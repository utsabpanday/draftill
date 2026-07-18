import { Schema, NodeSpec, MarkSpec } from 'prosemirror-model';

// Helper to define common block attributes for screenwriting
const commonAttrs = {
  revision: { default: 'none' },
  id: { default: '' },
  commentId: { default: '' },
  align: { default: 'left' },
  entityType: { default: '' },
  entityId: { default: '' }
};

const getAttrsDOM = (node: any) => {
  const attrs: Record<string, string> = {};
  if (node.attrs.revision && node.attrs.revision !== 'none') {
    attrs['data-revision'] = node.attrs.revision;
  }
  if (node.attrs.id) {
    attrs['id'] = node.attrs.id;
  }
  if (node.attrs.commentId) {
    attrs['data-comment-id'] = node.attrs.commentId;
  }
  if (node.attrs.align && node.attrs.align !== 'left') {
    attrs['style'] = `text-align: ${node.attrs.align}`;
  }
  if (node.attrs.entityType) attrs['data-entity-type'] = node.attrs.entityType;
  if (node.attrs.entityId) attrs['data-entity-id'] = node.attrs.entityId;
  return attrs;
};

const parseAttrsDOM = (dom: any) => {
  return {
    id: dom.id || '',
    revision: dom.getAttribute('data-revision') || 'none',
    commentId: dom.getAttribute('data-comment-id') || '',
    align: dom.style.textAlign || 'left',
    entityType: dom.getAttribute('data-entity-type') || '',
    entityId: dom.getAttribute('data-entity-id') || ''
  };
};

const getClasses = (base: string, node: any) => {
  let cls = base;
  if (node.attrs.revision && node.attrs.revision !== 'none') {
    cls += ` revised-${node.attrs.revision} relative after:content-['*'] after:absolute after:-right-4 after:text-amber-500 after:font-bold`;
  }
  if (node.attrs.commentId) {
    cls += ' bg-amber-500/10 border-l border-amber-500/50 pl-1';
  }
  return cls;
};

// Define the custom node types for screenwriting
const sceneHeading: NodeSpec = {
  attrs: commonAttrs,
  content: 'text*',
  group: 'block',
  parseDOM: [{ tag: 'h3', getAttrs: parseAttrsDOM }],
  toDOM: (node) => ['h3', { ...getAttrsDOM(node), class: getClasses('scene-heading uppercase font-bold mt-6 mb-2 tracking-wide font-courier', node) }, 0]
};

const action: NodeSpec = {
  attrs: commonAttrs,
  content: 'text*',
  group: 'block',
  parseDOM: [{ tag: 'p', getAttrs: parseAttrsDOM }],
  toDOM: (node) => ['p', { ...getAttrsDOM(node), class: getClasses('action mb-4 leading-normal font-courier', node) }, 0]
};

const character: NodeSpec = {
  attrs: commonAttrs,
  content: 'text*',
  group: 'block',
  parseDOM: [{ tag: 'h4', getAttrs: parseAttrsDOM }],
  toDOM: (node) => ['h4', { ...getAttrsDOM(node), class: getClasses('character uppercase ml-[120px] md:ml-[180px] mb-0 tracking-wide font-courier font-semibold', node) }, 0]
};

const dialogue: NodeSpec = {
  attrs: commonAttrs,
  content: 'text*',
  group: 'block',
  parseDOM: [{ tag: 'div.dialogue', getAttrs: parseAttrsDOM }],
  toDOM: (node) => ['div', { ...getAttrsDOM(node), class: getClasses('dialogue ml-[70px] mr-[50px] md:ml-[110px] md:mr-[90px] mb-4 font-courier leading-relaxed text-[15px]', node) }, 0]
};

const parenthetical: NodeSpec = {
  attrs: commonAttrs,
  content: 'text*',
  group: 'block',
  parseDOM: [{ tag: 'div.parenthetical', getAttrs: parseAttrsDOM }],
  toDOM: (node) => ['div', { ...getAttrsDOM(node), class: getClasses('parenthetical ml-[100px] md:ml-[145px] mb-0 italic font-courier text-[14px]', node) }, 0]
};

const transition: NodeSpec = {
  attrs: commonAttrs,
  content: 'text*',
  group: 'block',
  parseDOM: [{ tag: 'div.transition', getAttrs: parseAttrsDOM }],
  toDOM: (node) => ['div', { ...getAttrsDOM(node), class: getClasses('transition uppercase text-right mr-[50px] md:mr-[90px] mt-4 mb-4 font-courier', node) }, 0]
};

const shot: NodeSpec = {
  attrs: commonAttrs,
  content: 'text*',
  group: 'block',
  parseDOM: [{ tag: 'h5', getAttrs: parseAttrsDOM }],
  toDOM: (node) => ['h5', { ...getAttrsDOM(node), class: getClasses('shot uppercase mt-4 mb-2 font-courier font-semibold', node) }, 0]
};

// Table Nodes
const table: NodeSpec = {
  content: 'table_row+',
  group: 'block',
  parseDOM: [{ tag: 'table' }],
  toDOM: () => ['table', { class: 'border-collapse border border-gray-400 my-4 w-full table-fixed bg-transparent' }, ['tbody', 0]]
};

const table_row: NodeSpec = {
  content: 'table_cell+',
  parseDOM: [{ tag: 'tr' }],
  toDOM: () => ['tr', { class: 'border-b border-gray-400 bg-transparent' }, 0]
};

const table_cell: NodeSpec = {
  content: 'block+',
  parseDOM: [{ tag: 'td' }],
  toDOM: () => ['td', { class: 'border border-gray-400 p-2 min-w-[50px] align-top text-sm text-inherit bg-transparent' }, 0]
};

// Grid Nodes
const grid: NodeSpec = {
  content: 'grid_column+',
  group: 'block',
  parseDOM: [{ tag: 'div.grid-container' }],
  toDOM: () => ['div', { class: 'grid-container flex flex-row gap-4 w-full my-4 border border-dashed border-gray-400 p-2 rounded bg-transparent' }, 0]
};

const grid_column: NodeSpec = {
  content: 'block+',
  parseDOM: [{ tag: 'div.grid-column' }],
  toDOM: () => ['div', { class: 'grid-column flex-1 flex flex-col gap-2 p-2 border border-gray-400 rounded min-h-[50px] bg-transparent' }, 0]
};

// Page Node representing visual sheet of paper
const page: NodeSpec = {
  content: 'block+',
  parseDOM: [{ tag: 'div.page-sheet' }],
  toDOM: () => ['div', { class: 'page-sheet relative h-[1123px] w-[794px] overflow-hidden shadow-xl bg-white text-black border border-gray-200 dark:border-gray-700 rounded-md px-20 py-[76px] font-courier text-[16px] leading-[1.2]' }, 0]
};

// Dual Dialogue structures
const dualDialogueColumn: NodeSpec = {
  content: '(character | parenthetical | dialogue)+',
  toDOM: () => ['div', { class: 'dual-dialogue-column flex-1 flex flex-col gap-0.5' }, 0]
};

const dualDialogue: NodeSpec = {
  attrs: commonAttrs,
  content: 'dualDialogueColumn dualDialogueColumn',
  group: 'block',
  toDOM: (node) => ['div', { ...getAttrsDOM(node), class: getClasses('dual-dialogue flex flex-row gap-4 w-full my-4', node) }, 0]
};

// Standard text and doc nodes (doc contains multiple page nodes)
const doc: NodeSpec = {
  content: 'page+'
};

const text: NodeSpec = {
  group: 'inline'
};

const marks = {
  strong: {
    parseDOM: [{ tag: 'strong' }, { tag: 'b' }],
    toDOM: () => ['strong', 0]
  } as MarkSpec,
  em: {
    parseDOM: [{ tag: 'i' }, { tag: 'em' }],
    toDOM: () => ['em', 0]
  } as MarkSpec,
  underline: {
    parseDOM: [{ tag: 'u' }],
    toDOM: () => ['u', 0]
  } as MarkSpec,
  strike: {
    parseDOM: [{ tag: 's' }, { tag: 'del' }, { style: 'text-decoration=line-through' }],
    toDOM: () => ['s', 0]
  } as MarkSpec,
  textColor: {
    attrs: { color: { default: 'black' } },
    parseDOM: [{ style: 'color', getAttrs: (value: any) => ({ color: value }) }],
    toDOM: (mark) => ['span', { style: `color: ${mark.attrs.color}` }, 0]
  } as MarkSpec,
  textHighlight: {
    attrs: { color: { default: 'yellow' } },
    parseDOM: [{ style: 'background-color', getAttrs: (value: any) => ({ color: value }) }],
    toDOM: (mark) => ['span', { style: `background-color: ${mark.attrs.color}` }, 0]
  } as MarkSpec,
  fontFamily: {
    attrs: { family: { default: 'monospace' } },
    parseDOM: [{ style: 'font-family', getAttrs: (value: any) => ({ family: value }) }],
    toDOM: (mark) => ['span', { style: `font-family: ${mark.attrs.family}` }, 0]
  } as MarkSpec,
  fontSize: {
    attrs: { size: { default: '16px' } },
    parseDOM: [{ style: 'font-size', getAttrs: (value: any) => ({ size: value }) }],
    toDOM: (mark) => ['span', { style: `font-size: ${mark.attrs.size}` }, 0]
  } as MarkSpec,
  link: {
    attrs: {
      href: {},
      title: { default: null }
    },
    inclusive: false,
    parseDOM: [{
      tag: 'a[href]',
      getAttrs(dom: any) {
        return { href: dom.getAttribute('href'), title: dom.getAttribute('title') };
      }
    }],
    toDOM(mark) {
      return ['a', { href: mark.attrs.href, title: mark.attrs.title, class: 'text-[#F4C430] underline hover:underline cursor-pointer' }, 0];
    }
  } as MarkSpec
};

export const screenplaySchema = new Schema({
  nodes: {
    doc,
    text,
    sceneHeading,
    action,
    character,
    dialogue,
    parenthetical,
    transition,
    shot,
    page,
    table,
    table_row,
    table_cell,
    grid,
    grid_column,
    dualDialogueColumn,
    dualDialogue
  },
  marks
});
