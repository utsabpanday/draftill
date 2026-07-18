import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, X } from 'lucide-react';

export default function PreviewSlideshow({ scriptContent, isDarkMode, onClose }: { scriptContent: any; isDarkMode: boolean; onClose: () => void }) {
  const pages = useMemo(() => {
    const content = scriptContent?.content || [];
    const pageNodes = content.filter((node: any) => node.type === 'page');
    if (pageNodes.length) return pageNodes;

    // The editor store is intentionally flattened for autosave, so derive
    // presentation slides from scene boundaries (or manageable text chunks).
    const slides: any[] = [];
    let currentSlide: any[] = [];
    content.forEach((node: any) => {
      if (node.type === 'sceneHeading' && currentSlide.length) {
        slides.push({ type: 'page', content: currentSlide });
        currentSlide = [];
      }
      currentSlide.push(node);
      if (currentSlide.length >= 12) {
        slides.push({ type: 'page', content: currentSlide });
        currentSlide = [];
      }
    });
    if (currentSlide.length || slides.length === 0) slides.push({ type: 'page', content: currentSlide });
    return slides;
  }, [scriptContent]);
  const [pageIndex, setPageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!isPlaying || pages.length < 2) return;
    const timer = window.setInterval(() => setPageIndex((index) => (index + 1) % pages.length), 5000);
    return () => window.clearInterval(timer);
  }, [isPlaying, pages.length]);

  const page = pages[pageIndex];
  const text = (page.content || []).map((node: any) => node.content?.map((part: any) => part.text || '').join('') || '').join('\n');

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-3"><span className="text-xs font-bold uppercase tracking-widest text-gray-300">Preview</span><span className="text-xs text-gray-500">{pageIndex + 1} / {pages.length}</span></div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsPlaying((playing) => !playing)} className="flex items-center gap-1.5 rounded bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20 cursor-pointer"><Play size={13} /> {isPlaying ? 'Pause' : 'Play'}</button>
          <button onClick={onClose} className="rounded p-1.5 text-gray-400 hover:bg-white/10 hover:text-white cursor-pointer" title="Close Preview"><X size={18} /></button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center gap-5 p-6">
        <button onClick={() => setPageIndex((index) => (index - 1 + pages.length) % pages.length)} className="rounded-full bg-white/10 p-3 hover:bg-white/20 cursor-pointer"><ChevronLeft size={20} /></button>
        <div className={`h-full max-h-[calc(100vh-150px)] w-full max-w-3xl overflow-auto rounded shadow-2xl ${isDarkMode ? 'bg-[#242424] text-gray-100' : 'bg-white text-gray-900'}`}>
          <pre className="whitespace-pre-wrap p-14 font-courier text-sm leading-7">{text || 'This screenplay page is empty.'}</pre>
        </div>
        <button onClick={() => setPageIndex((index) => (index + 1) % pages.length)} className="rounded-full bg-white/10 p-3 hover:bg-white/20 cursor-pointer"><ChevronRight size={20} /></button>
      </div>
    </div>
  );
}
