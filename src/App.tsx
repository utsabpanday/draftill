import { useState, useEffect } from 'react';
import { 
  PenTool, Folder, BarChart2, 
  User, GitCommit, Settings, 
  ShieldAlert, Maximize2, Minimize2, Minus, X,
  ChevronLeft, ChevronRight, MessageSquare, GitBranch,
  Film, Home, Plus, Play, FileDown, Network
} from 'lucide-react';
import ScriptEditor from './editor/Editor';
import Outline from './components/Outline';
import CharacterBible from './components/CharacterBible';
import StatsDashboard from './components/StatsDashboard';
import CompareSplit from './components/CompareSplit';
import SettingsPanel from './components/SettingsPanel';
import AIStudioPanel from './components/AIStudioPanel';
import AIIcon from './components/AIIcon';
import SceneCreation from './components/SceneCreation';
import Freeflow from './components/Freeflow';
import PreviewSlideshow from './components/PreviewSlideshow';
import Homepage from './components/Homepage';
import { useAppStore } from './store/store';
import { eventMatchesShortcut, isTextEntryTarget } from './utils/shortcuts';
import { buildScreenplayPdfHtml } from './utils/pdfExport';

const PAGE_SHORTCUT_TABS: Record<string, string> = {
  'Open Editor': 'script',
  'Open Outline': 'outline',
  'Open Cast': 'bible',
  'Open Location': 'scene-creation',
  'Open Freeflow': 'freeflow',
  'Open History': 'compare',
  'Open Insights': 'stats',
  'Open Settings': 'settings'
};

const GLOBAL_SHORTCUT_ACTIONS = new Set([
  ...Object.keys(PAGE_SHORTCUT_TABS),
  'Open Home',
  'New Screenplay Page',
  'Toggle Sidebar',
  'Toggle Comments',
  'Toggle AI Panel',
  'Focus Mode'
]);

export default function App() {
  const { 
    activeTab, setActiveTab,
    isDarkMode,
    focusMode, setFocusMode,
    currentFilePath, currentFileName, setCurrentFile,
    isSaved, setIsSaved,
    scriptContent,
    titlePage,
    revisionMode, setRevisionMode,
    comments, addComment, deleteComment,
    activeProjectId, goHome, openProject, closeProjectTab, projectTabs,
    corkboardCards, characters, locations, freeflowNodes, freeflowEdges, freeflowGroups,
    wordGoal, pageGoal,
    activeStructureTemplate, screenplayFontFamily, lockSceneNumbers,
    projectWorkspacePath,
    dialog,
    closeDialog,
    showAlertDialog,
    autoSaveEnabled,
    shortcuts
  } = useAppStore();

  const [lockOwner, setLockOwner] = useState<string | null>(null);
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCommentsPanelOpen, setIsCommentsPanelOpen] = useState(false);
  const [isGitPanelOpen, setIsGitPanelOpen] = useState(false);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    const savedWidth = Number(localStorage.getItem('draftill:right-panel-width'));
    return Number.isFinite(savedWidth) ? Math.min(720, Math.max(320, savedWidth)) : 420;
  });
  const [commentText, setCommentText] = useState('');
  const [commentSelection, setCommentSelection] = useState<{ nodeIndex: number; selectionText: string } | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [firstRunProjId, setFirstRunProjId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const versionControlSurface = activeTab === 'script';

  useEffect(() => {
    if (!versionControlSurface) setIsGitPanelOpen(false);
  }, [versionControlSurface]);

  useEffect(() => {
    const handleGlobalShortcut = (event: KeyboardEvent) => {
      if (!activeProjectId || isTextEntryTarget(event.target)) return;
      const shortcut = shortcuts.find((item) => GLOBAL_SHORTCUT_ACTIONS.has(item.action) && eventMatchesShortcut(event, item.key));
      if (!shortcut) return;

      event.preventDefault();
      const destination = PAGE_SHORTCUT_TABS[shortcut.action];
      if (destination) {
        setActiveTab(destination);
        return;
      }

      if (shortcut.action === 'Open Home') {
        void goHome();
      } else if (shortcut.action === 'New Screenplay Page') {
        const addPage = () => window.dispatchEvent(new CustomEvent('draftill:add-screenplay-page'));
        if (activeTab === 'script') addPage();
        else {
          setActiveTab('script');
          window.setTimeout(addPage, 100);
        }
      } else if (shortcut.action === 'Toggle Sidebar') {
        setIsSidebarCollapsed((current) => !current);
      } else if (shortcut.action === 'Toggle Comments') {
        const next = !isCommentsPanelOpen;
        setIsCommentsPanelOpen(next);
        setIsGitPanelOpen(false);
        setIsAiPanelOpen(false);
        setFocusMode(false);
        setIsSidebarCollapsed(next);
      } else if (shortcut.action === 'Toggle AI Panel') {
        const next = !isAiPanelOpen;
        setIsAiPanelOpen(next);
        setIsCommentsPanelOpen(false);
        setIsGitPanelOpen(false);
        setFocusMode(false);
        setIsSidebarCollapsed(next);
      } else if (shortcut.action === 'Focus Mode') {
        setFocusMode(!focusMode);
      }
    };

    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, [activeProjectId, activeTab, focusMode, goHome, isAiPanelOpen, isCommentsPanelOpen, setActiveTab, setFocusMode, shortcuts]);

  const handleToggleMaximize = async () => {
    if (window.ipcRenderer) {
      const isMax = await window.ipcRenderer.invoke('window:toggle-maximize');
      setIsWindowMaximized(isMax);
    }
  };

  const handleAddComment = () => {
    if (!commentText.trim() || !commentSelection) return;
    addComment(commentSelection.nodeIndex, commentText.trim(), 'Author', commentSelection.selectionText);
    setCommentText('');
    setCommentSelection(null);
  };

  const handleJumpToComment = (nodeIndex: number) => {
    setActiveTab('script');
    setTimeout(() => window.dispatchEvent(new CustomEvent('draftill:jump-to-comment', { detail: { nodeIndex } })), 100);
  };

  const startRightPanelResize = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = rightPanelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = startWidth + (startX - moveEvent.clientX);
      setRightPanelWidth(Math.min(720, Math.max(320, nextWidth)));
    };
    const onMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  useEffect(() => {
    localStorage.setItem('draftill:right-panel-width', String(rightPanelWidth));
  }, [rightPanelWidth]);

  const handleCreateGitCommit = async () => {
    const gitFilePath = currentFilePath || (projectWorkspacePath ? activeProjectId : null);
    if (!gitFilePath || !commitMessage.trim() || !window.ipcRenderer) {
      showAlertDialog('Save First', 'Save your project file first to enable local Git snapshots.');
      return;
    }
    const res = await window.ipcRenderer.invoke('git:commit', gitFilePath, commitMessage, JSON.stringify({ scriptContent }));
    if (res.success) {
      showAlertDialog('Checkpoint Saved', 'Screenplay checkpoint committed successfully!');
      setCommitMessage('');
    } else {
      showAlertDialog('Error', 'Git Commit failed: ' + res.error);
    }
  };

  // Initialize theme class
  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
    document.body.style.backgroundColor = '#2a2a2a';
    if (!isDarkMode) useAppStore.setState({ isDarkMode: true });
  }, [isDarkMode]);

  useEffect(() => {
    const openComments = (event: Event) => {
      const detail = (event as CustomEvent<{ nodeIndex?: number; selectionText?: string }>).detail;
      if (typeof detail?.nodeIndex === 'number' && detail.selectionText) {
        setCommentSelection({ nodeIndex: detail.nodeIndex, selectionText: detail.selectionText });
      }
      setIsCommentsPanelOpen(true);
      setIsGitPanelOpen(false);
      setIsAiPanelOpen(false);
    };
    window.addEventListener('draftill:open-comments', openComments);
    return () => window.removeEventListener('draftill:open-comments', openComments);
  }, []);

  useEffect(() => {
    const askAI = (event: Event) => {
      const detail = (event as CustomEvent<{ nodeIndex?: number; selectionText?: string }>).detail;
      if (typeof detail?.nodeIndex !== 'number' || !detail.selectionText) return;
      setIsAiPanelOpen(true);
      setIsCommentsPanelOpen(false);
      setIsGitPanelOpen(false);
      setIsSidebarCollapsed(true);
      setTimeout(() => window.dispatchEvent(new CustomEvent('draftill:ai-add-context', { detail })), 120);
    };
    window.addEventListener('draftill:ask-ai', askAI);
    return () => window.removeEventListener('draftill:ask-ai', askAI);
  }, []);

  useEffect(() => {
    const useFreeflowSelectionAsAiContext = (event: Event) => {
      const detail = (event as CustomEvent<{ nodeIds?: string[] }>).detail;
      const nodeIds = Array.isArray(detail?.nodeIds) ? detail.nodeIds : [];
      if (nodeIds.length > 0) {
        setIsAiPanelOpen(true);
        setIsCommentsPanelOpen(false);
        setIsGitPanelOpen(false);
      }
      window.setTimeout(() => window.dispatchEvent(new CustomEvent('draftill:ai-freeflow-context-change', { detail: { nodeIds } })), nodeIds.length > 0 ? 120 : 0);
    };
    window.addEventListener('draftill:freeflow-context-change', useFreeflowSelectionAsAiContext);
    return () => window.removeEventListener('draftill:freeflow-context-change', useFreeflowSelectionAsAiContext);
  }, []);

  useEffect(() => {
    const openAssociatedFile = (_event: unknown, fileData: { filePath: string; name: string; content: string }) => {
      try {
        const parsed = JSON.parse(fileData.content);
        const projectData = parsed.scriptContent ? parsed : { scriptContent: { type: 'doc', content: parsed.content || [] }, titlePage: parsed.titlePage };
        const name = fileData.name.replace(/\.[^/.]+$/, '');
        useAppStore.setState((state) => ({
          activeProjectId: fileData.filePath,
          projectTabs: state.projectTabs.some((tab) => tab.id === fileData.filePath) ? state.projectTabs : [...state.projectTabs, { id: fileData.filePath, name }],
          currentFilePath: fileData.filePath,
          currentFileName: fileData.name,
          scriptContent: projectData.scriptContent || null,
          titlePage: projectData.titlePage || state.titlePage,
          corkboardCards: projectData.corkboardCards || [],
          characters: projectData.characters || [],
          locations: projectData.locations || [],
          comments: projectData.comments || [],
          freeflowNodes: projectData.freeflowNodes || [],
          freeflowEdges: projectData.freeflowEdges || [],
          freeflowGroups: projectData.freeflowGroups || [],
          wordGoal: projectData.wordGoal || 0,
          pageGoal: projectData.pageGoal || 0,
          activeStructureTemplate: projectData.activeStructureTemplate || 'three-act',
          screenplayFontFamily: projectData.screenplayFontFamily || 'monospace',
          lockSceneNumbers: projectData.lockSceneNumbers || false,
          revisionMode: projectData.revisionMode || 'none',
          activeTab: 'script',
          isSaved: true
        }));
      } catch (error) {
        showAlertDialog('Open Error', `Could not open ${fileData.name}: ${String(error)}`);
      }
    };
    window.ipcRenderer?.on('file:open-from-association', openAssociatedFile);
    return () => window.ipcRenderer?.off('file:open-from-association', openAssociatedFile);
  }, [showAlertDialog]);

  // Acquire file lock if file changes
  useEffect(() => {
    const manageLock = async () => {
      if (!currentFilePath || !window.ipcRenderer) return;
      
      const res = await window.ipcRenderer.invoke('lock:acquire', currentFilePath, 'Screenwriter');
      if (res.locked) {
        setLockOwner(res.owner);
      } else {
        setLockOwner(null);
      }
    };
    manageLock();

    return () => {
      if (currentFilePath && window.ipcRenderer) {
        window.ipcRenderer.invoke('lock:release', currentFilePath);
      }
    };
  }, [currentFilePath]);

  // Project Autosave / Manual Save Effect
  useEffect(() => {
    if (activeProjectId) {
      if (firstRunProjId !== activeProjectId) {
        setFirstRunProjId(activeProjectId);
        setIsSaved(true);
        return;
      }
      
      const projectData = {
        scriptContent,
        titlePage,
        corkboardCards,
        characters,
        locations,
        comments,
        freeflowNodes,
        freeflowEdges,
        freeflowGroups,
        wordGoal,
        pageGoal,
        activeStructureTemplate,
        screenplayFontFamily,
        lockSceneNumbers,
        revisionMode
      };
      
      const saveProjectData = async () => {
        if (window.ipcRenderer && projectWorkspacePath) {
          await window.ipcRenderer.invoke('workspace:writeProject', activeProjectId, JSON.stringify(projectData));
          const updatedProjects = useAppStore.getState().projects.map((p: any) => 
            p.id === activeProjectId ? { ...p, updatedAt: Date.now() } : p
          );
          useAppStore.setState({ projects: updatedProjects });
        } else {
          localStorage.setItem(`draftill_project_content_${activeProjectId}`, JSON.stringify(projectData));
          const savedProjects = localStorage.getItem('draftill_projects_meta');
          if (savedProjects) {
            try {
              const projectsList = JSON.parse(savedProjects);
              const index = projectsList.findIndex((p: any) => p.id === activeProjectId);
              if (index !== -1) {
                projectsList[index].updatedAt = Date.now();
                localStorage.setItem('draftill_projects_meta', JSON.stringify(projectsList));
                useAppStore.setState({ projects: projectsList });
              }
            } catch (e) {
              console.error(e);
            }
          }
        }
        setIsSaved(true);
      };

      if (autoSaveEnabled) {
        saveProjectData();
      } else {
        setIsSaved(false);
      }
    }
  }, [
    activeProjectId,
    scriptContent,
    titlePage,
    corkboardCards,
    characters,
    locations,
    comments,
    freeflowNodes,
    freeflowEdges,
    freeflowGroups,
    wordGoal,
    pageGoal,
    activeStructureTemplate,
    screenplayFontFamily,
    lockSceneNumbers,
    revisionMode,
    projectWorkspacePath
  ]);

  const handleManualSave = async () => {
    if (!activeProjectId) return;
    const projectData = {
      scriptContent,
      titlePage,
      corkboardCards,
      characters,
      locations,
      comments,
      freeflowNodes,
      freeflowEdges,
      freeflowGroups,
      wordGoal,
      pageGoal,
      activeStructureTemplate,
      screenplayFontFamily,
      lockSceneNumbers,
      revisionMode
    };
    if (window.ipcRenderer && projectWorkspacePath) {
      await window.ipcRenderer.invoke('workspace:writeProject', activeProjectId, JSON.stringify(projectData));
      const updatedProjects = useAppStore.getState().projects.map((p: any) => 
        p.id === activeProjectId ? { ...p, updatedAt: Date.now() } : p
      );
      useAppStore.setState({ projects: updatedProjects });
    } else {
      localStorage.setItem(`draftill_project_content_${activeProjectId}`, JSON.stringify(projectData));
      const savedProjects = localStorage.getItem('draftill_projects_meta');
      if (savedProjects) {
        try {
          const projectsList = JSON.parse(savedProjects);
          const index = projectsList.findIndex((p: any) => p.id === activeProjectId);
          if (index !== -1) {
            projectsList[index].updatedAt = Date.now();
            localStorage.setItem('draftill_projects_meta', JSON.stringify(projectsList));
            useAppStore.setState({ projects: projectsList });
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    setIsSaved(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleManualSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeProjectId,
    scriptContent,
    titlePage,
    corkboardCards,
    characters,
    locations,
    comments,
    freeflowNodes,
    freeflowEdges,
    freeflowGroups,
    wordGoal,
    pageGoal,
    activeStructureTemplate,
    screenplayFontFamily,
    lockSceneNumbers,
    revisionMode,
    projectWorkspacePath
  ]);

  // Export Handlers
  const handleSaveAsScript = async (customContent?: string) => {
    if (!scriptContent) return;
    
    let textContent = customContent || '';
    if (!textContent) {
      textContent = JSON.stringify({ content: scriptContent.content, titlePage });
    }

    if (window.ipcRenderer) {
      const res = await window.ipcRenderer.invoke('file:saveAs', textContent, currentFileName);
      if (res) {
        setCurrentFile(res.filePath, res.name);
        setIsSaved(true);
      }
    } else {
      // Download link in browser
      const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentFileName;
      a.click();
      URL.revokeObjectURL(url);
      setIsSaved(true);
    }
  };

  const handleExportPdf = async () => {
    if (!scriptContent) return;
    const html = buildScreenplayPdfHtml(scriptContent, currentFileName.replace(/\.[^/.]+$/, ''));
    if (window.ipcRenderer) {
      const name = currentFileName.replace(/\.[^/.]+$/, '') + '.pdf';
      const res = await window.ipcRenderer.invoke('file:exportPdf', { html, defaultName: name });
      if (res) showAlertDialog('PDF Exported', `Saved ${res.name}`);
      return;
    }
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Jump from outline tree directly back to script editor node
  const handleJumpToScene = (nodeId: string) => {
    setActiveTab('script');
    setTimeout(() => {
      const element = document.getElementById(nodeId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('bg-amber-500/20');
        setTimeout(() => element.classList.remove('bg-amber-500/20'), 1500);
      }
    }, 100);
  };

  if (activeProjectId === null) {
    return <Homepage />;
  }

  return (
    <div className={`flex h-screen w-screen overflow-hidden transition-colors ${isDarkMode ? 'bg-[#2a2a2a] text-[#e8e8e6]' : 'bg-[#e8e8e6] text-[#101113]'}`}>
      {/* Sidebar - Collapsible when focus mode is active */}
      {!focusMode && (
        <div className={`${isSidebarCollapsed ? 'w-16' : 'w-64'} ${isDarkMode ? 'bg-[#1a1a1a] text-[#e8e8e6] border-r border-[#333]' : 'bg-white text-[#101113] border-r border-gray-200'} flex flex-col pt-3 transition-all shrink-0`}>
          {/* Title Bar drag area inside sidebar */}
          <div className="absolute top-0 left-0 right-0 h-8" style={{ WebkitAppRegion: 'drag' } as any} />
          
          <div className={`px-6 py-4 font-inter font-bold text-xl tracking-tight border-b flex items-center justify-between gap-2 ${isDarkMode ? 'border-[#333]' : 'border-gray-200'} ${isSidebarCollapsed ? 'px-0 justify-center h-[62px]' : ''}`}>
            {!isSidebarCollapsed ? (
              <>
                <div className="flex items-center gap-2">
                  <img src="mainlogoicon.svg" className="w-8 h-8" alt="Draftill Logo" />
                  <button onClick={goHome} className="rounded p-1.5 text-gray-400 hover:bg-white/5 hover:text-[#F4C430] cursor-pointer" title="Home">
                    <Home size={15} />
                  </button>
                </div>
                <button 
                  onClick={() => setIsSidebarCollapsed(true)}
                  className="text-gray-400 hover:text-white p-1 hover:bg-white/5 rounded cursor-pointer transition-colors"
                  title="Collapse Sidebar"
                >
                  <ChevronLeft size={16} />
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <button onClick={goHome} className="text-gray-400 hover:text-[#F4C430] p-1 hover:bg-white/5 rounded cursor-pointer transition-colors" title="Home">
                  <Home size={15} />
                </button>
                <button 
                  onClick={() => {
                    setIsSidebarCollapsed(false);
                    setIsCommentsPanelOpen(false);
                    setIsGitPanelOpen(false);
                  }}
                  className="text-gray-400 hover:text-white p-1 hover:bg-white/5 rounded cursor-pointer transition-colors"
                  title="Expand Sidebar"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
          
          <nav className="flex-1 py-4 flex flex-col gap-1.5 overflow-y-auto">
            {[
              { id: 'script', icon: PenTool, label: 'Editor' },
              { id: 'outline', icon: Folder, label: 'Outline' },
              { id: 'bible', icon: User, label: 'Cast' },
              { id: 'scene-creation', icon: Film, label: 'Location' },
              { id: 'freeflow', icon: Network, label: 'Freeflow' },
              { id: 'compare', icon: GitBranch, label: 'History' },
              { id: 'stats', icon: BarChart2, label: 'Insights' },
              { id: 'settings', icon: Settings, label: 'Settings' }
            ].map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button 
                  key={tab.id}
                  className={`flex min-h-11 items-center gap-3.5 py-3 transition-colors cursor-pointer ${isSidebarCollapsed ? 'justify-center px-0' : 'px-6'} ${isActive ? `text-gray-300 border-r-2 border-[#F4C430] ${isDarkMode ? 'bg-white/5' : 'bg-black/5'}` : (isDarkMode ? 'hover:bg-white/5 text-white' : 'hover:bg-black/5 text-black')}`}
                  onClick={() => setActiveTab(tab.id)}
                  title={isSidebarCollapsed ? tab.label : undefined}
                >
                  <TabIcon size={17} className={`shrink-0 ${isActive ? 'text-[#F4C430]' : ''}`} />
                  {!isSidebarCollapsed && <span className="text-[12px] font-medium tracking-normal">{tab.label}</span>}
                </button>
              );
            })}
          </nav>

          {/* Revision controls are intentionally hidden from the editor UI. */}
          {false && (!isSidebarCollapsed ? (
            <div className={`p-4 border-t ${isDarkMode ? 'border-[#333]' : 'border-gray-200'} flex flex-col gap-2`}>
              <span className="text-[10px] font-bold text-gray-500 uppercase">Active Revision Tag</span>
              <div className="flex gap-1.5 justify-between">
                {['none', 'blue', 'pink', 'yellow', 'green'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setRevisionMode(mode as any)}
                    className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] uppercase font-bold transition-all ${
                      revisionMode === mode 
                        ? 'border-[#F4C430] scale-110 shadow' 
                        : (isDarkMode ? 'border-transparent text-gray-500' : 'border-gray-300 text-gray-400')
                    }`}
                    style={{
                      backgroundColor: mode === 'none' ? 'transparent' : (mode === 'blue' ? '#3b82f6' : (mode === 'pink' ? '#ec4899' : (mode === 'yellow' ? '#f59e0b' : '#10b981'))),
                      color: mode === 'none' ? (isDarkMode ? '#fff' : '#000') : '#fff'
                    }}
                  >
                    {mode === 'none' ? 'Ø' : ''}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className={`p-4 border-t ${isDarkMode ? 'border-[#333]' : 'border-gray-200'} flex flex-col items-center gap-2`}>
              <div 
                className="w-4 h-4 rounded-full border"
                style={{
                  backgroundColor: revisionMode === 'none' ? 'transparent' : (revisionMode === 'blue' ? '#3b82f6' : (revisionMode === 'pink' ? '#ec4899' : (revisionMode === 'yellow' ? '#f59e0b' : '#10b981'))),
                  borderColor: isDarkMode ? '#333' : '#ccc'
                }}
                title={`Active Revision: ${revisionMode}`}
              />
            </div>
          ))}

        </div>
      )}



      {/* Main Canvas */}
      <div className="flex-1 flex flex-col relative min-w-0">
        {/* Lock Banner */}
        {lockOwner && (
          <div className="bg-red-500/20 border-b border-red-500/30 px-6 py-2 flex items-center gap-2 text-red-400 text-xs shrink-0 font-inter">
            <ShieldAlert size={14} />
            <span><strong>Locked File:</strong> Screenplay is currently open by owner <strong>{lockOwner}</strong>. Saving might overwrite changes.</span>
          </div>
        )}

        {/* Top Control Bar */}
        <div className={`h-14 border-b flex items-center justify-between px-6 shrink-0 transition-colors ${isDarkMode ? 'bg-[#222] border-[#333]' : 'bg-[#f4f4f2] border-gray-200'}`} style={{ WebkitAppRegion: 'drag' } as any}>
          <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <div className="flex items-center gap-1 max-w-[38vw] overflow-x-auto">
              {projectTabs.map((tab) => (
                <div key={tab.id} className={`flex max-w-48 items-center rounded-t text-[11px] font-semibold transition-colors ${tab.id === activeProjectId ? 'bg-[#3a3a3a] text-white' : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-200'}`} title={tab.name}>
                  <button onClick={() => openProject(tab.id)} className="min-w-0 flex-1 truncate px-3 py-2 text-left cursor-pointer">
                    {tab.name}
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      closeProjectTab(tab.id);
                    }}
                    className="mr-1 rounded p-1 text-gray-400 hover:bg-white/10 hover:text-white cursor-pointer"
                    title={`Close ${tab.name}`}
                    aria-label={`Close ${tab.name}`}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              <button onClick={goHome} className="rounded p-2 text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-[#F4C430] cursor-pointer" title="Open Home / New Tab">
                <Plus size={15} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 font-inter" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <div className="flex items-center gap-1.5 px-1 text-xs text-gray-400" title={isSaved ? 'All changes saved' : 'Unsaved changes'}>
              <span className={`w-2 h-2 rounded-full ${isSaved ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
              <span className="font-medium">{isSaved ? 'Saved' : 'Modified'}</span>
            </div>
            <button 
              onClick={() => {
                const nextVal = !isCommentsPanelOpen;
                setIsCommentsPanelOpen(nextVal);
                if (nextVal) {
                  setIsGitPanelOpen(false);
                  setIsAiPanelOpen(false);
                  setIsSidebarCollapsed(true);
                } else {
                  setIsSidebarCollapsed(false);
                }
              }}
              className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${isCommentsPanelOpen ? 'text-[#F4C430] bg-white/5' : 'text-gray-400 hover:text-white'}`}
              title="Comments Panel"
            >
              <MessageSquare size={16} />
            </button>
            {versionControlSurface && <button 
              onClick={() => {
                const nextVal = !isGitPanelOpen;
                setIsGitPanelOpen(nextVal);
                if (nextVal) {
                  setIsCommentsPanelOpen(false);
                  setIsAiPanelOpen(false);
                  setIsSidebarCollapsed(true);
                } else {
                  setIsSidebarCollapsed(false);
                }
              }}
              className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${isGitPanelOpen ? 'text-[#F4C430] bg-white/5' : 'text-gray-400 hover:text-white'}`}
              title="Git Snapshots"
            >
              <GitBranch size={16} />
            </button>}
            <button 
              onClick={() => {
                const nextVal = !isAiPanelOpen;
                setIsAiPanelOpen(nextVal);
                if (nextVal) {
                  setIsCommentsPanelOpen(false);
                  setIsGitPanelOpen(false);
                  setIsSidebarCollapsed(true);
                } else {
                  setIsSidebarCollapsed(false);
                }
              }}
              className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${isAiPanelOpen ? 'text-[#F4C430] bg-white/5' : 'text-gray-400 hover:text-white'}`}
              title="Draftill AI"
            >
              <AIIcon size={17} />
            </button>
            <button 
              onClick={() => setIsPreviewOpen(true)}
              className="flex items-center gap-1.5 rounded bg-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-300 dark:bg-[#333] dark:text-gray-200 dark:hover:bg-[#444] cursor-pointer"
              title="Preview screenplay as slideshow"
            >
              <Play size={13} />
              <span>Preview</span>
            </button>
            <button
              onClick={handleExportPdf}
              className="flex items-center gap-1.5 rounded bg-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-300 dark:bg-[#333] dark:text-gray-200 dark:hover:bg-[#444] cursor-pointer"
              title="Export screenplay as PDF"
            >
              <FileDown size={13} />
              <span>PDF</span>
            </button>
            <button 
              onClick={() => handleSaveAsScript()}
              className="text-xs bg-[#F4C430] text-[#101113] font-bold px-3 py-1.5 rounded hover:bg-[#d4a822] transition-colors"
            >
              Save As
            </button>



            {/* Custom Window control buttons */}
            <div className="flex items-center gap-1 border-l border-gray-200 dark:border-[#333] pl-2 ml-1">
              <button 
                onClick={() => window.ipcRenderer?.invoke('window:minimize')}
                className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded text-gray-400 hover:text-white transition-colors cursor-pointer"
                title="Minimize Window"
              >
                <Minus size={14} />
              </button>
              <button 
                onClick={handleToggleMaximize}
                className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded text-gray-400 hover:text-white transition-colors cursor-pointer"
                title={isWindowMaximized ? "Restore Window" : "Maximize Window"}
              >
                {isWindowMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button 
                onClick={() => window.ipcRenderer?.invoke('window:close')}
                className="p-1.5 hover:bg-red-600/20 hover:text-red-500 rounded text-gray-400 transition-colors cursor-pointer"
                title="Close Window"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Inner Tab Canvas Row Wrapper */}
        <div className="flex-1 flex min-h-0 relative">
          
          {/* Dynamic Inner Tab Canvas */}
          {activeTab === 'script' ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <ScriptEditor />
            </div>
          ) : (
            <div className={`flex-1 overflow-auto p-8 transition-colors ${isDarkMode ? 'bg-[#2a2a2a]' : 'bg-[#e8e8e6]'}`}>
              {activeTab === 'outline' && <Outline onJumpToScene={handleJumpToScene} />}
              {activeTab === 'bible' && <CharacterBible />}
              {activeTab === 'scene-creation' && <SceneCreation />}
              {activeTab === 'freeflow' && <Freeflow />}
              {activeTab === 'compare' && <CompareSplit />}
              {activeTab === 'stats' && <StatsDashboard />}
              {activeTab === 'settings' && <SettingsPanel />}
            </div>
          )}

          {isPreviewOpen && <PreviewSlideshow scriptContent={scriptContent} isDarkMode={isDarkMode} onClose={() => setIsPreviewOpen(false)} />}

          {/* Separate Comments / Git Panel on the Right */}
          {!focusMode && (isCommentsPanelOpen || isGitPanelOpen || isAiPanelOpen) && (
            <div
              className={`relative border-l flex flex-col pt-8 shrink-0 font-inter text-xs ${isDarkMode ? 'bg-[#1a1a1a] text-[#e8e8e6] border-[#333]' : 'bg-white text-[#101113] border-gray-200'}`}
              style={{ width: rightPanelWidth }}
            >
              <button
                type="button"
                onMouseDown={startRightPanelResize}
                className="group absolute -left-1.5 top-0 z-20 flex h-full w-3 cursor-col-resize items-center justify-center"
                title="Drag to resize panel"
                aria-label="Resize side panel"
              >
                <span className="h-12 w-1 rounded-full bg-transparent transition-colors group-hover:bg-[#F4C430]" />
              </button>
              {isAiPanelOpen && (
                <AIStudioPanel onClose={() => {
                  setIsAiPanelOpen(false);
                  setIsSidebarCollapsed(false);
                }} onOpenSettings={() => {
                  setIsAiPanelOpen(false);
                  setIsSidebarCollapsed(false);
                  goHome().then(() => setTimeout(() => window.dispatchEvent(new CustomEvent('draftill:open-global-settings')), 100));
                }} />
              )}
              {isCommentsPanelOpen && (
                <>
                  <div className={`px-6 py-4 font-bold text-sm border-b flex items-center justify-between ${isDarkMode ? 'border-[#333]' : 'border-gray-200'}`}>
                    <span className="flex items-center gap-1.5 uppercase tracking-wider text-xs font-black">
                      <MessageSquare size={14} className="text-[#F4C430]" /> Comments
                    </span>
                    <button 
                      onClick={() => {
                        setIsCommentsPanelOpen(false);
                        setIsSidebarCollapsed(false);
                      }}
                      className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/5 cursor-pointer transition-colors"
                      title="Close Drawer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  
                  <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
                    <div className={`p-4 rounded-xl border flex flex-col gap-3 ${isDarkMode ? 'bg-[#222] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                      <h4 className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-xs text-white">
                        <MessageSquare size={14} className="text-[#F4C430]" /> Added Comments
                      </h4>
                      {commentSelection && (
                        <div className="rounded-lg border border-[#F4C430]/50 bg-[#F4C430]/5 p-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#F4C430]">New comment</p>
                          <p className="mt-1 line-clamp-2 text-[11px] italic text-gray-300">“{commentSelection.selectionText}”</p>
                          <textarea 
                            autoFocus
                            rows={2}
                            placeholder="Write your comment..."
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            className="mt-2 w-full rounded border border-[#444] bg-[#171717] p-2 text-xs text-white focus:border-[#F4C430] focus:outline-none"
                          />
                          <div className="mt-2 flex justify-end gap-2">
                            <button onClick={() => { setCommentSelection(null); setCommentText(''); }} className="text-[10px] font-bold text-gray-400 hover:text-white">Cancel</button>
                            <button onClick={handleAddComment} className="rounded bg-[#F4C430] px-2.5 py-1 text-[10px] font-bold text-black hover:bg-[#d4a822]">Add comment</button>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
                        {comments.length === 0 && <p className="py-4 text-center text-[11px] text-gray-500">Comments added from selected screenplay text appear here.</p>}
                        {comments.map((comm: any) => (
                          <div key={comm.id} className={`rounded border text-[11px] transition-colors ${isDarkMode ? 'border-[#333] bg-[#2a2a2a]' : 'border-gray-200 bg-gray-50'}`}>
                            <button onClick={() => handleJumpToComment(comm.nodeIndex)} className="w-full p-2 text-left hover:bg-white/5">
                              <div className="mb-1 flex items-center justify-between font-bold text-gray-400">
                                <span>{comm.author} · Page {comm.nodeIndex + 1}</span>
                                <span className="text-[9px] text-[#F4C430]">Go to text</span>
                              </div>
                              {comm.selectionText && <p className="mb-1 line-clamp-1 text-[10px] italic text-gray-500">“{comm.selectionText}”</p>}
                              <p className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>{comm.text}</p>
                            </button>
                            <div className="border-t border-[#333] px-2 py-1 text-right">
                              <button onClick={() => deleteComment(comm.id)} className="text-[10px] font-bold text-red-400 hover:text-red-300">Delete</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {isGitPanelOpen && (
                <>
                  <div className={`px-6 py-4 font-bold text-sm border-b flex items-center justify-between ${isDarkMode ? 'border-[#333]' : 'border-gray-200'}`}>
                    <span className="flex items-center gap-1.5 uppercase tracking-wider text-xs font-black">
                      <GitBranch size={14} className="text-[#F4C430]" /> Version Control
                    </span>
                    <button 
                      onClick={() => {
                        setIsGitPanelOpen(false);
                        setIsSidebarCollapsed(false);
                      }}
                      className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/5 cursor-pointer transition-colors"
                      title="Close Drawer"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
                    {/* Git snapshots */}
                    <div className={`p-4 rounded-xl border flex flex-col gap-3 ${isDarkMode ? 'bg-[#222] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                      <h4 className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-xs text-white">
                        <GitCommit size={14} className="text-[#F4C430]" /> Local Checkpoint
                      </h4>
                      <p className="text-[10px] text-gray-500">Record a local screenplay checkpoint. Freeflow, Character, and Location edits do not create versions.</p>
                      <input 
                        type="text" 
                        placeholder="e.g. Added Act I Twist"
                        value={commitMessage}
                        onChange={(e) => setCommitMessage(e.target.value)}
                        className={`w-full border rounded px-3 py-1.5 text-xs focus:outline-none focus:border-[#F4C430] ${isDarkMode ? 'bg-[#2a2a2a] border-[#333] text-white' : 'bg-white border-gray-300 text-black'}`}
                      />
                      <button 
                        onClick={handleCreateGitCommit}
                        className="w-full bg-transparent border border-[#F4C430] text-[#F4C430] font-bold py-1.5 rounded text-xs hover:bg-[#F4C430]/10 transition-colors cursor-pointer"
                      >
                        Commit Screenplay
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Custom Global Dialog Popup Modal */}
      {dialog.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-2xl p-6 border shadow-2xl ${
              isDarkMode ? 'bg-[#1f1f23] border-[#2f2f35] text-white' : 'bg-white border-gray-200 text-black'
            }`}
          >
            <h3 className="font-extrabold text-sm uppercase tracking-wider mb-2 text-[#F4C430]">{dialog.title}</h3>
            <p className="text-xs text-gray-400 mb-6 leading-relaxed">{dialog.message}</p>
            <div className="flex gap-2 justify-end text-xs">
              {dialog.type === 'confirm' && (
                <button 
                  onClick={closeDialog}
                  className={`px-3 py-2 rounded-xl border font-bold ${
                    isDarkMode ? 'border-[#333] text-gray-400 hover:bg-white/5' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Cancel
                </button>
              )}
              <button 
                onClick={() => {
                  dialog.onConfirm?.();
                  closeDialog();
                }}
                className="bg-[#F4C430] hover:bg-[#d8ae27] text-black px-5 py-2 rounded-xl font-extrabold cursor-pointer"
              >
                {dialog.type === 'confirm' ? 'Confirm' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
