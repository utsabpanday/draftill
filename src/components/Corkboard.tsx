import { useState, useEffect } from 'react';
import { useAppStore } from '../store/store';
import { Grid, Edit2, ChevronLeft, ChevronRight, Bookmark } from 'lucide-react';
import Timeline from './Timeline';

interface SceneGroup {
  id: string;
  heading: string;
  synopsis: string;
  color: string;
  nodes: any[];
}

export default function Corkboard({ onReorder }: { onReorder?: (newDocContent: any[]) => void }) {
  const { scriptContent, setScriptContent } = useAppStore();
  const [scenes, setScenes] = useState<SceneGroup[]>([]);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editSynopsis, setEditSynopsis] = useState('');
  const [editColor, setEditColor] = useState('#F4C430');

  // Colors list for tagging
  const tagColors = ['#F4C430', '#3b82f6', '#ec4899', '#10b981', '#8b5cf6', '#ef4444'];

  // Parse document JSON into scenes
  useEffect(() => {
    if (!scriptContent || !scriptContent.content) return;

    const parsedScenes: SceneGroup[] = [];
    let currentScene: SceneGroup | null = null;

    scriptContent.content.forEach((node: any, idx: number) => {
      if (node.type === 'sceneHeading') {
        if (currentScene) {
          parsedScenes.push(currentScene);
        }
        const headingText = node.content?.[0]?.text || 'UNTITLED SCENE';
        // Check if there is an action node immediately following to act as synopsis
        currentScene = {
          id: node.attrs?.id || `scene-${idx}`,
          heading: headingText,
          synopsis: node.attrs?.synopsis || 'Enter scene synopsis here...',
          color: node.attrs?.color || '#F4C430',
          nodes: [node]
        };
      } else {
        if (currentScene) {
          currentScene.nodes.push(node);
        } else {
          // pre-scene headings nodes
          currentScene = {
            id: 'pre-scene',
            heading: 'START',
            synopsis: '',
            color: '#333',
            nodes: [node]
          };
        }
      }
    });

    if (currentScene) {
      parsedScenes.push(currentScene);
    }

    setScenes(parsedScenes);
  }, [scriptContent]);

  // Reorder action: shift scene index
  const moveScene = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === scenes.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newScenes = [...scenes];
    
    // Swap
    const temp = newScenes[index];
    newScenes[index] = newScenes[targetIndex];
    newScenes[targetIndex] = temp;

    setScenes(newScenes);

    // Rebuild ProseMirror content
    const reorderedContent: any[] = [];
    newScenes.forEach((s) => {
      // make sure heading node has updated metadata
      const headingNode = { ...s.nodes[0] };
      if (!headingNode.attrs) headingNode.attrs = {};
      headingNode.attrs.color = s.color;
      headingNode.attrs.synopsis = s.synopsis;
      
      reorderedContent.push(headingNode);
      reorderedContent.push(...s.nodes.slice(1));
    });

    // Update global script contents
    const newDoc = {
      ...scriptContent,
      content: reorderedContent
    };
    
    setScriptContent(newDoc);
    if (onReorder) onReorder(reorderedContent);
  };

  const saveSceneMeta = (id: string) => {
    const updated = scenes.map((s) => {
      if (s.id === id) {
        s.synopsis = editSynopsis;
        s.color = editColor;
      }
      return s;
    });
    setScenes(updated);
    setEditingSceneId(null);

    // Re-sync with doc
    const reorderedContent: any[] = [];
    updated.forEach((s) => {
      const headingNode = { ...s.nodes[0] };
      if (!headingNode.attrs) headingNode.attrs = {};
      headingNode.attrs.color = s.color;
      headingNode.attrs.synopsis = s.synopsis;

      reorderedContent.push(headingNode);
      reorderedContent.push(...s.nodes.slice(1));
    });
    setScriptContent({ ...scriptContent, content: reorderedContent });
    if (onReorder) onReorder(reorderedContent);
  };

  const startEdit = (scene: SceneGroup) => {
    setEditingSceneId(scene.id);
    setEditSynopsis(scene.synopsis);
    setEditColor(scene.color);
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-6 font-inter text-[#e8e8e6] overflow-y-auto max-h-[85vh]">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Grid size={22} className="text-[#F4C430]" /> Corkboard Index Cards
          </h2>
          <p className="text-gray-400 text-xs mt-1">Reorder scene sequences and manage narrative beats with drag-like visual cards.</p>
        </div>
      </div>
      
      <Timeline onSelectScene={(id) => {
        const el = document.getElementById('card-' + id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {scenes.map((scene, idx) => {
          const isEditing = editingSceneId === scene.id;

          return (
            <div 
              key={scene.id} 
              id={'card-' + scene.id}
              className="bg-[#1e1e1e] rounded-xl border border-[#333] overflow-hidden flex flex-col justify-between shadow-lg relative min-h-[200px]"
              style={{ borderTop: `4px solid ${scene.color}` }}
            >
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <span className="text-[10px] bg-[#333] px-2 py-0.5 rounded text-[#F4C430] font-bold">
                      SCENE {idx + 1}
                    </span>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => moveScene(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 hover:bg-[#2a2a2a] rounded text-gray-400 disabled:opacity-20 transition-colors"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button 
                        onClick={() => moveScene(idx, 'down')}
                        disabled={idx === scenes.length - 1}
                        className="p-1 hover:bg-[#2a2a2a] rounded text-gray-400 disabled:opacity-20 transition-colors"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-courier font-bold uppercase text-white text-sm tracking-wide line-clamp-2 mb-2">
                    {scene.heading}
                  </h3>

                  {isEditing ? (
                    <textarea 
                      rows={3}
                      value={editSynopsis}
                      onChange={(e) => setEditSynopsis(e.target.value)}
                      className="w-full bg-[#2a2a2a] border border-[#333] rounded p-2 text-xs text-white focus:outline-none focus:border-[#F4C430] resize-none"
                    />
                  ) : (
                    <p className="text-gray-400 text-xs italic leading-relaxed line-clamp-4">
                      {scene.synopsis}
                    </p>
                  )}
                </div>

                {isEditing && (
                  <div className="mt-4">
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Color Tag</label>
                    <div className="flex gap-2">
                      {tagColors.map((color) => (
                        <button
                          key={color}
                          onClick={() => setEditColor(color)}
                          className="w-5 h-5 rounded-full border transition-all"
                          style={{
                            backgroundColor: color,
                            borderColor: editColor === color ? '#white' : 'transparent',
                            transform: editColor === color ? 'scale(1.2)' : 'none'
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="bg-[#1a1a1a] px-4 py-2 border-t border-[#333] flex justify-between items-center">
                <span className="text-[10px] text-gray-500 font-bold flex items-center gap-1">
                  <Bookmark size={10} style={{ color: scene.color }} />
                  {scene.color === '#F4C430' ? 'Plot A' : scene.color === '#3b82f6' ? 'Plot B' : 'Subplot'}
                </span>
                <div>
                  {isEditing ? (
                    <button 
                      onClick={() => saveSceneMeta(scene.id)}
                      className="text-xs font-bold text-[#F4C430] hover:text-[#d4a822] transition-colors"
                    >
                      Save Card
                    </button>
                  ) : (
                    <button 
                      onClick={() => startEdit(scene)}
                      className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      <Edit2 size={12} /> Edit Cards
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
