import { useEffect, useState } from 'react';
import { CheckCircle2, Cpu, Download, KeyRound, Loader2, Trash2 } from 'lucide-react';
import StyledSelect from './StyledSelect';

type ProviderId = 'local' | 'openai' | 'gemini' | 'anthropic' | 'glm' | 'deepseek' | 'moonshot' | 'openrouter' | 'groq' | 'xai' | 'llama' | 'compatible';
type Config = { provider: ProviderId; model: string; endpoint: string };
type LocalModel = { id: string; name: string; size: string; note: string; installed: boolean; needsRepair?: boolean };

const providers: Array<{ id: ProviderId; label: string; model: string; endpoint: string }> = [
  { id: 'local', label: 'Draftill Local Vision (private)', model: 'gemma-4-e2b-vision', endpoint: '' },
  { id: 'openai', label: 'OpenAI', model: 'gpt-4.1-mini', endpoint: 'https://api.openai.com/v1/chat/completions' },
  { id: 'gemini', label: 'Google Gemini', model: 'gemini-2.0-flash', endpoint: 'https://generativelanguage.googleapis.com/v1beta' },
  { id: 'anthropic', label: 'Anthropic', model: 'claude-3-5-haiku-latest', endpoint: 'https://api.anthropic.com/v1/messages' },
  { id: 'glm', label: 'GLM (Z.ai)', model: 'glm-4.7-flash', endpoint: 'https://api.z.ai/api/paas/v4/chat/completions' },
  { id: 'deepseek', label: 'DeepSeek', model: 'deepseek-chat', endpoint: 'https://api.deepseek.com/chat/completions' },
  { id: 'moonshot', label: 'Moonshot AI (Kimi)', model: 'kimi-k2.5', endpoint: 'https://api.moonshot.ai/v1/chat/completions' },
  { id: 'openrouter', label: 'OpenRouter', model: 'openai/gpt-4.1-mini', endpoint: 'https://openrouter.ai/api/v1/chat/completions' },
  { id: 'groq', label: 'Groq', model: 'llama-3.3-70b-versatile', endpoint: 'https://api.groq.com/openai/v1/chat/completions' },
  { id: 'xai', label: 'xAI (Grok)', model: 'grok-3-mini', endpoint: 'https://api.x.ai/v1/chat/completions' },
  { id: 'llama', label: 'Meta Llama compatible', model: 'meta-llama/llama-3.3-70b-instruct', endpoint: '' },
  { id: 'compatible', label: 'OpenAI compatible API', model: '', endpoint: '' }
];

export default function AISettings() {
  const [config, setConfig] = useState<Config>({ provider: 'local', model: 'gemma-4-e2b-vision', endpoint: '' });
  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [models, setModels] = useState<LocalModel[]>([]);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ received: number; total: number } | null>(null);
  const [message, setMessage] = useState('');

  const refresh = async () => {
    if (!window.ipcRenderer) return;
    const [saved, localModels] = await Promise.all([window.ipcRenderer.invoke('ai:getConfig'), window.ipcRenderer.invoke('ai:getLocalModels')]);
    if (saved?.config) setConfig(saved.config);
    setHasApiKey(Boolean(saved?.hasApiKey));
    setModels(localModels || []);
  };

  useEffect(() => {
    refresh();
    const onProgress = (_event: unknown, update: { modelId: string; received: number; total: number }) => {
      if (update.modelId === downloading) setProgress({ received: update.received, total: update.total });
    };
    window.ipcRenderer?.on('ai:model-download-progress', onProgress);
    return () => window.ipcRenderer?.off('ai:model-download-progress', onProgress);
  }, [downloading]);

  const chooseProvider = (providerId: ProviderId) => {
    const provider = providers.find((item) => item.id === providerId)!;
    setConfig({ provider: providerId, model: provider.model, endpoint: provider.endpoint });
    setMessage('');
  };

  const save = async () => {
    setSaving(true);
    const result = await window.ipcRenderer?.invoke('ai:saveConfig', { ...config, apiKey });
    setSaving(false);
    if (!result?.success) { setMessage(result?.error || 'Could not save AI settings.'); return; }
    setApiKey('');
    setHasApiKey(config.provider !== 'local');
    setMessage('AI settings saved securely.');
  };

  const download = async (modelId: string) => {
    setDownloading(modelId); setProgress(null); setMessage('');
    const result = await window.ipcRenderer?.invoke('ai:downloadLocalModel', modelId);
    setDownloading(null); setProgress(null);
    if (!result?.success) { setMessage(result?.error || 'Model download failed.'); return; }
    setConfig((current) => ({ ...current, provider: 'local', model: modelId, endpoint: '' }));
    await refresh();
    setMessage('Model downloaded and ready to select.');
  };

  const removeModel = async (modelId: string) => {
    await window.ipcRenderer?.invoke('ai:deleteLocalModel', modelId);
    await refresh();
  };

  return (
    <div className="flex min-w-0 flex-col gap-5 rounded-xl border border-[#333] bg-[#1e1e1e] p-4 sm:p-5 lg:p-6">
      <div>
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2"><Cpu size={16} className="text-[#F4C430]" /> AI Models & Providers</h3>
        <p className="mt-1 text-xs text-gray-400">Configure AI once here. Local vision models run privately on this PC without Ollama.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-gray-400 sm:col-span-2">Provider</label>
        <StyledSelect value={config.provider} onChange={(value) => chooseProvider(value as ProviderId)} ariaLabel="AI provider" className="sm:col-span-2" options={providers.map((provider) => ({ value: provider.id, label: provider.label }))} />
        {config.provider === 'local' ? (
          <StyledSelect value={config.model} onChange={(value) => setConfig((current) => ({ ...current, model: value }))} ariaLabel="Local AI model" className="sm:col-span-2" options={[{ value: '', label: 'Choose a downloaded local model' }, ...models.filter((model) => model.installed).map((model) => ({ value: model.id, label: model.name }))]} />
        ) : (
          <>
            <input value={config.model} onChange={(event) => setConfig((current) => ({ ...current, model: event.target.value }))} placeholder="Model name" className="rounded-lg border border-[#333] bg-[#171717] px-3 py-2 text-sm text-white focus:border-[#F4C430] focus:outline-none" />
            <input value={config.endpoint} onChange={(event) => setConfig((current) => ({ ...current, endpoint: event.target.value }))} placeholder="Provider endpoint" className="rounded-lg border border-[#333] bg-[#171717] px-3 py-2 text-sm text-white focus:border-[#F4C430] focus:outline-none" />
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-gray-400"><KeyRound size={12} /> API key {hasApiKey && '(saved securely)'}</label>
              <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={hasApiKey ? 'Leave blank to keep saved key' : 'Enter API key'} className="w-full rounded-lg border border-[#333] bg-[#171717] px-3 py-2 text-sm text-white focus:border-[#F4C430] focus:outline-none" />
            </div>
          </>
        )}
        <button onClick={save} disabled={saving} className="rounded-lg bg-[#F4C430] px-4 py-2 text-xs font-bold text-black disabled:opacity-60 sm:col-span-2">{saving ? 'Saving...' : 'Save AI setup'}</button>
      </div>

      <div className="border-t border-[#333] pt-4">
        <div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-white">Local vision model library</span><span className="text-[10px] text-gray-500">Downloaded to Draftill data</span></div>
        <div className="grid gap-2 md:grid-cols-2">
          {models.map((model) => {
            const active = downloading === model.id;
            const percent = active && progress?.total ? Math.min(100, Math.round((progress.received / progress.total) * 100)) : 0;
            return <div key={model.id} className="rounded-lg border border-[#333] bg-[#1a1a1a] p-3">
              <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-gray-200">{model.name}</p><p className="text-[10px] text-gray-500">{model.size} · {model.note}</p></div>
                {model.installed ? <button onClick={() => removeModel(model.id)} className="flex items-center gap-1 text-[10px] font-bold text-red-400 hover:text-red-300"><Trash2 size={12} /> Remove</button> : <button onClick={() => download(model.id)} disabled={Boolean(downloading)} className="flex items-center gap-1 rounded bg-[#303030] px-2 py-1 text-[10px] font-bold text-gray-200 disabled:opacity-60">{active ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}{active ? `${percent}%` : model.needsRepair ? 'Repair' : 'Download'}</button>}</div>
              {model.installed && <p className="mt-2 flex items-center gap-1 text-[10px] text-green-500"><CheckCircle2 size={11} /> Vision ready on this PC</p>}
              {model.needsRepair && !active && <p className="mt-2 text-[10px] text-red-400">Incomplete download detected — click Repair.</p>}
              {active && <div className="mt-2 h-1 overflow-hidden rounded bg-[#333]"><div className="h-full bg-[#F4C430]" style={{ width: `${percent}%` }} /></div>}
            </div>;
          })}
        </div>
      </div>
      {message && <p className={`text-xs ${/(failed|incomplete|invalid|could not)/i.test(message) ? 'text-red-400' : 'text-green-500'}`}>{message}</p>}
    </div>
  );
}
