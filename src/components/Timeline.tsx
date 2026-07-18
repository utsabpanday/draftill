import { useEffect, useState } from 'react';
import { useAppStore } from '../store/store';
import { Clock } from 'lucide-react';

interface TimelineItem {
  id: string;
  heading: string;
  durationMin: number;
  color: string;
  index: number;
}

export default function Timeline({ onSelectScene }: { onSelectScene?: (id: string) => void }) {
  const { scriptContent } = useAppStore();
  const [items, setItems] = useState<TimelineItem[]>([]);

  useEffect(() => {
    if (!scriptContent || !scriptContent.content) return;

    const parsedItems: TimelineItem[] = [];
    let currentItem: TimelineItem | null = null;
    let paragraphCount = 0;
    let sceneIndex = 0;

    let idx = 0;
    for (const node of scriptContent.content) {
      if (node.type === 'sceneHeading') {
        if (currentItem) {
          currentItem.durationMin = Math.max(0.5, Number((paragraphCount / 12).toFixed(1)));
          parsedItems.push(currentItem);
        }
        sceneIndex++;
        paragraphCount = 0;
        currentItem = {
          id: node.attrs?.id || `scene-${idx}`,
          heading: node.content?.[0]?.text || `SCENE ${sceneIndex}`,
          durationMin: 0.5,
          color: node.attrs?.color || '#F4C430',
          index: sceneIndex
        };
      } else {
        paragraphCount++;
      }
      idx++;
    }

    if (currentItem) {
      currentItem.durationMin = Math.max(0.5, Number((paragraphCount / 12).toFixed(1)));
      parsedItems.push(currentItem);
    }

    setItems(parsedItems);
  }, [scriptContent]);

  const totalDuration = items.reduce((sum, item) => sum + item.durationMin, 0);

  if (items.length === 0) return null;

  return (
    <div className="w-full bg-[#1e1e1e] p-4 rounded-xl border border-[#333] mb-6 font-inter text-[#e8e8e6] shrink-0 select-none">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
          <Clock size={12} className="text-[#F4C430]" /> Runtime Timeline
        </span>
        <span className="text-xs text-[#F4C430] font-bold">
          {totalDuration.toFixed(1)} Min Total Estimated Runtime
        </span>
      </div>

      {/* Horizontal Bar */}
      <div className="w-full h-6 bg-[#2a2a2a] rounded-lg overflow-hidden flex border border-[#333] p-0.5">
        {items.map((item) => {
          const widthPercent = totalDuration > 0 ? (item.durationMin / totalDuration) * 100 : 100 / items.length;
          return (
            <button
              key={item.id}
              onClick={() => onSelectScene && onSelectScene(item.id)}
              className="h-full hover:brightness-110 active:scale-95 transition-all relative group cursor-pointer border-r border-[#1e1e1e]/50 last:border-0"
              style={{ 
                width: `${widthPercent}%`, 
                backgroundColor: item.color 
              }}
            >
              {/* Tooltip on Hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none drop-shadow-md">
                <div className="bg-[#101113] border border-[#333] text-[9px] text-[#e8e8e6] rounded px-2.5 py-1.5 whitespace-nowrap uppercase font-courier leading-tight">
                  <span className="font-bold block text-[#F4C430]">SCENE {item.index}</span>
                  <span>{item.heading}</span>
                  <span className="block text-gray-400 text-[8px] mt-0.5 font-sans font-bold">~{item.durationMin} MIN</span>
                </div>
                <div className="w-2.5 h-2.5 bg-[#101113] border-r border-b border-[#333] rotate-45 -mt-1.5" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
