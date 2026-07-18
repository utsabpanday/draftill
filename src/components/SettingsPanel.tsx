import { useAppStore } from '../store/store';
import { Settings, CheckCircle, Upload } from 'lucide-react';

export default function SettingsPanel() {
  const { 
    activeProjectId,
    projects,
    updateProjectThumbnail,
    wordGoal, setWordGoal,
    pageGoal, setPageGoal,
    lockSceneNumbers, setLockSceneNumbers
  } = useAppStore();

  const currentProject = projects.find(p => p.id === activeProjectId);

  return (
    <div className="w-full max-w-3xl mx-auto p-6 font-inter text-[#e8e8e6] overflow-y-auto max-h-[85vh]">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Settings size={22} className="text-[#F4C430]" /> Script Settings
        </h2>
        <p className="text-gray-400 text-xs mt-1">Configure target word counts, page count limits, and scene numbering locks for this screenplay.</p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Screenplay Thumbnail Section */}
        <div className="bg-[#1e1e1e] p-6 rounded-xl border border-[#333] flex flex-col gap-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <CheckCircle size={16} className="text-[#F4C430]" /> Screenplay Cover / Thumbnail
          </h3>
          <div className="flex items-center gap-6">
            <div className="w-24 h-28 rounded-lg border border-[#333] bg-[#1a1a1a] flex items-center justify-center overflow-hidden shrink-0">
              {currentProject?.thumbnail ? (
                <img src={currentProject.thumbnail} className="w-full h-full object-cover" alt="Thumbnail Preview" />
              ) : (
                <span className="text-[10px] text-gray-500 font-bold uppercase">No Thumbnail</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs text-gray-300">Set a custom cover thumbnail image for this screenplay to show on your dashboard grid.</span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e: any) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (readerEvent) => {
                        const base64 = readerEvent.target?.result as string;
                        if (activeProjectId) {
                          updateProjectThumbnail(activeProjectId, base64);
                        }
                      };
                      reader.readAsDataURL(file);
                    };
                    input.click();
                  }}
                  className="bg-[#F4C430] hover:bg-[#d8ae27] text-black px-4 py-1.5 rounded-xl font-extrabold text-xs cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  <Upload size={12} /> Upload Image
                </button>
                {currentProject?.thumbnail && (
                  <button
                    onClick={() => activeProjectId && updateProjectThumbnail(activeProjectId, null)}
                    className="border border-[#333] text-gray-400 hover:text-white hover:bg-white/5 px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer transition-all"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Environment Goals */}
        <div className="bg-[#1e1e1e] p-6 rounded-xl border border-[#333] flex flex-col gap-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <CheckCircle size={16} className="text-[#F4C430]" /> Project Writing Goals
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-2">
            <div>
              <label className="text-xs font-semibold text-gray-400 block mb-1">Target Word Count</label>
              <input 
                type="number" 
                value={wordGoal || ''}
                onChange={(e) => setWordGoal(Number(e.target.value))}
                placeholder="e.g. 90000"
                className="w-full bg-[#2a2a2a] border border-[#333] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#F4C430]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 block mb-1">Target Page Count</label>
              <input 
                type="number" 
                value={pageGoal || ''}
                onChange={(e) => setPageGoal(Number(e.target.value))}
                placeholder="e.g. 110"
                className="w-full bg-[#2a2a2a] border border-[#333] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#F4C430]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-lg border border-[#333] mt-2">
            <div>
              <span className="text-xs font-bold text-white block">Production Scene Lock</span>
              <span className="text-[9px] text-gray-400 block">Lock scene numbers. New scene headings get auto A/B lettering (e.g. 12A).</span>
            </div>
            <button
              onClick={() => setLockSceneNumbers(!lockSceneNumbers)}
              className={`relative w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer shrink-0 ${
                lockSceneNumbers ? 'bg-[#F4C430]' : 'bg-[#333]'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200 ${
                lockSceneNumbers ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
