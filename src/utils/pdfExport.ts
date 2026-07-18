type EditorNode = {
  type?: string;
  content?: EditorNode[];
  text?: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character] || character));
}

function nodeText(node: EditorNode): string {
  if (typeof node.text === 'string') return node.text;
  return (node.content || []).map(nodeText).join('');
}

function renderChildren(node: EditorNode) {
  return (node.content || []).map(renderNode).join('');
}

function renderNode(node: EditorNode): string {
  const type = node.type || '';
  if (type === 'text') return escapeHtml(node.text || '');
  if (type === 'page' || type === 'doc') return renderChildren(node);
  if (type === 'table') return `<table class="editor-table"><tbody>${renderChildren(node)}</tbody></table>`;
  if (type === 'table_row') return `<tr>${renderChildren(node)}</tr>`;
  if (type === 'table_cell') return `<td>${renderChildren(node) || '&nbsp;'}</td>`;
  if (type === 'grid') return `<div class="editor-grid">${renderChildren(node)}</div>`;
  if (type === 'grid_column') return `<div class="editor-grid-column">${renderChildren(node) || '&nbsp;'}</div>`;
  if (type === 'dualDialogue') return `<div class="dual-dialogue">${renderChildren(node)}</div>`;
  if (type === 'dualDialogueColumn') return `<div class="dual-dialogue-column">${renderChildren(node)}</div>`;

  const text = escapeHtml(nodeText(node));
  if (type === 'sceneHeading') return `<h3>${text}</h3>`;
  if (type === 'character') return `<h4>${text}</h4>`;
  if (type === 'dialogue') return `<p class="dialogue">${text}</p>`;
  if (type === 'parenthetical') return `<p class="parenthetical">${text}</p>`;
  if (type === 'transition') return `<p class="transition">${text}</p>`;
  if (type === 'shot') return `<p class="shot">${text}</p>`;
  return `<p>${text || '&nbsp;'}</p>`;
}

export function buildScreenplayPdfHtml(scriptContent: EditorNode, title = 'Screenplay') {
  const body = renderNode(scriptContent);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page { size: Letter; margin: 0.75in 0.8in; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #111; background: #fff; font-family: 'Courier New', Courier, monospace; font-size: 12pt; line-height: 1.25; }
    h3 { margin: 24pt 0 6pt; font-size: 12pt; text-transform: uppercase; break-after: avoid; }
    h4 { margin: 14pt 0 0 2.2in; font-size: 12pt; text-transform: uppercase; break-after: avoid; }
    p { margin: 0 0 12pt; white-space: pre-wrap; overflow-wrap: anywhere; }
    .dialogue { margin-left: 1.4in; margin-right: 1in; }
    .parenthetical { margin-left: 1.8in; font-style: italic; }
    .transition { text-align: right; text-transform: uppercase; }
    .shot { margin-top: 18pt; font-weight: bold; text-transform: uppercase; }
    .editor-table { width: 100%; margin: 12pt 0; border-collapse: collapse; table-layout: fixed; break-inside: avoid; background: transparent; }
    .editor-table tr, .editor-table td { background: transparent; }
    .editor-table td { min-width: 42pt; padding: 7pt; border: 0.8pt solid #555; vertical-align: top; }
    .editor-table td > :first-child, .editor-grid-column > :first-child { margin-top: 0; }
    .editor-table td > :last-child, .editor-grid-column > :last-child { margin-bottom: 0; }
    .editor-grid { display: flex; width: 100%; gap: 10pt; margin: 12pt 0; padding: 7pt; border: 0.8pt dashed #666; break-inside: avoid; background: transparent; }
    .editor-grid-column { flex: 1 1 0; min-width: 0; min-height: 42pt; padding: 7pt; border: 0.8pt solid #666; background: transparent; }
    .dual-dialogue { display: flex; gap: 18pt; width: 100%; break-inside: avoid; }
    .dual-dialogue-column { flex: 1 1 0; min-width: 0; }
  </style></head><body>${body}</body></html>`;
}
