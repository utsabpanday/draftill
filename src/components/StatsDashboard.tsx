import { BarChart, Compass, MessageSquare, Map, Clock, FileText } from 'lucide-react';
import { useAppStore } from '../store/store';
import { generateCharacterReport, generateLocationReport } from '../utils/importersExporters';

export default function StatsDashboard() {
  const { scriptContent } = useAppStore();

  // Parse screenplay nodes for breakdown
  const rawNodes = (scriptContent?.content || []).map((node: any) => ({
    type: node.type,
    text: node.content?.[0]?.text || ''
  }));

  const totalParagraphs = rawNodes.length;
  
  // Counts
  let wordCount = 0;
  let sceneCount = 0;
  let dialogueCount = 0;
  let actionCount = 0;
  let dialogueWords = 0;
  let actionWords = 0;

  rawNodes.forEach((n: any) => {
    const words = n.text.split(/\s+/).filter(Boolean).length;
    wordCount += words;
    if (n.type === 'sceneHeading') sceneCount++;
    else if (n.type === 'dialogue') {
      dialogueCount++;
      dialogueWords += words;
    } else if (n.type === 'action') {
      actionCount++;
      actionWords += words;
    }
  });

  // Estimates
  const estimatedPages = Math.max(1, Math.round(totalParagraphs / 18));
  const estimatedRuntimeMinutes = estimatedPages; // 1 min per page

  // Ratios
  const totalRatioWords = dialogueWords + actionWords;
  const dialoguePercent = totalRatioWords > 0 ? Math.round((dialogueWords / totalRatioWords) * 100) : 50;
  const actionPercent = 100 - dialoguePercent;

  // Character breakdown and locations
  const characterBreakdowns = generateCharacterReport(rawNodes);
  const locationBreakdowns = generateLocationReport(rawNodes);

  // Group locations into INT vs EXT
  let intCount = 0;
  let extCount = 0;
  locationBreakdowns.forEach((loc) => {
    if (loc.type === 'INT') intCount += loc.sceneCount;
    else if (loc.type === 'EXT') extCount += loc.sceneCount;
  });

  return (
    <div className="w-full max-w-5xl mx-auto p-6 font-inter text-[#e8e8e6] overflow-y-auto max-h-[85vh]">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white tracking-tight">Script Analytics</h2>
        <p className="text-gray-400 text-xs mt-1">Real-time breakdown and runtime diagnostics of your screenplay.</p>
      </div>

      {/* Grid numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#1e1e1e] p-4 rounded-xl border border-[#333] flex items-center gap-3">
          <FileText size={24} className="text-[#F4C430]" />
          <div>
            <span className="text-[10px] text-gray-500 font-bold uppercase block">Est. Pages</span>
            <span className="text-xl font-bold text-white">{estimatedPages} pages</span>
          </div>
        </div>
        <div className="bg-[#1e1e1e] p-4 rounded-xl border border-[#333] flex items-center gap-3">
          <Clock size={24} className="text-[#F4C430]" />
          <div>
            <span className="text-[10px] text-gray-500 font-bold uppercase block">Est. Runtime</span>
            <span className="text-xl font-bold text-white">{estimatedRuntimeMinutes} min</span>
          </div>
        </div>
        <div className="bg-[#1e1e1e] p-4 rounded-xl border border-[#333] flex items-center gap-3">
          <Compass size={24} className="text-[#F4C430]" />
          <div>
            <span className="text-[10px] text-gray-500 font-bold uppercase block">Total Scenes</span>
            <span className="text-xl font-bold text-white">{sceneCount}</span>
          </div>
        </div>
        <div className="bg-[#1e1e1e] p-4 rounded-xl border border-[#333] flex items-center gap-3">
          <MessageSquare size={24} className="text-[#F4C430]" />
          <div>
            <span className="text-[10px] text-gray-500 font-bold uppercase block">Total Words</span>
            <span className="text-xl font-bold text-white">{wordCount}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Dialogue vs Action */}
        <div className="bg-[#1e1e1e] p-6 rounded-xl border border-[#333]">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <BarChart size={16} className="text-[#F4C430]" /> Dialogue vs Action Ratio
          </h3>
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Dialogue ({dialoguePercent}%)</span>
            <span>Action ({actionPercent}%)</span>
          </div>
          <div className="w-full h-4 bg-[#333] rounded-full overflow-hidden flex">
            <div className="bg-[#F4C430] h-full" style={{ width: `${dialoguePercent}%` }} />
            <div className="bg-amber-800 h-full" style={{ width: `${actionPercent}%` }} />
          </div>
          <div className="flex gap-4 mt-4 text-[11px] text-gray-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F4C430]" />
              <span>{dialogueWords} dialogue words</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-800" />
              <span>{actionWords} action words</span>
            </div>
          </div>
        </div>

        {/* INT vs EXT */}
        <div className="bg-[#1e1e1e] p-6 rounded-xl border border-[#333]">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <Map size={16} className="text-[#F4C430]" /> INT. vs EXT. Location Ratio
          </h3>
          {sceneCount === 0 ? (
            <p className="text-xs text-gray-500">No scenes in script yet.</p>
          ) : (
            <>
              <div className="flex justify-between text-xs text-gray-400 mb-2">
                <span>INT. ({Math.round((intCount / sceneCount) * 100) || 0}%)</span>
                <span>EXT. ({Math.round((extCount / sceneCount) * 100) || 0}%)</span>
              </div>
              <div className="w-full h-4 bg-[#333] rounded-full overflow-hidden flex">
                <div className="bg-amber-500 h-full" style={{ width: `${Math.round((intCount / sceneCount) * 100) || 0}%` }} />
                <div className="bg-amber-900 h-full" style={{ width: `${Math.round((extCount / sceneCount) * 100) || 0}%` }} />
              </div>
            </>
          )}
          <div className="flex gap-4 mt-4 text-[11px] text-gray-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>{intCount} interior scenes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-900" />
              <span>{extCount} exterior scenes</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Character Speaking Breakdown */}
        <div className="bg-[#1e1e1e] p-6 rounded-xl border border-[#333]">
          <h4 className="text-sm font-bold text-white uppercase mb-3 tracking-wider">Top Speaking Characters</h4>
          {characterBreakdowns.length === 0 ? (
            <p className="text-xs text-gray-500">No dialogues parsed yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {characterBreakdowns.slice(0, 5).map((char) => (
                <div key={char.name} className="text-xs">
                  <div className="flex justify-between mb-1">
                    <span className="font-bold text-gray-300 uppercase">{char.name}</span>
                    <span className="text-gray-400">{char.totalLinesSpoken} lines ({char.totalWordsSpoken} words)</span>
                  </div>
                  <div className="w-full h-1 bg-[#333] rounded overflow-hidden">
                    <div 
                      className="bg-[#F4C430] h-full" 
                      style={{ width: `${Math.min(100, (char.totalLinesSpoken / Math.max(1, dialogueCount)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scene List & Locations */}
        <div className="bg-[#1e1e1e] p-6 rounded-xl border border-[#333]">
          <h4 className="text-sm font-bold text-white uppercase mb-3 tracking-wider">Frequent Locations</h4>
          {locationBreakdowns.length === 0 ? (
            <p className="text-xs text-gray-500">No scene locations logged yet.</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
              {locationBreakdowns.slice(0, 5).map((loc) => (
                <div key={loc.name} className="flex justify-between items-center text-xs border-b border-[#333] pb-1.5">
                  <span className="uppercase text-gray-300 font-medium">{loc.name}</span>
                  <span className="bg-amber-500/10 text-[#F4C430] px-2 py-0.5 rounded font-bold">{loc.sceneCount} scenes</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
