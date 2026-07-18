import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, GitCommit, RefreshCw, RotateCcw } from 'lucide-react';
import { useAppStore } from '../store/store';
import StyledSelect from './StyledSelect';

type CommitRecord = { hash: string; message: string; date: string; author: string };
type ScriptBlock = { id: string; type: string; text: string; page: number };
type ParsedSnapshot = { raw: string; projectData: Record<string, any>; blocks: ScriptBlock[] };
type PreviewTitlePage = { title?: string; credit?: string; author?: string; sourceMaterial?: string; contactInfo?: string };

const PROJECT_FIELDS = [
  'scriptContent'
] as const;

function readText(node: any): string {
  return (node?.content || []).map((part: any) => typeof part?.text === 'string' ? part.text : '').join('');
}

function flattenScript(document: any): ScriptBlock[] {
  const pages = document?.content || [];
  return pages.flatMap((node: any, documentIndex: number) => {
    const children = node?.type === 'page' ? node.content || [] : [node];
    const page = node?.type === 'page' ? documentIndex + 1 : 1;
    return children.map((child: any, childIndex: number) => ({
      id: child?.attrs?.id || `${page}-${childIndex}-${child?.type || 'action'}`,
      type: child?.type || 'action',
      text: readText(child),
      page
    })).filter((block: ScriptBlock) => block.text.trim());
  });
}

function normalizeSnapshot(raw: string): ParsedSnapshot {
  const parsed = JSON.parse(raw);
  const projectData = parsed?.scriptContent
    ? parsed
    : { ...parsed, scriptContent: { type: 'doc', content: parsed?.content || [] } };
  return { raw, projectData, blocks: flattenScript(projectData.scriptContent) };
}

function comparableBlock(block: ScriptBlock | undefined) {
  return block ? `${block.type}\u0000${block.text.trim()}` : '';
}

function blockClass(type: string) {
  if (type === 'sceneHeading') return 'mt-5 font-bold uppercase tracking-wide';
  if (type === 'character') return 'mt-4 ml-[38%] font-bold uppercase';
  if (type === 'parenthetical') return 'ml-[30%] mr-[24%] italic';
  if (type === 'dialogue') return 'ml-[24%] mr-[20%]';
  if (type === 'transition') return 'mt-4 text-right font-bold uppercase';
  if (type === 'shot') return 'mt-4 font-bold uppercase';
  return 'mt-2';
}

function ScreenplayPreview({ title, subtitle, titlePage, blocks, comparison, historical }: { title: string; subtitle: string; titlePage?: PreviewTitlePage; blocks: ScriptBlock[]; comparison: ScriptBlock[]; historical?: boolean }) {
  const pages = useMemo(() => {
    const grouped = new Map<number, ScriptBlock[]>();
    blocks.forEach((block) => grouped.set(block.page, [...(grouped.get(block.page) || []), block]));
    return [...grouped.entries()];
  }, [blocks]);

  return <section className="min-w-0 rounded-xl border border-[#3a3a3a] bg-[#1b1b1b] p-3">
    <div className="mb-3 flex items-start justify-between gap-3 px-1">
      <div><h3 className="text-xs font-bold text-white">{title}</h3><p className="mt-0.5 text-[10px] text-gray-500">{subtitle}</p></div>
      <span className={`rounded px-2 py-1 text-[9px] font-bold uppercase ${historical ? 'bg-red-500/10 text-red-300' : 'bg-emerald-500/10 text-emerald-300'}`}>{historical ? 'Earlier' : 'Current'}</span>
    </div>
    <div className="space-y-4">
      {titlePage?.title && <article className="mx-auto flex min-h-[520px] max-w-[540px] flex-col rounded-sm bg-[#f5f2ea] px-[9%] py-12 font-courier text-[#171717] shadow-[0_12px_35px_rgba(0,0,0,.3)]">
        <div className="mt-24 text-center"><h4 className="text-base font-bold uppercase">{titlePage.title}</h4><p className="mt-5 text-[11px]">{titlePage.credit || 'Written by'}</p><p className="mt-2 text-[12px]">{titlePage.author}</p>{titlePage.sourceMaterial && <p className="mt-5 text-[10px]">{titlePage.sourceMaterial}</p>}</div>
        {titlePage.contactInfo && <p className="mt-auto whitespace-pre-line text-[9px] leading-relaxed">{titlePage.contactInfo}</p>}
      </article>}
      {pages.length === 0 ? <div className="rounded-lg border border-dashed border-[#444] p-10 text-center text-xs text-gray-500">This version has no screenplay content.</div> : pages.map(([page, pageBlocks]) => <article key={page} className="mx-auto min-h-[520px] max-w-[540px] rounded-sm bg-[#f5f2ea] px-[9%] py-10 font-courier text-[11px] leading-[1.45] text-[#171717] shadow-[0_12px_35px_rgba(0,0,0,.3)]">
        <p className="mb-7 text-right font-inter text-[9px] text-gray-400">{page}.</p>
        {pageBlocks.map((block) => {
          const index = blocks.indexOf(block);
          const pageIndex = pageBlocks.indexOf(block);
          const other = comparison.find((candidate) => candidate.id === block.id) || comparison.filter((candidate) => candidate.page === block.page)[pageIndex];
          const changed = comparableBlock(block) !== comparableBlock(other);
          return <div key={`${block.id}-${index}`} className={`${blockClass(block.type)} rounded-sm px-1 ${changed ? historical ? 'bg-red-200/70 ring-1 ring-red-300' : 'bg-emerald-200/70 ring-1 ring-emerald-300' : ''}`} title={changed ? historical ? 'Changed or removed in the active draft' : 'Changed or added in the active draft' : 'Unchanged'}>{block.text}</div>;
        })}
      </article>)}
    </div>
  </section>;
}

export default function CompareSplit() {
  const {
    currentFilePath, activeProjectId, projectWorkspacePath, scriptContent,
    loadProjectData, showAlertDialog, showConfirmDialog
  } = useAppStore();
  const gitFilePath = currentFilePath || (projectWorkspacePath ? activeProjectId : null);
  const [commits, setCommits] = useState<CommitRecord[]>([]);
  const [selectedCommit, setSelectedCommit] = useState('');
  const [snapshot, setSnapshot] = useState<ParsedSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState('');
  const currentBlocks = useMemo(() => flattenScript(scriptContent), [scriptContent]);
  const selectedCommitRecord = commits.find((commit) => commit.hash === selectedCommit);
  const changedPages = useMemo(() => {
    if (!snapshot) return [] as number[];
    const pages = new Set([...snapshot.blocks.map((block) => block.page), ...currentBlocks.map((block) => block.page)]);
    return [...pages].filter((page) => {
      const historical = snapshot.blocks.filter((block) => block.page === page).map(comparableBlock).join('\n');
      const current = currentBlocks.filter((block) => block.page === page).map(comparableBlock).join('\n');
      return historical !== current;
    });
  }, [snapshot, currentBlocks]);
  const historicalChangedBlocks = useMemo(() => snapshot?.blocks.filter((block) => changedPages.includes(block.page)) || [], [snapshot, changedPages]);
  const currentChangedBlocks = useMemo(() => currentBlocks.filter((block) => changedPages.includes(block.page)), [currentBlocks, changedPages]);

  const loadCommits = async () => {
    if (!gitFilePath || !window.ipcRenderer) {
      setError('Open a saved Draftill project to initialize local Git version tracking.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const logs = await window.ipcRenderer.invoke('git:log', gitFilePath) as CommitRecord[];
      setCommits(logs);
      if (logs.length > 0) setSelectedCommit((current) => logs.some((commit) => commit.hash === current) ? current : logs[0].hash);
      else setError('No draft commits recorded. Commit your current script in the bottom-left of the editor tab first.');
    } catch (requestError) {
      setError('Git repository not loaded: ' + (requestError instanceof Error ? requestError.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadCommits(); }, [gitFilePath]);
  useEffect(() => {
    if (!selectedCommit || !gitFilePath || !window.ipcRenderer) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setRestored(false);
    window.ipcRenderer.invoke('git:show', gitFilePath, selectedCommit).then((raw: string | null) => {
      if (cancelled) return;
      if (!raw) throw new Error('Could not retrieve this saved version.');
      setSnapshot(normalizeSnapshot(raw));
    }).catch((requestError: unknown) => {
      if (!cancelled) setError(requestError instanceof Error ? requestError.message : 'Could not parse this saved version.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedCommit, gitFilePath]);

  const restoreSelectedVersion = async () => {
    if (!snapshot || !gitFilePath || !window.ipcRenderer) return;
    setRestoring(true);
    setError('');
    try {
      const activeRaw = await window.ipcRenderer.invoke('workspace:readProject', gitFilePath) as string | null;
      const activeProjectData = activeRaw ? JSON.parse(activeRaw) : {};
      const restoredData = Object.fromEntries(PROJECT_FIELDS.filter((field) => field in snapshot.projectData).map((field) => [field, snapshot.projectData[field]]));
      const saved = await window.ipcRenderer.invoke('workspace:writeProject', gitFilePath, JSON.stringify({ ...activeProjectData, ...restoredData }));
      if (!saved?.success) throw new Error(saved?.error || 'The project file could not be restored.');
      loadProjectData(restoredData);
      setRestored(true);
      showAlertDialog('Version Restored', `Draftill restored ${selectedCommitRecord?.message || selectedCommit}. The Git checkpoint remains available if you need to compare again.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not restore this version.');
    } finally {
      setRestoring(false);
    }
  };

  const confirmRestore = () => {
    if (!snapshot) return;
    showConfirmDialog('Restore this version?', `This restores only screenplay content from “${selectedCommitRecord?.message || selectedCommit}”. Freeflow, characters, locations, comments, and settings stay unchanged.`, () => { void restoreSelectedVersion(); });
  };

  return <div className="mx-auto flex h-[85vh] w-full max-w-[1500px] flex-col p-6 font-inter text-[#e8e8e6]">
    <div className="mb-4 flex shrink-0 items-center justify-between gap-4">
      <div><h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white"><GitCommit size={22} className="text-[#F4C430]" /> Screenplay History</h2><p className="mt-1 text-xs text-gray-400">Only changed screenplay pages are shown. Every other project surface remains outside Version Control.</p></div>
      <button onClick={() => void loadCommits()} className="rounded-lg border border-[#3b3b3b] p-2 text-gray-400 transition-colors hover:bg-[#2a2a2a] hover:text-white" title="Refresh version history"><RefreshCw size={16} /></button>
    </div>

    {error ? <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-center text-amber-400"><AlertCircle size={32} /><p className="text-sm font-medium">{error}</p>{commits.length > 0 && <button onClick={() => setError('')} className="mt-2 rounded border border-amber-400/30 px-3 py-1.5 text-xs font-bold hover:bg-amber-400/10">Back to comparison</button>}</div> : <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center gap-3 rounded-xl border border-[#3a3a3a] bg-[#1e1e1e] p-4">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Compare current draft against</span>
        <StyledSelect value={selectedCommit} onChange={setSelectedCommit} ariaLabel="Version to compare" className="w-full max-w-xl" options={commits.map((commit) => ({ value: commit.hash, label: `[${commit.hash}] ${commit.message} (${commit.date})` }))} />
        <button onClick={confirmRestore} disabled={!snapshot || loading || restoring} className="ml-auto flex items-center gap-2 rounded-lg bg-[#F4C430] px-3 py-2 text-xs font-bold text-black transition-colors hover:bg-[#d4a822] disabled:cursor-not-allowed disabled:opacity-40">{restoring ? <RefreshCw size={14} className="animate-spin" /> : restored ? <Check size={14} /> : <RotateCcw size={14} />}{restoring ? 'Restoring…' : restored ? 'Restored' : 'Restore this version'}</button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl bg-[#151515] p-3">
        {loading || !snapshot ? <div className="py-24 text-center text-sm text-gray-500">Loading changed screenplay pages…</div> : changedPages.length === 0 ? <div className="py-24 text-center text-sm text-gray-500">No screenplay-page changes in this comparison.</div> : <><p className="mb-3 px-1 text-[10px] font-bold uppercase tracking-wider text-[#F4C430]">{changedPages.length} changed page{changedPages.length === 1 ? '' : 's'}</p><div className="grid min-w-[820px] grid-cols-2 gap-3">
          <ScreenplayPreview title={selectedCommitRecord?.message || 'Saved version'} subtitle={`${selectedCommitRecord?.date || ''}${selectedCommitRecord?.author ? ` · ${selectedCommitRecord.author}` : ''}`} blocks={historicalChangedBlocks} comparison={currentChangedBlocks} historical />
          <ScreenplayPreview title="Active working draft" subtitle="Only screenplay pages changed since this checkpoint" blocks={currentChangedBlocks} comparison={historicalChangedBlocks} />
        </div></>}
      </div>
    </div>}
  </div>;
}
