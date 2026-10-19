import { ToolInputError } from './tools.js';

/**
 * One assistant turn: the model reads the conversation, may call tools
 * (validated and run by the server), reads their results and answers.
 * `emit(event)` reports what really happens, for the page to show:
 *   { type: 'status', step: 'analyse' | 'outil' | 'reponse', tool? }
 *   { type: 'delta', text }            streamed answer text
 *   { type: 'tool', name, ok, error? } a tool call and its outcome
 *   { type: 'action', action }         something to show (creation, proposal…)
 * Nothing is invented: no fixed delays, no fake reasoning text.
 */
const TOOL_LABELS = {
  generate_image: 'Lancement de la génération d’image',
  generate_video: 'Lancement de la génération vidéo',
  edit_image: 'Lancement de la retouche',
  get_creation: 'Vérification d’une création',
  list_creations: 'Lecture des créations récentes',
  search_music: 'Recherche dans la bibliothèque audio',
  get_project: 'Lecture du projet',
  propose_project_edit: 'Préparation d’une proposition de modification',
  open_in_editor: 'Préparation de l’ouverture dans l’éditeur',
  remember_preference: 'Proposition de mémorisation',
};

export async function runAgent({ llm, toolbox, system, messages, emit = () => {}, signal, stream = false, maxRounds = 5 }) {
  const convo = [{ role: 'system', content: system }, ...messages];
  const actions = [];
  const toolLog = [];
  let reply = '';
  let model = llm.model;
  emit({ type: 'status', step: 'analyse' });
  for (let round = 0; round < maxRounds; round += 1) {
    let text = '';
    const out = await llm.complete({
      messages: convo,
      tools: toolbox.definitions(),
      signal,
      onDelta: stream
        ? (delta) => {
            if (!text) emit({ type: 'status', step: 'reponse' });
            text += delta;
            emit({ type: 'delta', text: delta });
          }
        : undefined,
    });
    model = out.model || model;
    if (out.content) reply += (reply && !stream ? '\n\n' : '') + out.content;
    if (!out.toolCalls.length) return { reply: reply.trim(), actions, tools: toolLog, model };
    convo.push({ role: 'assistant', content: out.content || null, tool_calls: out.toolCalls });
    for (const call of out.toolCalls) {
      const name = call.function?.name;
      emit({ type: 'status', step: 'outil', tool: name, label: TOOL_LABELS[name] || name });
      let content;
      try {
        const { result, action } = await toolbox.run(name, call.function?.arguments);
        content = result;
        toolLog.push({ name, ok: true });
        emit({ type: 'tool', name, ok: true });
        if (action) {
          actions.push(action);
          emit({ type: 'action', action });
        }
      } catch (error) {
        // Validation and provider errors go back to the model so it can explain or correct itself.
        const message = error instanceof ToolInputError ? error.message : error.message || 'Erreur inconnue.';
        content = { error: message };
        toolLog.push({ name, ok: false, error: message });
        emit({ type: 'tool', name, ok: false, error: message });
      }
      convo.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(content) });
    }
    if (stream && reply) {
      reply += '\n\n';
      emit({ type: 'delta', text: '\n\n' });
    }
  }
  return { reply: reply.trim() || 'Les actions demandées ont été traitées ; leur état est affiché ci-dessous.', actions, tools: toolLog, model };
}
