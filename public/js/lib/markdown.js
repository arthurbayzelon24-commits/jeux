/**
 * Small, safe Markdown reader for assistant answers: paragraphs, headings,
 * bullet and numbered lists, quotes, fenced code, inline code, bold, italic
 * and http(s) links. `parseMarkdown` returns plain data (tested in Node);
 * `renderMarkdown` builds DOM nodes with textContent only — model text is
 * never inserted as HTML.
 */

const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*|__[^_\n]+__)|(\*[^*\s][^*\n]*\*|_[^_\s][^_\n]*_)|(\[[^\]\n]+\]\((https?:\/\/[^\s)]+)\))|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"»])/g;

export function parseInline(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index) });
    const [all] = m;
    if (m[1]) out.push({ type: 'code', text: all.slice(1, -1) });
    else if (m[2]) out.push({ type: 'strong', text: all.slice(2, -2) });
    else if (m[3]) out.push({ type: 'em', text: all.slice(1, -1) });
    else if (m[4]) out.push({ type: 'link', text: all.slice(1, all.indexOf('](')), href: m[5] });
    else out.push({ type: 'link', text: all, href: all });
    last = m.index + all.length;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  return out;
}

export function parseMarkdown(source) {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let para = [];
  const flush = () => {
    if (para.length) blocks.push({ type: 'paragraph', inlines: parseInline(para.join('\n')) });
    para = [];
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const fence = /^\s*```\s*([\w+-]*)\s*$/.exec(line);
    if (fence) {
      flush();
      const code = [];
      i += 1;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) code.push(lines[i++]);
      blocks.push({ type: 'code', lang: fence[1] || '', text: code.join('\n') }); // an unclosed fence (still streaming) runs to the end
      continue;
    }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: 'heading', level: heading[1].length, inlines: parseInline(heading[2].trim()) });
      continue;
    }
    const item = /^\s*(?:([-*•])|(\d{1,3})[.)])\s+(.*)$/.exec(line);
    if (item) {
      flush();
      const ordered = Boolean(item[2]);
      const prev = blocks.at(-1);
      const list = prev?.type === 'list' && prev.ordered === ordered && prev.open ? prev : null;
      const target = list || { type: 'list', ordered, start: ordered ? Number(item[2]) : 1, items: [], open: true };
      target.items.push(parseInline(item[3]));
      if (!list) blocks.push(target);
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flush();
      const prev = blocks.at(-1);
      if (prev?.type === 'quote') prev.lines.push(quote[1]);
      else blocks.push({ type: 'quote', lines: [quote[1]] });
      continue;
    }
    if (!line.trim()) {
      flush();
      const prev = blocks.at(-1);
      if (prev?.type === 'list' && !/^\s*(?:[-*•]|\d{1,3}[.)])\s+/.test(lines[i + 1] ?? '')) prev.open = false;
      continue;
    }
    // A plain line right after a list item continues that item.
    const prev = blocks.at(-1);
    if (!para.length && prev?.type === 'list' && prev.open && /^\s+\S/.test(line)) {
      prev.items[prev.items.length - 1].push({ type: 'text', text: ' ' }, ...parseInline(line.trim()));
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks.map((b) => {
    if (b.type === 'list') delete b.open;
    if (b.type === 'quote') return { type: 'quote', inlines: parseInline(b.lines.join('\n')) };
    return b;
  });
}

function inlineNodes(doc, inlines) {
  return inlines.map((part) => {
    if (part.type === 'text') return doc.createTextNode(part.text);
    const tag = { code: 'code', strong: 'strong', em: 'em', link: 'a' }[part.type];
    const el = doc.createElement(tag);
    el.textContent = part.text;
    if (part.type === 'link') {
      el.href = part.href;
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
    }
    return el;
  });
}

export function renderMarkdown(source, doc = document) {
  const fragment = doc.createDocumentFragment();
  for (const block of parseMarkdown(source)) {
    let el;
    if (block.type === 'code') {
      el = doc.createElement('pre');
      const code = doc.createElement('code');
      code.textContent = block.text;
      if (block.lang) el.dataset.lang = block.lang;
      el.append(code);
    } else if (block.type === 'list') {
      el = doc.createElement(block.ordered ? 'ol' : 'ul');
      if (block.ordered && block.start !== 1) el.start = block.start;
      for (const item of block.items) {
        const li = doc.createElement('li');
        li.append(...inlineNodes(doc, item));
        el.append(li);
      }
    } else {
      el = doc.createElement(block.type === 'heading' ? `h${block.level + 2}` : block.type === 'quote' ? 'blockquote' : 'p');
      el.append(...inlineNodes(doc, block.inlines));
    }
    fragment.append(el);
  }
  return fragment;
}
