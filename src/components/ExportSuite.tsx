import { useState } from 'react';
import { useAppStore } from '../store/store';
import { 
  Download, Layers, Shield, FileSpreadsheet, Map
} from 'lucide-react';
import { 
  serializeFountain, 
  serializeFDX, 
  exportToPlainText, 
  exportToDOCX, 
  exportToEPUB,
  generateTableRead,
  generateCharacterReport,
  generateLocationReport,
  generatePropsReport,
  generateStripboard
} from '../utils/importersExporters';

export default function ExportSuite() {
  const { scriptContent, titlePage, currentFileName, showAlertDialog } = useAppStore();
  const [watermark, setWatermark] = useState('');
  const [selectedFormats, setSelectedFormats] = useState({
    fountain: true,
    fdx: false,
    text: false,
    docx: false,
    epub: false
  });

  const rawNodes = (scriptContent?.content || []).map((node: any) => ({
    type: node.type,
    text: node.content?.[0]?.text || ''
  }));

  // Toggle checklist format
  const toggleFormat = (key: keyof typeof selectedFormats) => {
    setSelectedFormats((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Perform single export
  const exportFormat = async (format: string) => {
    let content = '';
    let ext = '';

    if (format === 'fountain') {
      content = serializeFountain(rawNodes, titlePage);
      ext = '.fountain';
    } else if (format === 'fdx') {
      content = serializeFDX(rawNodes, titlePage);
      ext = '.fdx';
    } else if (format === 'text') {
      content = exportToPlainText(rawNodes, titlePage);
      ext = '.txt';
    } else if (format === 'docx') {
      content = exportToDOCX(rawNodes, titlePage);
      ext = '.doc'; // MS Word compatible HTML
    } else if (format === 'epub') {
      content = exportToEPUB(rawNodes, titlePage);
      ext = '.epub'; // XHTML markup
    }

    const defaultSaveName = currentFileName.replace(/\.[^/.]+$/, "") + ext;

    if (window.ipcRenderer) {
      const res = await window.ipcRenderer.invoke('file:saveAs', content, defaultSaveName);
      if (res) {
        showAlertDialog('Export Successful', `Successfully exported to ${res.name}`);
      }
    } else {
      // Browser fallback download
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultSaveName;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Export specific reports
  const exportReport = async (reportType: string) => {
    let content = '';
    let ext = '.txt';

    if (reportType === 'table-read') {
      content = generateTableRead(rawNodes);
      ext = '_table_read.txt';
    } else if (reportType === 'character') {
      const reps = generateCharacterReport(rawNodes);
      content = 'Character,Speaking Scenes,Lines Spoken,Words Spoken\n' + 
        reps.map((c) => `"${c.name}",${c.speakingScenesCount},${c.totalLinesSpoken},${c.totalWordsSpoken}`).join('\n');
      ext = '_character_breakdown.csv';
    } else if (reportType === 'location') {
      const reps = generateLocationReport(rawNodes);
      content = 'Location,Type,Time of Day,Scene Count\n' + 
        reps.map((l) => `"${l.name}",${l.type},${l.timeOfDay},${l.sceneCount}`).join('\n');
      ext = '_location_report.csv';
    } else if (reportType === 'props') {
      const reps = generatePropsReport(rawNodes);
      content = 'PROPS & WARDROBE LOG\n====================\n\n' + reps.join('\n');
      ext = '_props_log.txt';
    } else if (reportType === 'stripboard') {
      const reps = generateStripboard(rawNodes);
      content = 'Scene,Heading,INT/EXT,Day/Night,Est. Pages,Characters\n' + 
        reps.map((r) => `${r.sceneNum},"${r.heading}",${r.intExt},${r.dayNight},${r.pagesEstimate},"${r.characters.join(', ')}"`).join('\n');
      ext = '_shooting_schedule.csv';
    }

    const defaultSaveName = currentFileName.replace(/\.[^/.]+$/, "") + ext;

    if (window.ipcRenderer) {
      await window.ipcRenderer.invoke('file:saveAs', content, defaultSaveName);
    } else {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultSaveName;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Batch export action
  const handleBatchExport = async () => {
    const formats = Object.keys(selectedFormats).filter((k) => selectedFormats[k as keyof typeof selectedFormats]);
    if (formats.length === 0) {
      showAlertDialog('Selection Required', 'Please select at least one format for batch export.');
      return;
    }
    
    for (const f of formats) {
      await exportFormat(f);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-6 font-inter text-[#e8e8e6]">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white tracking-tight">Advanced Export Suite</h2>
        <p className="text-gray-400 text-xs mt-1">Export high-fidelity, industry-standard screenplays and comprehensive production reports.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Formats & Batch */}
        <div className="bg-[#1e1e1e] p-6 rounded-xl border border-[#333] flex flex-col gap-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
            <Layers size={16} className="text-[#F4C430]" /> Standard Exporters
          </h3>
          
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-lg border border-[#333]">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={selectedFormats.fountain}
                  onChange={() => toggleFormat('fountain')}
                  className="rounded text-[#F4C430] bg-[#2a2a2a]"
                />
                <span className="text-sm font-medium text-white">Fountain (.fountain)</span>
              </div>
              <button 
                onClick={() => exportFormat('fountain')}
                className="text-xs bg-[#F4C430] text-[#101113] font-bold px-3 py-1 rounded hover:bg-[#d4a822]"
              >
                Export
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-lg border border-[#333]">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={selectedFormats.fdx}
                  onChange={() => toggleFormat('fdx')}
                  className="rounded text-[#F4C430] bg-[#2a2a2a]"
                />
                <span className="text-sm font-medium text-white">Final Draft (.fdx)</span>
              </div>
              <button 
                onClick={() => exportFormat('fdx')}
                className="text-xs bg-[#F4C430] text-[#101113] font-bold px-3 py-1 rounded hover:bg-[#d4a822]"
              >
                Export
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-lg border border-[#333]">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={selectedFormats.text}
                  onChange={() => toggleFormat('text')}
                  className="rounded text-[#F4C430] bg-[#2a2a2a]"
                />
                <span className="text-sm font-medium text-white">Plain Text (.txt)</span>
              </div>
              <button 
                onClick={() => exportFormat('text')}
                className="text-xs bg-[#F4C430] text-[#101113] font-bold px-3 py-1 rounded hover:bg-[#d4a822]"
              >
                Export
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-lg border border-[#333]">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={selectedFormats.docx}
                  onChange={() => toggleFormat('docx')}
                  className="rounded text-[#F4C430] bg-[#2a2a2a]"
                />
                <span className="text-sm font-medium text-white">MS Word (.docx/.doc)</span>
              </div>
              <button 
                onClick={() => exportFormat('docx')}
                className="text-xs bg-[#F4C430] text-[#101113] font-bold px-3 py-1 rounded hover:bg-[#d4a822]"
              >
                Export
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-lg border border-[#333]">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={selectedFormats.epub}
                  onChange={() => toggleFormat('epub')}
                  className="rounded text-[#F4C430] bg-[#2a2a2a]"
                />
                <span className="text-sm font-medium text-white">EPUB (.epub)</span>
              </div>
              <button 
                onClick={() => exportFormat('epub')}
                className="text-xs bg-[#F4C430] text-[#101113] font-bold px-3 py-1 rounded hover:bg-[#d4a822]"
              >
                Export
              </button>
            </div>
          </div>

          <button 
            onClick={handleBatchExport}
            className="w-full mt-4 bg-transparent border border-[#F4C430] text-[#F4C430] font-bold py-2 rounded text-sm hover:bg-[#F4C430]/10 flex items-center justify-center gap-2 transition-colors"
          >
            <Download size={16} /> Batch Export Selected Formats
          </button>
        </div>

        {/* Right Column: Custom PDF Watermark & Production Reports */}
        <div className="bg-[#1e1e1e] p-6 rounded-xl border border-[#333] flex flex-col gap-5">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <Shield size={16} className="text-[#F4C430]" /> Print Security / Watermarking
            </h3>
            <input 
              type="text" 
              placeholder="e.g. CONFIDENTIAL COPY - DO NOT DISTRIBUTE" 
              value={watermark}
              onChange={(e) => setWatermark(e.target.value)}
              className="w-full bg-[#2a2a2a] border border-[#333] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#F4C430]"
            />
            <p className="text-[10px] text-gray-500 mt-1">Watermark overlays dynamically when printing script copies to PDF.</p>
          </div>

          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileSpreadsheet size={16} className="text-[#F4C430]" /> Production Reports & Sides
            </h3>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button 
                onClick={() => exportReport('table-read')}
                className="bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#333] p-3 rounded-lg text-left flex flex-col gap-1 transition-colors"
              >
                <span className="font-bold text-white">Table Read Script</span>
                <span className="text-[10px] text-gray-500">Dialogue-only format</span>
              </button>
              <button 
                onClick={() => exportReport('character')}
                className="bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#333] p-3 rounded-lg text-left flex flex-col gap-1 transition-colors"
              >
                <span className="font-bold text-white">Character Report</span>
                <span className="text-[10px] text-gray-500">CSV speaking breakdown</span>
              </button>
              <button 
                onClick={() => exportReport('location')}
                className="bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#333] p-3 rounded-lg text-left flex flex-col gap-1 transition-colors"
              >
                <span className="font-bold text-white">Location Breakdown</span>
                <span className="text-[10px] text-gray-500">Grouped INT/EXT metrics</span>
              </button>
              <button 
                onClick={() => exportReport('props')}
                className="bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#333] p-3 rounded-lg text-left flex flex-col gap-1 transition-colors"
              >
                <span className="font-bold text-white">Props & Wardrobe</span>
                <span className="text-[10px] text-gray-500">Auto-extracted item catalog</span>
              </button>
              <button 
                onClick={() => exportReport('stripboard')}
                className="col-span-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#333] p-3 rounded-lg text-center flex items-center justify-center gap-2 transition-colors font-bold text-white"
              >
                <Map size={14} className="text-[#F4C430]" /> Shooting Schedule Stripboard (CSV)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
