import { useState, useEffect } from 'react';
import { 
  Folder, Search, Trash2, Edit3, ChevronRight, Plus, X, 
  FileText, FilePlus, MoreVertical, FolderOpen, Upload, Home, Clock,
  Minus, Maximize2, Minimize2, Settings, Shield, Keyboard, Clapperboard, Tv, Theater, Mic2, BookOpen, Check
} from 'lucide-react';
import { useAppStore } from '../store/store';
import { PREBUILT_TEMPLATES } from '../utils/templates';
import { parseFountain, parseFDX, importPlainOrCeltx } from '../utils/importersExporters';
import AISettings from './AISettings';

export default function Homepage() {
  const {
    folders,
    projects,
    createFolder,
    deleteFolder,
    renameFolder,
    createProject,
    deleteProject,
    renameProject,
    moveProject,
    openProject,
    importProject,
    projectWorkspacePath,
    setWorkspace,
    scanWorkspaceFiles,
    isDarkMode,
    showConfirmDialog,
    showAlertDialog,
    dialog,
    closeDialog,
    shortcuts,
    updateShortcut,
    autoSaveEnabled,
    setAutoSaveEnabled
  } = useAppStore();

  // Navigation State
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);

  useEffect(() => {
    const openGlobalSettings = () => setShowGlobalSettings(true);
    window.addEventListener('draftill:open-global-settings', openGlobalSettings);
    return () => window.removeEventListener('draftill:open-global-settings', openGlobalSettings);
  }, []);

  const handleToggleMaximize = async () => {
    if (window.ipcRenderer) {
      const isMax = await window.ipcRenderer.invoke('window:toggle-maximize');
      setIsWindowMaximized(isMax);
    }
  };

  // Dropdown / menu states
  const [activeDropdownType, setActiveDropdownType] = useState<'project' | 'folder' | null>(null);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  // Modal States
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    e.dataTransfer.setData('text/plain', projectId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverFolderId(folderId);
  };

  const handleDragLeave = (_e: React.DragEvent, folderId: string) => {
    if (dragOverFolderId === folderId) {
      setDragOverFolderId(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverFolderId(null);
    const projectId = e.dataTransfer.getData('text/plain');
    if (projectId) {
      await moveProject(projectId, folderId);
    }
  };
  const [selectedTemplateId, setSelectedTemplateId] = useState('blank');

  const getTemplateVisual = (templateId: string) => {
    if (templateId.includes('tv')) return { Icon: Tv, label: 'EPISODE', accent: 'bg-sky-400/15 text-sky-300' };
    if (templateId.includes('stage') || templateId.includes('theater')) return { Icon: Theater, label: 'STAGE', accent: 'bg-violet-400/15 text-violet-300' };
    if (templateId.includes('music') || templateId.includes('podcast')) return { Icon: Mic2, label: 'AUDIO', accent: 'bg-emerald-400/15 text-emerald-300' };
    if (templateId.includes('save-the-cat')) return { Icon: BookOpen, label: 'BEATS', accent: 'bg-orange-400/15 text-orange-300' };
    return { Icon: Clapperboard, label: 'SCREENPLAY', accent: 'bg-[#F4C430]/15 text-[#F4C430]' };
  };

  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ type: 'project' | 'folder'; id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveTargetProjectId, setMoveTargetProjectId] = useState<string | null>(null);

  // Initialize workspace path and scan files on load
  useEffect(() => {
    const initWorkspace = async () => {
      if (window.ipcRenderer && !projectWorkspacePath) {
        const defaultPath = await window.ipcRenderer.invoke('workspace:getDefault');
        if (defaultPath) {
          setWorkspace(defaultPath);
        }
      } else {
        scanWorkspaceFiles();
      }
    };
    initWorkspace();
  }, [projectWorkspacePath]);

  // Handler to change the workspace folder
  const handleChangeWorkspace = async () => {
    if (window.ipcRenderer) {
      const selectedPath = await window.ipcRenderer.invoke('workspace:select');
      if (selectedPath) {
        setWorkspace(selectedPath);
        setCurrentFolderId(null); // Reset folder view on workspace change
      }
    } else {
      showAlertDialog('Desktop Mode Only', 'Workspace directory selection is only available in desktop app mode.');
    }
  };

  // Filter projects based on search query and folder
  const filteredProjects = projects.filter((project: any) => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFolder = project.folderId === currentFolderId;
    return matchesSearch && matchesFolder;
  });

  // Filter folders based on search query
  const filteredFolders = folders.filter((folder: any) => {
    if (searchQuery) {
      return folder.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  // Group folders and projects in the current view level
  const currentFolders = currentFolderId === null ? filteredFolders : [];

  const combinedItems = [
    ...currentFolders.map((folder: any) => ({
      ...folder,
      itemType: 'folder',
      timestamp: folder.createdAt || 0
    })),
    ...filteredProjects.map((project: any) => ({
      ...project,
      itemType: 'project',
      timestamp: project.updatedAt || project.createdAt || 0
    }))
  ];

  // Sort combined items by latest timestamp first (newest opened or created first)
  const sortedItems = combinedItems.sort((a, b) => b.timestamp - a.timestamp);

  const activeFolder = folders.find((f: any) => f.id === currentFolderId);

  const handlePageClick = () => {
    setActiveDropdownId(null);
    setActiveDropdownType(null);
  };

  // Form Submissions
  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    await createFolder(newFolderName.trim());
    setNewFolderName('');
    setShowNewFolderModal(false);
  };

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const projectId = await createProject(newProjectName.trim(), selectedTemplateId, currentFolderId);
    setShowNewProjectModal(false);
    setNewProjectName('');
    setSelectedTemplateId('blank');
    openProject(projectId);
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameValue.trim() || !renameTarget) return;
    if (renameTarget.type === 'project') {
      await renameProject(renameTarget.id, renameValue.trim());
    } else {
      await renameFolder(renameTarget.id, renameValue.trim());
    }
    setShowRenameModal(false);
    setRenameTarget(null);
    setRenameValue('');
  };

  const handleMoveSubmit = async (folderId: string | null) => {
    if (!moveTargetProjectId) return;
    await moveProject(moveTargetProjectId, folderId);
    setShowMoveModal(false);
    setMoveTargetProjectId(null);
  };

  const handleImportScript = async () => {
    if (window.ipcRenderer) {
      const fileData = await window.ipcRenderer.invoke('file:open');
      if (!fileData) return;

      const { content, name } = fileData;
      let docNodes: any[] = [];
      let loadedTitlePage = {};

      try {
        if (name.endsWith('.fountain')) {
          const nodes = parseFountain(content);
          docNodes = nodes.map((n) => ({
            type: n.type,
            attrs: { id: crypto.randomUUID() },
            content: n.text ? [{ type: 'text', text: n.text }] : undefined
          }));
        } else if (name.endsWith('.fdx') || name.endsWith('.fdxt')) {
          const { nodes, titlePage: tp } = parseFDX(content);
          docNodes = nodes.map((n) => ({
            type: n.type,
            attrs: { id: crypto.randomUUID() },
            content: n.text ? [{ type: 'text', text: n.text }] : undefined
          }));
          loadedTitlePage = tp;
        } else if (name.endsWith('.drftl')) {
          const parsed = JSON.parse(content);
          docNodes = parsed.content || [];
          loadedTitlePage = parsed.titlePage || {};
        } else {
          const nodes = importPlainOrCeltx(content);
          docNodes = nodes.map((n) => ({
            type: n.type,
            attrs: { id: crypto.randomUUID() },
            content: n.text ? [{ type: 'text', text: n.text }] : undefined
          }));
        }

        const formattedDoc = {
          type: 'doc',
          content: docNodes.some(n => n.type === 'page') 
            ? docNodes 
            : [{ type: 'page', content: docNodes }]
        };

        const projectName = name.replace(/\.[^/.]+$/, "");
        const projectId = await importProject(projectName, formattedDoc, loadedTitlePage, currentFolderId);
        openProject(projectId);
      } catch (err) {
        showAlertDialog('Import Error', 'Failed to parse and import screenplay: ' + err);
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.drftl,.fountain,.fdx,.txt';
      input.onchange = async (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        try {
          const nodes = parseFountain(text);
          const docNodes = nodes.map((n) => ({
            type: n.type,
            attrs: { id: crypto.randomUUID() },
            content: n.text ? [{ type: 'text', text: n.text }] : undefined
          }));
          const formattedDoc = {
            type: 'doc',
            content: [{ type: 'page', content: docNodes }]
          };
          const projectName = file.name.replace(/\.[^/.]+$/, "");
          const projectId = await importProject(projectName, formattedDoc, {}, currentFolderId);
          openProject(projectId);
        } catch (err) {
          showAlertDialog('Import Error', 'Failed to import: ' + err);
        }
      };
      input.click();
    }
  };

  return (
    <div 
      onClick={handlePageClick}
      className={`flex flex-col h-screen w-screen overflow-hidden font-inter transition-colors duration-200 ${
        isDarkMode ? 'bg-[#2a2a2a] text-[#e8e8e6]' : 'bg-[#f5f5f7] text-[#1c1c1e]'
      }`}
    >
      {/* Top Header Bar */}
      <header 
        className={`h-16 px-8 flex items-center justify-between border-b shrink-0 select-none ${
          isDarkMode ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-gray-200'
        }`}
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        {/* Brand / Logo */}
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <img src="mainlogoicon.svg" className="w-8 h-8" alt="Draftill Logo" />
        </div>

        {/* Search bar + Window controls */}
        <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button
            onClick={() => setShowGlobalSettings(true)}
            className={`p-2 rounded-xl border hover:text-white transition-all cursor-pointer ${
              isDarkMode ? 'bg-[#242424] border-[#3a3a3a] hover:bg-[#303030] text-gray-400' : 'bg-gray-100 border-gray-300 hover:bg-gray-200 text-gray-600'
            }`}
            title="Global Settings"
          >
            <Settings size={14} />
          </button>
          <div className="relative w-80">
            <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
            <input 
              type="text" 
              placeholder="Search files and folders..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#F4C430] border transition-all ${
                isDarkMode 
                  ? 'bg-[#242424] border-[#3a3a3a] text-white placeholder-gray-500 focus:bg-[#303030]' 
                  : 'bg-gray-100 border-transparent text-black placeholder-gray-400 focus:bg-white focus:border-gray-300'
              }`}
            />
          </div>

          {/* Custom Window control buttons */}
          <div className="flex items-center gap-1 border-l border-gray-200 dark:border-[#333] pl-3 ml-1">
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
      </header>

      {/* Main Grid View area */}
      <main className="flex-1 overflow-y-auto p-10">
        
        {/* Main Actions & Toolbar */}
        <div className="flex justify-between items-center mb-8">
          {/* Workspace Path folder button */}
          <div className="flex items-center gap-2">
            <button 
              onClick={handleChangeWorkspace}
              className={`p-1.5 rounded-lg border hover:text-white transition-all cursor-pointer ${
                isDarkMode ? 'bg-[#242424] border-[#3a3a3a] hover:bg-[#303030] text-gray-400' : 'bg-gray-100 border-gray-300 hover:bg-gray-200 text-gray-600'
              }`}
              title={`Workspace Path: ${projectWorkspacePath || 'No workspace selected'}`}
            >
              <FolderOpen size={13} />
            </button>
            <span className="text-[10px] font-semibold text-gray-500">Workspace directory</span>
          </div>

          {/* Action Buttons (Moved down from header) */}
          <div className="flex items-center gap-2 font-semibold">
            <button 
              onClick={handleImportScript}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all border cursor-pointer ${
                isDarkMode 
                  ? 'bg-transparent border-[#333] hover:bg-white/5 text-gray-300 hover:text-white' 
                  : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700 hover:text-black'
              }`}
            >
              <Upload size={14} />
              <span>Import Script</span>
            </button>
            <button 
              onClick={() => setShowNewFolderModal(true)}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm border cursor-pointer ${
                isDarkMode 
                  ? 'bg-[#242424] border-[#3a3a3a] hover:bg-[#303030] text-gray-300 hover:text-white' 
                  : 'bg-gray-100 border-gray-300 hover:bg-gray-200 text-gray-700 hover:text-black'
              }`}
            >
              <Plus size={14} />
              <span>New Folder</span>
            </button>
            <button 
              onClick={() => setShowNewProjectModal(true)}
              className="bg-[#F4C430] hover:bg-[#d8ae27] text-black shadow-md px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <FilePlus size={14} />
              <span>New Screenplay</span>
            </button>
          </div>
        </div>

        {/* Combined Items Section (Folders & Screenplays) */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              <button 
                onClick={() => setCurrentFolderId(null)}
                className={`hover:text-[#F4C430] transition-colors cursor-pointer ${currentFolderId === null ? 'text-white' : ''}`}
              >
                Workspace
              </button>
              {activeFolder && (
                <>
                  <ChevronRight size={10} className="text-gray-600" strokeWidth={3} />
                  <span className="text-white normal-case font-extrabold truncate max-w-xs">
                    {activeFolder.name}
                  </span>
                </>
              )}
            </div>
          </div>

          {sortedItems.length === 0 ? (
            <div className={`border border-dashed rounded-xl p-12 text-center flex flex-col items-center justify-center min-h-[220px] ${
              isDarkMode ? 'border-[#2f2f35]' : 'border-gray-300'
            }`}>
              <FileText size={28} className="text-gray-600 mb-3" />
              <p className="text-xs text-gray-500 mb-4">No folders or screenplays found.</p>
              <div className="flex items-center gap-2">
                {currentFolderId === null && (
                  <button 
                    onClick={() => setShowNewFolderModal(true)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all border cursor-pointer ${
                      isDarkMode 
                        ? 'bg-transparent border-[#333] hover:bg-white/5 text-gray-300 hover:text-white' 
                        : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700 hover:text-black'
                    }`}
                  >
                    <Plus size={14} /> New Folder
                  </button>
                )}
                <button 
                  onClick={() => setShowNewProjectModal(true)}
                  className="bg-[#F4C430] hover:bg-[#d8ae27] text-black px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Plus size={14} /> Create Screenplay
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-8">
              {sortedItems.map((item: any) => {
                if (item.itemType === 'folder') {
                  return (
                    <div 
                      key={item.id}
                      onClick={() => setCurrentFolderId(item.id)}
                      onDragOver={(e) => handleDragOver(e, item.id)}
                      onDragLeave={(e) => handleDragLeave(e, item.id)}
                      onDrop={(e) => handleDrop(e, item.id)}
                      className="group flex flex-col items-center cursor-pointer relative"
                    >
                      {/* Styled Grey folder layout matching reference screenshot */}
                      <div className={`relative mb-2 rounded-xl p-1 transition-all duration-200 ${
                        dragOverFolderId === item.id ? 'ring-2 ring-[#F4C430] bg-[#F4C430]/10 scale-105' : ''
                      }`}>
                        <svg className="w-24 h-20 transition-transform group-hover:scale-105 duration-200 drop-shadow-md" viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                          {/* Back page/folder tab */}
                          <path d="M5 12C5 8.68629 7.68629 6 11 6H35.4142C37.0056 6 38.532 6.63214 39.6569 7.75736L44.8284 12.9289C45.9532 14.0538 47.4797 14.6859 49.0711 14.6859H89C92.3137 14.6859 95 17.3722 95 20.6859V68C95 71.3137 92.3137 74 89 74H11C7.68629 74 5 71.3137 5 68V12Z" fill={isDarkMode ? '#898f99' : '#c0c4cb'} />
                          {/* Inner paper tab */}
                          <path d="M12 20C12 18.3431 13.3431 17 15 17H85C86.6569 17 88 18.3431 88 20V25H12V20Z" fill={isDarkMode ? '#a0a5b0' : '#e0e2e6'} fillOpacity="0.8" />
                          {/* Front folder pocket */}
                          <path d="M5 24C5 21.7909 6.79086 20 9 20H91C93.2091 20 95 21.7909 95 24V68C95 71.3137 92.3137 74 89 74H11C7.68629 74 5 71.3137 5 68V24Z" fill={isDarkMode ? '#a5aab2' : '#d1d4d9'} />
                          {/* Top folder front line */}
                          <path d="M9 20.5H91" stroke="#F4C430" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>

                        {/* Quick actions trigger on folder */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownType('folder');
                            setActiveDropdownId(activeDropdownId === item.id ? null : item.id);
                          }}
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/40 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity hover:text-white"
                        >
                          <MoreVertical size={12} />
                        </button>

                        {/* Folder Context Menu */}
                        {activeDropdownType === 'folder' && activeDropdownId === item.id && (
                          <div 
                            className={`absolute left-10 top-10 w-32 rounded-lg shadow-xl border z-20 overflow-hidden font-normal text-[11px] py-1 ${
                              isDarkMode ? 'bg-[#29292e] border-[#393942] text-white' : 'bg-white border-gray-200 text-black'
                            }`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button 
                              onClick={() => {
                                setRenameTarget({ type: 'folder', id: item.id, name: item.name });
                                setRenameValue(item.name);
                                setShowRenameModal(true);
                                setActiveDropdownId(null);
                              }}
                              className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-amber-500/10 hover:text-[#F4C430] transition-colors"
                            >
                              <Edit3 size={11} /> Rename
                            </button>
                            <button 
                              onClick={() => {
                                showConfirmDialog(
                                  'Delete Folder',
                                  `Delete folder "${item.name}"? Scripts inside will be deleted.`,
                                  () => deleteFolder(item.id)
                                );
                                setActiveDropdownId(null);
                              }}
                              className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-red-500 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 size={11} /> Delete
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Folder label centered underneath */}
                      <span className="text-xs font-semibold text-gray-300 group-hover:text-amber-500 transition-colors truncate max-w-[100px]">
                        {item.name}
                      </span>
                    </div>
                  );
                } else {
                  return (
                    <div 
                      key={item.id}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, item.id)}
                      onClick={() => openProject(item.id)}
                      className="group flex flex-col items-center cursor-grab active:cursor-grabbing relative select-none"
                    >
                      {/* File Page Style Layout */}
                      <div className="relative mb-2 w-24 h-28 rounded-lg border border-gray-400/40 bg-white/5 flex flex-col justify-between p-3 shadow hover:border-amber-500/50 hover:bg-white/10 overflow-visible transition-all duration-200">
                        {item.thumbnail ? (
                          <img src={item.thumbnail} className="absolute inset-0 w-full h-full object-cover rounded-lg opacity-85 group-hover:opacity-100 transition-opacity" alt="Cover" />
                        ) : (
                          <FileText size={32} className="text-[#F4C430] mx-auto mt-2" />
                        )}
                        
                        <span className="text-[8px] font-bold text-gray-500 uppercase tracking-wider truncate w-full text-center">
                          {item.templateName || 'Script'}
                        </span>

                        {/* Quick actions trigger on script */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownType('project');
                            setActiveDropdownId(activeDropdownId === item.id ? null : item.id);
                          }}
                          className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/40 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity hover:text-white"
                        >
                          <MoreVertical size={11} />
                        </button>

                        {/* Project Context Menu */}
                        {activeDropdownType === 'project' && activeDropdownId === item.id && (
                          <div 
                            className={`absolute right-1 top-8 w-36 rounded-lg shadow-xl border z-20 overflow-hidden font-normal text-[11px] py-1 ${
                              isDarkMode ? 'bg-[#29292e] border-[#393942] text-white' : 'bg-white border-gray-200 text-black'
                            }`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button 
                              onClick={() => {
                                setRenameTarget({ type: 'project', id: item.id, name: item.name });
                                setRenameValue(item.name);
                                setShowRenameModal(true);
                                setActiveDropdownId(null);
                              }}
                              className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-amber-500/10 hover:text-[#F4C430] transition-colors"
                            >
                              <Edit3 size={11} /> Rename
                            </button>
                            <button 
                              onClick={() => {
                                setMoveTargetProjectId(item.id);
                                setShowMoveModal(true);
                                setActiveDropdownId(null);
                              }}
                              className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-amber-500/10 hover:text-[#F4C430] transition-colors"
                            >
                              <Folder size={11} /> Move Folder
                            </button>
                            <button 
                              onClick={() => {
                                showConfirmDialog(
                                  'Delete Screenplay',
                                  `Delete project "${item.name}" permanently from workspace?`,
                                  () => deleteProject(item.id)
                                );
                                setActiveDropdownId(null);
                              }}
                              className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-red-500 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 size={11} /> Delete
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Screenplay filename centered underneath */}
                      <span className="text-xs font-semibold text-gray-300 group-hover:text-amber-500 transition-colors truncate max-w-[100px]">
                        {item.name}
                      </span>
                    </div>
                  );
                }
              })}
            </div>
          )}
        </div>

      </main>

      {/* MODAL 1: Create Folder */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-2xl p-6 border shadow-2xl ${
              isDarkMode ? 'bg-[#1f1f23] border-[#2f2f35]' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-white">Create New Folder</h3>
              <button onClick={() => setShowNewFolderModal(false)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateFolderSubmit} className="flex flex-col gap-4">
              <input 
                type="text" 
                placeholder="Folder name (e.g. Pixpair)"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoFocus
                className={`w-full px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#F4C430] border ${
                  isDarkMode ? 'bg-[#29292e] border-[#393942] text-white' : 'bg-white border-gray-300 text-black'
                }`}
              />
              <div className="flex gap-2 justify-end text-xs">
                <button 
                  type="button"
                  onClick={() => setShowNewFolderModal(false)}
                  className={`px-3 py-2 rounded-xl border font-bold ${
                    isDarkMode ? 'border-[#333] text-gray-400 hover:bg-white/5' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={!newFolderName.trim()}
                  className="bg-[#F4C430] hover:bg-[#d8ae27] text-black px-4 py-2 rounded-xl font-extrabold disabled:opacity-50"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Create Project */}
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-3xl rounded-2xl p-6 border shadow-2xl ${
              isDarkMode ? 'bg-[#242424] border-[#3a3a3a]' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-white">New Screenplay</h3>
              <button 
                onClick={() => setShowNewProjectModal(false)}
                className="text-gray-400 hover:text-white hover:bg-white/5 rounded-full p-1"
              >
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleCreateProjectSubmit} className="flex flex-col gap-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Screenplay Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. Midnight Horizon"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  autoFocus
                  required
                  className={`w-full px-4 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#F4C430] border ${
                    isDarkMode ? 'bg-[#1f1f1f] border-[#444] text-white' : 'bg-white border-gray-300 text-black'
                  }`}
                />
              </div>

              {/* Template selector */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Select Narrative Structure Template</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-2">
                  
                  {/* Blank Template */}
                  <div 
                    onClick={() => setSelectedTemplateId('blank')}
                    className={`group relative min-h-40 overflow-hidden border rounded-xl p-3 cursor-pointer transition-all flex flex-col justify-between ${
                      selectedTemplateId === 'blank'
                        ? 'border-[#F4C430] bg-[#303030] text-white shadow-[0_0_0_1px_rgba(244,196,48,0.2)]'
                        : (isDarkMode ? 'bg-[#1f1f1f] border-[#383838] hover:border-[#555] hover:bg-[#292929]' : 'bg-gray-50 border-gray-200 hover:border-gray-300')
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F4C430]/15 text-[#F4C430]"><FilePlus size={17} /></div>
                        <div><span className="text-[9px] font-bold tracking-[0.16em] text-gray-500">START HERE</span><h4 className="font-bold text-xs tracking-wide text-white">Blank canvas</h4></div>
                      </div>
                      {selectedTemplateId === 'blank' && <span className="rounded-full bg-[#F4C430] p-1 text-black"><Check size={11} strokeWidth={3} /></span>}
                    </div>
                    <p className="mt-4 max-w-[20rem] text-[11px] leading-relaxed text-gray-400">A clean screenplay with no structure beats or built-in story guidance.</p>
                    <div className="mt-4 flex gap-1"><span className="h-1.5 w-10 rounded-full bg-[#F4C430]"></span><span className="h-1.5 w-6 rounded-full bg-[#555]"></span><span className="h-1.5 w-14 rounded-full bg-[#3c3c3c]"></span></div>
                  </div>

                  {/* Prebuilt structures */}
                  {PREBUILT_TEMPLATES.map((tmpl) => {
                    const visual = getTemplateVisual(tmpl.id);
                    const TemplateIcon = visual.Icon;
                    return (
                    <div 
                      key={tmpl.id}
                      onClick={() => setSelectedTemplateId(tmpl.id)}
                      className={`group relative min-h-40 overflow-hidden border rounded-xl p-3 cursor-pointer transition-all flex flex-col justify-between ${
                        selectedTemplateId === tmpl.id
                          ? 'border-[#F4C430] bg-[#303030] text-white shadow-[0_0_0_1px_rgba(244,196,48,0.2)]'
                          : (isDarkMode ? 'bg-[#1f1f1f] border-[#383838] hover:border-[#555] hover:bg-[#292929]' : 'bg-gray-50 border-gray-200 hover:border-gray-300')
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${visual.accent}`}><TemplateIcon size={17} /></div>
                          <div className="min-w-0"><span className="text-[9px] font-bold tracking-[0.16em] text-gray-500">{visual.label}</span><h4 className="font-bold text-xs leading-snug text-white line-clamp-2">{tmpl.name.replace(/\s*\([^)]*\)/, '')}</h4></div>
                        </div>
                        {selectedTemplateId === tmpl.id && <span className="shrink-0 rounded-full bg-[#F4C430] p-1 text-black"><Check size={11} strokeWidth={3} /></span>}
                      </div>
                      <p className="mt-4 text-[11px] text-gray-400 leading-relaxed line-clamp-2">{tmpl.description}</p>
                      <div className="flex justify-between items-center border-t border-white/5 pt-2 mt-3 text-[10px] text-gray-500 font-bold">
                        <span>{tmpl.targetPageCount} PAGES</span>
                        <span className="flex items-center gap-1"><Clock size={11} /> {tmpl.estimatedRuntimeMin} MIN</span>
                      </div>
                    </div>
                  )})}
                </div>
              </div>

              <div className="flex gap-2 justify-end text-xs pt-4 border-t dark:border-[#2f2f35] border-gray-100">
                <button 
                  type="button"
                  onClick={() => setShowNewProjectModal(false)}
                  className={`px-3 py-2 rounded-xl border font-bold ${
                    isDarkMode ? 'border-[#333] text-gray-400 hover:bg-white/5' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={!newProjectName.trim()}
                  className="bg-[#F4C430] hover:bg-[#d8ae27] text-black px-5 py-2 rounded-xl font-extrabold disabled:opacity-50 cursor-pointer"
                >
                  Start Screenplay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Rename (Project or Folder) */}
      {showRenameModal && renameTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-2xl p-6 border shadow-2xl ${
              isDarkMode ? 'bg-[#1f1f23] border-[#2f2f35]' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-white">
                Rename {renameTarget.type === 'project' ? 'Screenplay' : 'Folder'}
              </h3>
              <button 
                onClick={() => { setShowRenameModal(false); setRenameTarget(null); }}
                className="text-gray-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleRenameSubmit} className="flex flex-col gap-4">
              <input 
                type="text" 
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                required
                className={`w-full px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#F4C430] border ${
                  isDarkMode ? 'bg-[#29292e] border-[#393942] text-white' : 'bg-white border-gray-300 text-black'
                }`}
              />
              <div className="flex gap-2 justify-end text-xs">
                <button 
                  type="button"
                  onClick={() => { setShowRenameModal(false); setRenameTarget(null); }}
                  className={`px-3 py-2 rounded-xl border font-bold ${
                    isDarkMode ? 'border-[#333] text-gray-400 hover:bg-white/5' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={!renameValue.trim() || renameValue.trim() === renameTarget.name}
                  className="bg-[#F4C430] hover:bg-[#d8ae27] text-black px-4 py-2 rounded-xl font-extrabold disabled:opacity-50 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Move Project to Folder */}
      {showMoveModal && moveTargetProjectId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-2xl p-6 border shadow-2xl ${
              isDarkMode ? 'bg-[#1f1f23] border-[#2f2f35]' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-white">Move to Folder</h3>
              <button 
                onClick={() => { setShowMoveModal(false); setMoveTargetProjectId(null); }}
                className="text-gray-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1 py-1">
              {/* Root folder option */}
              <button
                onClick={() => handleMoveSubmit(null)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  isDarkMode ? 'hover:bg-white/5 text-gray-300 hover:text-white' : 'hover:bg-gray-100 text-gray-700 hover:text-black'
                }`}
              >
                <Home size={14} className="text-gray-500" />
                <span>Move to All Projects (Root)</span>
              </button>

              {/* Folder list */}
              {folders.map((folder: any) => (
                <button
                  key={folder.id}
                  onClick={() => handleMoveSubmit(folder.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                    isDarkMode ? 'hover:bg-white/5 text-gray-300 hover:text-white' : 'hover:bg-gray-100 text-gray-700 hover:text-black'
                  }`}
                >
                  <Folder size={14} className="text-[#F4C430]" />
                  <span>{folder.name}</span>
                </button>
              ))}
            </div>

            <div className="flex justify-end text-xs pt-4 border-t dark:border-[#2f2f35] border-gray-100 mt-4">
              <button 
                onClick={() => { setShowMoveModal(false); setMoveTargetProjectId(null); }}
                className={`px-3 py-2 rounded-xl border font-bold ${
                  isDarkMode ? 'border-[#333] text-gray-400 hover:bg-white/5' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Global Settings Dialog Modal */}
      {showGlobalSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`w-[min(1120px,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] rounded-2xl border p-4 shadow-2xl flex flex-col sm:p-6 lg:p-7 ${
              isDarkMode ? 'bg-[#202020] border-[#3a3a3a] text-white' : 'bg-white border-gray-200 text-black'
            }`}
          >
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3 dark:border-[#383838] sm:mb-5">
              <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-[#F4C430] sm:text-base">
                <Settings size={17} /> Global Settings
              </h3>
              <button 
                onClick={() => setShowGlobalSettings(false)}
                className="text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="settings-scroll min-h-0 flex-1 overflow-y-auto py-1 pr-1 text-xs font-semibold sm:pr-2">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] lg:gap-6">
                <AISettings />
                <div className="flex min-w-0 flex-col gap-5">
              {/* Save Settings & Spellcheck */}
              <div className={`rounded-xl border p-4 flex flex-col gap-4 ${isDarkMode ? 'bg-[#191919] border-[#353535]' : 'bg-gray-50 border-gray-200'}`}>
                <h4 className="text-[10px] font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <Shield size={14} className="text-[#F4C430]" /> Save Options & Dictionary
                </h4>
                
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#333] bg-[#1a1a1a] p-3">
                  <div>
                    <span className="text-[11px] font-bold text-white block">Auto-Save Screenplays</span>
                    <span className="text-[9px] text-gray-400 font-normal block mt-0.5">Automatically saves changes as you write. If off, manual saving (Ctrl+S) is required.</span>
                  </div>
                  <button
                    onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
                    className={`relative w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer shrink-0 ${
                      autoSaveEnabled ? 'bg-[#F4C430]' : 'bg-[#333]'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200 ${
                      autoSaveEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 block mb-1">Spellcheck / Dictionary</label>
                  <div className="bg-[#1a1a1a] p-3 rounded-xl border border-[#333] flex items-center justify-between">
                    <span className="text-[11px] text-gray-300 font-normal">Offline Spellcheck Dictionary</span>
                    <span className="text-[9px] font-bold uppercase text-[#F4C430] bg-[#F4C430]/10 px-2 py-0.5 rounded-lg">
                      Active (Local English US)
                    </span>
                  </div>
                </div>
              </div>

              {/* Remapping Shortcuts */}
              <div className={`rounded-xl border p-4 flex flex-col gap-4 ${isDarkMode ? 'bg-[#191919] border-[#353535]' : 'bg-gray-50 border-gray-200'}`}>
                <h4 className="text-[10px] font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <Keyboard size={14} className="text-[#F4C430]" /> Keyboard Shortcut Remapping
                </h4>
                <div className="flex flex-col gap-2">
                  {shortcuts.map((sc, index) => (
                    <div key={sc.action}>
                      {(index === 0 || shortcuts[index - 1]?.category !== sc.category) && <p className="mb-1 mt-3 text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#F4C430] first:mt-0">{sc.category}</p>}
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-[#333] bg-[#1a1a1a] p-3">
                        <div>
                          <span className="font-bold text-white uppercase block text-[10px]">{sc.action}</span>
                          <span className="text-gray-500 font-normal text-[9px]">{sc.description}</span>
                        </div>
                        <input
                          aria-label={`${sc.action} shortcut`}
                          type="text"
                          value={sc.key}
                          onChange={(e) => updateShortcut(sc.action, e.target.value)}
                          className="bg-[#2a2a2a] border border-[#3b3b3b] rounded px-3 py-1 text-center font-mono font-bold text-[#F4C430] w-28 focus:outline-none focus:border-[#F4C430]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end border-t border-gray-100 pt-4 dark:border-[#383838] sm:mt-5">
              <button 
                onClick={() => setShowGlobalSettings(false)}
                className="bg-[#F4C430] hover:bg-[#d8ae27] text-black px-6 py-2 rounded-xl font-extrabold cursor-pointer text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
