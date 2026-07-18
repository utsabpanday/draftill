import { setBlockType } from 'prosemirror-commands';
import { screenplaySchema } from './schema';
import { EditorState } from 'prosemirror-state';

// Helper to check current node type
function getCurrentNodeType(state: EditorState) {
  const { $from } = state.selection;
  // Climb up to the parent block node
  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d);
    if (node.type.name in screenplaySchema.nodes) {
      return node.type;
    }
  }
  return null;
}

// Command to cycle element type on Tab
export const cycleElementType = (state: EditorState, dispatch?: (tr: any) => void): boolean => {
  const type = getCurrentNodeType(state);
  if (!type) return false;

  const cycleOrder = [
    screenplaySchema.nodes.sceneHeading,
    screenplaySchema.nodes.action,
    screenplaySchema.nodes.character,
    screenplaySchema.nodes.parenthetical,
    screenplaySchema.nodes.dialogue,
    screenplaySchema.nodes.transition,
    screenplaySchema.nodes.shot,
  ];

  const currentIndex = cycleOrder.indexOf(type);
  if (currentIndex === -1) return false;

  const nextIndex = (currentIndex + 1) % cycleOrder.length;
  const nextType = cycleOrder[nextIndex];

  if (dispatch) {
    dispatch(state.tr.setBlockType(state.selection.from, state.selection.to, nextType));
  }
  return true;
};

// Command for Enter key smart logic
export const smartEnter = (state: EditorState, dispatch?: (tr: any) => void): boolean => {
  const { $from, empty } = state.selection;
  if (!empty) return false;

  const type = getCurrentNodeType(state);
  if (!type) return false;

  const parent = $from.parent;
  const textContent = parent.textContent.trim();

  // If node is empty, cycle it back to action or standard block instead of inserting new line
  if (textContent === '') {
    if (type !== screenplaySchema.nodes.action) {
      if (dispatch) {
        dispatch(state.tr.setBlockType(state.selection.from, state.selection.to, screenplaySchema.nodes.action));
      }
      return true;
    }
  }

  // Determine next element type based on standard Final Draft rules
  let nextType = screenplaySchema.nodes.action;
  
  if (type === screenplaySchema.nodes.sceneHeading) {
    nextType = screenplaySchema.nodes.action;
  } else if (type === screenplaySchema.nodes.action) {
    // If action starts with INT or EXT, make it sceneheading
    if (/^(INT\.|EXT\.|INT\/EXT\.|EST\.)/i.test(textContent)) {
      if (dispatch) {
        dispatch(state.tr.setBlockType(state.selection.from, state.selection.to, screenplaySchema.nodes.sceneHeading));
      }
      return true;
    }
    nextType = screenplaySchema.nodes.action;
  } else if (type === screenplaySchema.nodes.character) {
    // Character is followed by Dialogue (or Parenthetical if they typed '(')
    if (textContent.startsWith('(')) {
      nextType = screenplaySchema.nodes.parenthetical;
    } else {
      nextType = screenplaySchema.nodes.dialogue;
    }
  } else if (type === screenplaySchema.nodes.parenthetical) {
    nextType = screenplaySchema.nodes.dialogue;
  } else if (type === screenplaySchema.nodes.dialogue) {
    // Dialogue is followed by Character (conversational)
    nextType = screenplaySchema.nodes.character;
  } else if (type === screenplaySchema.nodes.transition) {
    nextType = screenplaySchema.nodes.sceneHeading;
  } else if (type === screenplaySchema.nodes.shot) {
    nextType = screenplaySchema.nodes.action;
  }

  if (dispatch) {
    const tr = state.tr;
    tr.split($from.pos);
    const newPos = tr.mapping.map($from.pos);
    dispatch(tr.setBlockType(newPos, newPos, nextType).scrollIntoView());
  }
  return true;
};

// Create a custom keymap plugin builder
export function buildScreenplayKeymap(customShortcuts: { action: string; key: string }[] = []) {
  const map: Record<string, any> = {
    'Tab': cycleElementType,
    'Enter': smartEnter,
  };

  // Map keyboard shortcuts dynamically
  customShortcuts.forEach((sc) => {
    let typeName = '';
    if (sc.action === 'Scene Heading') typeName = 'sceneHeading';
    else if (sc.action === 'Action') typeName = 'action';
    else if (sc.action === 'Character') typeName = 'character';
    else if (sc.action === 'Dialogue') typeName = 'dialogue';
    else if (sc.action === 'Parenthetical') typeName = 'parenthetical';
    else if (sc.action === 'Transition') typeName = 'transition';
    else if (sc.action === 'Shot') typeName = 'shot';

    if (typeName) {
      const nodeType = screenplaySchema.nodes[typeName];
      map[sc.key] = setBlockType(nodeType);
    }
  });

  return map;
}
