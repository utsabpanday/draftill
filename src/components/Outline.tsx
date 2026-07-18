import { useState, useEffect } from 'react';
import { useAppStore } from '../store/store';
import { FolderOpen, MapPin, Eye, FileText, Search } from 'lucide-react';
import Timeline from './Timeline';

interface SceneOutlineNode {
  id: string;
  index: string;
  text: string;
  act: string;
  sequence: string;
  charCount: number;
}

export default function Outline({ onJumpToScene }: { onJumpToScene?: (nodeId: string) => void }) {
  const { scriptContent, lockSceneNumbers } = useAppStore();
  const [nodes, setNodes] = useState<SceneOutlineNode[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!scriptContent || !scriptContent.content) return;

    const outlineList: SceneOutlineNode[] = [];
    let currentAct = 'Act I: Setup';
    let currentSeq = 'Sequence 1: Ordinary World';
    let lastSceneNum = 0;
    let letterIndex = 65; // 'A'

    scriptContent.content.forEach((node: any, idx: number) => {
      // Look for custom act/sequence tags or standard formatting
      if (node.type === 'action') {
        const text = node.content?.[0]?.text || '';
        if (text.toUpperCase().includes('ACT I:')) currentAct = text;
        else if (text.toUpperCase().includes('ACT II:')) currentAct = text;
        else if (text.toUpperCase().includes('ACT III:')) currentAct = text;
        else if (text.toUpperCase().includes('SEQUENCE:')) currentSeq = text;
      }

      if (node.type === 'sceneHeading') {
        let displayNum = '';
        if (lockSceneNumbers && node.attrs?.sceneNumber) {
          displayNum = node.attrs.sceneNumber;
          const parsed = parseInt(displayNum);
          if (!isNaN(parsed)) {
            lastSceneNum = parsed;
            letterIndex = 65;
          }
        } else if (lockSceneNumbers) {
          displayNum = `${lastSceneNum}${String.fromCharCode(letterIndex)}`;
          letterIndex++;
        } else {
          lastSceneNum++;
          displayNum = String(lastSceneNum);
          letterIndex = 65;
        }

        const text = node.content?.[0]?.text || 'UNTITLED SCENE';
        
        // Count characters in this scene
        let charCount = 0;
        let runningIdx = idx + 1;
        while (runningIdx < scriptContent.content.length && scriptContent.content[runningIdx].type !== 'sceneHeading') {
          if (scriptContent.content[runningIdx].type === 'character') {
            charCount++;
          }
          runningIdx++;
        }

        outlineList.push({
          id: node.attrs?.id || `scene-${idx}`,
          index: displayNum,
          text,
          act: currentAct,
          sequence: currentSeq,
          charCount
        });
      }
    });

    setNodes(outlineList);
  }, [scriptContent, lockSceneNumbers]);

  // Group nodes by Act
  const filteredNodes = nodes.filter((n) => n.text.toLowerCase().includes(search.toLowerCase()));
  const acts = Array.from(new Set(filteredNodes.map((n) => n.act)));

  return (
    <div className="w-full max-w-2xl mx-auto p-6 font-inter text-[#e8e8e6]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FolderOpen size={22} className="text-[#F4C430]" /> Outline Tree
          </h2>
          <p className="text-gray-400 text-xs mt-1">Nested structural hierarchy (Act &gt; Sequence &gt; Scene) mapped to scene headings.</p>
        </div>
      </div>
      
      <Timeline onSelectScene={onJumpToScene} />

      <div className="relative mb-6">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-500">
          <Search size={16} />
        </span>
        <input 
          type="text" 
          placeholder="Filter scenes by heading..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#1e1e1e] border border-[#333] rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#F4C430]"
        />
      </div>

      <div className="flex flex-col gap-6">
        {acts.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            No matching scenes found in current script outline.
          </div>
        ) : (
          acts.map((act) => {
            const actScenes = filteredNodes.filter((n) => n.act === act);
            return (
              <div key={act} className="bg-[#1e1e1e] rounded-xl border border-[#333] overflow-hidden">
                {/* Act Header */}
                <div className="bg-[#1a1a1a] px-4 py-3 border-b border-[#333] flex items-center gap-2">
                  <FileText size={16} className="text-[#F4C430]" />
                  <span className="font-bold text-xs uppercase tracking-wider text-white">{act}</span>
                </div>

                {/* Scene list */}
                <div className="divide-y divide-[#333]">
                  {actScenes.map((scene) => (
                    <div 
                      key={scene.id}
                      onClick={() => onJumpToScene && onJumpToScene(scene.id)}
                      className="px-6 py-3 flex justify-between items-center hover:bg-[#252525] cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-gray-500 font-bold w-12">
                          SCENE {scene.index}
                        </span>
                        <div className="flex items-center gap-1.5 uppercase font-courier text-sm text-[#e8e8e6] font-semibold">
                          <MapPin size={12} className="text-[#F4C430]/70" />
                          {scene.text}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {scene.charCount > 0 && (
                          <span className="text-[10px] bg-[#2a2a2a] text-[#F4C430] px-2 py-0.5 rounded-full font-bold">
                            {scene.charCount} CAST
                          </span>
                        )}
                        <button className="text-xs text-gray-500 hover:text-[#F4C430] flex items-center gap-1 transition-colors">
                          <Eye size={12} /> Jump
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
