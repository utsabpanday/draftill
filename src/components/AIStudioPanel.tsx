import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AtSign, ChevronDown, Clapperboard, Download, FilePenLine, Globe2, Hash, History as HistoryIcon, ImagePlus, Loader2, Mic, Paperclip, Plus, Quote, Send, Settings2, Square, StickyNote, Wrench, X } from 'lucide-react';
import { useAppStore } from '../store/store';
import AIIcon from './AIIcon';

type SourceLink = { title: string; url: string };
type GeneratedImage = { dataUrl: string; mime: string; revisedPrompt?: string };
type ProviderEvent = { name: 'web_search' | 'image_generation'; detail: string };
type Message = { id?: string; role: 'user' | 'assistant'; content: string; aiContext?: string; excerpts?: Array<{ nodeIndex: number; text: string }>; freeflowContexts?: Array<{ nodeId: string; type: string; title: string }>; attachmentNames?: string[]; activity?: ActivityStep[]; activitySeconds?: number; sources?: SourceLink[]; generatedImages?: GeneratedImage[] };
type Conversation = { messages: Message[]; toolEvents: string[]; title?: string; updatedAt?: number };
type Attachment = { id: string; name: string; mime: string; dataUrl: string; kind: 'image' | 'audio' | 'video' | 'file' };
type SelectedExcerpt = { id: string; nodeIndex: number; text: string };
type SelectedFreeflowContext = { nodeId: string };
type ToolCall = { function?: { name?: string; arguments?: string } };
type ScreenplayBlock = { type: string; text: string };
type ScreenplayPageEdit = { page?: number; mode?: 'append' | 'replace_text' | 'replace_page'; targetText?: string; blocks?: ScreenplayBlock[] };
type Props = { onClose: () => void; onOpenSettings: () => void };
type ActivityStep = { id: string; label: string; detail?: string; toolName?: string; kind: 'thinking' | 'tool'; status: 'running' | 'complete' | 'failed' };

function toolLabel(call: ToolCall) {
  const name = call.function?.name || 'draftill_tool';
  const labels: Record<string, string> = {
    edit_screenplay_pages: 'Editing screenplay pages',
    create_scene: 'Creating a formatted scene',
    edit_freeflow_node: 'Editing the Freeflow canvas',
    connect_freeflow_nodes: 'Editing a Freeflow connection',
    edit_character: 'Editing the Character Bible',
    edit_location: 'Editing the Location library',
    edit_comment: 'Editing screenplay comments',
    create_version_checkpoint: 'Creating a screenplay checkpoint',
    update_editor_settings: 'Updating editor settings',
    web_search: 'Searching the web',
    image_generation: 'Generating an image',
  };
  return labels[name] || 'Running a Draftill tool';
}

function activityIcon(name: string | undefined, active: boolean) {
  if (active) return <Loader2 size={13} className="animate-spin text-[#F4C430]" />;
  if (name?.includes('screenplay')) return <FilePenLine size={13} className="text-[#F4C430]" />;
  if (name?.includes('freeflow') || name?.includes('scene') || name?.includes('location')) return <Clapperboard size={13} className="text-[#F4C430]" />;
  if (name?.includes('character')) return <AtSign size={13} className="text-[#F4C430]" />;
  if (name?.includes('comment')) return <StickyNote size={13} className="text-[#F4C430]" />;
  if (name?.includes('settings')) return <Settings2 size={13} className="text-[#F4C430]" />;
  if (name?.includes('web_search')) return <Globe2 size={13} className="text-[#F4C430]" />;
  if (name?.includes('image_generation')) return <ImagePlus size={13} className="text-[#F4C430]" />;
  return <Wrench size={13} className="text-[#F4C430]" />;
}

function inlineFormat(value: string): ReactNode[] {
  return value.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => part.startsWith('**') && part.endsWith('**') ? <strong key={index} className="font-bold text-white">{part.slice(2, -2)}</strong> : <span key={index}>{part}</span>);
}

function RichReply({ content }: { content: string }) {
  const lines = content.replace(/\r/g, '').split('\n').filter((line) => line.trim());
  return <div className="space-y-2">{lines.map((line, index) => {
    const clean = line.trim();
    if (/^#{1,3}\s/.test(clean) || (/^\*\*.+\*\*$/.test(clean) && clean.length < 90)) return <h4 key={index} className="pt-1 text-[11px] font-bold text-white">{clean.replace(/^#+\s*/, '').replace(/^\*\*|\*\*$/g, '')}</h4>;
    if (/^[-*]\s+/.test(clean)) return <div key={index} className="flex gap-2 pl-1"><span className="mt-1 text-[#F4C430]">•</span><span>{inlineFormat(clean.replace(/^[-*]\s+/, ''))}</span></div>;
    return <p key={index}>{inlineFormat(clean)}</p>;
  })}</div>;
}

function AssistantArtifacts({ sources = [], generatedImages = [], onSave }: { sources?: SourceLink[]; generatedImages?: GeneratedImage[]; onSave: (image: GeneratedImage, index: number) => void }) {
  if (!sources.length && !generatedImages.length) return null;
  return <div className="mt-2 space-y-2">
    {generatedImages.map((image, index) => <div key={`${image.mime}-${index}`} className="overflow-hidden rounded-lg border border-[#343434] bg-[#171717]">
      <img src={image.dataUrl} alt={image.revisedPrompt || `Draftill AI generated visual ${index + 1}`} className="max-h-80 w-full object-contain" />
      <div className="flex items-center justify-between gap-2 border-t border-[#303030] px-2 py-1.5">
        <span className="min-w-0 truncate text-[9px] text-gray-600">{image.revisedPrompt || 'AI-generated image'}</span>
        <button onClick={() => onSave(image, index)} className="flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-[9px] text-gray-400 hover:bg-white/5 hover:text-[#F4C430]" title="Save generated image"><Download size={10} /> Save</button>
      </div>
    </div>)}
    {sources.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="flex items-center gap-1 text-[9px] text-gray-600"><Globe2 size={10} /> Sources</span>{sources.map((source) => <button key={source.url} onClick={() => window.ipcRenderer?.invoke('link:openExternal', source.url)} className="max-w-full truncate rounded border border-[#343434] px-1.5 py-0.5 text-[9px] text-gray-400 hover:border-[#F4C430]/50 hover:text-[#F4C430]" title={source.url}>{source.title}</button>)}</div>}
  </div>;
}

function ActivityTrace({ steps, isRunning, seconds }: { steps: ActivityStep[]; isRunning: boolean; seconds?: number }) {
  if (!steps.length) return null;
  const latest = steps.at(-1);
  return <details open={isRunning || undefined} className="mb-2 text-[10px] text-gray-400">
    <summary className="flex cursor-pointer list-none items-center gap-2 py-1">
      {isRunning ? <Loader2 size={11} className="animate-spin text-[#F4C430]" /> : <Wrench size={11} className="text-[#F4C430]" />}
      <span className="font-semibold text-gray-300">{isRunning ? `Thinking · ${Math.max(1, seconds || 0)}s` : 'Activity'}</span>
      <span className="min-w-0 flex-1 truncate text-[9px] text-gray-600">{latest?.label}</span>
      <ChevronDown size={11} className="shrink-0 text-gray-600" />
    </summary>
    <div className="ml-[5px] space-y-1.5 border-l border-[#3b3b3b] py-1 pl-3">{steps.map((step) => <div key={step.id} className="min-w-0">
      <div className="flex items-center gap-2">{step.kind === 'thinking' ? <Loader2 size={9} className={step.status === 'running' ? 'animate-spin text-[#F4C430]' : 'text-gray-600'} /> : activityIcon(step.toolName, step.status === 'running')}<span className={step.status === 'failed' ? 'text-red-300' : 'text-gray-500'}>{step.label}</span></div>
      {step.detail?.trim() && <div className={`ml-[17px] mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap break-words pr-2 text-[9px] leading-relaxed ${step.status === 'failed' ? 'text-red-300/80' : step.label === 'Model reasoning' ? 'text-gray-300' : 'text-gray-600'}`}>{step.detail.trim()}</div>}
    </div>)}</div>
  </details>;
}

export default function AIStudioPanel({ onClose, onOpenSettings }: Props) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [modelName, setModelName] = useState('');
  const [conversations, setConversations] = useState<Record<string, Conversation>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('draftill:ai-chat-history') || '{}');
      return saved && typeof saved === 'object' ? saved : {};
    } catch { return {}; }
  });
  const [activeConversationKeys, setActiveConversationKeys] = useState<Record<string, string>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('draftill:ai-active-conversations') || '{}');
      return saved && typeof saved === 'object' ? saved : {};
    } catch { return {}; }
  });
  const [prompt, setPrompt] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedExcerpts, setSelectedExcerpts] = useState<SelectedExcerpt[]>([]);
  const [selectedFreeflowContexts, setSelectedFreeflowContexts] = useState<SelectedFreeflowContext[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [activitySteps, setActivitySteps] = useState<ActivityStep[]>([]);
  const [activitySeconds, setActivitySeconds] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const activityStepsRef = useRef<ActivityStep[]>([]);
  const activeActivityMessageIdRef = useRef<string | null>(null);
  const { activeTab, activeProjectId, currentFilePath, projectWorkspacePath, activeNodeIdx, scriptContent, setScriptContent, titlePage, characters, setCharacters, locations, setLocations, comments, setComments, freeflowNodes, freeflowEdges, freeflowGroups, setFreeflow, wordGoal, pageGoal, screenplayFontFamily, lockSceneNumbers, revisionMode, pageBgColor, setWordGoal, setPageGoal, setScreenplayFontFamily, setLockSceneNumbers, setRevisionMode, setPageBgColor } = useAppStore();
  const projectConversationKey = activeProjectId || 'draftill:no-active-screenplay';
  const conversationKey = activeConversationKeys[projectConversationKey] || projectConversationKey;
  const conversation = conversations[conversationKey] || { messages: [], toolEvents: [] };
  const screenplayTitle = titlePage.title?.trim() || 'Untitled Screenplay';
  const messages = conversation.messages;
  const setMessages = (next: Message[] | ((current: Message[]) => Message[])) => {
    setConversations((current) => {
      const existing = current[conversationKey] || { messages: [], toolEvents: [] };
      const messages = typeof next === 'function' ? next(existing.messages) : next;
      return { ...current, [conversationKey]: { ...existing, title: screenplayTitle, updatedAt: Date.now(), messages: messages.slice(-80) } };
    });
  };
  const setToolEvents = (next: string[] | ((current: string[]) => string[])) => {
    setConversations((current) => {
      const existing = current[conversationKey] || { messages: [], toolEvents: [] };
      const toolEvents = typeof next === 'function' ? next(existing.toolEvents) : next;
      return { ...current, [conversationKey]: { ...existing, title: screenplayTitle, updatedAt: Date.now(), toolEvents: toolEvents.slice(-80) } };
    });
  };
  const setActivity = (next: ActivityStep[] | ((current: ActivityStep[]) => ActivityStep[])) => {
    const resolved = typeof next === 'function' ? next(activityStepsRef.current) : next;
    activityStepsRef.current = resolved;
    setActivitySteps(resolved);
  };

  useEffect(() => { window.ipcRenderer?.invoke('ai:getConfig').then((result) => { const config = result?.config; setConfigured(Boolean(config?.provider && config?.model)); setModelName(config?.model || ''); }); }, []);
  useEffect(() => { setPrompt(''); setError(''); }, [conversationKey]);
  useEffect(() => {
    const serializable = Object.fromEntries(Object.entries(conversations).map(([key, item]) => [key, { ...item, messages: item.messages.map(({ generatedImages: _generatedImages, ...message }) => message) }]));
    localStorage.setItem('draftill:ai-chat-history', JSON.stringify(serializable));
  }, [conversations]);
  useEffect(() => { localStorage.setItem('draftill:ai-active-conversations', JSON.stringify(activeConversationKeys)); }, [activeConversationKeys]);
  useEffect(() => {
    if (!isSending) return;
    const startedAt = Date.now();
    const interval = window.setInterval(() => setActivitySeconds(Math.max(1, Math.floor((Date.now() - startedAt) / 1000))), 250);
    return () => window.clearInterval(interval);
  }, [isSending]);
  useEffect(() => {
    const messageId = activeActivityMessageIdRef.current;
    if (!messageId) return;
    setMessages((current) => current.map((message) => message.id === messageId ? { ...message, activity: activitySteps, activitySeconds } : message));
  }, [activitySteps, activitySeconds]);
  useEffect(() => {
    const addExcerpt = (event: Event) => {
      const detail = (event as CustomEvent<{ nodeIndex?: number; selectionText?: string }>).detail;
      if (typeof detail?.nodeIndex !== 'number' || !detail.selectionText) return;
      const nodeIndex = detail.nodeIndex;
      const text = detail.selectionText;
      setSelectedExcerpts((current) => [...current, { id: crypto.randomUUID(), nodeIndex, text }]);
    };
    window.addEventListener('draftill:ai-add-context', addExcerpt);
    return () => window.removeEventListener('draftill:ai-add-context', addExcerpt);
  }, []);
  useEffect(() => {
    const updateFreeflowContext = (event: Event) => {
      const detail = (event as CustomEvent<{ nodeIds?: string[] }>).detail;
      const nodeIds = Array.isArray(detail?.nodeIds) ? [...new Set(detail.nodeIds.filter((id): id is string => typeof id === 'string' && id.length > 0))] : [];
      setSelectedFreeflowContexts(nodeIds.map((nodeId) => ({ nodeId })));
    };
    window.addEventListener('draftill:ai-freeflow-context-change', updateFreeflowContext);
    return () => window.removeEventListener('draftill:ai-freeflow-context-change', updateFreeflowContext);
  }, []);
  const historyEntries = Object.entries(conversations).filter(([, item]) => item.messages.length > 0).sort(([, first], [, second]) => (second.updatedAt || 0) - (first.updatedAt || 0));
  const sceneMentions: string[] = (scriptContent?.content || []).flatMap((node: any) => node.type === 'page' ? node.content || [] : [node]).filter((node: any) => node.type === 'sceneHeading').map((node: any) => (node.content || []).map((part: any) => part.text || '').join('')).filter(Boolean);
  const mentionMatch = prompt.match(/(?:^|\s)([@#])([^@#\n]*)$/);
  const mentionQuery = mentionMatch?.[2].trim().toLocaleLowerCase() || '';
  const mentionOptions = mentionMatch?.[1] === '@' ? characters.filter((character) => character.name.toLocaleLowerCase().includes(mentionQuery)).slice(0, 5).map((character) => ({ label: character.name, icon: AtSign })) : mentionMatch?.[1] === '#' ? sceneMentions.filter((scene) => scene.toLocaleLowerCase().includes(mentionQuery)).slice(0, 5).map((scene) => ({ label: scene, icon: Hash })) : [];
  const insertMention = (label: string) => setPrompt((current) => current.replace(/(?:^|\s)([@#])([^@#\n]*)$/, (matched, marker: string) => `${matched.startsWith(' ') ? ' ' : ''}${marker}${label} `));

  const startNewChat = () => {
    const newConversationKey = `${projectConversationKey}::${crypto.randomUUID()}`;
    setConversations((current) => ({ ...current, [newConversationKey]: { messages: [], toolEvents: [], title: screenplayTitle, updatedAt: Date.now() } }));
    setActiveConversationKeys((current) => ({ ...current, [projectConversationKey]: newConversationKey }));
    setPrompt('');
    setAttachments([]);
    setSelectedExcerpts([]);
    setSelectedFreeflowContexts([]);
    setError('');
    activeActivityMessageIdRef.current = null;
    setActivity([]);
    setIsHistoryOpen(false);
  };

  const makeScreenplayNodes = (blocks: ScreenplayBlock[]) => {
    const allowedTypes = new Set(['sceneHeading', 'action', 'character', 'dialogue', 'parenthetical', 'transition', 'shot']);
    return blocks.slice(0, 36).flatMap((block) => {
      const text = typeof block?.text === 'string' ? block.text.trim().slice(0, 3000) : '';
      return text && allowedTypes.has(block.type) ? [{ type: block.type, attrs: { revision: 'none', id: crypto.randomUUID() }, content: [{ type: 'text', text }] }] : [];
    });
  };
  const createVersionCheckpoint = async (label: string) => {
    const gitFilePath = currentFilePath || (projectWorkspacePath ? activeProjectId : null);
    if (!gitFilePath || !window.ipcRenderer) throw new Error('Save this screenplay before AI editing so Draftill can create a version checkpoint.');
    const committed = await window.ipcRenderer.invoke('git:commit', gitFilePath, label.slice(0, 120), JSON.stringify({ scriptContent }));
    if (!committed?.success) throw new Error(committed?.error || 'Could not create the pre-edit checkpoint.');
  };

  const executeCalls = async (calls: ToolCall[], onProgress?: (call: ToolCall, index: number, status: 'running' | 'complete' | 'failed', detail?: string) => void, requestLabel = 'AI edit') => {
    const events: string[] = [];
    const nextNodes = [...freeflowNodes];
    let nextEdges = [...freeflowEdges];
    const nextCharacters = [...characters];
    const nextLocations = [...locations];
    const nextComments = [...comments];
    const document = structuredClone(scriptContent || { type: 'doc', content: [] });
    let freeflowChanged = false;
    let charactersChanged = false;
    let locationsChanged = false;
    let commentsChanged = false;
    let screenplayChanged = false;
    const versionedMutations = new Set(['edit_screenplay_pages', 'create_scene']);
    const hasVersionedMutation = calls.some((call) => versionedMutations.has(call.function?.name || ''));

    if (hasVersionedMutation) {
      const checkpointCall: ToolCall = { function: { name: 'create_version_checkpoint', arguments: '{}' } };
      onProgress?.(checkpointCall, -1, 'running');
      try {
        await createVersionCheckpoint(`Before AI change: ${requestLabel || 'Draftill edit'}`);
        const checkpointEvent = 'Created a version checkpoint before AI changes';
        events.push(checkpointEvent);
        onProgress?.(checkpointCall, -1, 'complete', checkpointEvent);
      } catch (checkpointError) {
        const checkpointEvent = checkpointError instanceof Error ? checkpointError.message : 'Version checkpoint failed.';
        events.push(`Stopped AI changes: ${checkpointEvent}`);
        onProgress?.(checkpointCall, -1, 'failed', checkpointEvent);
        setToolEvents((current) => [...current, ...events]);
        return events;
      }
    }

    const ensurePage = (requestedPage: unknown) => {
      const pageNumber = Math.min(200, Math.max(1, Number.isInteger(requestedPage) ? Number(requestedPage) : (activeNodeIdx || 0) + 1));
      if ((document.content || []).some((node: any) => node.type !== 'page')) document.content = [{ type: 'page', content: document.content || [] }];
      document.content ||= [];
      while (document.content.length < pageNumber) document.content.push({ type: 'page', content: [] });
      return { page: document.content[pageNumber - 1], pageNumber };
    };
    const parseBlocks = (value: unknown) => makeScreenplayNodes(Array.isArray(value) ? value.filter((block): block is ScreenplayBlock => Boolean(block) && typeof block === 'object' && typeof (block as ScreenplayBlock).type === 'string' && typeof (block as ScreenplayBlock).text === 'string') : []);

    for (const [index, call] of calls.slice(0, 16).entries()) {
      onProgress?.(call, index, 'running');
      try {
        const args = JSON.parse(call.function?.arguments || '{}') as Record<string, any>;
        const name = call.function?.name;
        let event = '';
        if (name === 'edit_screenplay_pages') {
          const edits = (Array.isArray(args.edits) ? args.edits : []).slice(0, 8) as ScreenplayPageEdit[];
          if (!edits.length) throw new Error('No page edits were supplied.');
          let changedBlocks = 0;
          for (const edit of edits) {
            const { page, pageNumber } = ensurePage(edit.page);
            const blocks = parseBlocks(edit.blocks);
            if (!blocks.length) throw new Error(`Page ${pageNumber} has no valid screenplay blocks.`);
            page.content ||= [];
            if (edit.mode === 'replace_page') page.content = blocks;
            else if (edit.mode === 'replace_text') {
              const targetText = typeof edit.targetText === 'string' ? edit.targetText.trim() : '';
              const blockIndex = page.content.findIndex((node: any) => (node.content || []).map((part: any) => part.text || '').join('').trim() === targetText);
              if (!targetText || blockIndex === -1) throw new Error(`The target text was not found on page ${pageNumber}.`);
              page.content.splice(blockIndex, 1, ...blocks);
            } else page.content.push(...blocks);
            changedBlocks += blocks.length;
          }
          screenplayChanged = true;
          event = `Edited ${edits.length} screenplay page${edits.length === 1 ? '' : 's'} (${changedBlocks} blocks)`;
        } else if (name === 'create_scene') {
          const { page, pageNumber } = ensurePage(args.page);
          const heading = typeof args.heading === 'string' ? args.heading.trim().toUpperCase().slice(0, 180) : '';
          if (!heading) throw new Error('A scene location heading is required.');
          const blocks = parseBlocks([{ type: 'sceneHeading', text: heading }, ...(typeof args.action === 'string' && args.action.trim() ? [{ type: 'action', text: args.action }] : [])]);
          const location = nextLocations.find((item) => item.id === args.locationId) || nextLocations.find((item) => item.heading.trim().toUpperCase() === heading);
          if (location && blocks[0]) (blocks[0] as any).attrs = { ...blocks[0].attrs, entityType: 'location', entityId: location.id };
          page.content = [...(page.content || []), ...blocks];
          screenplayChanged = true;
          event = `Created scene on page ${pageNumber}: ${heading}`;
        } else if (name === 'edit_freeflow_node') {
          const action = String(args.action);
          if (action === 'create') {
            const type = ['scene', 'shot', 'character', 'note', 'link', 'checklist'].includes(String(args.type)) ? args.type as 'scene' | 'shot' | 'character' | 'note' | 'link' | 'checklist' : 'note';
            const title = typeof args.title === 'string' ? args.title.trim().slice(0, 120) : '';
            if (!title) throw new Error('A Freeflow node title is required.');
            nextNodes.push({ id: crypto.randomUUID(), type, title, detail: typeof args.detail === 'string' ? args.detail.slice(0, 1200) : '', url: type === 'link' && typeof args.url === 'string' ? args.url.slice(0, 2000) : undefined, linkPreview: type === 'link' ? null : undefined, checklist: type === 'checklist' ? (Array.isArray(args.checklist) ? args.checklist : []).slice(0, 30).map((item: any) => ({ id: crypto.randomUUID(), text: typeof item?.text === 'string' ? item.text.slice(0, 300) : '', checked: Boolean(item?.checked) })) : undefined, x: typeof args.x === 'number' ? args.x : 180 + (nextNodes.length % 4) * 245, y: typeof args.y === 'number' ? args.y : 150 + Math.floor(nextNodes.length / 4) * 180, width: typeof args.width === 'number' ? args.width : (type === 'link' || type === 'checklist' ? 270 : 220), groupId: null });
            event = `Created Freeflow ${type}: ${title}`;
          } else {
            const nodeIndex = nextNodes.findIndex((node) => node.id === args.id);
            if (nodeIndex === -1) throw new Error('The Freeflow node id was not found.');
            if (action === 'delete') { const title = nextNodes[nodeIndex].title; nextNodes.splice(nodeIndex, 1); nextEdges = nextEdges.filter((edge) => edge.from !== args.id && edge.to !== args.id); event = `Deleted Freeflow node: ${title}`; }
            else { const current = nextNodes[nodeIndex]; nextNodes[nodeIndex] = { ...current, type: ['scene', 'shot', 'character', 'note', 'link', 'checklist'].includes(String(args.type)) ? args.type : current.type, title: typeof args.title === 'string' ? args.title.trim().slice(0, 120) || current.title : current.title, detail: typeof args.detail === 'string' ? args.detail.slice(0, 1200) : current.detail, url: typeof args.url === 'string' ? args.url.slice(0, 2000) : current.url, linkPreview: typeof args.url === 'string' && args.url !== current.url ? null : current.linkPreview, checklist: Array.isArray(args.checklist) ? args.checklist.slice(0, 30).map((item: any) => ({ id: crypto.randomUUID(), text: typeof item?.text === 'string' ? item.text.slice(0, 300) : '', checked: Boolean(item?.checked) })) : current.checklist, x: typeof args.x === 'number' ? args.x : current.x, y: typeof args.y === 'number' ? args.y : current.y, width: typeof args.width === 'number' ? args.width : current.width }; event = `Updated Freeflow node: ${nextNodes[nodeIndex].title}`; }
          }
          freeflowChanged = true;
        } else if (name === 'connect_freeflow_nodes') {
          if (args.action === 'connect') {
            const endpointIds = new Set([...nextNodes.map((node) => node.id), ...freeflowGroups.map((group) => group.id)]);
            if (!endpointIds.has(args.from) || !endpointIds.has(args.to) || args.from === args.to) throw new Error('Both valid source and target node or group ids are required.');
            const fromPort = Number.isInteger(args.fromPort) ? Math.max(0, args.fromPort) : 0;
            const toPort = Number.isInteger(args.toPort) ? Math.max(0, args.toPort) : 0;
            if (!nextEdges.some((edge) => edge.from === args.from && edge.to === args.to && (edge.fromPort || 0) === fromPort && (edge.toPort || 0) === toPort)) nextEdges.push({ id: crypto.randomUUID(), from: args.from, to: args.to, fromPort, toPort, style: ['curve', 'straight', 'elbow'].includes(args.style) ? args.style : 'curve' });
            event = 'Connected two Freeflow endpoints';
          } else {
            const edgeIndex = nextEdges.findIndex((edge) => edge.id === args.edgeId);
            if (edgeIndex === -1) throw new Error('The Freeflow connection id was not found.');
            if (args.action === 'delete') { nextEdges.splice(edgeIndex, 1); event = 'Deleted a Freeflow connection'; }
            else { nextEdges[edgeIndex] = { ...nextEdges[edgeIndex], style: ['curve', 'straight', 'elbow'].includes(args.style) ? args.style : nextEdges[edgeIndex].style }; event = 'Updated a Freeflow connection'; }
          }
          freeflowChanged = true;
        } else if (name === 'edit_character') {
          if (args.action === 'create') {
            const characterName = typeof args.name === 'string' ? args.name.trim().slice(0, 100) : '';
            if (!characterName) throw new Error('A character name is required.');
            nextCharacters.push({ id: crypto.randomUUID(), name: characterName, description: typeof args.description === 'string' ? args.description.slice(0, 1400) : '', role: typeof args.role === 'string' ? args.role.slice(0, 120) : '', arc: typeof args.arc === 'string' ? args.arc.slice(0, 1200) : '', notes: typeof args.notes === 'string' ? args.notes.slice(0, 1400) : '', image: null, screenTimePercent: 0, scenesFeatured: [] });
            event = `Created character: ${characterName}`;
          } else {
            const characterIndex = nextCharacters.findIndex((character) => character.id === args.id);
            if (characterIndex === -1) throw new Error('The Character Bible id was not found.');
            if (args.action === 'delete') { const characterName = nextCharacters[characterIndex].name; nextCharacters.splice(characterIndex, 1); event = `Deleted character: ${characterName}`; }
            else { const current = nextCharacters[characterIndex]; nextCharacters[characterIndex] = { ...current, name: typeof args.name === 'string' ? args.name.trim().slice(0, 100) || current.name : current.name, role: typeof args.role === 'string' ? args.role.slice(0, 120) : current.role, description: typeof args.description === 'string' ? args.description.slice(0, 1400) : current.description, arc: typeof args.arc === 'string' ? args.arc.slice(0, 1200) : current.arc, notes: typeof args.notes === 'string' ? args.notes.slice(0, 1400) : current.notes }; event = `Updated character: ${nextCharacters[characterIndex].name}`; }
          }
          charactersChanged = true;
        } else if (name === 'edit_location') {
          if (args.action === 'create') {
            const heading = typeof args.heading === 'string' ? args.heading.trim().toUpperCase().slice(0, 180) : '';
            if (!heading) throw new Error('A production location heading is required.');
            nextLocations.push({ id: crypto.randomUUID(), heading, description: typeof args.description === 'string' ? args.description.slice(0, 1400) : '', notes: typeof args.notes === 'string' ? args.notes.slice(0, 1200) : '', image: null });
            event = `Created location: ${heading}`;
          } else {
            const locationIndex = nextLocations.findIndex((location) => location.id === args.id);
            if (locationIndex === -1) throw new Error('The Location-library id was not found.');
            if (args.action === 'delete') { const heading = nextLocations[locationIndex].heading; nextLocations.splice(locationIndex, 1); event = `Deleted location: ${heading}`; }
            else { const current = nextLocations[locationIndex]; nextLocations[locationIndex] = { ...current, heading: typeof args.heading === 'string' ? args.heading.trim().toUpperCase().slice(0, 180) || current.heading : current.heading, description: typeof args.description === 'string' ? args.description.slice(0, 1400) : current.description, notes: typeof args.notes === 'string' ? args.notes.slice(0, 1200) : current.notes }; event = `Updated location: ${nextLocations[locationIndex].heading}`; }
          }
          locationsChanged = true;
        } else if (name === 'edit_comment') {
          if (args.action === 'create') {
            const commentText = typeof args.text === 'string' ? args.text.trim().slice(0, 1200) : '';
            if (!commentText) throw new Error('Comment text is required.');
            nextComments.push({ id: crypto.randomUUID(), nodeIndex: Number.isInteger(args.nodeIndex) ? Math.max(0, args.nodeIndex) : activeNodeIdx || 0, selectionText: typeof args.selectionText === 'string' ? args.selectionText.slice(0, 500) : undefined, text: commentText, author: 'Draftill AI', timestamp: Date.now() });
            event = 'Created a screenplay comment';
          } else {
            const commentIndex = nextComments.findIndex((comment) => comment.id === args.id);
            if (commentIndex === -1) throw new Error('The comment id was not found.');
            if (args.action === 'delete') { nextComments.splice(commentIndex, 1); event = 'Deleted a screenplay comment'; }
            else { const current = nextComments[commentIndex]; nextComments[commentIndex] = { ...current, text: typeof args.text === 'string' ? args.text.trim().slice(0, 1200) || current.text : current.text, nodeIndex: Number.isInteger(args.nodeIndex) ? Math.max(0, args.nodeIndex) : current.nodeIndex, selectionText: typeof args.selectionText === 'string' ? args.selectionText.slice(0, 500) : current.selectionText }; event = 'Updated a screenplay comment'; }
          }
          commentsChanged = true;
        } else if (name === 'create_version_checkpoint') {
          if (activeTab !== 'script') throw new Error('Version Control is available only from the screenplay editor.');
          await createVersionCheckpoint(typeof args.label === 'string' && args.label.trim() ? args.label.trim() : 'Draftill AI checkpoint');
          event = 'Created a named version checkpoint';
        } else if (name === 'update_editor_settings') {
          let changed = false;
          if (typeof args.wordGoal === 'number' && Number.isFinite(args.wordGoal) && args.wordGoal >= 0) { setWordGoal(Math.round(args.wordGoal)); changed = true; }
          if (typeof args.pageGoal === 'number' && Number.isFinite(args.pageGoal) && args.pageGoal >= 0) { setPageGoal(Math.round(args.pageGoal)); changed = true; }
          if (typeof args.screenplayFontFamily === 'string' && args.screenplayFontFamily.trim()) { setScreenplayFontFamily(args.screenplayFontFamily.trim().slice(0, 120)); changed = true; }
          if (typeof args.lockSceneNumbers === 'boolean') { setLockSceneNumbers(args.lockSceneNumbers); changed = true; }
          if (['none', 'blue', 'pink', 'yellow', 'green'].includes(String(args.revisionMode))) { setRevisionMode(String(args.revisionMode) as 'none' | 'blue' | 'pink' | 'yellow' | 'green'); changed = true; }
          if (typeof args.pageBackground === 'string' && /^#[0-9a-f]{6}$/i.test(args.pageBackground)) { setPageBgColor(args.pageBackground); changed = true; }
          if (!changed) throw new Error('No supported editor setting was supplied.');
          event = 'Updated editor settings';
        } else throw new Error('This Draftill action is not supported.');
        events.push(event);
        onProgress?.(call, index, 'complete', event);
      } catch (error) {
        const event = `Skipped ${toolLabel(call)}: ${error instanceof Error ? error.message : 'invalid input'}`;
        events.push(event);
        onProgress?.(call, index, 'failed', event);
      }
    }
    if (freeflowChanged) {
      const nextGroups = freeflowGroups.map((group) => ({ ...group, nodeIds: group.nodeIds.filter((id) => nextNodes.some((node) => node.id === id)) })).filter((group) => group.nodeIds.length);
      const endpointIds = new Set([...nextNodes.map((node) => node.id), ...nextGroups.map((group) => group.id)]);
      setFreeflow(nextNodes, nextEdges.filter((edge) => endpointIds.has(edge.from) && endpointIds.has(edge.to)), nextGroups);
    }
    if (screenplayChanged) setScriptContent(document);
    if (charactersChanged) setCharacters(nextCharacters);
    if (locationsChanged) setLocations(nextLocations);
    if (commentsChanged) setComments(nextComments);
    if (events.length) setToolEvents((current) => [...current, ...events]);
    return events;
  };
  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const selected = Array.from(files).slice(0, 4);
    const supported = selected.filter((file) => /^(image|audio|video)\//.test(file.type));
    if (supported.length !== selected.length) setError('Attach images, audio, or video files only.');
    const tooLarge = supported.find((file) => file.size > 8 * 1024 * 1024);
    if (tooLarge) { setError(`${tooLarge.name} is larger than the 8 MB attachment limit.`); return; }
    const loaded = await Promise.all(supported.map((file) => new Promise<Attachment>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ id: crypto.randomUUID(), name: file.name, mime: file.type, dataUrl: String(reader.result), kind: file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('video/') ? 'video' : 'file' });
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    })));
    setAttachments((current) => [...current, ...loaded]);
    setError('');
  };
  const toggleRecording = async () => {
    if (isRecording && recorderRef.current) { recorderRef.current.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) recordingChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => setAttachments((current) => [...current, { id: crypto.randomUUID(), name: `Voice note ${new Date().toLocaleTimeString()}.webm`, mime: blob.type || 'audio/webm', dataUrl: String(reader.result), kind: 'audio' }]);
        reader.readAsDataURL(blob);
        setIsRecording(false);
      };
      recorder.start(); recorderRef.current = recorder; setIsRecording(true); setError('');
    } catch { setError('Microphone access is required to record a voice note.'); }
  };
  const saveGeneratedImage = async (image: GeneratedImage, index: number) => {
    if (!window.ipcRenderer) return;
    const result = await window.ipcRenderer.invoke('ai:saveGeneratedImage', { dataUrl: image.dataUrl, mime: image.mime, suggestedName: `Draftill-AI-${index + 1}` });
    if (!result?.success && !result?.canceled) setError(result?.error || 'Could not save the generated image.');
  };
  const sendPrompt = async () => {
    const text = prompt.trim(); if (!text || isSending || !window.ipcRenderer) return;
    const outgoingAttachments = attachments;
    const outgoingExcerpts = selectedExcerpts;
    const outgoingFreeflowNodes = selectedFreeflowContexts.map((contextItem) => freeflowNodes.find((node) => node.id === contextItem.nodeId)).filter((node): node is NonNullable<typeof node> => Boolean(node));
    const outgoingFreeflowIds = new Set(outgoingFreeflowNodes.map((node) => node.id));
    const outgoingFreeflowEdges = freeflowEdges.filter((edge) => outgoingFreeflowIds.has(edge.from) || outgoingFreeflowIds.has(edge.to));
    const attachmentNote = outgoingAttachments.length ? `\n[Attached: ${outgoingAttachments.map((attachment) => attachment.name).join(', ')}]` : '';
    const screenplayAiContext = outgoingExcerpts.length ? `\n\n[SELECTED SCREENPLAY TEXT — authoritative context for this request]\n${outgoingExcerpts.map((excerpt, index) => `Excerpt ${index + 1}, page ${excerpt.nodeIndex + 1}:\n${excerpt.text}`).join('\n\n')}\n[/SELECTED SCREENPLAY TEXT]` : '';
    const freeflowAiContext = outgoingFreeflowNodes.length ? `\n\n[SELECTED FREEFLOW NODES — authoritative context for this request]\n${outgoingFreeflowNodes.map((node, index) => `Node ${index + 1}\nID: ${node.id}\nType: ${node.type}\nTitle: ${node.title}\nDetails: ${node.detail || 'No details'}\nURL: ${node.url || 'None'}\nChecklist: ${node.checklist?.length ? node.checklist.map((item) => `[${item.checked ? 'x' : ' '}] ${item.text}`).join(' | ') : 'None'}\nGroup: ${node.groupId || 'None'}\nHas image: ${Boolean(node.image)}\nHas video: ${Boolean(node.video)}`).join('\n\n')}\nConnections touching the selection:\n${outgoingFreeflowEdges.length ? outgoingFreeflowEdges.map((edge) => `${edge.from} -> ${edge.to} (${edge.style || 'curve'})`).join('\n') : 'None'}\n[/SELECTED FREEFLOW NODES]` : '';
    const referenceInstruction = screenplayAiContext || freeflowAiContext ? `\nTreat “this”, “it”, “that”, “the node”, and similar references in the user's message as referring to the selected context above. Use its real IDs, type, title, details, and connections. Do not ask the user to repeat or clarify the selection.` : '';
    const aiContext = `${screenplayAiContext}${freeflowAiContext}${referenceInstruction}`;
    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: text + attachmentNote, aiContext, excerpts: outgoingExcerpts.map(({ nodeIndex, text }) => ({ nodeIndex, text })), freeflowContexts: outgoingFreeflowNodes.map((node) => ({ nodeId: node.id, type: node.type, title: node.title })), attachmentNames: outgoingAttachments.map((attachment) => attachment.name) };
    const nextMessages = [...messages, userMessage];
    const initialActivity: ActivityStep[] = [{ id: crypto.randomUUID(), label: 'Reading active page', kind: 'thinking', status: 'running' }];
    const pendingResponseId = crypto.randomUUID();
    activeActivityMessageIdRef.current = pendingResponseId;
    setMessages([...nextMessages, { id: pendingResponseId, role: 'assistant', content: '', activity: initialActivity, activitySeconds: 0 }]);
    setPrompt(''); setError(''); setAttachments([]); setSelectedExcerpts([]); setActivitySeconds(0); setActivity(initialActivity); setIsSending(true);
    const rawPages = (scriptContent?.content || []).some((node: any) => node.type === 'page') ? (scriptContent?.content || []).filter((node: any) => node.type === 'page') : [{ type: 'page', content: scriptContent?.content || [] }];
    const compactBlocks = (page: any) => (page?.content || []).map((node: any) => ({ id: node.attrs?.id || null, type: node.type, text: (node.content || []).map((part: any) => part.text || '').join('').slice(0, 1200) })).filter((block: any) => block.text);
    const currentPageIndex = Math.min(Math.max(activeNodeIdx || 0, 0), Math.max(rawPages.length - 1, 0));
    const requestedPageNumbers = [...text.matchAll(/\bpages?\s+(\d{1,3})\b/gi)].map((match) => Number(match[1])).filter((pageNumber) => pageNumber >= 1 && pageNumber <= rawPages.length && pageNumber !== currentPageIndex + 1);
    const pageSummaries = rawPages.map((page: any, index: number) => { const blocks = compactBlocks(page); const firstScene = blocks.find((block: any) => block.type === 'sceneHeading')?.text || ''; return { page: index + 1, scene: firstScene, excerpt: blocks.map((block: any) => block.text).join(' ').slice(0, 220) }; });
    const compactFreeflowNodes = freeflowNodes.map((node) => ({ id: node.id, type: node.type, title: node.title.slice(0, 120), detail: node.detail.slice(0, 500), url: node.url?.slice(0, 800) || null, checklist: node.checklist?.slice(0, 30).map((item) => ({ text: item.text.slice(0, 200), checked: item.checked })) || null, x: Math.round(node.x), y: Math.round(node.y), groupId: node.groupId || null, hasImage: Boolean(node.image), hasVideo: Boolean(node.video) }));
    const context = JSON.stringify({ activeSurface: activeTab, versionControlSurfaces: ['script'], activePage: { page: currentPageIndex + 1, blocks: compactBlocks(rawPages[currentPageIndex]) }, requestedPages: requestedPageNumbers.map((pageNumber) => ({ page: pageNumber, blocks: compactBlocks(rawPages[pageNumber - 1]) })), pageSummaries, editor: { wordGoal, pageGoal, screenplayFontFamily, lockSceneNumbers, revisionMode, pageBackground: pageBgColor }, characters: characters.map((character) => ({ id: character.id, name: character.name, role: character.role, description: character.description.slice(0, 500), arc: character.arc.slice(0, 400), notes: character.notes.slice(0, 300), hasImage: Boolean(character.image) })), locations: locations.map((location) => ({ id: location.id, heading: location.heading, description: location.description.slice(0, 600), notes: location.notes.slice(0, 400), hasImage: Boolean(location.image) })), comments: comments.map((comment) => ({ id: comment.id, page: comment.nodeIndex + 1, text: comment.text.slice(0, 300), selectionText: comment.selectionText?.slice(0, 200) })), selectedExcerpts: outgoingExcerpts.map((excerpt) => ({ page: excerpt.nodeIndex + 1, text: excerpt.text.slice(0, 1200) })), selectedFreeflow: { nodes: outgoingFreeflowNodes.map((node) => compactFreeflowNodes.find((candidate) => candidate.id === node.id)), edges: outgoingFreeflowEdges }, freeflow: { nodes: compactFreeflowNodes, edges: freeflowEdges, groups: freeflowGroups } });
    const progressTimer = window.setTimeout(() => setActivity((current) => current.map((step) => step.status === 'running' ? { ...step, status: 'complete' as const } : step).concat({ id: crypto.randomUUID(), label: 'Drafting a response', detail: 'Planning any requested Draftill edits.', kind: 'thinking', status: 'running' } as ActivityStep)), 650);
    try {
      const requestMessages = nextMessages.slice(-10).map((message, index, windowedMessages) => ({ role: message.role, content: `${message.content}${index === windowedMessages.length - 1 ? message.aiContext || '' : ''}`.slice(-5000) }));
      const result = await window.ipcRenderer.invoke('ai:chat', { messages: requestMessages, context, attachments: outgoingAttachments });
      window.clearTimeout(progressTimer);
      if (!result?.success) {
        const message = result?.error || 'The AI request failed.';
        setError(message);
        const failedActivity = activityStepsRef.current.map((step) => step.status === 'running' ? { ...step, detail: message, status: 'failed' as const } : step);
        setActivity(failedActivity);
        setMessages((current) => current.map((item) => item.id === pendingResponseId ? { ...item, content: message, activity: failedActivity, activitySeconds } : item));
        return;
      }
      if (result.attachmentNotice) setToolEvents((current) => [...current, result.attachmentNotice]);
      if (typeof result.reasoning === 'string' && result.reasoning.trim()) {
        setActivity((current) => [...current, { id: `reasoning-${crypto.randomUUID()}`, label: 'Model reasoning', detail: result.reasoning.trim().slice(0, 12000), kind: 'thinking', status: 'complete' }]);
      }
      const providerEvents = (Array.isArray(result.providerEvents) ? result.providerEvents : []) as ProviderEvent[];
      if (providerEvents.length) {
        setActivity((current) => current.map((step) => step.status === 'running' ? { ...step, status: 'complete' as const } : step).concat(providerEvents.map((providerEvent) => ({ id: `${providerEvent.name}-${crypto.randomUUID()}`, label: providerEvent.name === 'web_search' ? 'Searched the web' : 'Generated an image', detail: providerEvent.detail, toolName: providerEvent.name, kind: 'tool' as const, status: 'complete' as const }))));
      }
      const actionEvents = await executeCalls(result.toolCalls || [], (call, index, status, detail) => {
        setActivity((current) => {
          if (status === 'running') return current.map((step) => step.status === 'running' ? { ...step, status: 'complete' as const } : step).concat({ id: `${call.function?.name || 'tool'}-${index}-${crypto.randomUUID()}`, label: toolLabel(call), toolName: call.function?.name, kind: 'tool', status: 'running' } as ActivityStep);
          return current.map((step) => step.status === 'running' ? { ...step, detail, status } : step);
        });
      }, text);
      const modelContent = typeof result.content === 'string' ? result.content.trim() : '';
      const isPlaceholder = /^Working with Draftill tools/i.test(modelContent);
      const completion = actionEvents.length ? `Completed in Draftill:\n${actionEvents.map((event) => `- ${event}`).join('\n')}` : '';
      let reply = modelContent && !isPlaceholder ? modelContent : completion;
      if (actionEvents.length) {
        const summaryStepId = `summary-${crypto.randomUUID()}`;
        setActivity((current) => current.map((step) => step.status === 'running' ? { ...step, status: 'complete' as const } : step).concat({ id: summaryStepId, label: 'Confirming completed changes', detail: 'Turning tool results into a clear response.', kind: 'thinking', status: 'running' }));
        const summaryResult = await window.ipcRenderer.invoke('ai:chat', {
          mode: 'summary',
          messages: [{ role: 'user', content: `Original request:\n${text}\n\nActual Draftill tool outcomes:\n${actionEvents.map((event) => `- ${event}`).join('\n')}` }],
          context: 'Use only the listed tool outcomes.'
        });
        setActivity((current) => current.map((step) => step.id === summaryStepId ? { ...step, detail: summaryResult?.success ? 'Prepared the final response from actual tool outcomes.' : 'Used the verified tool outcome summary.', status: 'complete' as const } : step));
        const summarizedContent = typeof summaryResult?.content === 'string' ? summaryResult.content.trim() : '';
        if (summaryResult?.success && summarizedContent) reply = summarizedContent;
      }
      const completedActivity = activityStepsRef.current.map((step) => step.status === 'running' ? { ...step, status: 'complete' as const } : step);
      setActivity(completedActivity);
      const generatedImages = (Array.isArray(result.generatedImages) ? result.generatedImages : []) as GeneratedImage[];
      const sources = (Array.isArray(result.sources) ? result.sources : []) as SourceLink[];
      if (!reply) reply = generatedImages.length ? 'Generated the requested image.' : 'The model returned an empty response.';
      setMessages((current) => current.map((item) => item.id === pendingResponseId ? { ...item, content: reply, activity: completedActivity, activitySeconds, sources, generatedImages } : item));
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'The AI request failed.';
      setError(message);
      const failedActivity = activityStepsRef.current.map((step) => step.status === 'running' ? { ...step, detail: message, status: 'failed' as const } : step);
      setActivity(failedActivity);
      setMessages((current) => current.map((item) => item.id === pendingResponseId ? { ...item, content: message, activity: failedActivity, activitySeconds } : item));
    } finally {
      window.clearTimeout(progressTimer);
      activeActivityMessageIdRef.current = null;
      setIsSending(false);
    }
  };

  return <div className="relative flex min-h-0 flex-1 flex-col">
    <div className="flex items-center justify-between border-b border-[#333] px-5 py-4"><div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-white"><AIIcon size={16} /> Draftill AI</div><p className="mt-1 text-[10px] text-gray-500">{configured ? `Using ${modelName}` : 'Set up a model in Global Settings.'}</p></div><div className="flex items-center gap-1"><button onClick={startNewChat} disabled={isSending} className="rounded p-1.5 text-gray-400 transition-colors hover:bg-white/5 hover:text-[#F4C430] disabled:cursor-not-allowed disabled:opacity-30" title={isSending ? 'Wait for the current response' : 'New chat'}><Plus size={16} /></button><button onClick={() => setIsHistoryOpen((open) => !open)} className={`rounded p-1.5 transition-colors ${isHistoryOpen ? 'bg-[#F4C430]/15 text-[#F4C430]' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`} title="Chat history"><HistoryIcon size={15} /></button><button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-white/5 hover:text-white" title="Close AI"><X size={15} /></button></div></div>
    {isHistoryOpen && <div className="absolute inset-x-3 top-[68px] z-30 max-h-[calc(100%-84px)] overflow-y-auto rounded-lg border border-[#3a3a3a] bg-[#1b1b1b] p-3 shadow-2xl"><div className="mb-3 flex items-center justify-between"><div><p className="text-[11px] font-bold text-white">Chat history</p><p className="mt-0.5 text-[9px] text-gray-500">Saved separately for each screenplay.</p></div><button onClick={() => setIsHistoryOpen(false)} className="rounded p-1 text-gray-500 hover:bg-white/5 hover:text-white" title="Close history"><X size={13} /></button></div>{historyEntries.length === 0 ? <p className="py-6 text-center text-[11px] text-gray-500">No saved AI chats yet.</p> : <div className="space-y-2">{historyEntries.map(([key, item]) => <details key={key} open={key === conversationKey} className="rounded border border-[#343434] bg-[#222]"><summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2"><div className="min-w-0"><p className="truncate text-[11px] font-bold text-gray-200">{item.title || 'Untitled Screenplay'}{key === conversationKey && <span className="ml-1.5 text-[9px] text-[#F4C430]">ACTIVE</span>}</p><p className="mt-0.5 text-[9px] text-gray-500">{item.messages.length} messages{item.updatedAt ? ` · ${new Date(item.updatedAt).toLocaleString()}` : ''}</p></div><ChevronDown size={12} className="shrink-0 text-gray-500" /></summary><div className="max-h-52 space-y-2 overflow-y-auto border-t border-[#343434] px-2.5 py-2">{item.messages.map((message, index) => <div key={`${key}-${index}`} className={`rounded p-2 text-[10px] leading-relaxed ${message.role === 'user' ? 'ml-3 bg-[#383838] text-gray-200' : 'mr-2 bg-[#191919] text-gray-400'}`}><p className="mb-1 text-[8px] font-bold uppercase tracking-wider text-gray-500">{message.role === 'user' ? 'You' : 'Draftill AI'}</p>{message.content}</div>)}</div></details>)}</div>}</div>}
    {configured === false ? <div className="flex flex-1 flex-col items-center justify-center p-7 text-center"><div className="rounded-full bg-[#F4C430]/10 p-3 text-[#F4C430]"><Settings2 size={22} /></div><h3 className="mt-4 text-sm font-bold text-white">AI is not set up</h3><p className="mt-2 max-w-xs text-[11px] leading-relaxed text-gray-500">Choose a private local model or connect a provider API in Global Settings.</p><button onClick={onOpenSettings} className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#F4C430] px-3 py-2 text-[11px] font-bold text-black"><Settings2 size={13} /> Set up in Settings</button></div> : configured === null ? <div className="flex flex-1 items-center justify-center text-gray-500"><Loader2 size={16} className="animate-spin" /></div> : <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && <p className="text-[11px] leading-relaxed text-gray-500">Ask for a scene rewrite, dialogue pass, character idea, or multilingual translation.</p>}
        {messages.map((message, index) => <div key={message.id || `${message.role}-${index}`} className={`text-[11px] leading-[1.55] ${message.role === 'user' ? 'ml-5 rounded-lg bg-[#393939] p-3 text-gray-200' : 'mr-3 px-1 py-1 text-gray-300'}`}>{message.role === 'assistant' ? <><ActivityTrace steps={message.activity || []} isRunning={message.id === activeActivityMessageIdRef.current && isSending} seconds={message.id === activeActivityMessageIdRef.current ? activitySeconds : message.activitySeconds} />{message.content && <RichReply content={message.content} />}<AssistantArtifacts sources={message.sources} generatedImages={message.generatedImages} onSave={saveGeneratedImage} /></> : <><div className="mb-2 flex flex-wrap gap-1">{message.excerpts?.map((excerpt, excerptIndex) => <span key={`${excerpt.nodeIndex}-${excerptIndex}`} className="flex max-w-full items-center gap-1 rounded-full border border-[#F4C430]/40 bg-[#F4C430]/10 px-2 py-0.5 text-[9px] text-[#F4C430]"><Quote size={9} /><span className="truncate">Page {excerpt.nodeIndex + 1}: {excerpt.text}</span></span>)}{message.freeflowContexts?.map((contextItem) => <span key={contextItem.nodeId} className="flex max-w-full items-center gap-1 rounded-full border border-sky-400/35 bg-sky-400/10 px-2 py-0.5 text-[9px] text-sky-300"><Clapperboard size={9} /><span className="truncate">{contextItem.type}: {contextItem.title}</span></span>)}{message.attachmentNames?.map((name) => <span key={name} className="flex items-center gap-1 rounded-full border border-white/10 bg-black/10 px-2 py-0.5 text-[9px] text-gray-300"><Paperclip size={9} />{name}</span>)}</div><span>{message.content}</span></>}</div>)}
      </div>
      <div className="border-t border-[#333] p-3">
        {(selectedExcerpts.length > 0 || selectedFreeflowContexts.length > 0 || attachments.length > 0) && <div className="mb-2 flex flex-wrap gap-1.5">{selectedExcerpts.map((excerpt) => <span key={excerpt.id} className="flex max-w-full items-center gap-1 rounded-full border border-[#F4C430]/40 bg-[#F4C430]/10 px-2 py-1 text-[9px] text-[#F4C430]"><Quote size={10} /> <span className="truncate">Page {excerpt.nodeIndex + 1}: {excerpt.text}</span><button onClick={() => setSelectedExcerpts((current) => current.filter((item) => item.id !== excerpt.id))} className="text-[#F4C430] hover:text-white"><X size={10} /></button></span>)}{selectedFreeflowContexts.map((contextItem) => { const node = freeflowNodes.find((candidate) => candidate.id === contextItem.nodeId); return node ? <span key={contextItem.nodeId} className="flex max-w-full items-center gap-1 rounded-full border border-sky-400/35 bg-sky-400/10 px-2 py-1 text-[9px] text-sky-300"><Clapperboard size={10} /><span className="truncate">{node.type}: {node.title}</span><button onClick={() => setSelectedFreeflowContexts((current) => current.filter((item) => item.nodeId !== contextItem.nodeId))} className="text-sky-300 hover:text-white"><X size={10} /></button></span> : null; })}{attachments.map((attachment) => <span key={attachment.id} className="flex items-center gap-1 rounded-full border border-[#3e3e3e] bg-[#252525] px-2 py-1 text-[9px] text-gray-300"><Paperclip size={10} /> {attachment.name}<button onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))} className="text-gray-500 hover:text-white"><X size={10} /></button></span>)}</div>}
        <div className="relative flex items-center rounded-2xl border border-[#3a3a3a] bg-[#171717] p-1.5 focus-within:border-[#F4C430]">
          {mentionOptions.length > 0 && <div className="absolute bottom-[calc(100%+8px)] left-0 z-20 w-full overflow-hidden rounded-lg border border-[#3f3f3f] bg-[#242424] py-1 shadow-2xl">{mentionOptions.map((option) => { const Icon = option.icon; return <button key={option.label} onMouseDown={(event) => event.preventDefault()} onClick={() => insertMention(option.label)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-gray-200 hover:bg-white/8"><Icon size={12} className="text-[#F4C430]" />{option.label}</button>; })}</div>}
          <button onClick={() => fileInputRef.current?.click()} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-white/8 hover:text-[#F4C430]" title="Add image, audio, or video"><ImagePlus size={15} /></button>
          <input ref={fileInputRef} type="file" accept="image/*,audio/*,video/*" multiple className="hidden" onChange={(event) => { addFiles(event.target.files); event.currentTarget.value = ''; }} />
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendPrompt(); } }} placeholder="Ask Draftill AI" rows={1} className="min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-[11px] text-white outline-none placeholder:text-gray-600" />
          <button onClick={toggleRecording} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-gray-400 hover:bg-white/8 hover:text-[#F4C430]'}`} title={isRecording ? 'Stop recording' : 'Record voice'}>{isRecording ? <Square size={13} fill="currentColor" /> : <Mic size={15} />}</button>
          <button onClick={sendPrompt} disabled={isSending || !prompt.trim()} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F4C430] text-black hover:bg-[#d4a822] disabled:opacity-40" title="Send prompt"><Send size={14} /></button>
        </div>
        <p className="mt-1.5 text-[9px] text-gray-600">Media understanding, web search, and image generation activate only when the selected model supports them.</p>
        {error && <p className="mt-2 text-[10px] text-red-400">{error}</p>}
      </div>
    </div>}
  </div>;
}
