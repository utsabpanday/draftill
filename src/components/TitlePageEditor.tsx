import { useAppStore } from '../store/store';
import { FileText } from 'lucide-react';

export default function TitlePageEditor() {
  const { titlePage, setTitlePage } = useAppStore();

  const handleChange = (key: keyof typeof titlePage, value: string) => {
    setTitlePage({ [key]: value });
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-6 font-inter text-[#e8e8e6] flex flex-col lg:flex-row gap-8 h-[85vh] overflow-y-auto">
      {/* Edit Panel */}
      <div className="flex-1 bg-[#1e1e1e] p-6 rounded-xl border border-[#333] flex flex-col gap-4 self-start">
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 mb-2">
          <FileText size={20} className="text-[#F4C430]" /> Title Page Settings
        </h2>
        
        <div>
          <label className="text-xs font-semibold text-gray-400 block mb-1">SCREENPLAY TITLE</label>
          <input 
            type="text" 
            value={titlePage.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="e.g. INCEPTION"
            className="w-full bg-[#2a2a2a] border border-[#333] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#F4C430] uppercase font-mono font-bold"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-400 block mb-1">CREDIT</label>
          <input 
            type="text" 
            value={titlePage.credit}
            onChange={(e) => handleChange('credit', e.target.value)}
            placeholder="e.g. Written by"
            className="w-full bg-[#2a2a2a] border border-[#333] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#F4C430]"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-400 block mb-1">AUTHOR NAME</label>
          <input 
            type="text" 
            value={titlePage.author}
            onChange={(e) => handleChange('author', e.target.value)}
            placeholder="e.g. John Doe"
            className="w-full bg-[#2a2a2a] border border-[#333] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#F4C430]"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-400 block mb-1">SOURCE MATERIAL (OPTIONAL)</label>
          <input 
            type="text" 
            value={titlePage.sourceMaterial}
            onChange={(e) => handleChange('sourceMaterial', e.target.value)}
            placeholder="e.g. Based on the novel by..."
            className="w-full bg-[#2a2a2a] border border-[#333] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#F4C430]"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-400 block mb-1">CONTACT & AGENT INFORMATION</label>
          <textarea 
            rows={4}
            value={titlePage.contactInfo}
            onChange={(e) => handleChange('contactInfo', e.target.value)}
            placeholder="e.g. Agent Name&#10;Email: agent@agency.com&#10;Phone: +1 (555) 0199"
            className="w-full bg-[#2a2a2a] border border-[#333] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#F4C430] resize-none"
          />
        </div>
      </div>

      {/* Preview Page Mockup */}
      <div className="flex-1 flex flex-col items-center select-none">
        <span className="text-xs text-gray-500 font-bold uppercase mb-2">Title Page Preview</span>
        <div className="w-[450px] h-[580px] bg-white text-black shadow-2xl rounded border border-gray-300 p-12 flex flex-col justify-between font-courier text-center text-[10px] leading-normal relative">
          {/* Header margin space */}
          <div className="h-10" />

          {/* Centered details */}
          <div className="flex flex-col gap-6">
            <h1 className="text-sm font-bold uppercase tracking-wider">
              {titlePage.title || 'UNTITLED SCREENPLAY'}
            </h1>
            
            <div className="flex flex-col gap-2">
              <p className="italic text-gray-600">{titlePage.credit || 'Written by'}</p>
              <p className="font-bold">{titlePage.author || 'Screenwriter'}</p>
            </div>

            {titlePage.sourceMaterial && (
              <p className="text-gray-500 mt-2 text-[8px] max-w-[300px] mx-auto leading-relaxed">
                {titlePage.sourceMaterial}
              </p>
            )}
          </div>

          {/* Bottom Left Contact details */}
          <div className="text-left font-normal text-gray-700 text-[8px] whitespace-pre-line leading-relaxed max-w-[200px]">
            {titlePage.contactInfo || 'Contact Information'}
          </div>
        </div>
      </div>
    </div>
  );
}
