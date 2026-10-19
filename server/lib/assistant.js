import { ProviderError, networkError, providerHttpError } from '../providers/base.js';
import { ASPECTS, RESOLUTIONS, QUALITY_TIERS } from '../../public/js/shared/imageSizes.js';
import { STYLES } from '../../public/js/shared/styles.js';
import { MUSIC_CATEGORIES, searchCatalog } from '../../public/js/shared/audioCatalog.js';
import { CAMERA_MOVES } from './prompt.js';

/**
 * SOLVEX AI conversational assistant. A real language model (OpenAI Chat
 * Completions, model named in OPENAI_CHAT_MODEL or OPENAI_TEXT_MODEL) reads the
 * conversation and may call SOLVEX tools: image generation, video generation
 * and the music library. Tool calls are executed for real; their results go
 * back to the model and to the page, which shows the live creations.
 */

const MAX_ROUNDS = 4;

function systemPrompt({ image, video }) {
  return `Tu es SOLVEX AI, l'assistant créatif de l'application SOLVEX (montage vidéo, retouche photo, génération d'images et de vidéos). Réponds toujours en français, de façon claire et concise.

Ce que tu sais faire :
- discuter, proposer des idées (vidéos pour les réseaux sociaux, concepts, scénarios, titres, musiques, transitions, effets) ;
- transformer une idée en description détaillée pour un générateur d'images ou de vidéos ;
- lancer une vraie génération avec les outils generate_image et generate_video ;
- chercher des musiques et sons dans la bibliothèque SOLVEX avec search_music ;
- préparer des instructions de montage étape par étape (l'utilisateur les applique dans l'éditeur ; tu ne modifies pas toi-même la timeline).

Règles :
- N'appelle generate_image ou generate_video que si l'utilisateur demande clairement de créer, générer ou refaire une image ou une vidéo. Pour une simple demande d'idées ou de prompt, réponds sans lancer de génération et propose de la lancer.
- S'il manque une information indispensable (sujet flou, image ou vidéo ?), pose une seule question courte avant de générer.
- Pour générer, écris une description riche et précise (sujet, cadrage, lumière, ambiance, couleurs), choisis un format adapté (par exemple 9:16 pour TikTok/Reels, 16:9 pour YouTube) et annonce les paramètres choisis.
- Quand l'utilisateur demande une variante (« plus froid », « autre angle »…), reprends la dernière description de l'historique et modifie-la.
- Ne prétends jamais qu'une génération est terminée : elle démarre, et son résultat s'affiche dans la conversation quand le service l'a produit.
- N'invente pas de fonctions que SOLVEX n'a pas.

Services disponibles maintenant : génération d'images ${image ? `oui (${image})` : 'non configurée'} ; génération de vidéos ${video ? `oui (${video})` : 'non configurée'}.`;
}

function tools() {
  return [
    {
      type: 'function',
      function: {
        name: 'generate_image',
        description: 'Lance une vraie génération d’image. À utiliser seulement quand l’utilisateur veut obtenir une image.',
        parameters: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'Description détaillée de l’image.' },
            aspect: { type: 'string', enum: ASPECTS.map((a) => a.id), description: 'Format.' },
            resolution: { type: 'string', enum: RESOLUTIONS.map((r) => r.id), description: 'Résolution (côté long : 512 px à 3840 px). 1080p par défaut.' },
            quality: { type: 'string', enum: QUALITY_TIERS.map((q) => q.id), description: 'Niveau de qualité. standard par défaut.' },
            style: { type: 'string', enum: Object.keys(STYLES), description: 'Style visuel.' },
          },
          required: ['prompt', 'aspect'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'generate_video',
        description: 'Lance une vraie génération de vidéo courte (quelques secondes). Seulement quand l’utilisateur veut obtenir une vidéo.',
        parameters: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'Description détaillée de la scène et du mouvement.' },
            aspect: { type: 'string', enum: ['16:9', '9:16'] },
            duration: { type: 'integer', enum: [4, 6, 8] },
            style: { type: 'string', enum: Object.keys(STYLES) },
            camera: { type: 'string', enum: Object.keys(CAMERA_MOVES) },
          },
          required: ['prompt', 'aspect'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_music',
        description: 'Cherche des musiques ou des sons dans la bibliothèque SOLVEX (titres libres de droits créés par SOLVEX).',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Ambiance ou mots-clés, par exemple « calme piano », « épique », « vlog joyeux ».' },
            category: { type: 'string', enum: MUSIC_CATEGORIES },
          },
          required: ['query'],
        },
      },
    },
  ];
}

export function assistantModel(config) {
  return config.openai.chatModel || config.openai.textModel || '';
}

export function isAssistantConfigured(config) {
  return Boolean(config.openai.apiKey && assistantModel(config));
}

/**
 * Runs one assistant turn. `run(name, args)` executes a tool and returns
 * { result, action } — `result` goes back to the model, `action` to the page.
 */
export async function chatTurn(config, { messages, services, run }, { fetchImpl = fetch, signal } = {}) {
  const { apiKey, baseUrl } = config.openai;
  const model = assistantModel(config);
  const convo = [{ role: 'system', content: systemPrompt(services) }, ...messages];
  const actions = [];
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    let response;
    try {
      response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: convo, tools: tools(), tool_choice: 'auto' }),
      });
    } catch (error) {
      throw networkError(error, 'OpenAI');
    }
    if (!response.ok) throw await providerHttpError(response, 'OpenAI');
    const body = await response.json();
    const message = body?.choices?.[0]?.message;
    if (!message) throw new ProviderError('Le modèle n’a renvoyé aucune réponse.', { code: 'empty_result' });
    const calls = message.tool_calls || [];
    if (!calls.length) {
      const reply = (message.content || '').trim();
      if (!reply && !actions.length) throw new ProviderError('Le modèle n’a renvoyé aucune réponse.', { code: 'empty_result' });
      return { reply, actions, model: body.model || model };
    }
    convo.push({ role: 'assistant', content: message.content || null, tool_calls: calls });
    for (const call of calls) {
      let args = {};
      try {
        args = JSON.parse(call.function?.arguments || '{}');
      } catch {
        args = {};
      }
      let result;
      try {
        const out = await run(call.function?.name, args);
        result = out.result;
        if (out.action) actions.push(out.action);
      } catch (error) {
        result = { error: error.message };
        actions.push({ type: 'error', tool: call.function?.name, message: error.message });
      }
      convo.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  return { reply: 'J’ai lancé les actions demandées ; voici leur état ci-dessous.', actions, model };
}

export { searchCatalog };
