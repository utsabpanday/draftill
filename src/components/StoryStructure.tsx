import { useAppStore } from '../store/store';
import { PREBUILT_TEMPLATES } from '../utils/templates';
import { Clock, ChevronRight } from 'lucide-react';

export default function StoryStructure({ onApplyTemplate }: { onApplyTemplate: (nodes: any[], titlePageData: any) => void }) {
  const { setScriptContent, setTitlePage } = useAppStore();

  const handleSelect = (template: any) => {
    // Convert template nodes into editor structure
    const editorNodes = template.nodes.map((n: any) => ({
      type: n.type,
      attrs: {
        revision: 'none',
        id: crypto.randomUUID()
      },
      content: n.text ? [{ type: 'text', text: n.text }] : undefined
    }));

    const newDoc = {
      type: 'doc',
      content: editorNodes
    };

    // Apply
    setScriptContent(newDoc);
    setTitlePage({
      title: template.name.toUpperCase(),
      author: 'Screenwriter'
    });

    onApplyTemplate(editorNodes, { title: template.name.toUpperCase(), author: 'Screenwriter' });
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-6 font-inter text-[#e8e8e6] overflow-y-auto max-h-[85vh]">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white tracking-tight">Prebuilt Screenplay Templates</h2>
        <p className="text-gray-400 text-xs mt-1">Jumpstart your narrative with structural beat outlines and page-count benchmarks.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PREBUILT_TEMPLATES.map((tmpl) => (
          <div 
            key={tmpl.id}
            onClick={() => handleSelect(tmpl)}
            className="bg-[#1e1e1e] hover:bg-[#252525] border border-[#333] hover:border-[#F4C430]/40 rounded-xl p-5 cursor-pointer flex flex-col justify-between transition-all duration-200"
          >
            <div>
              <div className="flex justify-between items-start gap-2 mb-2">
                <h3 className="font-bold text-white text-sm uppercase tracking-wide">
                  {tmpl.name}
                </h3>
                <span className="text-[9px] bg-[#333] px-2 py-0.5 rounded text-[#F4C430] font-bold">
                  {tmpl.targetPageCount} PGS
                </span>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed mb-4">
                {tmpl.description}
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-[#333]/50 pt-3 text-[10px] text-gray-500 font-bold">
              <span className="flex items-center gap-1">
                <Clock size={12} className="text-[#F4C430]/70" />
                ~{tmpl.estimatedRuntimeMin} min runtime
              </span>
              <span className="text-[#F4C430] flex items-center gap-0.5 hover:translate-x-0.5 transition-transform">
                Apply Template <ChevronRight size={12} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
