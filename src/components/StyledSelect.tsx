import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type StyledSelectOption = { value: string; label: string; group?: string };

type Props = {
  value: string;
  options: StyledSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  compact?: boolean;
};

export default function StyledSelect({ value, options, onChange, ariaLabel, className = '', compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const move = (direction: number) => {
    if (!options.length) return;
    const index = Math.max(0, options.findIndex((option) => option.value === value));
    onChange(options[(index + direction + options.length) % options.length].value);
  };

  return <div ref={rootRef} className={`relative ${className}`}>
    <button type="button" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} onKeyDown={(event) => { if (event.key === 'Escape') { setOpen(false); return; } if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); move(event.key === 'ArrowDown' ? 1 : -1); setOpen(true); } }} className={`flex w-full items-center justify-between gap-3 rounded-lg border border-[#404040] bg-[#242424] text-left font-semibold text-gray-200 outline-none transition-colors hover:border-[#5a5a5a] focus:border-[#F4C430] focus:ring-1 focus:ring-[#F4C430]/20 ${compact ? 'min-h-8 px-2.5 py-1.5 text-[10px]' : 'min-h-10 px-3 py-2 text-xs'}`}>
      <span className="min-w-0 flex-1 truncate">{selected?.label || 'Select'}</span><ChevronDown size={compact ? 12 : 14} className={`shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180 text-[#F4C430]' : ''}`} />
    </button>
    {open && <div role="listbox" aria-label={ariaLabel} className="absolute left-0 top-[calc(100%+6px)] z-[70] max-h-72 w-max min-w-full max-w-[min(680px,calc(100vw-48px))] overflow-y-auto rounded-lg border border-[#454545] bg-[#202020] p-1 shadow-2xl ring-1 ring-black/50">
      {options.map((option, index) => {
        const active = option.value === value;
        const showGroup = option.group && (index === 0 || option.group !== options[index - 1].group);
        return <div key={option.value}>{showGroup && <p className="px-2.5 pb-1 pt-2 text-[8px] font-bold uppercase tracking-[0.15em] text-gray-600">{option.group}</p>}<button type="button" role="option" aria-selected={active} onClick={() => { onChange(option.value); setOpen(false); }} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[11px] transition-colors ${active ? 'bg-[#F4C430]/12 text-[#F4C430]' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}><span className="grid h-4 w-4 shrink-0 place-items-center">{active && <Check size={12} />}</span><span className="min-w-0 whitespace-normal">{option.label}</span></button></div>;
      })}
    </div>}
  </div>;
}
