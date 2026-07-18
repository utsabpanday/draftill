import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { EditorState, Selection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { screenplaySchema } from './schema';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, toggleMark, setBlockType } from 'prosemirror-commands';
import { history, undo, redo } from 'prosemirror-history';
import { CharacterRecord, LocationRecord, useAppStore } from '../store/store';
import { buildScreenplayKeymap } from './keymap';
import { 
  Bold, Italic, Underline, Strikethrough, Link,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Columns, Table, Trash2, Minus, Type, Palette, Sparkles, FileText, MessageSquare, ChevronDown
} from 'lucide-react';

import 'prosemirror-view/style/prosemirror.css';

// NodeView representing editable visual page sheets
class PageView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  node: any;

  constructor(node: any, view: EditorView, getPos: () => number) {
    this.node = node;
    this.dom = document.createElement('div');
    this.dom.className = 'page-container relative group mb-12 flex justify-center w-full';

    // Create the page sheet content wrapper
    const sheet = document.createElement('div');
    sheet.className = 'page-sheet relative h-[1123px] w-[794px] overflow-hidden shadow-2xl bg-white text-black border border-gray-300 dark:border-gray-700 rounded-md px-20 py-[76px] font-courier text-[16px] leading-[1.2] flex flex-col justify-start transition-colors duration-150';
    
    // Apply background color from store
    const pageBg = useAppStore.getState().pageBgColor;
    sheet.style.backgroundColor = pageBg;
    if (pageBg === '#2d3748' || pageBg === '#1a202c') {
      sheet.classList.add('text-white');
      sheet.classList.remove('text-black');
    } else {
      sheet.classList.add('text-black');
      sheet.classList.remove('text-white');
    }

    this.dom.appendChild(sheet);
    this.contentDOM = sheet;

    // Create floating page manager toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'font-inter absolute left-1/2 -translate-x-1/2 -bottom-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-[#1a1a1a] p-1 rounded-md shadow-md border border-gray-200 dark:border-gray-700 z-10';

    // Delete Page button
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.type = 'button';
    deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m9 15 6-6"/><path d="m15 15-6-6"/></svg>';
    deleteBtn.title = 'Remove page';
    deleteBtn.setAttribute('aria-label', 'Remove page');
    deleteBtn.className = 'inline-flex h-7 w-7 items-center justify-center rounded text-red-400 hover:bg-red-500/15 hover:text-red-300 cursor-pointer focus:outline-none';
    deleteBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const pos = getPos();
      if (view.state.doc.childCount === 1) {
        // The screenplay schema requires one page, so the final page is cleared.
        const emptyBlock = screenplaySchema.nodes.action.createAndFill();
        if (emptyBlock) view.dispatch(view.state.tr.replaceWith(pos + 1, pos + this.node.nodeSize - 1, emptyBlock).scrollIntoView());
        return;
      }
      view.dispatch(view.state.tr.delete(pos, pos + this.node.nodeSize).scrollIntoView());
    };
    toolbar.appendChild(deleteBtn);

    // Add Page Below button
    const addBtn = document.createElement('button');
    addBtn.innerHTML = '➕';
    addBtn.title = 'Add Page Below';
    addBtn.className = 'px-2 py-1 hover:bg-green-500/10 text-green-500 rounded text-xs cursor-pointer focus:outline-none';
    addBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const pos = getPos();
      const insertPos = pos + this.node.nodeSize;
      const emptyPage = screenplaySchema.nodes.page.createAndFill() || screenplaySchema.nodes.page.create(null, screenplaySchema.nodes.action.createAndFill());
      const tr = view.state.tr.insert(insertPos, emptyPage);
      view.dispatch(tr);
    };
    toolbar.appendChild(addBtn);

    this.dom.appendChild(toolbar);
  }

  update(node: any) {
    if (node.type.name !== 'page') return false;
    this.node = node;
    return true;
  }

  // Pages are structural containers, not selectable content blocks. Suppress ProseMirror's node outline.
  selectNode() {
    this.dom.classList.remove('ProseMirror-selectednode');
    this.dom.style.outline = 'none';
  }

  deselectNode() {
    this.dom.classList.remove('ProseMirror-selectednode');
    this.dom.style.outline = 'none';
  }
}

type ToolbarOption = { value: string; label: string; group?: string };
type EntityHover = { type: 'character' | 'location'; id: string; left: number; top: number };

function normalizeLinkUrl(value: string) {
  const raw = value.trim();
  if (!raw) return null;
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

function ToolbarSelect({ value, options, onChange, title, className = '', searchable = false }: { value: string; options: ToolbarOption[]; onChange: (value: string) => void; title: string; className?: string; searchable?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) || options[0];
  const visibleOptions = searchable ? options.filter((option) => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) : options;

  useEffect(() => {
    const closeOnOutsidePress = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsidePress);
    return () => document.removeEventListener('mousedown', closeOnOutsidePress);
  }, []);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        title={title}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setIsOpen((current) => !current)}
        className={`flex h-7 w-full items-center justify-between gap-2 rounded-md border px-2 text-left text-[11px] font-semibold transition-colors ${isOpen ? 'border-[#F4C430] bg-[#303030] text-white shadow-[0_0_0_1px_rgba(244,196,48,0.16)]' : 'border-gray-200 bg-gray-100 text-gray-800 hover:bg-gray-200 dark:border-[#3a3a3a] dark:bg-[#252525] dark:text-gray-100 dark:hover:bg-[#303030]'}`}
        aria-expanded={isOpen}
      >
        <span className="min-w-0 truncate">{selected.label}</span>
        <ChevronDown size={13} className={`shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180 text-[#F4C430]' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 min-w-full overflow-hidden rounded-md border border-[#454545] bg-[#232323] py-1 shadow-2xl ring-1 ring-black/40">
          {searchable && <div className="border-b border-[#3a3a3a] p-1.5"><input autoFocus value={query} onMouseDown={(event) => event.stopPropagation()} onChange={(event) => setQuery(event.target.value)} placeholder="Search fonts…" className="w-full rounded border border-[#414141] bg-[#171717] px-2 py-1.5 text-[11px] text-white outline-none placeholder:text-gray-600 focus:border-[#F4C430]" /></div>}
          <div className={searchable ? 'max-h-64 overflow-y-auto py-1' : ''}>
          {visibleOptions.length === 0 && <p className="px-3 py-3 text-[11px] text-gray-500">No fonts found.</p>}
          {visibleOptions.map((option, index) => {
            const active = option.value === value;
            const showGroup = option.group && (index === 0 || option.group !== visibleOptions[index - 1].group);
            return <div key={option.value}>{showGroup && <p className="px-2.5 pb-1 pt-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">{option.group}</p>}<button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(option.value); setIsOpen(false); setQuery(''); }} className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] transition-colors ${active ? 'bg-[#F4C430]/15 text-[#F4C430]' : 'text-gray-200 hover:bg-white/8 hover:text-white'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-[#F4C430]' : 'bg-transparent'}`} />
              <span className="whitespace-nowrap">{option.label}</span>
            </button></div>;
          })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScriptEditor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const { 
    scriptContent, setScriptContent, 
    currentFilePath,
    activeProjectId,
    shortcuts,
    wordGoal, pageGoal,
    setActiveNodeIdx,
    setActiveEditorView,
    isDarkMode,
    pageBgColor,
    setPageBgColor,
    screenplayFontFamily,
    setScreenplayFontFamily,
    characters,
    locations,
    addComment,
    showAlertDialog
  } = useAppStore();

  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionType, setMentionType] = useState<'@' | '#'>('@');
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPopupCoords, setMentionPopupCoords] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  const [selectionToolbar, setSelectionToolbar] = useState<{ left: number; top: number } | null>(null);
  const [commentComposer, setCommentComposer] = useState<{ left: number; top: number; nodeIndex: number; selectionText: string } | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [deviceFonts, setDeviceFonts] = useState<string[]>([]);
  const [linkDialog, setLinkDialog] = useState<{ from: number; to: number } | null>(null);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [linkError, setLinkError] = useState('');
  const [entityHover, setEntityHover] = useState<EntityHover | null>(null);
  const charactersRef = useRef<CharacterRecord[]>(characters);
  const locationsRef = useRef<LocationRecord[]>(locations);
  charactersRef.current = characters;
  locationsRef.current = locations;

  const syncEntityReferences = useCallback((view: EditorView | null) => {
    if (!view || !editorRef.current) return;
    editorRef.current.querySelectorAll<HTMLElement>('.character, .scene-heading').forEach((element) => {
      const type = element.classList.contains('character') ? 'character' : 'location';
      const rawText = (element.textContent || '').trim().toUpperCase();
      const normalizedText = type === 'character' ? rawText.replace(/\s*\([^)]*\)\s*$/, '').trim() : rawText;
      const existingId = element.dataset.entityId || '';
      const entity = type === 'character'
        ? charactersRef.current.find((item) => item.id === existingId) || charactersRef.current.find((item) => item.name.trim().toUpperCase() === normalizedText)
        : locationsRef.current.find((item) => item.id === existingId) || locationsRef.current.find((item) => item.heading.trim().toUpperCase() === normalizedText);
      element.classList.toggle('draftill-entity-reference', Boolean(entity));
      element.classList.toggle('draftill-character-reference', Boolean(entity) && type === 'character');
      element.classList.toggle('draftill-location-reference', Boolean(entity) && type === 'location');
      if (entity) {
        element.dataset.entityType = type;
        element.dataset.entityId = entity.id;
        element.dataset.draftillEntity = 'true';
      } else {
        delete element.dataset.entityType;
        delete element.dataset.entityId;
        delete element.dataset.draftillEntity;
      }
    });
  }, []);

  const showEntityHover = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = (event.target as Element).closest<HTMLElement>('[data-draftill-entity="true"]');
    if (!target || !editorRef.current) return;
    const type = target.dataset.entityType === 'location' ? 'location' : 'character';
    const id = target.dataset.entityId;
    if (!id) return;
    const rect = target.getBoundingClientRect();
    const container = editorRef.current.getBoundingClientRect();
    setEntityHover({ type, id, left: Math.max(8, Math.min(rect.left - container.left, container.width - 278)), top: rect.bottom - container.top + 7 });
  };

  const hideEntityHover = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = (event.target as Element).closest<HTMLElement>('[data-draftill-entity="true"]');
    if (target && event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
    setEntityHover(null);
  };

  useEffect(() => {
    window.ipcRenderer?.invoke('fonts:listSystem').then((fonts) => {
      if (Array.isArray(fonts)) setDeviceFonts(fonts.filter((font): font is string => typeof font === 'string'));
    }).catch(() => setDeviceFonts([]));
  }, []);

  useEffect(() => {
    syncEntityReferences(viewRef.current);
  }, [characters, locations, syncEntityReferences]);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim() || !editorRef.current) {
      setSelectionToolbar(null);
      return;
    }
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    const container = editorRef.current.getBoundingClientRect();
    setSelectionToolbar({ left: rect.left - container.left + rect.width / 2 - 74, top: Math.max(4, rect.top - container.top - 38) });
  };

  const handleAskSelection = () => {
    const selectedText = window.getSelection()?.toString().trim();
    if (!selectedText || !viewRef.current) return;
    let nodeIndex = 0;
    const selectionPos = viewRef.current.state.selection.$from.pos;
    viewRef.current.state.doc.forEach((child, offset, index) => {
      if (offset <= selectionPos && offset + child.nodeSize >= selectionPos) nodeIndex = index;
    });
    window.dispatchEvent(new CustomEvent('draftill:ask-ai', { detail: { nodeIndex, selectionText: selectedText } }));
    setSelectionToolbar(null);
  };

  const handleAddSelectionComment = () => {
    const selectedText = window.getSelection()?.toString().trim();
    if (!selectedText || !viewRef.current || !selectionToolbar) return;
    let nodeIndex = 0;
    const selectionPos = viewRef.current.state.selection.$from.pos;
    viewRef.current.state.doc.forEach((child, offset, index) => {
      if (offset <= selectionPos && offset + child.nodeSize >= selectionPos) nodeIndex = index;
    });
    const maxLeft = Math.max(12, (editorRef.current?.clientWidth || 300) - 272);
    setCommentComposer({ left: Math.max(12, Math.min(selectionToolbar.left, maxLeft)), top: selectionToolbar.top + 36, nodeIndex, selectionText: selectedText });
    setCommentDraft('');
    setSelectionToolbar(null);
  };

  const submitSelectionComment = () => {
    if (!commentComposer || !commentDraft.trim()) return;
    addComment(commentComposer.nodeIndex, commentDraft.trim(), 'Author', commentComposer.selectionText);
    setCommentDraft('');
    setCommentComposer(null);
  };

  const showMentionPopupRef = useRef(showMentionPopup);
  showMentionPopupRef.current = showMentionPopup;

  const mentionActiveIndexRef = useRef(mentionActiveIndex);
  mentionActiveIndexRef.current = mentionActiveIndex;

  // Extract scene headings from the document for # mentions
  const sceneHeadings: { id: string; text: string }[] = [];
  if (scriptContent && scriptContent.content) {
    scriptContent.content.forEach((node: any, idx: number) => {
      if (node.type === 'sceneHeading' && node.content && node.content[0]?.text) {
        sceneHeadings.push({ id: `scene-${idx}`, text: node.content[0].text });
      }
    });
  }

  const filteredChars = characters.filter((c: any) => 
    c.name.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  const filteredScenes = sceneHeadings.filter((s) =>
    s.text.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  const filteredMentionItems = mentionType === '@' ? filteredChars : filteredScenes;
  
  const filteredMentionCountRef = useRef(filteredMentionItems.length);
  filteredMentionCountRef.current = filteredMentionItems.length;

  const handleSelectMention = (text: string) => {
    if (!viewRef.current) return;
    const view = viewRef.current;
    const { state } = view;
    const { $from } = state.selection;
    const lookback = Math.min($from.parentOffset, 40);
    const textBefore = $from.parent.textBetween(Math.max(0, $from.parentOffset - lookback), $from.parentOffset, null, null);
    const trigger = mentionType;
    const regex = trigger === '@' ? /@([\w\s]*)$/ : /#([\w\s.]*)$/;
    const match = textBefore.match(regex);
    if (match) {
      const queryStart = $from.pos - match[0].length;
      const queryEnd = $from.pos;
      const formatted = trigger === '@' ? text.toUpperCase() : text;
      const tr = state.tr.replaceWith(queryStart, queryEnd, screenplaySchema.text(trigger + formatted + " "));
      view.dispatch(tr);
    }
    setShowMentionPopup(false);
    view.focus();
  };

  const triggerMentionSelectRef = useRef(() => {});
  triggerMentionSelectRef.current = () => {
    if (filteredMentionItems.length > 0 && mentionActiveIndex < filteredMentionItems.length) {
      const item = filteredMentionItems[mentionActiveIndex];
      handleSelectMention('name' in item ? (item as any).name : (item as any).text);
    } else if (mentionQuery.trim()) {
      handleSelectMention(mentionQuery.trim());
    }
  };

  const handleToggleLink = () => {
    if (!viewRef.current) return;
    const view = viewRef.current;
    const { state } = view;
    const { from, to, empty } = state.selection;
    if (empty) {
      showAlertDialog('Add Link', 'Please select some text first to link it.');
      return;
    }

    if (state.doc.rangeHasMark(from, to, screenplaySchema.marks.link)) {
      view.dispatch(state.tr.removeMark(from, to, screenplaySchema.marks.link).scrollIntoView());
      view.focus();
      return;
    }

    setLinkUrl('https://');
    setLinkError('');
    setLinkDialog({ from, to });
  };

  const submitLink = () => {
    if (!linkDialog || !viewRef.current) return;
    const href = normalizeLinkUrl(linkUrl);
    if (!href) {
      setLinkError('Enter a valid http(s) URL or email address.');
      return;
    }
    const view = viewRef.current;
    view.dispatch(view.state.tr.addMark(linkDialog.from, linkDialog.to, screenplaySchema.marks.link.create({ href, title: href })).scrollIntoView());
    view.focus();
    setLinkDialog(null);
    setLinkError('');
  };

  // Find parent node utility for ProseMirror node hierarchies
  const findParentNode = (predicate: (node: any) => boolean) => {
    return (state: EditorState) => {
      const { $from } = state.selection;
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        if (predicate(node)) {
          return {
            pos: $from.before(d),
            start: $from.start(d),
            depth: d,
            node
          };
        }
      }
      return null;
    };
  };

  // Commands
  const runCommand = (command: (state: EditorState, dispatch: any) => boolean) => {
    if (!viewRef.current) return;
    viewRef.current.focus();
    command(viewRef.current.state, viewRef.current.dispatch);
  };

  // Active Mark checking
  const isMarkActive = (markType: any) => {
    if (!editorState) return false;
    const { from, $from, to, empty } = editorState.selection;
    if (empty) return !!markType.isInSet(editorState.storedMarks || $from.marks());
    return editorState.doc.rangeHasMark(from, to, markType);
  };

  // Get active mark attribute
  const getActiveMarkAttr = (markType: any, attrName: string) => {
    if (!editorState) return '';
    const { from, to, empty } = editorState.selection;
    if (empty) {
      const marks = editorState.storedMarks || editorState.selection.$from.marks();
      const mark = marks.find(m => m.type === markType);
      return mark ? mark.attrs[attrName] : '';
    }
    let attrValue = '';
    editorState.doc.nodesBetween(from, to, (node) => {
      const mark = node.marks.find(m => m.type === markType);
      if (mark) {
        attrValue = mark.attrs[attrName];
      }
    });
    return attrValue;
  };

  // Get active block type
  const getActiveBlockType = () => {
    if (!editorState) return 'action';
    const { $from } = editorState.selection;
    for (let d = $from.depth; d >= 0; d--) {
      const node = $from.node(d);
      if (node && node.type.name in screenplaySchema.nodes && node.type.name !== 'doc' && node.type.name !== 'table_row' && node.type.name !== 'table' && node.type.name !== 'grid' && node.type.name !== 'grid_column' && node.type.name !== 'page') {
        return node.type.name;
      }
    }
    return 'action';
  };

  // Check if inside table cell
  const isInsideTableCell = () => {
    if (!editorState) return false;
    const cell = findParentNode(n => n.type.name === 'table_cell')(editorState);
    return !!cell;
  };

  // Text Alignment Command
  const setAlignment = (align: 'left' | 'center' | 'right' | 'justify') => {
    return (state: EditorState, dispatch: any) => {
      const { from, to } = state.selection;
      const tr = state.tr;
      let modified = false;
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (node.isBlock && node.type.name !== 'table_row' && node.type.name !== 'table' && node.type.name !== 'grid' && node.type.name !== 'page') {
          tr.setNodeMarkup(pos, null, {
            ...node.attrs,
            align
          });
          modified = true;
        }
      });
      if (modified) {
        if (dispatch) dispatch(tr);
        return true;
      }
      return false;
    };
  };

  // Text Color Command
  const setTextColor = (color: string) => {
    return (state: EditorState, dispatch: any) => {
      const { textColor } = state.schema.marks;
      if (!textColor) return false;
      const { from, to, empty } = state.selection;
      if (empty) return false;
      if (dispatch) {
        const tr = state.tr;
        if (color === 'clear' || !color) {
          tr.removeMark(from, to, textColor);
        } else {
          tr.addMark(from, to, textColor.create({ color }));
        }
        dispatch(tr);
      }
      return true;
    };
  };

  // Text Highlight Color Command
  const setTextHighlight = (color: string) => {
    return (state: EditorState, dispatch: any) => {
      const { textHighlight } = state.schema.marks;
      if (!textHighlight) return false;
      const { from, to, empty } = state.selection;
      if (empty) return false;
      if (dispatch) {
        const tr = state.tr;
        if (color === 'clear' || !color) {
          tr.removeMark(from, to, textHighlight);
        } else {
          tr.addMark(from, to, textHighlight.create({ color }));
        }
        dispatch(tr);
      }
      return true;
    };
  };

  // Font family is a screenplay-level setting. Remove legacy range-specific marks
  // so existing text and everything typed afterward share one font.
  const handleScreenplayFontFamily = (family: string) => {
    const view = viewRef.current;
    if (!view) return;
    const { fontFamily } = view.state.schema.marks;
    const tr = view.state.tr.removeMark(0, view.state.doc.content.size, fontFamily);
    const activeMarks = view.state.storedMarks || view.state.selection.$from.marks();
    tr.setStoredMarks(activeMarks.filter((mark) => mark.type !== fontFamily));
    view.dispatch(tr);
    setScreenplayFontFamily(family);
    view.focus();
  };

  // Font Size Command
  const setFontSize = (size: string) => {
    return (state: EditorState, dispatch: any) => {
      const { fontSize } = state.schema.marks;
      if (!fontSize) return false;
      const { from, to, empty } = state.selection;
      if (empty) return false;
      if (dispatch) {
        const tr = state.tr;
        if (size === 'clear') {
          tr.removeMark(from, to, fontSize);
        } else {
          tr.addMark(from, to, fontSize.create({ size }));
        }
        dispatch(tr);
      }
      return true;
    };
  };

  // Grid Insertion Command
  const insertGrid = (cols = 2) => {
    return (state: EditorState, dispatch: any) => {
      const { schema } = state;
      const colNodes = [];
      for (let c = 0; c < cols; c++) {
        colNodes.push(
          schema.nodes.grid_column.createAndFill() || schema.nodes.grid_column.create(null, schema.nodes.action.createAndFill())
        );
      }
      const gridNode = schema.nodes.grid.create(null, colNodes);
      if (dispatch) {
        dispatch(state.tr.replaceSelectionWith(gridNode).scrollIntoView());
      }
      return true;
    };
  };

  // Table Insertion Command
  const insertTable = (rows = 3, cols = 3) => {
    return (state: EditorState, dispatch: any) => {
      const { schema } = state;
      const rowNodes = [];
      for (let r = 0; r < rows; r++) {
        const cellNodes = [];
        for (let c = 0; c < cols; c++) {
          cellNodes.push(
            schema.nodes.table_cell.createAndFill() || schema.nodes.table_cell.create(null, schema.nodes.action.createAndFill())
          );
        }
        rowNodes.push(schema.nodes.table_row.create(null, cellNodes));
      }
      const tableNode = schema.nodes.table.create(null, rowNodes);
      if (dispatch) {
        dispatch(state.tr.replaceSelectionWith(tableNode).scrollIntoView());
      }
      return true;
    };
  };

  // Table Row deletion
  const deleteRow = (state: EditorState, dispatch: any) => {
    const row = findParentNode(n => n.type.name === 'table_row')(state);
    const tableNode = findParentNode(n => n.type.name === 'table')(state);
    if (!row || !tableNode) return false;
    if (tableNode.node.childCount <= 1) {
      return deleteTable(state, dispatch);
    }
    if (dispatch) {
      dispatch(state.tr.delete(row.pos, row.pos + row.node.nodeSize));
    }
    return true;
  };

  // Table Row insertion
  const addRow = (below = true) => {
    return (state: EditorState, dispatch: any) => {
      const row = findParentNode(n => n.type.name === 'table_row')(state);
      const tableNode = findParentNode(n => n.type.name === 'table')(state);
      if (!row || !tableNode) return false;
      const { schema } = state;
      const cellCount = row.node.childCount;
      const newCells = [];
      for (let i = 0; i < cellCount; i++) {
        newCells.push(schema.nodes.table_cell.createAndFill() || schema.nodes.table_cell.create(null, schema.nodes.action.createAndFill()));
      }
      const newRow = schema.nodes.table_row.create(null, newCells);
      if (dispatch) {
        const tr = state.tr;
        const insertPos = below ? (row.pos + row.node.nodeSize) : row.pos;
        tr.insert(insertPos, newRow);
        dispatch(tr.scrollIntoView());
      }
      return true;
    };
  };

  // Table Column insertion
  const addColumn = (right = true) => {
    return (state: EditorState, dispatch: any) => {
      const cell = findParentNode(n => n.type.name === 'table_cell')(state);
      const row = findParentNode(n => n.type.name === 'table_row')(state);
      const tableNode = findParentNode(n => n.type.name === 'table')(state);
      if (!cell || !row || !tableNode) return false;

      let colIndex = 0;
      row.node.forEach((_child, offset, idx) => {
        if (row.start + offset === cell.start) {
          colIndex = idx;
        }
      });

      const insertColIndex = right ? colIndex + 1 : colIndex;
      const { schema } = state;
      const tr = state.tr;

      tableNode.node.forEach((rowChild, rowOffset) => {
        let cellInsertPos = tableNode.start + rowOffset + 1; // start of row
        rowChild.forEach((cellChild, _cellOffset, cellIdx) => {
          if (cellIdx < insertColIndex) {
            cellInsertPos += cellChild.nodeSize;
          }
        });
        const newCell = schema.nodes.table_cell.createAndFill() || schema.nodes.table_cell.create(null, schema.nodes.action.createAndFill());
        tr.insert(tr.mapping.map(cellInsertPos), newCell);
      });

      if (dispatch) {
        dispatch(tr.scrollIntoView());
      }
      return true;
    };
  };

  // Table Column deletion
  const deleteColumn = (state: EditorState, dispatch: any) => {
    const cell = findParentNode(n => n.type.name === 'table_cell')(state);
    const row = findParentNode(n => n.type.name === 'table_row')(state);
    const tableNode = findParentNode(n => n.type.name === 'table')(state);
    if (!cell || !row || !tableNode) return false;

    let colIndex = 0;
    row.node.forEach((_child, offset, idx) => {
      if (row.start + offset === cell.start) {
        colIndex = idx;
      }
    });

    if (row.node.childCount <= 1) {
      return deleteTable(state, dispatch);
    }

    const tr = state.tr;
    tableNode.node.forEach((rowChild, rowOffset) => {
      let cellDelPos = tableNode.start + rowOffset + 1; // start of row
      let cellToDelete = null;
      rowChild.forEach((cellChild, _cellOffset, cellIdx) => {
        if (cellIdx < colIndex) {
          cellDelPos += cellChild.nodeSize;
        } else if (cellIdx === colIndex) {
          cellToDelete = cellChild;
        }
      });
      if (cellToDelete) {
        tr.delete(tr.mapping.map(cellDelPos), tr.mapping.map(cellDelPos + (cellToDelete as any).nodeSize));
      }
    });

    if (dispatch) {
      dispatch(tr.scrollIntoView());
    }
    return true;
  };

  // Table Deletion
  const deleteTable = (state: EditorState, dispatch: any) => {
    const parentTable = findParentNode(n => n.type.name === 'table')(state);
    if (!parentTable) return false;
    if (dispatch) {
      dispatch(state.tr.delete(parentTable.pos, parentTable.pos + parentTable.node.nodeSize));
    }
    return true;
  };

  // Block type helper
  const handleSetBlockType = (type: string) => {
    runCommand(setBlockType(screenplaySchema.nodes[type]));
  };

  // Handle document transaction updates (flattens page structure for Zustand store compatibility)
  const handleDocUpdate = (view: EditorView) => {
    const json = view.state.doc.toJSON();

    const flatBlocks: any[] = [];
    if (json.content) {
      json.content.forEach((pageNode: any) => {
        if (pageNode.type === 'page' && pageNode.content) {
          flatBlocks.push(...pageNode.content);
        } else {
          flatBlocks.push(pageNode);
        }
      });
    }

    const flatJson = {
      type: 'doc',
      content: flatBlocks
    };

    setScriptContent(flatJson);

    // Run auto-backup in the background if active path exists
    if (currentFilePath && window.ipcRenderer) {
      window.ipcRenderer.invoke('backup:save', currentFilePath, JSON.stringify(flatJson));
    }
  };

  // Auto-Pagination Algorithm (Google Docs page overflow and merging)
  const paginateDocument = (view: EditorView) => {
    // Sheets are fixed A4 canvases. Overflow remains on the current page until
    // the writer deliberately uses the page control to add another sheet.
    const automaticPaginationEnabled = false as boolean;
    if (!automaticPaginationEnabled) return;

    const state = view.state;
    const doc = state.doc;
    let tr = state.tr;
    tr.setMeta('paginate', true);

    let hasChanges = false;
    const pageSheets = view.dom.querySelectorAll('.page-sheet');
    let currentPos = 0;

    for (let i = 0; i < pageSheets.length; i++) {
      const pageDom = pageSheets[i] as HTMLElement;
      const pageNode = doc.maybeChild(i);
      if (!pageNode || pageNode.type.name !== 'page') {
        currentPos += pageNode ? pageNode.nodeSize : 0;
        continue;
      }

      const pageStartPos = currentPos;
      const pageEndPos = pageStartPos + pageNode.nodeSize;

      // Detect visual sheet height overflow (US Letter limit: 1100px)
      if (pageDom.scrollHeight > 1100) {
        const children = pageDom.children;
        let accumHeight = 160; // top & bottom padding padding-top: 5rem (80px) and padding-bottom: 5rem (80px).
        let splitIdx = -1;

        for (let c = 0; c < children.length; c++) {
          const childDom = children[c] as HTMLElement;
          accumHeight += childDom.offsetHeight || 0;

          const style = window.getComputedStyle(childDom);
          const marginTop = parseFloat(style.marginTop) || 0;
          const marginBottom = parseFloat(style.marginBottom) || 0;
          accumHeight += marginTop + marginBottom;

          if (accumHeight > 940 && c > 0) {
            splitIdx = c;
            break;
          }
        }

        if (splitIdx !== -1) {
          let splitPos = pageStartPos + 1; // start of page contents
          for (let c = 0; c < splitIdx; c++) {
            splitPos += pageNode.child(c).nodeSize;
          }

          const overflowingNodes: any[] = [];
          for (let c = splitIdx; c < pageNode.childCount; c++) {
            overflowingNodes.push(pageNode.child(c));
          }

          // Delete overflowing nodes from this fixed-height page, then continue on the next.
          tr.delete(splitPos, pageEndPos - 1);
          const mappedPageEnd = tr.mapping.map(pageEndPos, -1);

          const hasNextPage = i + 1 < pageSheets.length;
          if (hasNextPage) {
            // Move nodes to prepend inside the next page
            tr.insert(mappedPageEnd + 1, overflowingNodes);
          } else {
            // Append a new page node
            const newPage = screenplaySchema.nodes.page.create(null, overflowingNodes);
            tr.insert(mappedPageEnd, newPage);
          }

          hasChanges = true;
          break; // Process one page change at a time (sequential updates prevent mapping collision)
        }
      } else {
        // Page has space remaining: pull first node from next page if it fits
        const hasNextPage = i + 1 < pageSheets.length;
        if (hasNextPage) {
          const nextPageNode = doc.child(i + 1);
          if (nextPageNode && nextPageNode.childCount > 0) {
            const firstChildOfNextPage = nextPageNode.child(0);
            const nextPageDom = pageSheets[i + 1] as HTMLElement;

            if (nextPageDom && nextPageDom.children.length > 0) {
              const firstChildDom = nextPageDom.children[0] as HTMLElement;
              const childHeight = firstChildDom.offsetHeight || 20;
              const style = window.getComputedStyle(firstChildDom);
              const marginTop = parseFloat(style.marginTop) || 0;
              const marginBottom = parseFloat(style.marginBottom) || 0;
              const totalChildHeight = childHeight + marginTop + marginBottom;

              if (pageDom.scrollHeight + totalChildHeight < 1100) {
                const nextNodePos = pageEndPos + 1; // next page content start pos
                tr.delete(nextNodePos, nextNodePos + firstChildOfNextPage.nodeSize);
                tr.insert(pageEndPos - 1, firstChildOfNextPage);
                hasChanges = true;
                break;
              }
            }
          } else if (nextPageNode && nextPageNode.childCount === 0) {
            // Clean up empty next page node
            tr.delete(pageEndPos, pageEndPos + nextPageNode.nodeSize);
            hasChanges = true;
            break;
          }
        }
      }

      currentPos += pageNode.nodeSize;
    }

    if (hasChanges) {
      view.dispatch(tr);
    }
  };

  // Keep page backgrounds synchronized reactively
  useEffect(() => {
    const sheets = document.querySelectorAll('.page-sheet');
    sheets.forEach((sheet: any) => {
      sheet.style.backgroundColor = pageBgColor;
      if (pageBgColor === '#2d3748' || pageBgColor === '#1a202c') {
        sheet.classList.add('text-white');
        sheet.classList.remove('text-black');
      } else {
        sheet.classList.add('text-black');
        sheet.classList.remove('text-white');
      }
    });
  }, [pageBgColor]);

  useEffect(() => {
    if (!editorRef.current) return;

    // Use initial state or state loaded from file
    let doc;
    if (scriptContent && scriptContent.type === 'doc') {
      try {
        // Backward compatibility wrapping flat blocks into pages
        const hasPages = scriptContent.content && scriptContent.content.some((n: any) => n.type === 'page');
        let paginatedContent = scriptContent;
        if (!hasPages) {
          paginatedContent = {
            type: 'doc',
            content: [{
              type: 'page',
              content: scriptContent.content || []
            }]
          };
        }
        doc = screenplaySchema.nodeFromJSON(paginatedContent);
      } catch (e) {
        console.error('Failed to parse scriptContent JSON', e);
      }
    }

    if (!doc) {
      const defaultDoc = screenplaySchema.node('doc', null, [
        screenplaySchema.node('page', null, [
          screenplaySchema.node('sceneHeading', { id: crypto.randomUUID() }, [screenplaySchema.text('INT. DRAFTILL DEMO - DAY')]),
          screenplaySchema.node('action', null, [screenplaySchema.text('This is the screenplay canvas. Each sheet uses a fixed A4 size.')]),
          screenplaySchema.node('character', null, [screenplaySchema.text('SCREENWRITER')]),
          screenplaySchema.node('dialogue', null, [screenplaySchema.text('Is this where I type?')]),
          screenplaySchema.node('character', null, [screenplaySchema.text('AI ASSISTANT')]),
          screenplaySchema.node('parenthetical', null, [screenplaySchema.text('(smiling)')]),
          screenplaySchema.node('dialogue', null, [screenplaySchema.text('Yes! Press Tab to cycle elements or Enter for smart formatting.')])
        ])
      ]);
      doc = defaultDoc;
      setTimeout(() => {
        const flatBlocks: any[] = [];
        defaultDoc.forEach((pageNode) => {
          pageNode.forEach((child) => {
            flatBlocks.push(child.toJSON());
          });
        });
        setScriptContent({ type: 'doc', content: flatBlocks });
      }, 0);
    }

    // Build custom shortcuts keymap
    const customKeymap = buildScreenplayKeymap(shortcuts);

    const state = EditorState.create({
      doc,
      schema: screenplaySchema,
      plugins: [
        history(),
        keymap({ 'Mod-z': undo, 'Mod-y': redo, 'Mod-Shift-z': redo }),
        keymap(customKeymap),
        keymap(baseKeymap)
      ]
    });

    setEditorState(state);

    const view = new EditorView(editorRef.current, {
      state,
      handleClick(_view, _position, event) {
        if (!event.ctrlKey && !event.metaKey) return false;
        const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
        if (!target) return false;
        event.preventDefault();
        window.ipcRenderer?.invoke('link:openExternal', target.getAttribute('href'));
        return true;
      },
      handleKeyDown(_view, event) {
        if (showMentionPopupRef.current) {
          const count = filteredMentionCountRef.current;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setMentionActiveIndex((prev) => (count > 0 ? (prev + 1) % count : 0));
            return true;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setMentionActiveIndex((prev) => (count > 0 ? (prev - 1 + count) % count : 0));
            return true;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            triggerMentionSelectRef.current();
            return true;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setShowMentionPopup(false);
            return true;
          }
        }
        return false;
      },
      dispatchTransaction(transaction) {
        const newState = view.state.apply(transaction);
        view.updateState(newState);
        setEditorState(newState);
        handleDocUpdate(view);
        window.requestAnimationFrame(() => syncEntityReferences(view));

        // Check for character (@) or scene (#) mentions query
        const { $from, empty } = newState.selection;
        if (empty && $from.parent.isTextblock) {
          const lookback = Math.min($from.parentOffset, 40);
          const textBefore = $from.parent.textBetween(Math.max(0, $from.parentOffset - lookback), $from.parentOffset, null, null);
          const charMatch = textBefore.match(/@([\w\s]*)$/);
          const sceneMatch = textBefore.match(/#([\w\s.]*)$/);
          const match = charMatch || sceneMatch;
          const trigger = charMatch ? '@' : '#';
          if (match) {
            const query = match[1];
            setMentionType(trigger as '@' | '#');
            setMentionQuery(query);
            setMentionActiveIndex(0);
            setShowMentionPopup(true);
            try {
              const coords = view.coordsAtPos($from.pos);
              const sheetEl = editorRef.current?.getBoundingClientRect();
              const relativeLeft = coords.left - (sheetEl?.left || 0);
              const relativeTop = coords.bottom - (sheetEl?.top || 0);
              setMentionPopupCoords({ 
                left: relativeLeft,
                top: relativeTop + 24
              });
            } catch(_e) {}
          } else {
            setShowMentionPopup(false);
          }
        } else {
          setShowMentionPopup(false);
        }

        // Find active block index for commenting
        let activeIdx = 0;
        newState.doc.forEach((child, offset, idx) => {
          if (offset <= $from.pos && offset + child.nodeSize >= $from.pos) {
            activeIdx = idx;
          }
        });
        setActiveNodeIdx(activeIdx);

        // Run auto pagination on document edit
        if (!transaction.getMeta('paginate')) {
          paginateDocument(view);
        }
      },
      nodeViews: {
        page(node, view, getPos) {
          return new PageView(node, view, getPos as () => number);
        }
      }
    });

    viewRef.current = view;
    setActiveEditorView(view);
    window.requestAnimationFrame(() => syncEntityReferences(view));

    const jumpToComment = (event: Event) => {
      const nodeIndex = (event as CustomEvent<{ nodeIndex: number }>).detail?.nodeIndex;
      if (typeof nodeIndex !== 'number') return;
      let position = 0;
      view.state.doc.forEach((_child, offset, index) => {
        if (index === nodeIndex) position = offset;
      });
      const nodeDom = view.nodeDOM(position) as HTMLElement | null;
      nodeDom?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const target = Math.min(position + 1, view.state.doc.content.size);
      view.dispatch(view.state.tr.setSelection(Selection.near(view.state.doc.resolve(target))));
      view.focus();
    };
    const addScreenplayPage = () => {
      const insertPos = view.state.doc.content.size;
      const emptyPage = screenplaySchema.nodes.page.createAndFill()
        || screenplaySchema.nodes.page.create(null, screenplaySchema.nodes.action.createAndFill());
      let transaction = view.state.tr.insert(insertPos, emptyPage);
      transaction = transaction.setSelection(Selection.near(transaction.doc.resolve(insertPos + 1))).scrollIntoView();
      view.dispatch(transaction);
      window.requestAnimationFrame(() => {
        const pages = editorRef.current?.querySelectorAll<HTMLElement>('.page-container');
        pages?.item(pages.length - 1)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      view.focus();
    };
    window.addEventListener('draftill:jump-to-comment', jumpToComment);
    window.addEventListener('draftill:add-screenplay-page', addScreenplayPage);

    return () => {
      window.removeEventListener('draftill:jump-to-comment', jumpToComment);
      window.removeEventListener('draftill:add-screenplay-page', addScreenplayPage);
      view.destroy();
      setActiveEditorView(null);
    };
  }, [currentFilePath, activeProjectId, shortcuts, syncEntityReferences]);

  // Word/Page goals math (flat scriptContent)
  const rawNodes = (scriptContent?.content || []).map((node: any) => ({
    type: node.type,
    text: node.content?.[0]?.text || ''
  }));
  let totalWords = 0;
  rawNodes.forEach((n: any) => {
    totalWords += n.text.split(/\s+/).filter(Boolean).length;
  });
  const estPages = Math.max(1, Math.round(rawNodes.length / 18));
  const wordPercent = wordGoal > 0 ? Math.min(100, Math.round((totalWords / wordGoal) * 100)) : 0;
  const pagePercent = pageGoal > 0 ? Math.min(100, Math.round((estPages / pageGoal) * 100)) : 0;

  // Active styles checking for toolbar state
  const isBold = isMarkActive(screenplaySchema.marks.strong);
  const isItalic = isMarkActive(screenplaySchema.marks.em);
  const isUnderline = isMarkActive(screenplaySchema.marks.underline);
  const isStrike = isMarkActive(screenplaySchema.marks.strike);
  const isLink = isMarkActive(screenplaySchema.marks.link);

  const activeFontFamily = screenplayFontFamily || 'monospace';
  const activeFontSize = getActiveMarkAttr(screenplaySchema.marks.fontSize, 'size') || '16px';
  const activeTextColor = getActiveMarkAttr(screenplaySchema.marks.textColor, 'color') || (isDarkMode ? '#ffffff' : '#000000');
  const activeHighlightColor = getActiveMarkAttr(screenplaySchema.marks.textHighlight, 'color') || '';
  const hoveredEntity = entityHover?.type === 'character'
    ? characters.find((item) => item.id === entityHover.id)
    : entityHover?.type === 'location'
      ? locations.find((item) => item.id === entityHover.id)
      : null;

  const activeBlockType = getActiveBlockType();
  const insideCell = isInsideTableCell();
  const curatedFontOptions: ToolbarOption[] = [
    { value: 'monospace', label: 'Courier Prime', group: 'Screenplay fonts' },
    { value: 'sans-serif', label: 'Inter', group: 'Screenplay fonts' },
    { value: 'Arial', label: 'Arial', group: 'Screenplay fonts' },
    { value: 'Georgia', label: 'Georgia', group: 'Screenplay fonts' },
    { value: 'Courier New', label: 'Courier New', group: 'Screenplay fonts' }
  ];
  const curatedNames = new Set(curatedFontOptions.map((font) => font.label.toLocaleLowerCase()));
  const fontOptions = [...curatedFontOptions, ...deviceFonts.filter((font) => !curatedNames.has(font.toLocaleLowerCase())).map((font) => ({ value: font, label: font, group: 'Installed on this PC' }))];

  const handleClearColor = () => {
    runCommand(setTextColor('clear'));
  };

  const handleClearHighlight = () => {
    runCommand(setTextHighlight('clear'));
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#f4f4f2] dark:bg-[#2a2a2a] overflow-hidden">
      {/* Sticky/Fixed responsive Toolbar */}
      <div className="sticky top-0 z-10 w-full shrink-0 border-b border-gray-200 dark:border-[#333] bg-[#fdfdfd] dark:bg-[#1a1a1a] shadow-sm py-1.5 px-3 flex flex-wrap gap-1.5 items-center text-[11px] font-inter text-gray-700 dark:text-gray-300">
        
        {/* Paragraph Block selector */}
        <div className="flex items-center gap-1">
          <Type size={14} className="text-gray-400" />
          <ToolbarSelect
            value={activeBlockType}
            onChange={handleSetBlockType}
            title="Screenplay Element Type"
            className="w-32"
            options={[
              { value: 'sceneHeading', label: 'Scene Heading' }, { value: 'action', label: 'Action' },
              { value: 'character', label: 'Character' }, { value: 'dialogue', label: 'Dialogue' },
              { value: 'parenthetical', label: 'Parenthetical' }, { value: 'transition', label: 'Transition' }, { value: 'shot', label: 'Shot' }
            ]}
          />
        </div>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-800 self-center" />

        {/* Font Family */}
        <ToolbarSelect
          value={activeFontFamily}
          onChange={handleScreenplayFontFamily}
          title="Screenplay Font Family"
          className="w-32"
          searchable
          options={fontOptions}
        />

        {/* Font Size */}
        <ToolbarSelect
          value={activeFontSize}
          onChange={(value) => runCommand(setFontSize(value))}
          title="Font Size"
          className="w-[76px]"
          options={['12px', '14px', '16px', '18px', '20px', '24px', '32px'].map((size) => ({ value: size, label: size }))}
        />

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-800 self-center" />

        {/* Text Decoration Marks */}
        <div className="flex items-center bg-gray-100 dark:bg-[#222] rounded p-0.5 border border-gray-200 dark:border-gray-800">
          <button
            onClick={() => runCommand(toggleMark(screenplaySchema.marks.strong))}
            className={`p-1 rounded transition-all cursor-pointer ${isBold ? 'bg-amber-500/20 text-[#F4C430] font-bold' : 'text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}
            title="Bold"
          >
            <Bold size={14} />
          </button>
          <button
            onClick={() => runCommand(toggleMark(screenplaySchema.marks.em))}
            className={`p-1 rounded transition-all cursor-pointer ${isItalic ? 'bg-amber-500/20 text-[#F4C430] font-bold' : 'text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}
            title="Italic"
          >
            <Italic size={14} />
          </button>
          <button
            onClick={() => runCommand(toggleMark(screenplaySchema.marks.underline))}
            className={`p-1 rounded transition-all cursor-pointer ${isUnderline ? 'bg-amber-500/20 text-[#F4C430] font-bold' : 'text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}
            title="Underline"
          >
            <Underline size={14} />
          </button>
          <button
            onClick={() => runCommand(toggleMark(screenplaySchema.marks.strike))}
            className={`p-1 rounded transition-all cursor-pointer ${isStrike ? 'bg-amber-500/20 text-[#F4C430] font-bold' : 'text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}
            title="Strikethrough"
          >
            <Strikethrough size={14} />
          </button>
          <button
            onClick={handleToggleLink}
            onMouseDown={(event) => event.preventDefault()}
            className={`p-1 rounded transition-all cursor-pointer ${isLink ? 'bg-amber-500/20 text-[#F4C430] font-bold' : 'text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}
            title="Link"
          >
            <Link size={14} />
          </button>
        </div>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-800 self-center" />

        {/* Text color picker input */}
        <div className="flex items-center gap-1.5" title="Text Color">
          <Palette size={14} className="text-gray-400" />
          <input 
            type="color" 
            value={activeTextColor}
            onChange={(e) => runCommand(setTextColor(e.target.value))}
            className="w-5 h-5 border border-gray-300 dark:border-gray-700 rounded-full cursor-pointer p-0 bg-transparent"
          />
          {activeTextColor !== (isDarkMode ? '#ffffff' : '#000000') && (
            <button onClick={handleClearColor} className="text-[10px] text-red-400 hover:text-red-500 font-bold" title="Reset Text Color">Ø</button>
          )}
        </div>

        {/* Highlight color picker input */}
        <div className="flex items-center gap-1.5" title="Highlight Color">
          <Sparkles size={14} className="text-gray-400" />
          <input 
            type="color" 
            value={activeHighlightColor || '#ffff00'}
            onChange={(e) => runCommand(setTextHighlight(e.target.value))}
            className="w-5 h-5 border border-gray-300 dark:border-gray-700 rounded cursor-pointer p-0 bg-transparent"
          />
          {activeHighlightColor && (
            <button onClick={handleClearHighlight} className="text-[10px] text-red-400 hover:text-red-500 font-bold" title="Clear Highlight">Ø</button>
          )}
        </div>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-800 self-center" />

        {/* Page Background settings */}
        <div className="flex items-center gap-1.5" title="Page Background Color">
          <FileText size={14} className="text-gray-400" />
          <ToolbarSelect
            value={pageBgColor}
            onChange={setPageBgColor}
            title="Page Background Color"
            className="w-[88px]"
            options={[
              { value: '#ffffff', label: 'White' }, { value: '#fcf8f2', label: 'Cream' }, { value: '#f4ecd8', label: 'Sepia' }, { value: '#2d3748', label: 'Charcoal' }, { value: '#1a202c', label: 'Dark' }
            ]}
          />
          <input 
            type="color" 
            value={pageBgColor}
            onChange={(e) => setPageBgColor(e.target.value)}
            className="w-5 h-5 border border-gray-300 dark:border-gray-700 rounded cursor-pointer p-0 bg-transparent"
          />
        </div>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-800 self-center" />

        {/* Alignment */}
        <div className="flex items-center bg-gray-100 dark:bg-[#222] rounded p-0.5 border border-gray-200 dark:border-gray-800">
          <button
            onClick={() => runCommand(setAlignment('left'))}
            className="p-1 rounded text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            title="Align Left"
          >
            <AlignLeft size={14} />
          </button>
          <button
            onClick={() => runCommand(setAlignment('center'))}
            className="p-1 rounded text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            title="Align Center"
          >
            <AlignCenter size={14} />
          </button>
          <button
            onClick={() => runCommand(setAlignment('right'))}
            className="p-1 rounded text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            title="Align Right"
          >
            <AlignRight size={14} />
          </button>
          <button
            onClick={() => runCommand(setAlignment('justify'))}
            className="p-1 rounded text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            title="Align Justify"
          >
            <AlignJustify size={14} />
          </button>
        </div>

        <div className="w-px h-5 bg-gray-200 dark:bg-gray-800 self-center" />

        {/* Layout additions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => runCommand(insertGrid(2))}
            className="p-1 bg-gray-100 dark:bg-[#222] border border-gray-200 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-[#333] text-gray-600 dark:text-gray-300 rounded flex items-center gap-1 transition-colors cursor-pointer"
            title="Insert 2 Columns Grid"
          >
            <Columns size={13} />
            <span>Grid</span>
          </button>

          <button
            onClick={() => runCommand(insertTable(3, 3))}
            className="p-1 bg-gray-100 dark:bg-[#222] border border-gray-200 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-[#333] text-gray-600 dark:text-gray-300 rounded flex items-center gap-1 transition-colors cursor-pointer"
            title="Insert 3x3 Table"
          >
            <Table size={13} />
            <span>Table</span>
          </button>

        </div>
      </div>

      {/* Table Context Controls (Only visible when cursor is inside a table cell) */}
      {insideCell && (
        <div className="flex w-full flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-1.5 font-inter text-[11px] text-gray-600 animate-fade-in dark:border-[#333] dark:bg-[#1a1a1a] dark:text-gray-300">
          <span className="flex items-center gap-1 rounded border border-[#F4C430]/35 bg-[#F4C430]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#F4C430]">
            Table Mode
          </span>
          <button
            onClick={() => runCommand(addRow(false))}
            className="cursor-pointer rounded border border-gray-300 bg-gray-50 px-2 py-1 text-gray-600 transition-colors hover:border-[#F4C430]/60 hover:text-[#b58a00] dark:border-[#3b3b3b] dark:bg-[#242424] dark:text-gray-300 dark:hover:text-[#F4C430]"
          >
            + Row Above
          </button>
          <button
            onClick={() => runCommand(addRow(true))}
            className="cursor-pointer rounded border border-gray-300 bg-gray-50 px-2 py-1 text-gray-600 transition-colors hover:border-[#F4C430]/60 hover:text-[#b58a00] dark:border-[#3b3b3b] dark:bg-[#242424] dark:text-gray-300 dark:hover:text-[#F4C430]"
          >
            + Row Below
          </button>
          <button
            onClick={() => runCommand(deleteRow)}
            className="flex cursor-pointer items-center gap-1 rounded border border-gray-300 bg-gray-50 px-2 py-1 text-gray-500 transition-colors hover:border-red-400/50 hover:text-red-500 dark:border-[#3b3b3b] dark:bg-[#242424] dark:text-gray-400 dark:hover:text-red-400"
          >
            <Minus size={11} /> Delete Row
          </button>
          
          <div className="h-4 w-px self-center bg-gray-300 dark:bg-[#444]" />

          <button
            onClick={() => runCommand(addColumn(false))}
            className="cursor-pointer rounded border border-gray-300 bg-gray-50 px-2 py-1 text-gray-600 transition-colors hover:border-[#F4C430]/60 hover:text-[#b58a00] dark:border-[#3b3b3b] dark:bg-[#242424] dark:text-gray-300 dark:hover:text-[#F4C430]"
          >
            + Col Left
          </button>
          <button
            onClick={() => runCommand(addColumn(true))}
            className="cursor-pointer rounded border border-gray-300 bg-gray-50 px-2 py-1 text-gray-600 transition-colors hover:border-[#F4C430]/60 hover:text-[#b58a00] dark:border-[#3b3b3b] dark:bg-[#242424] dark:text-gray-300 dark:hover:text-[#F4C430]"
          >
            + Col Right
          </button>
          <button
            onClick={() => runCommand(deleteColumn)}
            className="flex cursor-pointer items-center gap-1 rounded border border-gray-300 bg-gray-50 px-2 py-1 text-gray-500 transition-colors hover:border-red-400/50 hover:text-red-500 dark:border-[#3b3b3b] dark:bg-[#242424] dark:text-gray-400 dark:hover:text-red-400"
          >
            <Minus size={11} /> Delete Col
          </button>

          <div className="h-4 w-px self-center bg-gray-300 dark:bg-[#444]" />

          <button
            onClick={() => runCommand(deleteTable)}
            className="flex cursor-pointer items-center gap-1 rounded border border-gray-300 bg-gray-50 px-2.5 py-1 font-semibold text-gray-500 transition-colors hover:border-red-400/50 hover:text-red-500 dark:border-[#3b3b3b] dark:bg-[#242424] dark:text-gray-400 dark:hover:text-red-400"
          >
            <Trash2 size={11} /> Delete Table
          </button>
        </div>
      )}

      {/* Editor Content Area (Scrollable container) */}
      <div className="flex-1 overflow-auto w-full p-8 flex flex-col items-center justify-start">
        
        {/* Goals progress bar */}
        {(wordGoal > 0 || pageGoal > 0) && (
          <div className="w-[794px] bg-white dark:bg-[#1e1e1e] p-3 rounded-lg border border-gray-200 dark:border-[#333] mb-4 flex justify-between text-xs text-gray-500 dark:text-gray-400 gap-4 shrink-0 font-inter shadow-sm">
            {wordGoal > 0 && (
              <div className="flex-1">
                <div className="flex justify-between mb-1 font-bold">
                  <span>WORDS GOAL</span>
                  <span>{totalWords} / {wordGoal} ({wordPercent}%)</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-[#333] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#F4C430] h-full" style={{ width: `${wordPercent}%` }} />
                </div>
              </div>
            )}
            {pageGoal > 0 && (
              <div className="flex-1">
                <div className="flex justify-between mb-1 font-bold">
                  <span>PAGES GOAL</span>
                  <span>{estPages} / {pageGoal} ({pagePercent}%)</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-[#333] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#F4C430] h-full" style={{ width: `${pagePercent}%` }} />
                </div>
              </div>
            )}
          </div>
        )}

        <div 
          ref={editorRef} 
          onMouseUp={handleTextSelection}
          onMouseOver={showEntityHover}
          onMouseOut={hideEntityHover}
          className="focus:outline-none prosemirror-editor flex flex-col items-center w-full relative"
          style={{ '--screenplay-font-family': screenplayFontFamily || 'monospace' } as CSSProperties}
        >
          {entityHover && hoveredEntity && <div className="pointer-events-none absolute z-50 w-[270px] overflow-hidden rounded-lg border border-[#454545] bg-[#1c1c1c] font-inter text-left shadow-2xl" style={{ left: entityHover.left, top: entityHover.top }}>
            {'image' in hoveredEntity && hoveredEntity.image ? <img src={hoveredEntity.image} alt="" className="h-28 w-full object-cover" /> : null}
            <div className="p-3"><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#F4C430]">{entityHover.type}</p><h4 className="mt-1 text-xs font-bold uppercase text-white">{'name' in hoveredEntity ? hoveredEntity.name : hoveredEntity.heading}</h4>{'role' in hoveredEntity && hoveredEntity.role && <p className="mt-0.5 text-[9px] font-bold uppercase text-sky-300">{hoveredEntity.role}</p>}<p className="mt-2 text-[10px] leading-relaxed text-gray-300">{hoveredEntity.description || 'No details added yet.'}</p>{hoveredEntity.notes && <p className="mt-2 line-clamp-3 text-[9px] italic leading-relaxed text-gray-500">{hoveredEntity.notes}</p>}</div>
          </div>}
          {selectionToolbar && (
            <div style={{ left: `${selectionToolbar.left}px`, top: `${selectionToolbar.top}px` }} className="font-inter absolute z-40 flex items-center gap-1 rounded bg-[#292929] p-1 shadow-xl ring-1 ring-white/10">
              <button type="button" onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); handleAskSelection(); }} className="flex items-center gap-1 rounded bg-[#F4C430] px-2 py-1 text-[10px] font-bold text-black hover:bg-[#d4a822] cursor-pointer" title="Ask AI about selection"><Sparkles size={12} /> Ask AI</button>
              <button type="button" onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); handleAddSelectionComment(); }} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold text-white hover:bg-white/10 cursor-pointer" title="Comment on selection"><MessageSquare size={12} className="text-[#F4C430]" /> Comment</button>
            </div>
          )}
          {commentComposer && (
            <div
              style={{ left: `${commentComposer.left}px`, top: `${commentComposer.top}px` }}
              className="font-inter absolute z-50 w-[260px] rounded-lg border border-[#4a4a4a] bg-[#1d1d1d] p-3 text-white shadow-2xl ring-1 ring-black/40"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#F4C430]"><MessageSquare size={12} /> Add comment</div>
              <p className="mb-2 line-clamp-2 text-[10px] italic text-gray-400">“{commentComposer.selectionText}”</p>
              <textarea
                autoFocus
                rows={3}
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); submitSelectionComment(); } }}
                placeholder="Write a comment…"
                className="w-full resize-none rounded border border-[#444] bg-[#151515] p-2 text-[11px] text-white outline-none focus:border-[#F4C430]"
              />
              <div className="mt-2 flex items-center justify-end gap-2">
                <button type="button" onClick={() => { setCommentComposer(null); setCommentDraft(''); }} className="text-[10px] font-bold text-gray-400 hover:text-white">Cancel</button>
                <button type="button" onClick={submitSelectionComment} disabled={!commentDraft.trim()} className="rounded bg-[#F4C430] px-2.5 py-1 text-[10px] font-bold text-black hover:bg-[#d4a822] disabled:opacity-40">Add comment</button>
              </div>
            </div>
          )}
          {/* Mention Popup Overlay (Characters @ or Scenes #) */}
          {showMentionPopup && (
            <div 
              style={{ 
                position: 'absolute', 
                left: `${mentionPopupCoords.left}px`, 
                top: `${mentionPopupCoords.top}px` 
              }}
              className={`w-56 max-h-48 overflow-y-auto rounded-lg shadow-xl border z-30 font-inter text-xs py-1 ${
                isDarkMode ? 'bg-[#1f1f23] border-[#2f2f35] text-white' : 'bg-white border-gray-200 text-black'
              }`}
            >
              <div className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider border-b ${
                isDarkMode ? 'border-[#2f2f35] text-gray-500' : 'border-gray-100 text-gray-400'
              }`}>
                {mentionType === '@' ? '👤 Characters' : '🎬 Scenes'}
              </div>
              {filteredMentionItems.length === 0 ? (
                <div className="px-3 py-2 text-gray-500 italic">
                  {mentionQuery 
                    ? `No matching ${mentionType === '@' ? 'characters' : 'scenes'} (Enter to insert)` 
                    : `Type to search ${mentionType === '@' ? 'characters' : 'scenes'}...`
                  }
                </div>
              ) : (
                filteredMentionItems.map((item: any, index: number) => {
                  const label = item.name || item.text;
                  const subtitle = mentionType === '@' ? item.role : null;
                  return (
                    <button
                      key={item.id || label}
                      onClick={() => handleSelectMention(label)}
                      className={`w-full text-left px-3 py-1.5 font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
                        index === mentionActiveIndex 
                          ? 'bg-[#F4C430] text-black' 
                          : (isDarkMode ? 'hover:bg-white/5 text-gray-300' : 'hover:bg-gray-100 text-gray-700')
                      }`}
                    >
                      {mentionType === '@' && item.image ? (
                        <img src={item.image} className="w-5 h-5 rounded-full object-cover shrink-0" alt="" />
                      ) : mentionType === '@' ? (
                        <span className="w-5 h-5 rounded-full bg-[#F4C430]/20 flex items-center justify-center text-[8px] font-black text-[#F4C430] shrink-0">
                          {label.charAt(0)}
                        </span>
                      ) : (
                        <span className="text-[10px]">🎬</span>
                      )}
                      <div className="flex flex-col">
                        <span className="font-bold text-[11px]">{label}</span>
                        {subtitle && <span className={`text-[9px] font-normal ${index === mentionActiveIndex ? 'text-black/70' : 'text-gray-500'}`}>{subtitle}</span>}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
      {linkDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-[#3a3a3a] bg-[#202020] p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-sm font-bold text-white"><Link size={15} className="text-[#F4C430]" /> Add link</div>
            <p className="mt-1 text-[11px] text-gray-500">The selected screenplay text will open this address.</p>
            <input
              autoFocus
              value={linkUrl}
              onChange={(event) => { setLinkUrl(event.target.value); setLinkError(''); }}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submitLink(); } if (event.key === 'Escape') setLinkDialog(null); }}
              placeholder="https://example.com"
              className="mt-4 w-full rounded-lg border border-[#444] bg-[#151515] px-3 py-2 text-sm text-white outline-none placeholder:text-gray-600 focus:border-[#F4C430]"
            />
            {linkError && <p className="mt-2 text-[11px] text-red-400">{linkError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => { setLinkDialog(null); setLinkError(''); }} className="rounded-lg px-3 py-2 text-xs font-bold text-gray-400 hover:bg-white/5 hover:text-white">Cancel</button>
              <button type="button" onClick={submitLink} className="rounded-lg bg-[#F4C430] px-3 py-2 text-xs font-bold text-black hover:bg-[#d4a822]">Add link</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
