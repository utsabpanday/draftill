import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BoxSelect, CircleUserRound, Clapperboard, ExternalLink, Film, FolderPlus, ImagePlus, Link2, ListChecks, Pause, Play, Plus, RefreshCw, StickyNote, UsersRound, Video, X, ZoomIn, ZoomOut } from 'lucide-react';
import { FreeflowEdge, FreeflowGroup, FreeflowNode, useAppStore } from '../store/store';
import { eventMatchesShortcut, isTextEntryTarget } from '../utils/shortcuts';
import StyledSelect from './StyledSelect';

type LineStyle = NonNullable<FreeflowEdge['style']>;
type CanvasPoint = { x: number; y: number };
type ConnectionDrag = CanvasPoint & { from: string; fromPort: number };
type DraggingItem = { id: string; kind: 'node' | 'group'; offsetX: number; offsetY: number };
type FlowEndpoint = { id: string; x: number; y: number; width: number; height: number; inputPorts: number; outputPorts: number };

const NODE_LABELS: Record<FreeflowNode['type'], string> = {
  scene: 'Scene',
  shot: 'Shot',
  character: 'Character',
  note: 'Note',
  image: 'Image',
  video: 'Video',
  link: 'Link',
  checklist: 'Checklist'
};

const NODE_ICONS = {
  scene: Clapperboard,
  shot: Film,
  character: CircleUserRound,
  note: StickyNote,
  image: ImagePlus,
  video: Video,
  link: Link2,
  checklist: ListChecks
} as const;

const FREEFLOW_SHORTCUT_ACTIONS = new Set([
  'Add Freeflow Scene',
  'Add Freeflow Shot',
  'Add Freeflow Character',
  'Add Freeflow Note',
  'Add Freeflow Media',
  'Add Freeflow Link',
  'Add Freeflow Checklist'
]);

function VideoPreview({ src, title }: { src: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  };

  return <div className="mt-3 overflow-hidden rounded border border-[#454545] bg-[#151515]" onMouseDown={(event) => event.stopPropagation()}>
    <video
      ref={videoRef}
      src={src}
      preload="metadata"
      className="block aspect-video w-full bg-black object-cover"
      aria-label={title}
      onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
      onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)}
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={() => setPlaying(false)}
    />
    <div className="flex items-center gap-2 px-2 py-2">
      <button type="button" onClick={togglePlay} className="grid h-6 w-6 place-items-center rounded border border-[#505050] text-zinc-100 hover:border-[#f4c430] hover:text-[#f4c430]" aria-label={playing ? 'Pause video' : 'Play video'}>
        {playing ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
      </button>
      <input
        aria-label="Video timeline"
        type="range"
        min="0"
        max={duration || 0}
        step="0.1"
        value={Math.min(progress, duration || 0)}
        onChange={(event) => {
          const video = videoRef.current;
          if (!video) return;
          video.currentTime = Number(event.target.value);
          setProgress(video.currentTime);
        }}
        className="freeflow-timeline min-w-0 flex-1"
      />
    </div>
  </div>;
}

export default function Freeflow() {
  const { freeflowNodes, freeflowEdges, freeflowGroups, setFreeflow, scriptContent, characters, shortcuts } = useAppStore();
  const canvasRef = useRef<HTMLDivElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const selectedRef = useRef<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<DraggingItem | null>(null);
  const [connectionDrag, setConnectionDrag] = useState<ConnectionDrag | null>(null);
  const [connectionTarget, setConnectionTarget] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [panning, setPanning] = useState<{ x: number; y: number; baseX: number; baseY: number } | null>(null);
  const [lineStyle, setLineStyle] = useState<LineStyle>('curve');
  const [previewingLinkId, setPreviewingLinkId] = useState<string | null>(null);
  const [linkErrors, setLinkErrors] = useState<Record<string, string>>({});

  const scenes = useMemo(() => (scriptContent?.content || [])
    .flatMap((node: any) => node.type === 'page' ? node.content || [] : [node])
    .filter((node: any) => node.type === 'sceneHeading')
    .map((node: any) => (node.content || []).map((item: any) => item.text || '').join('')), [scriptContent]);
  const selectedEdge = freeflowEdges.find((edge) => edge.id === selectedEdgeId) || null;
  const syncAiContext = (nodeIds: string[]) => window.dispatchEvent(new CustomEvent('draftill:freeflow-context-change', { detail: { nodeIds } }));
  const groupLayout = (group: FreeflowGroup, index = freeflowGroups.indexOf(group)) => ({
    x: typeof group.x === 'number' ? group.x : 40,
    y: typeof group.y === 'number' ? group.y : 40 + Math.max(0, index) * 72,
    width: group.width || 190,
    height: 52,
    inputPorts: Math.max(1, group.inputPorts || 3),
    outputPorts: Math.max(1, group.outputPorts || 3)
  });
  const endpointById = (id: string): FlowEndpoint | null => {
    const node = freeflowNodes.find((item) => item.id === id);
    if (node) return { id, x: node.x, y: node.y, width: node.width || 230, height: 140, inputPorts: 1, outputPorts: 1 };
    const group = freeflowGroups.find((item) => item.id === id);
    if (!group) return null;
    return { id, ...groupLayout(group) };
  };
  const portY = (endpoint: FlowEndpoint, side: 'input' | 'output', port = 0) => {
    const count = side === 'input' ? endpoint.inputPorts : endpoint.outputPorts;
    if (count === 1) return endpoint.y + endpoint.height / 2;
    return endpoint.y + 13 + Math.min(Math.max(port, 0), count - 1) * ((endpoint.height - 26) / (count - 1));
  };

  useEffect(() => () => {
    window.dispatchEvent(new CustomEvent('draftill:freeflow-context-change', { detail: { nodeIds: [] } }));
  }, []);

  const selectNodes = useCallback((nodeIds: string[]) => {
    selectedRef.current = nodeIds;
    setSelected(nodeIds);
  }, []);
  const addNode = useCallback((type: FreeflowNode['type'], title: string, detail = '', extras: Partial<Pick<FreeflowNode, 'image' | 'video' | 'url' | 'linkPreview' | 'checklist'>> = {}) => {
    const index = freeflowNodes.length;
    const node: FreeflowNode = {
      id: crypto.randomUUID(),
      type,
      title,
      detail,
      ...extras,
      x: 180 + (index % 4) * 290,
      y: 140 + Math.floor(index / 4) * 230,
      width: type === 'image' || type === 'video' || type === 'link' || type === 'checklist' ? 270 : 230,
      groupId: null
    };
    setFreeflow([...freeflowNodes, node], freeflowEdges, freeflowGroups);
    selectNodes([node.id]);
    setSelectedGroupId(null);
    setSelectedEdgeId(null);
  }, [freeflowEdges, freeflowGroups, freeflowNodes, selectNodes, setFreeflow]);

  const addFromScript = useCallback(() => addNode('scene', scenes.find((scene: string) => !freeflowNodes.some((node) => node.title === scene)) || 'NEW SCENE', 'Imported from screenplay'), [addNode, freeflowNodes, scenes]);
  const addCharacter = useCallback(() => {
    const character = characters.find((item) => !freeflowNodes.some((node) => node.title === item.name));
    addNode('character', character?.name || 'NEW CHARACTER', character?.description || 'Character planning node', { image: character?.image });
  }, [addNode, characters, freeflowNodes]);
  const addLink = useCallback(() => addNode('link', 'NEW LINK', '', { url: '', linkPreview: null }), [addNode]);
  const addChecklist = useCallback(() => addNode('checklist', 'NEW CHECKLIST', '', { checklist: [
    { id: crypto.randomUUID(), text: 'First item', checked: false },
    { id: crypto.randomUUID(), text: 'Second item', checked: false }
  ] }), [addNode]);
  const addMedia = useCallback(async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const isVideo = file.type.startsWith('video/');
      addNode(isVideo ? 'video' : 'image', file.name.replace(/\.[^.]+$/, ''), isVideo ? 'Video reference' : 'Image reference', isVideo ? { video: dataUrl } : { image: dataUrl });
    }
  }, [addNode]);

  const toggleSelected = (id: string, append: boolean) => setSelected((current) => {
    const next = append ? (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) : [id];
    selectedRef.current = next;
    return next;
  });
  const updateNode = (id: string, patch: Partial<FreeflowNode>) => setFreeflow(freeflowNodes.map((node) => node.id === id ? { ...node, ...patch } : node), freeflowEdges, freeflowGroups);
  const updateGroup = (id: string, patch: Partial<FreeflowGroup>) => setFreeflow(freeflowNodes, freeflowEdges, freeflowGroups.map((group) => group.id === id ? { ...group, ...patch } : group));
  const loadLinkPreview = async (node: FreeflowNode) => {
    const rawUrl = (node.url || '').trim();
    if (!rawUrl || !window.ipcRenderer) return;
    const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    setPreviewingLinkId(node.id);
    setLinkErrors((current) => ({ ...current, [node.id]: '' }));
    const result = await window.ipcRenderer.invoke('link:preview', url);
    if (result?.success && result.preview) {
      updateNode(node.id, { url: result.preview.url, linkPreview: result.preview, title: node.title === 'NEW LINK' || !node.title.trim() ? result.preview.title : node.title });
    } else {
      updateNode(node.id, { url, linkPreview: null });
      setLinkErrors((current) => ({ ...current, [node.id]: result?.error || 'Could not load preview.' }));
    }
    setPreviewingLinkId(null);
  };
  const updateChecklistItem = (node: FreeflowNode, itemId: string, patch: { text?: string; checked?: boolean }) => updateNode(node.id, { checklist: (node.checklist || []).map((item) => item.id === itemId ? { ...item, ...patch } : item) });
  const addEdge = (from: string, to: string, fromPort = 0, toPort = 0) => {
    if (from === to || !endpointById(from) || !endpointById(to) || freeflowEdges.some((edge) => edge.from === from && edge.to === to && (edge.fromPort || 0) === fromPort && (edge.toPort || 0) === toPort)) return;
    setFreeflow(freeflowNodes, [...freeflowEdges, { id: crypto.randomUUID(), from, to, fromPort, toPort, style: lineStyle }], freeflowGroups);
  };
  const completeConnection = (to: string, toPort = 0) => {
    if (!connectionDrag) return;
    const from = connectionDrag.from;
    addEdge(from, to, connectionDrag.fromPort, toPort);
    const contextNodes = [...new Set([from, to].flatMap((id) => freeflowGroups.find((group) => group.id === id)?.nodeIds || (freeflowNodes.some((node) => node.id === id) ? [id] : [])))];
    selectNodes(contextNodes);
    syncAiContext(contextNodes);
    setSelectedGroupId(freeflowGroups.some((group) => group.id === to) ? to : freeflowGroups.some((group) => group.id === from) ? from : null);
    setSelectedEdgeId(null);
    setConnectionDrag(null);
    setConnectionTarget(null);
  };
  const updateSelectedEdgeStyle = (style: LineStyle) => {
    if (!selectedEdge) return;
    setFreeflow(freeflowNodes, freeflowEdges.map((edge) => edge.id === selectedEdge.id ? { ...edge, style } : edge), freeflowGroups);
  };
  const linkSelected = () => {
    if (selected.length !== 2) return;
    addEdge(selected[0], selected[1]);
  };
  const groupSelected = () => {
    if (selected.length < 2) return;
    const selectedNodes = freeflowNodes.filter((node) => selected.includes(node.id));
    const group: FreeflowGroup = {
      id: crypto.randomUUID(),
      name: `GROUP ${freeflowGroups.length + 1}`,
      nodeIds: selected,
      color: '#F4C430',
      x: Math.max(30, selectedNodes.reduce((sum, node) => sum + node.x, 0) / selectedNodes.length - 230),
      y: Math.max(30, selectedNodes.reduce((sum, node) => sum + node.y, 0) / selectedNodes.length),
      width: 190,
      inputPorts: 3,
      outputPorts: 3
    };
    setFreeflow(freeflowNodes.map((node) => selected.includes(node.id) ? { ...node, groupId: group.id } : node), freeflowEdges, [...freeflowGroups, group]);
    selectNodes([]);
    setSelectedGroupId(group.id);
    syncAiContext(group.nodeIds);
  };
  const removeSelected = () => {
    if (selectedEdgeId) {
      setFreeflow(freeflowNodes, freeflowEdges.filter((edge) => edge.id !== selectedEdgeId), freeflowGroups);
      setSelectedEdgeId(null);
      return;
    }
    if (selectedGroupId) {
      setFreeflow(
        freeflowNodes.map((node) => node.groupId === selectedGroupId ? { ...node, groupId: null } : node),
        freeflowEdges.filter((edge) => edge.from !== selectedGroupId && edge.to !== selectedGroupId),
        freeflowGroups.filter((group) => group.id !== selectedGroupId)
      );
      setSelectedGroupId(null);
      syncAiContext([]);
      return;
    }
    const removedGroupIds = freeflowGroups.filter((group) => group.nodeIds.every((id) => selected.includes(id))).map((group) => group.id);
    setFreeflow(
      freeflowNodes.filter((node) => !selected.includes(node.id)),
      freeflowEdges.filter((edge) => !selected.includes(edge.from) && !selected.includes(edge.to) && !removedGroupIds.includes(edge.from) && !removedGroupIds.includes(edge.to)),
      freeflowGroups.map((group) => ({ ...group, nodeIds: group.nodeIds.filter((id) => !selected.includes(id)) })).filter((group) => group.nodeIds.length > 0)
    );
    selectNodes([]);
    syncAiContext([]);
  };
  const point = (event: React.MouseEvent): CanvasPoint => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: (event.clientX - rect.left - pan.x) / zoom, y: (event.clientY - rect.top - pan.y) / zoom };
  };
  const linePath = (fromX: number, fromY: number, toX: number, toY: number, style: LineStyle = 'curve') => {
    if (style === 'straight') return `M ${fromX} ${fromY} L ${toX} ${toY}`;
    if (style === 'elbow') {
      const middleX = fromX + (toX - fromX) / 2;
      return `M ${fromX} ${fromY} L ${middleX} ${fromY} L ${middleX} ${toY} L ${toX} ${toY}`;
    }
    const curve = Math.max(80, Math.abs(toX - fromX) / 2);
    return `M ${fromX} ${fromY} C ${fromX + curve} ${fromY}, ${toX - curve} ${toY}, ${toX} ${toY}`;
  };
  const edgePath = (from: FlowEndpoint, to: FlowEndpoint, edge: FreeflowEdge) => linePath(from.x + from.width, portY(from, 'output', edge.fromPort), to.x, portY(to, 'input', edge.toPort), edge.style);
  const connectionPath = connectionDrag ? (() => {
    const from = endpointById(connectionDrag.from);
    return from ? linePath(from.x + from.width, portY(from, 'output', connectionDrag.fromPort), connectionDrag.x, connectionDrag.y, lineStyle) : '';
  })() : '';

  useEffect(() => {
    const handleFreeflowShortcut = (event: KeyboardEvent) => {
      if (isTextEntryTarget(event.target)) return;
      const shortcut = shortcuts.find((item) => FREEFLOW_SHORTCUT_ACTIONS.has(item.action) && eventMatchesShortcut(event, item.key));
      if (!shortcut) return;
      event.preventDefault();

      if (shortcut.action === 'Add Freeflow Scene') addFromScript();
      else if (shortcut.action === 'Add Freeflow Shot') addNode('shot', 'NEW SHOT', 'Camera, lens, action');
      else if (shortcut.action === 'Add Freeflow Character') addCharacter();
      else if (shortcut.action === 'Add Freeflow Note') addNode('note', 'NEW NOTE', 'Add a planning note');
      else if (shortcut.action === 'Add Freeflow Media') mediaInputRef.current?.click();
      else if (shortcut.action === 'Add Freeflow Link') addLink();
      else if (shortcut.action === 'Add Freeflow Checklist') addChecklist();
    };

    window.addEventListener('keydown', handleFreeflowShortcut);
    return () => window.removeEventListener('keydown', handleFreeflowShortcut);
  }, [addCharacter, addChecklist, addFromScript, addLink, addNode, shortcuts]);

  return <div className="flex h-full min-h-[680px] flex-col overflow-hidden rounded-lg border border-[#3d3d3d] bg-[#1d1d1d] font-inter text-zinc-100">
    <div className="flex flex-wrap items-center gap-2 border-b border-[#3d3d3d] bg-[#242424] px-4 py-3">
      <div className="mr-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-100"><BoxSelect size={15} className="text-[#f4c430]" /> Freeflow</div>
      <button onClick={addFromScript} className="freeflow-tool"><Clapperboard size={14} /> Scene</button>
      <button onClick={() => addNode('shot', 'NEW SHOT', 'Camera, lens, action')} className="freeflow-tool"><Film size={14} /> Shot</button>
      <button onClick={addCharacter} className="freeflow-tool"><CircleUserRound size={14} /> Character</button>
      <button onClick={() => addNode('note', 'NEW NOTE', 'Add a planning note')} className="freeflow-tool"><StickyNote size={14} /> Note</button>
      <button onClick={() => mediaInputRef.current?.click()} className="freeflow-tool"><ImagePlus size={14} /> Media</button>
      <button onClick={addLink} className="freeflow-tool"><Link2 size={14} /> Link</button>
      <button onClick={addChecklist} className="freeflow-tool"><ListChecks size={14} /> Checklist</button>
      <input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(event) => { void addMedia(event.target.files); event.currentTarget.value = ''; }} />
      <span className="mx-1 h-5 w-px bg-[#4a4a4a]" />
      {selectedEdge ? <div className="freeflow-edge-inspector" data-freeflow-interactive>
        <span>Selected line</span>
        <StyledSelect value={selectedEdge.style || 'curve'} onChange={(value) => updateSelectedEdgeStyle(value as LineStyle)} ariaLabel="Selected connector style" className="w-28" compact options={[{ value: 'curve', label: 'Curved' }, { value: 'straight', label: 'Straight' }, { value: 'elbow', label: 'Elbow' }]} />
      </div> : <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">New line</span>
        <StyledSelect value={lineStyle} onChange={(value) => setLineStyle(value as LineStyle)} ariaLabel="New connector style" className="w-32" compact options={[{ value: 'curve', label: 'Curved line' }, { value: 'straight', label: 'Straight line' }, { value: 'elbow', label: 'Elbow line' }]} />
      </div>}
      <button onClick={linkSelected} disabled={selected.length !== 2} className="freeflow-tool"><Link2 size={14} /> Connect</button>
      <button onClick={groupSelected} disabled={selected.length < 2} className="freeflow-tool"><UsersRound size={14} /> Group</button>
      <button onClick={removeSelected} disabled={!selected.length && !selectedGroupId && !selectedEdgeId} className="freeflow-tool"><X size={14} /> Delete</button>
      <span className="ml-auto hidden text-[10px] text-zinc-500 lg:block">Drag from an output dot to an input dot. Scroll to zoom; drag empty canvas to move.</span>
    </div>
    <div
      ref={canvasRef}
      className={`freeflow-wall relative flex-1 overflow-hidden ${panning ? 'cursor-grabbing' : 'cursor-default'}`}
      style={{ backgroundSize: `${24 * zoom}px ${24 * zoom}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }}
      onWheel={(event) => {
        event.preventDefault();
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const nextZoom = Math.min(2.25, Math.max(0.45, zoom * (event.deltaY > 0 ? 0.9 : 1.1)));
        const ratio = nextZoom / zoom;
        const cursorX = event.clientX - rect.left;
        const cursorY = event.clientY - rect.top;
        setPan({ x: cursorX - (cursorX - pan.x) * ratio, y: cursorY - (cursorY - pan.y) * ratio });
        setZoom(nextZoom);
      }}
      onMouseDown={(event) => {
        const target = event.target as Element;
        if (!target.closest('[data-freeflow-interactive]')) {
          setPanning({ x: event.clientX, y: event.clientY, baseX: pan.x, baseY: pan.y });
          selectNodes([]);
          syncAiContext([]);
          setSelectedGroupId(null);
          setSelectedEdgeId(null);
          setConnectionDrag(null);
          setConnectionTarget(null);
        }
      }}
      onMouseMove={(event) => {
        if (dragging) {
          const next = point(event);
          if (dragging.kind === 'node') {
            setFreeflow(freeflowNodes.map((node) => node.id === dragging.id ? { ...node, x: next.x - dragging.offsetX, y: next.y - dragging.offsetY } : node), freeflowEdges, freeflowGroups);
          } else {
            setFreeflow(freeflowNodes, freeflowEdges, freeflowGroups.map((group) => group.id === dragging.id ? { ...group, x: next.x - dragging.offsetX, y: next.y - dragging.offsetY } : group));
          }
        }
        if (connectionDrag) setConnectionDrag((current) => current ? { ...current, ...point(event) } : null);
        if (panning) setPan({ x: panning.baseX + event.clientX - panning.x, y: panning.baseY + event.clientY - panning.y });
      }}
      onMouseUp={() => {
        setDragging(null);
        setPanning(null);
        setConnectionDrag(null);
        setConnectionTarget(null);
      }}
      onMouseLeave={() => {
        setDragging(null);
        setPanning(null);
        setConnectionDrag(null);
        setConnectionTarget(null);
      }}
    >
      <div className="absolute bottom-3 right-3 z-40 flex items-center overflow-hidden rounded border border-[#505050] bg-[#242424] shadow-xl" data-freeflow-interactive>
        <button type="button" className="freeflow-zoom" onClick={() => setZoom((value) => Math.max(0.45, value - 0.15))} aria-label="Zoom out"><ZoomOut size={14} /></button>
        <span className="min-w-12 border-x border-[#505050] px-2 py-1.5 text-center text-[10px] font-bold text-zinc-300">{Math.round(zoom * 100)}%</span>
        <button type="button" className="freeflow-zoom" onClick={() => setZoom((value) => Math.min(2.25, value + 0.15))} aria-label="Zoom in"><ZoomIn size={14} /></button>
      </div>
      <div className="absolute inset-0 origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        <svg className="absolute inset-0 h-[2600px] w-[3600px] overflow-visible" aria-hidden="true">
          <defs><marker id="freeflow-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#8c8c8c" /></marker></defs>
          {freeflowEdges.map((edge) => {
            const from = endpointById(edge.from);
            const to = endpointById(edge.to);
            const isSelected = edge.id === selectedEdgeId;
            return from && to ? <path key={edge.id} data-freeflow-interactive d={edgePath(from, to, edge)} fill="none" stroke={isSelected ? '#f4c430' : '#8c8c8c'} strokeWidth={isSelected ? '2.7' : '1.6'} markerEnd="url(#freeflow-arrow)" className="freeflow-edge cursor-pointer" onMouseDown={(event) => { event.stopPropagation(); selectNodes([]); syncAiContext([]); setSelectedGroupId(null); setSelectedEdgeId(edge.id); }} /> : null;
          })}
          {connectionPath && <path d={connectionPath} fill="none" stroke="#f4c430" strokeWidth="2" strokeDasharray="6 5" markerEnd="url(#freeflow-arrow)" className="pointer-events-none" />}
        </svg>
        {freeflowGroups.map((group, index) => {
          const layout = groupLayout(group, index);
          const groupSelected = selectedGroupId === group.id;
          const isConnectionSource = connectionDrag?.from === group.id;
          const isConnectionTarget = connectionTarget === group.id;
          const handleTop = (port: number, count: number) => (count === 1 ? layout.height / 2 : 13 + port * ((layout.height - 26) / (count - 1))) - 6;
          return <div
            key={group.id}
            data-freeflow-interactive
            onMouseDown={(event) => {
              event.stopPropagation();
              if (connectionDrag) return;
              const pos = point(event);
              setDragging({ id: group.id, kind: 'group', offsetX: pos.x - layout.x, offsetY: pos.y - layout.y });
              selectNodes([]);
              setSelectedGroupId(group.id);
              setSelectedEdgeId(null);
              syncAiContext(group.nodeIds);
            }}
            className={`freeflow-group absolute z-20 flex items-center gap-2 rounded border bg-[#292929] px-2.5 shadow-[0_10px_24px_rgba(0,0,0,.22)] ${groupSelected || isConnectionSource || isConnectionTarget ? 'border-[#f4c430] shadow-[0_0_0_1px_#f4c430,0_10px_24px_rgba(0,0,0,.22)]' : 'border-[#505050] hover:border-[#777]'}`}
            style={{ left: layout.x, top: layout.y, width: layout.width, height: layout.height }}
          >
            {Array.from({ length: layout.inputPorts }, (_, port) => <button
              key={`input-${port}`}
              type="button"
              data-freeflow-interactive
              onMouseDown={(event) => event.stopPropagation()}
              onMouseEnter={() => { if (connectionDrag && connectionDrag.from !== group.id) setConnectionTarget(group.id); }}
              onMouseLeave={() => { if (connectionTarget === group.id) setConnectionTarget(null); }}
              onMouseUp={(event) => { event.stopPropagation(); completeConnection(group.id, port); }}
              className={`freeflow-handle absolute -left-1.5 h-3 w-3 rounded-full border ${isConnectionTarget ? 'border-[#f4c430] bg-[#f4c430]' : 'border-[#777] bg-[#1b1b1b] hover:border-[#f4c430]'}`}
              style={{ top: handleTop(port, layout.inputPorts) }}
              title={`Group input ${port + 1}`}
              aria-label={`Input ${port + 1} for ${group.name}`}
            />)}
            <FolderPlus size={14} className="shrink-0 text-[#f4c430]" />
            <div className="min-w-0 flex-1">
              <input value={group.name} onMouseDown={(event) => event.stopPropagation()} onChange={(event) => updateGroup(group.id, { name: event.target.value.slice(0, 80) })} aria-label="Group name" className="freeflow-group-name" />
              <p className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Merge · {group.nodeIds.length} nodes</p>
            </div>
            {Array.from({ length: layout.outputPorts }, (_, port) => <button
              key={`output-${port}`}
              type="button"
              data-freeflow-interactive
              onMouseDown={(event) => {
                event.stopPropagation();
                const pos = point(event);
                setConnectionDrag({ from: group.id, fromPort: port, ...pos });
                setConnectionTarget(null);
                selectNodes([]);
                setSelectedGroupId(group.id);
                setSelectedEdgeId(null);
                syncAiContext(group.nodeIds);
              }}
              className={`freeflow-handle absolute -right-1.5 h-3 w-3 rounded-full border ${isConnectionSource ? 'border-[#f4c430] bg-[#f4c430]' : 'border-[#777] bg-[#1b1b1b] hover:border-[#f4c430]'}`}
              style={{ top: handleTop(port, layout.outputPorts) }}
              title={`Group output ${port + 1}`}
              aria-label={`Output ${port + 1} for ${group.name}`}
            />)}
          </div>;
        })}
        {freeflowNodes.map((node) => {
          const NodeIcon = NODE_ICONS[node.type];
          const isSelected = selected.includes(node.id);
          const isConnectionSource = connectionDrag?.from === node.id;
          const isConnectionTarget = connectionTarget === node.id;
          const isNote = node.type === 'note';
          const isLink = node.type === 'link';
          const isChecklist = node.type === 'checklist';
          const hasEditableTitle = isNote || isLink || isChecklist;
          return <div
            key={node.id}
            data-freeflow-interactive
            onMouseDown={(event) => {
              event.stopPropagation();
              if (connectionDrag) return;
              const pos = point(event);
              setDragging({ id: node.id, kind: 'node', offsetX: pos.x - node.x, offsetY: pos.y - node.y });
              toggleSelected(node.id, event.shiftKey);
              setSelectedGroupId(null);
              setSelectedEdgeId(null);
            }}
            onMouseUp={() => syncAiContext(selectedRef.current)}
            className={`freeflow-node absolute cursor-pointer select-none border bg-[#2a2a2a] p-3 shadow-[0_12px_30px_rgba(0,0,0,.24)] transition-[border-color,box-shadow] ${isSelected || isConnectionSource || isConnectionTarget ? 'border-[#f4c430] shadow-[0_0_0_1px_#f4c430,0_12px_30px_rgba(0,0,0,.24)]' : 'border-[#535353] hover:border-[#777]'}`}
            style={{ left: node.x, top: node.y, width: node.width || 230 }}
          >
            <button
              type="button"
              data-freeflow-interactive
              onMouseDown={(event) => event.stopPropagation()}
              onMouseEnter={() => { if (connectionDrag && connectionDrag.from !== node.id) setConnectionTarget(node.id); }}
              onMouseLeave={() => { if (connectionTarget === node.id) setConnectionTarget(null); }}
              onMouseUp={(event) => { event.stopPropagation(); completeConnection(node.id, 0); }}
              className={`freeflow-handle absolute -left-1.5 top-[62px] h-3 w-3 rounded-full border ${isConnectionTarget ? 'border-[#f4c430] bg-[#f4c430]' : 'border-[#777] bg-[#1b1b1b]'}`}
              title="Drop a connection here"
              aria-label={`Input for ${node.title}`}
            />
            <button
              type="button"
              data-freeflow-interactive
              onMouseDown={(event) => {
                event.stopPropagation();
                const pos = point(event);
                setConnectionDrag({ from: node.id, fromPort: 0, ...pos });
                setConnectionTarget(null);
                selectNodes([node.id]);
                setSelectedGroupId(null);
                setSelectedEdgeId(null);
              }}
              className={`freeflow-handle absolute -right-1.5 top-[62px] h-3 w-3 rounded-full border ${isConnectionSource ? 'border-[#f4c430] bg-[#f4c430]' : 'border-[#777] bg-[#1b1b1b] hover:border-[#f4c430]'}`}
              title="Drag to another node input"
              aria-label={`Output for ${node.title}`}
            />
            <div className="flex items-start gap-2 pr-3">
              <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center border border-[#505050] bg-[#222] text-zinc-400"><NodeIcon size={13} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">{NODE_LABELS[node.type]}</p>
                {hasEditableTitle ? <textarea value={node.title} rows={Math.max(1, Math.ceil(Math.max(node.title.length, 1) / 28))} aria-label={`${NODE_LABELS[node.type]} title`} onMouseDown={(event) => event.stopPropagation()} onChange={(event) => updateNode(node.id, { title: event.target.value })} className="freeflow-note-title mt-1" placeholder={`Name this ${NODE_LABELS[node.type].toLowerCase()}`} /> : <p className="mt-1 truncate text-xs font-semibold text-zinc-100">{node.title}</p>}
              </div>
            </div>
            {node.image && <img src={node.image} alt={node.title} draggable={false} className="mt-3 aspect-[4/3] w-full border border-[#454545] object-cover" />}
            {node.video && <VideoPreview src={node.video} title={node.title} />}
            {isLink && <div className="mt-3 space-y-2" onMouseDown={(event) => event.stopPropagation()}>
              <div className="flex items-center gap-1.5">
                <input value={node.url || ''} onChange={(event) => updateNode(node.id, { url: event.target.value, linkPreview: null })} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void loadLinkPreview({ ...node, url: event.currentTarget.value }); } }} aria-label="Link URL" placeholder="https://example.com" className="freeflow-link-url min-w-0 flex-1" />
                <button type="button" onClick={() => void loadLinkPreview(node)} disabled={!node.url?.trim() || previewingLinkId === node.id} className="grid h-7 w-7 shrink-0 place-items-center rounded border border-[#505050] text-zinc-400 hover:border-[#f4c430] hover:text-[#f4c430] disabled:opacity-40" title="Load link preview"><RefreshCw size={11} className={previewingLinkId === node.id ? 'animate-spin' : ''} /></button>
              </div>
              {linkErrors[node.id] && <p className="text-[9px] leading-snug text-red-300">{linkErrors[node.id]}</p>}
              {node.linkPreview && <button type="button" onClick={() => window.ipcRenderer?.invoke('link:openExternal', node.linkPreview?.url || node.url)} className="block w-full overflow-hidden rounded border border-[#454545] bg-[#202020] text-left hover:border-[#f4c430]/70" title="Open link">
                {node.linkPreview.image && <img src={node.linkPreview.image} alt="" draggable={false} className="aspect-[1.9/1] w-full object-cover" />}
                <span className="block p-2">
                  <span className="flex items-center justify-between gap-2 text-[8px] font-bold uppercase tracking-[0.1em] text-zinc-500"><span className="truncate">{node.linkPreview.siteName}</span><ExternalLink size={10} /></span>
                  <span className="mt-1 block line-clamp-2 text-[11px] font-semibold leading-snug text-zinc-100">{node.linkPreview.title}</span>
                  {node.linkPreview.description && <span className="mt-1 block line-clamp-2 text-[9px] leading-relaxed text-zinc-400">{node.linkPreview.description}</span>}
                </span>
              </button>}
            </div>}
            {isChecklist && <div className="mt-3 space-y-1.5" onMouseDown={(event) => event.stopPropagation()}>
              {(node.checklist || []).map((item) => <div key={item.id} className="flex items-center gap-2 rounded border border-transparent px-1 py-0.5 focus-within:border-[#4a4a4a]">
                <input type="checkbox" checked={item.checked} onChange={(event) => updateChecklistItem(node, item.id, { checked: event.target.checked })} aria-label={`Mark ${item.text || 'checklist item'} complete`} className="h-3.5 w-3.5 shrink-0 accent-[#f4c430]" />
                <input value={item.text} onChange={(event) => updateChecklistItem(node, item.id, { text: event.target.value })} aria-label="Checklist item" placeholder="Checklist item" className={`min-w-0 flex-1 bg-transparent text-[11px] outline-none ${item.checked ? 'text-zinc-600 line-through' : 'text-zinc-300'}`} />
                <button type="button" onClick={() => updateNode(node.id, { checklist: (node.checklist || []).filter((candidate) => candidate.id !== item.id) })} className="text-zinc-600 hover:text-red-300" title="Remove checklist item"><X size={10} /></button>
              </div>)}
              <button type="button" onClick={() => updateNode(node.id, { checklist: [...(node.checklist || []), { id: crypto.randomUUID(), text: '', checked: false }] })} className="flex items-center gap-1 px-1 py-1 text-[9px] font-semibold text-zinc-500 hover:text-[#f4c430]"><Plus size={10} /> Add item</button>
            </div>}
            {isNote ? <textarea value={node.detail} rows={Math.max(2, Math.ceil(Math.max(node.detail.length, 1) / 30))} aria-label="Note text" onMouseDown={(event) => event.stopPropagation()} onChange={(event) => updateNode(node.id, { detail: event.target.value })} placeholder="Write anything here…" className="freeflow-note-body mt-3" /> : node.detail && <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-zinc-400">{node.detail}</p>}
          </div>;
        })}
      </div>
    </div>
    <style>{`
      .freeflow-wall { background-color: #202020; background-image: radial-gradient(#3b3b3b 1px, transparent 1px); }
      .freeflow-tool { display:flex; align-items:center; gap:6px; border:1px solid #4a4a4a; background:#2d2d2d; color:#d4d4d4; border-radius:4px; padding:7px 9px; font-size:11px; font-weight:600; transition: border-color .15s, color .15s, background .15s; cursor:pointer; }
      .freeflow-tool:hover:not(:disabled) { border-color:#f4c430; color:#f4c430; background:#303030; }
      .freeflow-tool:disabled { cursor:not-allowed; opacity:.35; }
      .freeflow-select { border:1px solid #4a4a4a; border-radius:4px; background:#2d2d2d; color:#d4d4d4; padding:7px 26px 7px 9px; font-size:11px; font-weight:600; outline:none; cursor:pointer; }
      .freeflow-select:focus { border-color:#f4c430; }
      .freeflow-edge-inspector { display:flex; align-items:center; gap:7px; border:1px solid rgba(244,196,48,.55); border-radius:4px; background:rgba(244,196,48,.08); padding:3px 3px 3px 8px; color:#f4c430; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; }
      .freeflow-timeline { accent-color:#f4c430; height:3px; cursor:pointer; }
      .freeflow-edge { pointer-events:stroke; }
      .freeflow-handle { cursor:crosshair; }
      .freeflow-zoom { display:grid; height:28px; width:28px; place-items:center; color:#d4d4d4; cursor:pointer; }
      .freeflow-zoom:hover { background:#353535; color:#f4c430; }
      .freeflow-note-title, .freeflow-note-body { display:block; width:100%; resize:none; overflow:hidden; border:0; outline:0; background:transparent; color:#f4f4f5; font-family:Arial, Helvetica, sans-serif; cursor:text; }
      .freeflow-link-url { height:28px; border:1px solid #4a4a4a; border-radius:4px; background:#222; padding:0 7px; color:#d4d4d8; font-size:10px; outline:none; }
      .freeflow-link-url:focus { border-color:#f4c430; }
      .freeflow-group-name { display:block; width:100%; border:0; outline:0; background:transparent; color:#e4e4e7; font-size:10px; line-height:1.2; font-weight:800; letter-spacing:.1em; text-transform:uppercase; cursor:text; }
      .freeflow-group-name:focus { color:#fff; }
      .freeflow-note-title { min-height:18px; font-size:12px; line-height:1.35; font-weight:600; }
      .freeflow-note-body { min-height:42px; color:#a1a1aa; font-size:11px; line-height:1.55; }
      .freeflow-note-title::placeholder, .freeflow-note-body::placeholder { color:#71717a; }
    `}</style>
  </div>;
}
