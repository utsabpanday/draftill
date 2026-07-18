import { create } from 'zustand';
import { PREBUILT_TEMPLATES } from '../utils/templates';

export interface FolderRecord {
  id: string;
  name: string;
  createdAt: number;
}

export interface ProjectRecord {
  id: string;
  name: string;
  folderId: string | null;
  createdAt: number;
  updatedAt: number;
  templateName?: string;
  thumbnail?: string | null;
}

export interface ProjectTab {
  id: string;
  name: string;
}

export interface CharacterRecord {
  id: string;
  name: string;
  description: string;
  arc: string;
  notes: string;
  role?: string;
  image?: string | null;
  screenTimePercent: number;
  scenesFeatured: string[];
}

export interface LocationRecord {
  id: string;
  heading: string;
  description: string;
  notes: string;
  image?: string | null;
}

export interface CorkboardCard {
  id: string;
  title: string;
  synopsis: string;
  colorTag: string; // hex or category
  pov: string;
  subplot: string;
  sceneNodeIndex: number;
}

export interface CommentPin {
  id: string;
  nodeIndex: number;
  selectionText?: string;
  text: string;
  author: string;
  timestamp: number;
}

export interface FreeflowNode {
  id: string;
  type: 'scene' | 'shot' | 'character' | 'note' | 'image' | 'video' | 'link' | 'checklist';
  title: string;
  detail: string;
  x: number;
  y: number;
  width?: number;
  image?: string | null;
  video?: string | null;
  url?: string;
  linkPreview?: { url: string; title: string; description: string; siteName: string; image?: string } | null;
  checklist?: Array<{ id: string; text: string; checked: boolean }>;
  groupId?: string | null;
}

export interface FreeflowEdge {
  id: string;
  from: string;
  to: string;
  style?: 'curve' | 'straight' | 'elbow';
  fromPort?: number;
  toPort?: number;
}
export interface FreeflowGroup {
  id: string;
  name: string;
  nodeIds: string[];
  color: string;
  x?: number;
  y?: number;
  width?: number;
  inputPorts?: number;
  outputPorts?: number;
}

export interface VersionCommit {
  hash: string;
  message: string;
  date: string;
  author: string;
}

export interface KeyboardShortcut {
  action: string;
  key: string;
  description: string;
  category: 'Writing' | 'Navigation' | 'Panels' | 'Freeflow';
}

export interface TitlePageData {
  title: string;
  credit: string; // "Written by", etc.
  author: string;
  sourceMaterial: string; // "Based on..."
  contactInfo: string;
}

interface AppState {
  // Navigation & UI
  activeTab: string;
  isDarkMode: boolean;
  focusMode: boolean;
  splitScreen: boolean;
  compareScriptDoc: any | null; // ProseMirror JSON of side-by-side comparison
  pageBgColor: string;
  screenplayFontFamily: string;
  
  // Workspace & Active File
  currentFilePath: string | null;
  currentFileName: string;
  isSaved: boolean;
  projectWorkspacePath: string | null;
  recentProjects: string[]; // paths
  projectLockUser: string | null;
  
  // Script content (JSON state of editor)
  scriptContent: any | null;
  titlePage: TitlePageData;
  
  // Outlines & Beats
  outlineExpandedNodes: string[];
  wordGoal: number;
  pageGoal: number;
  
  // Structure Templates & Guides
  activeStructureTemplate: string;
  corkboardCards: CorkboardCard[];
  
  // Character Bible
  characters: CharacterRecord[];
  locations: LocationRecord[];
  
  // Collaboration / Local Git
  comments: CommentPin[];
  freeflowNodes: FreeflowNode[];
  freeflowEdges: FreeflowEdge[];
  freeflowGroups: FreeflowGroup[];
  revisionMode: 'none' | 'blue' | 'pink' | 'yellow' | 'green';
  versionHistory: VersionCommit[];
  activeCompareCommit: string | null;
  
  // Settings & Shortcuts
  shortcuts: KeyboardShortcut[];
  autoBackupIntervalMinutes: number;
  lockSceneNumbers: boolean;
  autoSaveEnabled: boolean;
  
  activeEditorView: any | null;
  activeNodeIdx: number | null;
  setPageBgColor: (color: string) => void;
  setScreenplayFontFamily: (family: string) => void;

  // Projects & Folders Workspace State
  activeProjectId: string | null;
  folders: FolderRecord[];
  projects: ProjectRecord[];
  projectTabs: ProjectTab[];
  
  // Actions
  scanWorkspaceFiles: () => Promise<void>;
  createFolder: (name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  renameFolder: (id: string, name: string) => Promise<void>;
  createProject: (name: string, templateId: string, folderId: string | null) => Promise<string>;
  deleteProject: (id: string) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  moveProject: (id: string, folderId: string | null) => Promise<void>;
  updateProjectThumbnail: (id: string, thumbnail: string | null) => void;
  openProject: (id: string) => Promise<void>;
  closeProjectTab: (id: string) => Promise<void>;
  closeProject: () => Promise<void>;
  goHome: () => Promise<void>;
  importProject: (name: string, content: any, titlePage: any, folderId: string | null) => Promise<string>;
  
  setActiveEditorView: (view: any | null) => void;
  setActiveNodeIdx: (idx: number | null) => void;
  setActiveTab: (tab: string) => void;
  setTheme: (dark: boolean) => void;
  setFocusMode: (focusMode: boolean) => void;
  setSplitScreen: (split: boolean) => void;
  setCompareScriptDoc: (doc: any | null) => void;
  setCurrentFile: (path: string | null, name: string) => void;
  setIsSaved: (saved: boolean) => void;
  setWorkspace: (path: string | null) => void;
  setRecentProjects: (projects: string[]) => void;
  setProjectLock: (user: string | null) => void;
  setScriptContent: (content: any) => void;
  setTitlePage: (data: Partial<TitlePageData>) => void;
  setWordGoal: (goal: number) => void;
  setPageGoal: (goal: number) => void;
  setCorkboardCards: (cards: CorkboardCard[]) => void;
  setCharacters: (chars: CharacterRecord[]) => void;
  addCharacter: (char: Omit<CharacterRecord, 'id' | 'screenTimePercent' | 'scenesFeatured'>) => void;
  updateCharacter: (id: string, char: Partial<CharacterRecord>) => void;
  deleteCharacter: (id: string) => void;
  setLocations: (locations: LocationRecord[]) => void;
  addLocation: (location: Omit<LocationRecord, 'id'>) => string;
  updateLocation: (id: string, location: Partial<LocationRecord>) => void;
  deleteLocation: (id: string) => void;
  setComments: (comments: CommentPin[]) => void;
  addComment: (nodeIndex: number, text: string, author: string, selectionText?: string) => void;
  deleteComment: (id: string) => void;
  setFreeflow: (nodes: FreeflowNode[], edges: FreeflowEdge[], groups: FreeflowGroup[]) => void;
  setRevisionMode: (mode: 'none' | 'blue' | 'pink' | 'yellow' | 'green') => void;
  setVersionHistory: (versionHistory: VersionCommit[]) => void;
  setActiveCompareCommit: (commit: string | null) => void;
  setShortcuts: (shortcuts: KeyboardShortcut[]) => void;
  updateShortcut: (action: string, key: string) => void;
  setAutoBackupInterval: (minutes: number) => void;
  setLockSceneNumbers: (lock: boolean) => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  dialog: {
    isOpen: boolean;
    type: 'alert' | 'confirm';
    title: string;
    message: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  };
  showAlertDialog: (title: string, message: string) => void;
  showConfirmDialog: (title: string, message: string, onConfirm: () => void) => void;
  closeDialog: () => void;
  loadProjectData: (data: Partial<AppState>) => void;
}

const defaultShortcuts: KeyboardShortcut[] = [
  { action: 'Scene Heading', key: 'Ctrl-Alt-1', description: 'Switch element to Scene Heading', category: 'Writing' },
  { action: 'Action', key: 'Ctrl-Alt-2', description: 'Switch element to Action', category: 'Writing' },
  { action: 'Character', key: 'Ctrl-Alt-3', description: 'Switch element to Character', category: 'Writing' },
  { action: 'Dialogue', key: 'Ctrl-Alt-4', description: 'Switch element to Dialogue', category: 'Writing' },
  { action: 'Parenthetical', key: 'Ctrl-Alt-5', description: 'Switch element to Parenthetical', category: 'Writing' },
  { action: 'Transition', key: 'Ctrl-Alt-6', description: 'Switch element to Transition', category: 'Writing' },
  { action: 'Shot', key: 'Ctrl-Alt-7', description: 'Switch element to Shot', category: 'Writing' },
  { action: 'Dual Dialogue', key: 'Ctrl-Alt-8', description: 'Switch element to Dual Dialogue', category: 'Writing' },
  { action: 'New Screenplay Page', key: 'Ctrl-Enter', description: 'Append and focus a new screenplay page', category: 'Writing' },
  { action: 'Open Home', key: 'Ctrl-0', description: 'Return to the project home page', category: 'Navigation' },
  { action: 'Open Editor', key: 'Ctrl-1', description: 'Open the screenplay Editor page', category: 'Navigation' },
  { action: 'Open Outline', key: 'Ctrl-2', description: 'Open the Outline page', category: 'Navigation' },
  { action: 'Open Cast', key: 'Ctrl-3', description: 'Open the Cast page', category: 'Navigation' },
  { action: 'Open Location', key: 'Ctrl-4', description: 'Open the Location page', category: 'Navigation' },
  { action: 'Open Freeflow', key: 'Ctrl-5', description: 'Open the Freeflow page', category: 'Navigation' },
  { action: 'Open History', key: 'Ctrl-6', description: 'Open screenplay History', category: 'Navigation' },
  { action: 'Open Insights', key: 'Ctrl-7', description: 'Open the Insights page', category: 'Navigation' },
  { action: 'Open Settings', key: 'Ctrl-8', description: 'Open screenplay Settings', category: 'Navigation' },
  { action: 'Toggle Sidebar', key: 'Ctrl-B', description: 'Collapse or expand the left sidebar', category: 'Panels' },
  { action: 'Toggle Comments', key: 'Ctrl-Shift-M', description: 'Open or close the Comments panel', category: 'Panels' },
  { action: 'Toggle AI Panel', key: 'Ctrl-Shift-A', description: 'Open or close the Draftill AI panel', category: 'Panels' },
  { action: 'Focus Mode', key: 'Ctrl-Shift-F', description: 'Toggle focus / distraction-free writing', category: 'Panels' },
  { action: 'Add Freeflow Scene', key: 'Ctrl-Shift-1', description: 'Create a scene node on Freeflow', category: 'Freeflow' },
  { action: 'Add Freeflow Shot', key: 'Ctrl-Shift-2', description: 'Create a shot node on Freeflow', category: 'Freeflow' },
  { action: 'Add Freeflow Character', key: 'Ctrl-Shift-3', description: 'Create a character node on Freeflow', category: 'Freeflow' },
  { action: 'Add Freeflow Note', key: 'Ctrl-Shift-4', description: 'Create a note node on Freeflow', category: 'Freeflow' },
  { action: 'Add Freeflow Media', key: 'Ctrl-Shift-5', description: 'Choose image or video nodes for Freeflow', category: 'Freeflow' },
  { action: 'Add Freeflow Link', key: 'Ctrl-Shift-6', description: 'Create a link preview node on Freeflow', category: 'Freeflow' },
  { action: 'Add Freeflow Checklist', key: 'Ctrl-Shift-7', description: 'Create a checklist node on Freeflow', category: 'Freeflow' },
];

function loadShortcuts() {
  if (typeof window === 'undefined') return defaultShortcuts;
  try {
    const saved = JSON.parse(localStorage.getItem('draftill_keyboard_shortcuts') || '[]') as Array<Partial<KeyboardShortcut>>;
    return defaultShortcuts.map((shortcut) => {
      const savedShortcut = saved.find((item) => item.action === shortcut.action);
      return typeof savedShortcut?.key === 'string' ? { ...shortcut, key: savedShortcut.key } : shortcut;
    });
  } catch {
    return defaultShortcuts;
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 'script',
  isDarkMode: true,
  focusMode: false,
  splitScreen: false,
  compareScriptDoc: null,
  currentFilePath: null,
  currentFileName: 'Untitled Script.drftl',
  isSaved: true,
  projectWorkspacePath: typeof window !== 'undefined' ? localStorage.getItem('draftill_workspace_path') : null,
  recentProjects: [],
  projectLockUser: null,
  scriptContent: null,
  titlePage: {
    title: 'UNTITLED SCREENPLAY',
    credit: 'Written by',
    author: 'Author Name',
    sourceMaterial: '',
    contactInfo: 'Contact Information\nEmail: contact@example.com',
  },
  outlineExpandedNodes: [],
  wordGoal: 0,
  pageGoal: 0,
  activeStructureTemplate: 'three-act',
  corkboardCards: [],
  characters: [],
  locations: [],
  comments: [],
  freeflowNodes: [],
  freeflowEdges: [],
  freeflowGroups: [],
  revisionMode: 'none',
  versionHistory: [],
  activeCompareCommit: null,
  shortcuts: loadShortcuts(),
  autoBackupIntervalMinutes: 5,
  lockSceneNumbers: false,
  autoSaveEnabled: typeof window !== 'undefined' ? localStorage.getItem('draftill_auto_save_enabled') !== 'false' : true,
  activeEditorView: null,
  activeNodeIdx: null,
  pageBgColor: '#ffffff',
  screenplayFontFamily: 'monospace',
  dialog: {
    isOpen: false,
    type: 'alert',
    title: '',
    message: '',
  },

  // Projects & Folders Workspace State
  activeProjectId: null,
  folders: [],
  projects: [],
  projectTabs: [],

  scanWorkspaceFiles: async () => {
    const state = get();
    const workspacePath = state.projectWorkspacePath;
    if (workspacePath && window.ipcRenderer) {
      const { folders, projects } = await window.ipcRenderer.invoke('workspace:scan', workspacePath);
      // Merge persisted thumbnails from localStorage into scanned projects
      const thumbMap: Record<string, string> = JSON.parse(localStorage.getItem('draftill_thumbnails') || '{}');
      const mergedProjects = projects.map((p: any) => ({
        ...p,
        thumbnail: thumbMap[p.id] || p.thumbnail || null
      }));
      set({ folders, projects: mergedProjects });
    }
  },

  createFolder: async (name) => {
    const state = get();
    const workspacePath = state.projectWorkspacePath;
    if (workspacePath && window.ipcRenderer) {
      await window.ipcRenderer.invoke('workspace:createFolder', workspacePath, name);
      await state.scanWorkspaceFiles();
    } else {
      const newFolder: FolderRecord = {
        id: crypto.randomUUID(),
        name,
        createdAt: Date.now()
      };
      const updatedFolders = [...state.folders, newFolder];
      localStorage.setItem('draftill_folders', JSON.stringify(updatedFolders));
      set({ folders: updatedFolders });
    }
  },

  deleteFolder: async (id) => {
    const state = get();
    const workspacePath = state.projectWorkspacePath;
    if (workspacePath && window.ipcRenderer) {
      await window.ipcRenderer.invoke('workspace:delete', workspacePath + '/' + id);
      await state.scanWorkspaceFiles();
    } else {
      const updatedFolders = state.folders.filter((f: any) => f.id !== id);
      localStorage.setItem('draftill_folders', JSON.stringify(updatedFolders));
      const updatedProjects = state.projects.map((p: any) => p.folderId === id ? { ...p, folderId: null } : p);
      localStorage.setItem('draftill_projects_meta', JSON.stringify(updatedProjects));
      set({ folders: updatedFolders, projects: updatedProjects });
    }
  },

  renameFolder: async (id, name) => {
    const state = get();
    const workspacePath = state.projectWorkspacePath;
    if (workspacePath && window.ipcRenderer) {
      const oldPath = workspacePath + '/' + id;
      const newPath = workspacePath + '/' + name;
      await window.ipcRenderer.invoke('workspace:rename', oldPath, newPath);
      await state.scanWorkspaceFiles();
    } else {
      const updatedFolders = state.folders.map((f: any) => f.id === id ? { ...f, name } : f);
      localStorage.setItem('draftill_folders', JSON.stringify(updatedFolders));
      set({ folders: updatedFolders });
    }
  },

  createProject: async (name, templateId, folderId) => {
    const state = get();
    const workspacePath = state.projectWorkspacePath;
    const id = crypto.randomUUID();
    let templateName = 'Blank Screenplay';
    let content: any = {
      type: 'doc',
      content: [
        {
          type: 'page',
          content: [
            {
              type: 'sceneHeading',
              attrs: { id: crypto.randomUUID() },
              content: [{ type: 'text', text: 'INT. NEW SCENE - DAY' }]
            },
            {
              type: 'action',
              content: [{ type: 'text', text: 'Start writing your story here...' }]
            }
          ]
        }
      ]
    };
    let titlePageData = {
      title: name.toUpperCase(),
      credit: 'Written by',
      author: 'Author Name',
      sourceMaterial: '',
      contactInfo: 'Contact Information\nEmail: contact@example.com',
    };

    if (templateId && templateId !== 'blank') {
      const template = PREBUILT_TEMPLATES.find(t => t.id === templateId);
      if (template) {
        templateName = template.name;
        const editorNodes = template.nodes.map((n: any) => ({
          type: n.type,
          attrs: {
            revision: 'none',
            id: crypto.randomUUID()
          },
          content: n.text ? [{ type: 'text', text: n.text }] : undefined
        }));
        content = {
          type: 'doc',
          content: [{
            type: 'page',
            content: editorNodes
          }]
        };
      }
    }

    const newProjectData = {
      scriptContent: content,
      titlePage: titlePageData,
      corkboardCards: [],
      characters: [],
      locations: [],
      comments: [],
      freeflowNodes: [],
      freeflowEdges: [],
      freeflowGroups: [],
      wordGoal: 0,
      pageGoal: 0,
      activeStructureTemplate: templateId === 'blank' ? 'three-act' : templateId,
      screenplayFontFamily: 'monospace',
      lockSceneNumbers: false,
      revisionMode: 'none'
    };

    if (workspacePath && window.ipcRenderer) {
      const dir = folderId ? `${workspacePath}/${folderId}` : workspacePath;
      const filePath = `${dir}/${name}.drftl`;
      await window.ipcRenderer.invoke('workspace:createProject', filePath, JSON.stringify(newProjectData));
      await state.scanWorkspaceFiles();
      return filePath;
    } else {
      localStorage.setItem(`draftill_project_content_${id}`, JSON.stringify(newProjectData));
      const newProjectMeta: ProjectRecord = {
        id,
        name,
        folderId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        templateName
      };
      const updatedProjects = [...state.projects, newProjectMeta];
      localStorage.setItem('draftill_projects_meta', JSON.stringify(updatedProjects));
      set({ projects: updatedProjects });
      return id;
    }
  },

  deleteProject: async (id) => {
    const state = get();
    const workspacePath = state.projectWorkspacePath;
    if (workspacePath && window.ipcRenderer) {
      await window.ipcRenderer.invoke('workspace:delete', id);
      await state.scanWorkspaceFiles();
      if (state.activeProjectId === id) {
        set({ activeProjectId: null });
      }
    } else {
      localStorage.removeItem(`draftill_project_content_${id}`);
      const updatedProjects = state.projects.filter((p: any) => p.id !== id);
      localStorage.setItem('draftill_projects_meta', JSON.stringify(updatedProjects));
      if (state.activeProjectId === id) {
        set({ projects: updatedProjects, activeProjectId: null });
      } else {
        set({ projects: updatedProjects });
      }
    }
  },

  renameProject: async (id, name) => {
    const state = get();
    const workspacePath = state.projectWorkspacePath;
    if (workspacePath && window.ipcRenderer) {
      const separator = id.includes('\\') ? '\\' : '/';
      const parts = id.split(separator);
      parts[parts.length - 1] = `${name}.drftl`;
      const newPath = parts.join(separator);
      
      await window.ipcRenderer.invoke('workspace:rename', id, newPath);
      if (state.activeProjectId === id) {
        set({ activeProjectId: newPath, currentFileName: name + '.drftl', titlePage: { ...state.titlePage, title: name.toUpperCase() } });
      }
      await state.scanWorkspaceFiles();
    } else {
      const updatedProjects = state.projects.map((p: any) => p.id === id ? { ...p, name, updatedAt: Date.now() } : p);
      localStorage.setItem('draftill_projects_meta', JSON.stringify(updatedProjects));
      if (state.activeProjectId === id) {
        set({ 
          projects: updatedProjects, 
          currentFileName: name + '.drftl',
          titlePage: { ...state.titlePage, title: name.toUpperCase() }
        });
      } else {
        set({ projects: updatedProjects });
      }
    }
  },

  moveProject: async (id, folderId) => {
    const state = get();
    const workspacePath = state.projectWorkspacePath;
    if (workspacePath && window.ipcRenderer) {
      const separator = id.includes('\\') ? '\\' : '/';
      const fileName = id.split(separator).pop() || '';
      const dir = folderId ? `${workspacePath}/${folderId}` : workspacePath;
      const newPath = `${dir}/${fileName}`;
      
      await window.ipcRenderer.invoke('workspace:move', id, newPath);
      if (state.activeProjectId === id) {
        set({ activeProjectId: newPath });
      }
      await state.scanWorkspaceFiles();
    } else {
      const updatedProjects = state.projects.map((p: any) => p.id === id ? { ...p, folderId, updatedAt: Date.now() } : p);
      localStorage.setItem('draftill_projects_meta', JSON.stringify(updatedProjects));
      set({ projects: updatedProjects });
    }
  },

  updateProjectThumbnail: (id: string, thumbnail: string | null) => {
    const state = get();
    // Persist in a dedicated localStorage map keyed by project id/path
    const thumbMap: Record<string, string | null> = JSON.parse(localStorage.getItem('draftill_thumbnails') || '{}');
    if (thumbnail) {
      thumbMap[id] = thumbnail;
    } else {
      delete thumbMap[id];
    }
    localStorage.setItem('draftill_thumbnails', JSON.stringify(thumbMap));
    // Also update in-memory store
    const updatedProjects = state.projects.map((p: any) => 
      p.id === id ? { ...p, thumbnail } : p
    );
    localStorage.setItem('draftill_projects_meta', JSON.stringify(updatedProjects));
    set({ projects: updatedProjects });
  },

  openProject: async (id) => {
    const state = get();
    const workspacePath = state.projectWorkspacePath;
    if (workspacePath && window.ipcRenderer) {
      const dataStr = await window.ipcRenderer.invoke('workspace:readProject', id);
      if (dataStr) {
        try {
          const data = JSON.parse(dataStr);
          const separator = id.includes('\\') ? '\\' : '/';
          const fileName = id.split(separator).pop() || '';
          const name = fileName.replace(/\.[^/.]+$/, "");
          set((current) => ({
            activeProjectId: id,
            projectTabs: current.projectTabs.some((tab) => tab.id === id) ? current.projectTabs : [...current.projectTabs, { id, name }],
            currentFileName: fileName,
            scriptContent: data.scriptContent || null,
            titlePage: data.titlePage || {
              title: name.toUpperCase(),
              credit: 'Written by',
              author: 'Author Name',
              sourceMaterial: '',
              contactInfo: 'Contact Information\nEmail: contact@example.com',
            },
            corkboardCards: data.corkboardCards || [],
            characters: data.characters || [],
            locations: data.locations || [],
            comments: data.comments || [],
            freeflowNodes: data.freeflowNodes || [],
            freeflowEdges: data.freeflowEdges || [],
            freeflowGroups: data.freeflowGroups || [],
            wordGoal: data.wordGoal || 0,
            pageGoal: data.pageGoal || 0,
            activeStructureTemplate: data.activeStructureTemplate || 'three-act',
            screenplayFontFamily: data.screenplayFontFamily || 'monospace',
            lockSceneNumbers: data.lockSceneNumbers || false,
            revisionMode: data.revisionMode || 'none',
            activeTab: 'script',
            isSaved: true
          }));
        } catch (e) {
          console.error('Failed to load project content', e);
        }
      }
    } else {
      const projectMeta = state.projects.find((p: any) => p.id === id);
      if (!projectMeta) return;
      const dataStr = localStorage.getItem(`draftill_project_content_${id}`);
      if (dataStr) {
        try {
          const data = JSON.parse(dataStr);
          set((current) => ({
            activeProjectId: id,
            projectTabs: current.projectTabs.some((tab) => tab.id === id) ? current.projectTabs : [...current.projectTabs, { id, name: projectMeta.name }],
            currentFileName: projectMeta.name + '.drftl',
            scriptContent: data.scriptContent || null,
            titlePage: data.titlePage || {
              title: projectMeta.name.toUpperCase(),
              credit: 'Written by',
              author: 'Author Name',
              sourceMaterial: '',
              contactInfo: 'Contact Information\nEmail: contact@example.com',
            },
            corkboardCards: data.corkboardCards || [],
            characters: data.characters || [],
            locations: data.locations || [],
            comments: data.comments || [],
            freeflowNodes: data.freeflowNodes || [],
            freeflowEdges: data.freeflowEdges || [],
            freeflowGroups: data.freeflowGroups || [],
            wordGoal: data.wordGoal || 0,
            pageGoal: data.pageGoal || 0,
            activeStructureTemplate: data.activeStructureTemplate || 'three-act',
            screenplayFontFamily: data.screenplayFontFamily || 'monospace',
            lockSceneNumbers: data.lockSceneNumbers || false,
            revisionMode: data.revisionMode || 'none',
            activeTab: 'script',
            isSaved: true
          }));
        } catch (e) {
          console.error('Failed to load project content', e);
        }
      }
    }
  },

  closeProject: async () => {
    const state = get();
    const workspacePath = state.projectWorkspacePath;
    if (state.activeProjectId) {
      const projectData = {
        scriptContent: state.scriptContent,
        titlePage: state.titlePage,
        corkboardCards: state.corkboardCards,
        characters: state.characters,
        locations: state.locations,
        comments: state.comments,
        freeflowNodes: state.freeflowNodes,
        freeflowEdges: state.freeflowEdges,
        freeflowGroups: state.freeflowGroups,
        wordGoal: state.wordGoal,
        pageGoal: state.pageGoal,
        activeStructureTemplate: state.activeStructureTemplate,
        screenplayFontFamily: state.screenplayFontFamily,
        lockSceneNumbers: state.lockSceneNumbers,
        revisionMode: state.revisionMode
      };

      if (workspacePath && window.ipcRenderer) {
        await window.ipcRenderer.invoke('workspace:writeProject', state.activeProjectId, JSON.stringify(projectData));
        await state.scanWorkspaceFiles();
      } else {
        localStorage.setItem(`draftill_project_content_${state.activeProjectId}`, JSON.stringify(projectData));
        const updatedProjects = state.projects.map((p: any) => p.id === state.activeProjectId ? { ...p, updatedAt: Date.now() } : p);
        localStorage.setItem('draftill_projects_meta', JSON.stringify(updatedProjects));
        set({ projects: updatedProjects });
      }
      
      set({
        activeProjectId: null,
        scriptContent: null,
        titlePage: {
          title: 'UNTITLED SCREENPLAY',
          credit: 'Written by',
          author: 'Author Name',
          sourceMaterial: '',
          contactInfo: 'Contact Information\nEmail: contact@example.com',
        },
        corkboardCards: [],
        characters: [],
        locations: [],
        comments: [],
        freeflowNodes: [],
        freeflowEdges: [],
        freeflowGroups: [],
        wordGoal: 0,
        pageGoal: 0,
        activeStructureTemplate: 'three-act',
        screenplayFontFamily: 'monospace',
        lockSceneNumbers: false,
        revisionMode: 'none',
        currentFilePath: null,
        currentFileName: 'Untitled Script.drftl',
        isSaved: true
      });
    }
  },

  closeProjectTab: async (id) => {
    const state = get();
    const tabIndex = state.projectTabs.findIndex((tab) => tab.id === id);
    if (tabIndex === -1) return;

    const remainingTabs = state.projectTabs.filter((tab) => tab.id !== id);
    if (id !== state.activeProjectId) {
      set({ projectTabs: remainingTabs });
      return;
    }

    // Save the current project before leaving it, then activate the closest open tab.
    await state.goHome();
    set({ projectTabs: remainingTabs });
    const nextTab = remainingTabs[tabIndex] || remainingTabs[tabIndex - 1];
    if (nextTab) await get().openProject(nextTab.id);
  },

  goHome: async () => {
    const state = get();
    if (!state.activeProjectId) return;
    const projectData = {
      scriptContent: state.scriptContent,
      titlePage: state.titlePage,
      corkboardCards: state.corkboardCards,
      characters: state.characters,
      locations: state.locations,
      comments: state.comments,
      freeflowNodes: state.freeflowNodes,
      freeflowEdges: state.freeflowEdges,
      freeflowGroups: state.freeflowGroups,
      wordGoal: state.wordGoal,
      pageGoal: state.pageGoal,
      activeStructureTemplate: state.activeStructureTemplate,
      screenplayFontFamily: state.screenplayFontFamily,
      lockSceneNumbers: state.lockSceneNumbers,
      revisionMode: state.revisionMode
    };
    if (state.projectWorkspacePath && window.ipcRenderer) {
      await window.ipcRenderer.invoke('workspace:writeProject', state.activeProjectId, JSON.stringify(projectData));
      await state.scanWorkspaceFiles();
    } else {
      localStorage.setItem(`draftill_project_content_${state.activeProjectId}`, JSON.stringify(projectData));
      const updatedProjects = state.projects.map((p: any) => p.id === state.activeProjectId ? { ...p, updatedAt: Date.now() } : p);
      localStorage.setItem('draftill_projects_meta', JSON.stringify(updatedProjects));
      set({ projects: updatedProjects });
    }
    set({ activeProjectId: null, activeEditorView: null });
  },

  importProject: async (name, content, titlePage, folderId) => {
    const state = get();
    const workspacePath = state.projectWorkspacePath;
    const id = crypto.randomUUID();
    const newProjectData = {
      scriptContent: content,
      titlePage: titlePage || {
        title: name.toUpperCase(),
        credit: 'Written by',
        author: 'Author Name',
        sourceMaterial: '',
        contactInfo: 'Contact Information\nEmail: contact@example.com',
      },
      corkboardCards: [],
      characters: [],
      locations: [],
      comments: [],
      freeflowNodes: [],
      freeflowEdges: [],
      freeflowGroups: [],
      wordGoal: 0,
      pageGoal: 0,
      activeStructureTemplate: 'three-act',
      screenplayFontFamily: 'monospace',
      lockSceneNumbers: false,
      revisionMode: 'none'
    };

    if (workspacePath && window.ipcRenderer) {
      const dir = folderId ? `${workspacePath}/${folderId}` : workspacePath;
      const filePath = `${dir}/${name}.drftl`;
      await window.ipcRenderer.invoke('workspace:createProject', filePath, JSON.stringify(newProjectData));
      await state.scanWorkspaceFiles();
      return filePath;
    } else {
      localStorage.setItem(`draftill_project_content_${id}`, JSON.stringify(newProjectData));
      const newProjectMeta: ProjectRecord = {
        id,
        name,
        folderId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        templateName: 'Imported Script'
      };
      const updatedProjects = [...state.projects, newProjectMeta];
      localStorage.setItem('draftill_projects_meta', JSON.stringify(updatedProjects));
      set({ projects: updatedProjects });
      return id;
    }
  },

  setActiveEditorView: (activeEditorView: any | null) => set({ activeEditorView }),
  setActiveNodeIdx: (activeNodeIdx: number | null) => set({ activeNodeIdx }),
  setPageBgColor: (pageBgColor: string) => set({ pageBgColor }),
  setScreenplayFontFamily: (screenplayFontFamily: string) => set({ screenplayFontFamily, isSaved: false }),
  setActiveTab: (activeTab: string) => set({ activeTab }),
  setTheme: () => {
    localStorage.removeItem('draftill_dark_mode');
    set({ isDarkMode: true });
  },
  setFocusMode: (focusMode: boolean) => set({ focusMode }),
  setSplitScreen: (splitScreen: boolean) => set({ splitScreen }),
  setCompareScriptDoc: (compareScriptDoc: any) => set({ compareScriptDoc }),
  setCurrentFile: (currentFilePath: string | null, currentFileName: string) => set({ currentFilePath, currentFileName, isSaved: true }),
  setIsSaved: (isSaved: boolean) => set({ isSaved }),
  setWorkspace: (projectWorkspacePath: string | null) => {
    if (projectWorkspacePath) {
      localStorage.setItem('draftill_workspace_path', projectWorkspacePath);
    } else {
      localStorage.removeItem('draftill_workspace_path');
    }
    set({ projectWorkspacePath });
    get().scanWorkspaceFiles();
  },
  setRecentProjects: (recentProjects: string[]) => set({ recentProjects }),
  setProjectLock: (projectLockUser: string | null) => set({ projectLockUser }),
  setScriptContent: (scriptContent: any) => set({ scriptContent, isSaved: false }),
  setTitlePage: (data: Partial<TitlePageData>) => set((state) => ({ titlePage: { ...state.titlePage, ...data }, isSaved: false })),
  setWordGoal: (wordGoal: number) => set({ wordGoal }),
  setPageGoal: (pageGoal: number) => set({ pageGoal }),
  setCorkboardCards: (corkboardCards: CorkboardCard[]) => set({ corkboardCards }),
  setCharacters: (characters: CharacterRecord[]) => set({ characters, isSaved: false }),
  addCharacter: (char) => set((state) => ({
    characters: [
      ...state.characters,
      {
        ...char,
        id: crypto.randomUUID(),
        screenTimePercent: 0,
        scenesFeatured: [],
      }
    ],
    isSaved: false
  })),
  updateCharacter: (id: string, char: Partial<CharacterRecord>) => set((state) => ({
    characters: state.characters.map((c) => c.id === id ? { ...c, ...char } : c),
    isSaved: false
  })),
  deleteCharacter: (id: string) => set((state) => ({
    characters: state.characters.filter((c) => c.id !== id),
    isSaved: false
  })),
  setLocations: (locations: LocationRecord[]) => set({ locations, isSaved: false }),
  addLocation: (location: Omit<LocationRecord, 'id'>) => {
    const id = crypto.randomUUID();
    set((state) => ({ locations: [...state.locations, { ...location, id }], isSaved: false }));
    return id;
  },
  updateLocation: (id: string, location: Partial<LocationRecord>) => set((state) => ({
    locations: state.locations.map((item) => item.id === id ? { ...item, ...location } : item),
    isSaved: false
  })),
  deleteLocation: (id: string) => set((state) => ({ locations: state.locations.filter((item) => item.id !== id), isSaved: false })),
  setComments: (comments: CommentPin[]) => set({ comments }),
  addComment: (nodeIndex: number, text: string, author: string, selectionText?: string) => set((state) => ({
    comments: [
      ...state.comments,
      {
        id: crypto.randomUUID(),
        nodeIndex,
        selectionText,
        text,
        author,
        timestamp: Date.now(),
      }
    ],
    isSaved: false
  })),
  deleteComment: (id: string) => set((state) => ({
    comments: state.comments.filter((c) => c.id !== id),
    isSaved: false
  })),
  setFreeflow: (freeflowNodes, freeflowEdges, freeflowGroups) => set({ freeflowNodes, freeflowEdges, freeflowGroups, isSaved: false }),
  setRevisionMode: (revisionMode: 'none' | 'blue' | 'pink' | 'yellow' | 'green') => set({ revisionMode }),
  setVersionHistory: (versionHistory: VersionCommit[]) => set({ versionHistory }),
  setActiveCompareCommit: (activeCompareCommit: string | null) => set({ activeCompareCommit }),
  setShortcuts: (shortcuts: KeyboardShortcut[]) => {
    localStorage.setItem('draftill_keyboard_shortcuts', JSON.stringify(shortcuts));
    set({ shortcuts });
  },
  updateShortcut: (action: string, key: string) => set((state) => {
    const shortcuts = state.shortcuts.map((shortcut) => shortcut.action === action ? { ...shortcut, key } : shortcut);
    localStorage.setItem('draftill_keyboard_shortcuts', JSON.stringify(shortcuts));
    return { shortcuts };
  }),
  setAutoBackupInterval: (autoBackupIntervalMinutes: number) => set({ autoBackupIntervalMinutes }),
  setLockSceneNumbers: (lockSceneNumbers: boolean) => set({ lockSceneNumbers }),
  setAutoSaveEnabled: (autoSaveEnabled: boolean) => {
    localStorage.setItem('draftill_auto_save_enabled', String(autoSaveEnabled));
    set({ autoSaveEnabled });
  },
  showAlertDialog: (title: string, message: string) => set({
    dialog: {
      isOpen: true,
      type: 'alert',
      title,
      message,
      onConfirm: () => {}
    }
  }),
  showConfirmDialog: (title: string, message: string, onConfirm: () => void) => set({
    dialog: {
      isOpen: true,
      type: 'confirm',
      title,
      message,
      onConfirm
    }
  }),
  closeDialog: () => set((state) => ({
    dialog: {
      ...state.dialog,
      isOpen: false
    }
  })),
  loadProjectData: (data: Partial<AppState>) => set((state) => ({
    ...state,
    ...data,
    isDarkMode: true,
    isSaved: true
  }))
}));

// Initialize default workspace if not set in local storage
if (typeof window !== 'undefined' && window.ipcRenderer) {
  const savedPath = localStorage.getItem('draftill_workspace_path');
  if (!savedPath) {
    window.ipcRenderer.invoke('workspace:getDefault').then((defaultPath) => {
      if (defaultPath) {
        useAppStore.getState().setWorkspace(defaultPath);
      }
    });
  }
}
