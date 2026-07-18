import { useRef, useState } from 'react';
import { ArrowRight, Edit3, Film, ImagePlus, MapPin, Plus, Trash2, X } from 'lucide-react';
import { LocationRecord, useAppStore } from '../store/store';

const emptyForm = { heading: 'INT. NEW LOCATION - DAY', description: '', notes: '', image: null as string | null };

export default function SceneCreation() {
  const { locations, addLocation, updateLocation, deleteLocation, scriptContent, setScriptContent, setActiveTab } = useAppStore();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);

  const normalizedLocation = (): Omit<LocationRecord, 'id'> => ({
    heading: form.heading.trim().toUpperCase(),
    description: form.description.trim(),
    notes: form.notes.trim(),
    image: form.image
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const saveLocation = () => {
    const location = normalizedLocation();
    if (!location.heading) return null;
    if (editingId) {
      updateLocation(editingId, location);
      setMessage('Location updated.');
      return { ...location, id: editingId };
    }
    const existing = locations.find((item) => item.heading.toUpperCase() === location.heading);
    if (existing) {
      updateLocation(existing.id, location);
      setEditingId(existing.id);
      setMessage('Location updated.');
      return { ...location, id: existing.id };
    }
    const id = addLocation(location);
    setEditingId(id);
    setMessage('Location saved.');
    return { ...location, id };
  };

  const insertIntoScreenplay = (location: LocationRecord) => {
    const current = scriptContent?.type === 'doc' ? structuredClone(scriptContent) : { type: 'doc', content: [] };
    const blocks = [
      { type: 'sceneHeading', attrs: { revision: 'none', id: crypto.randomUUID(), entityType: 'location', entityId: location.id }, content: [{ type: 'text', text: location.heading }] },
      ...(location.description ? [{ type: 'action', attrs: { revision: 'none', id: crypto.randomUUID() }, content: [{ type: 'text', text: location.description }] }] : [])
    ];
    const pages = Array.isArray(current.content) ? current.content : [];
    if (pages.some((node: any) => node.type === 'page')) {
      const lastPage = [...pages].reverse().find((node: any) => node.type === 'page');
      if (lastPage) lastPage.content = [...(lastPage.content || []), ...blocks];
    } else current.content = [...pages, ...blocks];
    setScriptContent(current);
    setMessage('Location added to the screenplay.');
  };

  const saveAndInsert = () => {
    const location = saveLocation();
    if (location) insertIntoScreenplay(location);
  };

  const editLocation = (location: LocationRecord) => {
    setEditingId(location.id);
    setForm({ heading: location.heading, description: location.description, notes: location.notes, image: location.image || null });
    setMessage('');
  };

  const loadImage = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setForm((current) => ({ ...current, image: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  return <section className="mx-auto w-full max-w-5xl">
    <div className="mb-6 flex items-center gap-3">
      <Film className="text-[#F4C430]" size={22} />
      <div><h1 className="text-2xl font-bold">Locations</h1><p className="mt-1 text-xs text-gray-500">Build a visual location library and add formatted scene headings to the screenplay.</p></div>
    </div>

    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <div className="self-start rounded-xl border border-[#3a3a3a] bg-[#1a1a1a] p-5">
        <div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-bold text-[#F4C430]"><Plus size={15} /> {editingId ? 'Edit Location' : 'Add Location'}</h2>{editingId && <button type="button" onClick={resetForm} className="text-[10px] font-bold text-gray-500 hover:text-white">New</button>}</div>
        <button type="button" onClick={() => imageInputRef.current?.click()} className="group relative mb-4 flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-[#454545] bg-[#222] text-gray-500 hover:border-[#F4C430] hover:text-[#F4C430]">
          {form.image ? <img src={form.image} alt="Location preview" className="h-full w-full object-cover" /> : <span className="flex items-center gap-2 text-xs font-bold"><ImagePlus size={16} /> Add location image</span>}
          {form.image && <span className="absolute inset-0 grid place-items-center bg-black/55 text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">Change image</span>}
        </button>
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { loadImage(event.target.files?.[0]); event.currentTarget.value = ''; }} />
        {form.image && <button type="button" onClick={() => setForm((current) => ({ ...current, image: null }))} className="-mt-2 mb-3 flex items-center gap-1 text-[10px] font-bold text-red-400 hover:text-red-300"><X size={10} /> Remove image</button>}
        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500">Scene heading<input value={form.heading} onChange={(event) => setForm((current) => ({ ...current, heading: event.target.value }))} className="mt-1.5 w-full rounded border border-[#444] bg-[#252525] px-3 py-2 text-sm font-mono text-white outline-none focus:border-[#F4C430]" placeholder="INT. LOCATION - DAY" /></label>
        <label className="mt-3 block text-[10px] font-bold uppercase tracking-wider text-gray-500">Description / opening action<textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} className="mt-1.5 w-full resize-y rounded border border-[#444] bg-[#252525] px-3 py-2 text-xs text-white outline-none focus:border-[#F4C430]" placeholder="What does this place look and feel like?" /></label>
        <label className="mt-3 block text-[10px] font-bold uppercase tracking-wider text-gray-500">Production notes<textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={2} className="mt-1.5 w-full resize-y rounded border border-[#444] bg-[#252525] px-3 py-2 text-xs text-white outline-none focus:border-[#F4C430]" placeholder="Set dressing, access, lighting…" /></label>
        <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={saveLocation} disabled={!form.heading.trim()} className="rounded border border-[#555] px-3 py-2 text-xs font-bold text-gray-200 hover:border-[#F4C430] hover:text-[#F4C430] disabled:opacity-40">Save</button><button type="button" onClick={saveAndInsert} disabled={!form.heading.trim()} className="rounded bg-[#F4C430] px-3 py-2 text-xs font-bold text-black hover:bg-[#d4a822] disabled:opacity-40">Save & add</button></div>
        {message && <p className="mt-3 text-[10px] text-emerald-400">{message}</p>}
        <button type="button" onClick={() => setActiveTab('script')} className="mt-4 flex items-center gap-2 text-xs text-gray-500 hover:text-[#F4C430]"><ArrowRight size={13} /> Return to editor</button>
      </div>

      <div className="grid content-start gap-3 sm:grid-cols-2">
        {locations.length === 0 ? <div className="col-span-full rounded-xl border border-dashed border-[#3a3a3a] bg-[#1a1a1a] p-12 text-center text-gray-500"><MapPin size={34} className="mx-auto mb-3 opacity-40" /><p className="text-sm">No saved locations yet.</p></div> : locations.map((location) => <article key={location.id} className="overflow-hidden rounded-xl border border-[#373737] bg-[#1d1d1d]">
          <div className="aspect-video bg-[#252525]">{location.image ? <img src={location.image} alt={location.heading} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-gray-600"><MapPin size={28} /></div>}</div>
          <div className="p-4"><h3 className="text-xs font-bold uppercase tracking-wide text-white">{location.heading}</h3><p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-gray-400">{location.description || 'No description yet.'}</p>{location.notes && <p className="mt-2 line-clamp-2 text-[10px] italic text-gray-600">{location.notes}</p>}
            <div className="mt-4 flex items-center gap-2"><button type="button" onClick={() => insertIntoScreenplay(location)} className="flex-1 rounded bg-[#F4C430] px-3 py-2 text-[10px] font-bold text-black hover:bg-[#d4a822]"><Plus size={11} className="mr-1 inline" /> Add to screenplay</button><button type="button" onClick={() => editLocation(location)} className="rounded border border-[#444] p-2 text-gray-400 hover:border-[#F4C430] hover:text-[#F4C430]" title="Edit location"><Edit3 size={13} /></button><button type="button" onClick={() => { deleteLocation(location.id); if (editingId === location.id) resetForm(); }} className="rounded border border-[#444] p-2 text-gray-400 hover:border-red-400 hover:text-red-400" title="Delete location"><Trash2 size={13} /></button></div>
          </div>
        </article>)}
      </div>
    </div>
  </section>;
}
