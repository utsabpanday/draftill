import { useRef, useState } from 'react';
import { useAppStore } from '../store/store';
import { User, Plus, Trash2, Edit3, BarChart2, Upload, X } from 'lucide-react';

export default function CharacterBible() {
  const { characters, addCharacter, updateCharacter, deleteCharacter, scriptContent } = useAppStore();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [description, setDescription] = useState('');
  const [arc, setArc] = useState('');
  const [notes, setNotes] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const newImageInputRef = useRef<HTMLInputElement>(null);

  // Compute character screen time on the fly based on editor nodes
  const calculateStats = (charName: string) => {
    if (!scriptContent || !scriptContent.content) return { lines: 0, percent: 0 };
    let totalLines = 0;
    let charLines = 0;

    scriptContent.content.forEach((node: any) => {
      if (node.type === 'character') {
        totalLines++;
        if (node.content && node.content[0]?.text?.toUpperCase() === charName.toUpperCase()) {
          charLines++;
        }
      }
    });

    const percent = totalLines > 0 ? Math.round((charLines / totalLines) * 100) : 0;
    return { lines: charLines, percent };
  };

  const handleAdd = () => {
    if (!name.trim()) return;
    addCharacter({ name: name.toUpperCase(), role, description, arc, notes, image });
    setName('');
    setRole('');
    setDescription('');
    setArc('');
    setNotes('');
    setImage(null);
  };

  const loadNewCharacterImage = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleSaveEdit = (id: string) => {
    updateCharacter(id, { role, description, arc, notes });
    setEditingId(null);
  };

  const startEdit = (char: any) => {
    setEditingId(char.id);
    setRole(char.role || '');
    setDescription(char.description);
    setArc(char.arc);
    setNotes(char.notes);
  };

  const handleImageUpload = (charId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const base64 = readerEvent.target?.result as string;
        updateCharacter(charId, { image: base64 });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-6 font-inter text-[#e8e8e6]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Character Room</h2>
          <p className="text-gray-400 text-xs mt-1">Track character arcs, motivations, and screen time from one place.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Add Form */}
        <div className="bg-[#1e1e1e] p-6 rounded-xl border border-[#333] flex flex-col gap-4 self-start">
          <h3 className="text-lg font-bold text-[#F4C430] flex items-center gap-2">
            <Plus size={18} /> Add Character
          </h3>
          <button type="button" onClick={() => newImageInputRef.current?.click()} className="group relative mx-auto grid h-24 w-24 place-items-center overflow-hidden rounded-full border-2 border-dashed border-[#444] bg-[#252525] text-gray-500 hover:border-[#F4C430] hover:text-[#F4C430]" title="Add character image">
            {image ? <img src={image} alt="New character preview" className="h-full w-full object-cover" /> : <Upload size={20} />}
            {image && <span className="absolute inset-0 grid place-items-center bg-black/55 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">Change</span>}
          </button>
          <input ref={newImageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { loadNewCharacterImage(event.target.files?.[0]); event.currentTarget.value = ''; }} />
          {image && <button type="button" onClick={() => setImage(null)} className="-mt-2 flex items-center justify-center gap-1 text-[10px] font-bold text-red-400 hover:text-red-300"><X size={10} /> Remove image</button>}
          <div>
            <label className="text-xs font-semibold text-gray-400 block mb-1">NAME</label>
            <input 
              type="text" 
              placeholder="e.g. JOHN DOE" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#2a2a2a] border border-[#333] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#F4C430] uppercase"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 block mb-1">ROLE</label>
            <input 
              type="text" 
              placeholder="e.g. Protagonist, Antagonist, Supporting" 
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-[#2a2a2a] border border-[#333] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#F4C430]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 block mb-1">DESCRIPTION</label>
            <input 
              type="text" 
              placeholder="e.g. Cybernetic detective, 40s" 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#2a2a2a] border border-[#333] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#F4C430]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 block mb-1">CHARACTER ARC</label>
            <textarea 
              rows={3}
              placeholder="e.g. Goes from cynical loner to selfless leader..." 
              value={arc}
              onChange={(e) => setArc(e.target.value)}
              className="w-full bg-[#2a2a2a] border border-[#333] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#F4C430] resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 block mb-1">ADDITIONAL NOTES</label>
            <textarea 
              rows={3}
              placeholder="e.g. Wears a battered beige trench coat. Speaks in short sentences." 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#2a2a2a] border border-[#333] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#F4C430] resize-none"
            />
          </div>
          <button 
            onClick={handleAdd}
            className="w-full bg-[#F4C430] text-[#101113] font-bold rounded py-2 text-sm hover:bg-[#d4a822] transition-colors"
          >
            Create Profile
          </button>
        </div>

        {/* Right Profiles list */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {characters.length === 0 ? (
            <div className="bg-[#1a1a1a] border border-dashed border-[#333] rounded-xl p-12 text-center text-gray-500">
              <User size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No characters created yet. Create one to begin tracking.</p>
            </div>
          ) : (
            characters.map((char: any) => {
              const stats = calculateStats(char.name);
              const isEditing = editingId === char.id;

              return (
                <div key={char.id} className="bg-[#1e1e1e] p-6 rounded-xl border border-[#333] flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      {/* Character Avatar / Image */}
                      <div className="relative group/avatar shrink-0">
                        <div className="w-14 h-14 rounded-full bg-[#F4C430]/10 flex items-center justify-center text-[#F4C430] overflow-hidden border-2 border-[#333] group-hover/avatar:border-[#F4C430] transition-colors">
                          {char.image ? (
                            <img src={char.image} className="w-full h-full object-cover" alt={char.name} />
                          ) : (
                            <User size={24} />
                          )}
                        </div>
                        <button
                          onClick={() => handleImageUpload(char.id)}
                          className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#F4C430] text-black flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer shadow-md"
                          title="Upload Character Image"
                        >
                          <Upload size={10} />
                        </button>
                        {char.image && (
                          <button
                            onClick={() => updateCharacter(char.id, { image: null })}
                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer shadow-md"
                            title="Remove Image"
                          >
                            <X size={9} />
                          </button>
                        )}
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-white uppercase tracking-wider">{char.name}</h4>
                        {char.role && <span className="text-[10px] font-bold text-[#F4C430] bg-[#F4C430]/10 px-2 py-0.5 rounded-full uppercase">{char.role}</span>}
                        <p className="text-xs text-gray-400 mt-0.5">{char.description || 'No description provided'}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => isEditing ? handleSaveEdit(char.id) : startEdit(char)}
                        className="p-2 hover:bg-white/5 rounded text-gray-400 hover:text-white transition-colors"
                      >
                        {isEditing ? <span className="text-xs font-bold text-[#F4C430]">Save</span> : <Edit3 size={16} />}
                      </button>
                      <button 
                        onClick={() => deleteCharacter(char.id)}
                        className="p-2 hover:bg-red-500/10 rounded text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Body Content */}
                  {isEditing ? (
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-400 block mb-1">ROLE</label>
                        <input 
                          type="text"
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                          placeholder="e.g. Protagonist"
                          className="w-full bg-[#2a2a2a] border border-[#333] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#F4C430]"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-400 block mb-1">CHARACTER ARC</label>
                        <textarea 
                          rows={2}
                          value={arc}
                          onChange={(e) => setArc(e.target.value)}
                          className="w-full bg-[#2a2a2a] border border-[#333] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#F4C430]"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-400 block mb-1">NOTES</label>
                        <textarea 
                          rows={2}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="w-full bg-[#2a2a2a] border border-[#333] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#F4C430]"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-[#1a1a1a] p-4 rounded-lg">
                      <div>
                        <span className="text-xs font-bold text-gray-500 uppercase block mb-1">Character Arc</span>
                        <p className="text-gray-300 text-xs italic">{char.arc || 'Not defined'}</p>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-gray-500 uppercase block mb-1">Behavior & Notes</span>
                        <p className="text-gray-300 text-xs italic">{char.notes || 'Not defined'}</p>
                      </div>
                    </div>
                  )}

                  {/* Auto speaking time stats */}
                  <div className="flex items-center gap-4 bg-[#2a2a2a]/30 p-3 rounded-lg border border-[#333]/50">
                    <BarChart2 size={16} className="text-[#F4C430]" />
                    <div className="flex-1">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Speaking Lines / Screen Time</span>
                        <span className="font-bold text-white">{stats.lines} lines ({stats.percent}%)</span>
                      </div>
                      <div className="w-full bg-[#333] h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-[#F4C430] h-full rounded-full transition-all duration-500" 
                          style={{ width: `${stats.percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
