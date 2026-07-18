import { app, BrowserWindow, ipcMain, dialog, Menu, MenuItem, safeStorage, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { execFileSync, execSync, spawn, ChildProcess } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function getInstalledWindowsFonts() {
  if (process.platform !== 'win32') return []
  const registryKeys = [
    'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts',
    'HKCU\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts'
  ]
  const names = new Set<string>()
  for (const registryKey of registryKeys) {
    try {
      const output = execSync(`reg.exe query "${registryKey}"`, { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).toString()
      for (const line of output.split(/\r?\n/)) {
        const match = line.match(/^\s*(.+?)\s{2,}REG_\w+\s+/)
        if (!match) continue
        const name = match[1].replace(/\s*\((TrueType|OpenType|PostScript)\)\s*$/i, '').trim()
        if (name) names.add(name)
      }
    } catch {
      // A missing optional font registry key should not stop the editor from opening.
    }
  }
  return [...names].sort((first, second) => first.localeCompare(second, undefined, { sensitivity: 'base' }))
}

app.on('before-quit', () => {
  if (localServer && !localServer.killed) localServer.kill()
})

ipcMain.handle('fonts:listSystem', () => getInstalledWindowsFonts())
ipcMain.handle('link:openExternal', async (_event, rawUrl: string) => {
  try {
    const url = new URL(rawUrl)
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) throw new Error('Unsupported link protocol.')
    await shell.openExternal(url.href)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to open link.' }
  }
})

function isPrivateNetworkAddress(address: string) {
  const normalized = address.toLowerCase().replace(/^::ffff:/, '')
  if (normalized === '::1' || normalized === '0.0.0.0') return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')) return true
  if (!isIP(normalized)) return false
  const parts = normalized.split('.').map(Number)
  if (parts.length !== 4) return false
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168)
}

async function validatePreviewUrl(rawUrl: string) {
  const url = new URL(rawUrl)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Enter a public http or https link.')
  if (url.hostname === 'localhost' || url.hostname.endsWith('.local')) throw new Error('Local network links cannot be previewed.')
  const addresses = await lookup(url.hostname, { all: true })
  if (!addresses.length || addresses.some((entry) => isPrivateNetworkAddress(entry.address))) throw new Error('Private network links cannot be previewed.')
  return url
}

function decodePreviewText(value: string) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\s+/g, ' ').trim()
}

function pageMetadata(html: string, pageUrl: URL) {
  const meta = new Map<string, string>()
  for (const tag of html.match(/<meta\s+[^>]*>/gi) || []) {
    const attributes = new Map<string, string>()
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)) attributes.set(match[1].toLowerCase(), match[2])
    const key = (attributes.get('property') || attributes.get('name') || '').toLowerCase()
    const content = attributes.get('content') || ''
    if (key && content && !meta.has(key)) meta.set(key, content)
  }
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const imageValue = meta.get('og:image') || meta.get('twitter:image') || ''
  let image = ''
  try { if (imageValue) image = new URL(imageValue, pageUrl).href } catch { /* Ignore invalid preview images. */ }
  return {
    url: pageUrl.href,
    title: decodePreviewText(meta.get('og:title') || meta.get('twitter:title') || titleMatch?.[1] || pageUrl.hostname).slice(0, 180),
    description: decodePreviewText(meta.get('og:description') || meta.get('description') || meta.get('twitter:description') || '').slice(0, 420),
    siteName: decodePreviewText(meta.get('og:site_name') || pageUrl.hostname).slice(0, 100),
    image
  }
}

ipcMain.handle('link:preview', async (_event, rawUrl: string) => {
  try {
    let url = await validatePreviewUrl(rawUrl)
    let response: Response | null = null
    for (let redirect = 0; redirect < 4; redirect += 1) {
      response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(9000), headers: { 'User-Agent': 'Mozilla/5.0 Draftill-Link-Preview/1.0', Accept: 'text/html,application/xhtml+xml' } })
      if (response.status < 300 || response.status >= 400) break
      const location = response.headers.get('location')
      if (!location) break
      url = await validatePreviewUrl(new URL(location, url).href)
    }
    if (!response?.ok) throw new Error(`Preview request failed (${response?.status || 'network error'}).`)
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) throw new Error('This link does not provide an HTML preview.')
    const declaredBytes = Number(response.headers.get('content-length') || 0)
    if (declaredBytes > 1_500_000) throw new Error('This page is too large to preview.')
    const reader = response.body?.getReader()
    if (!reader) throw new Error('This page did not return preview content.')
    const chunks: Uint8Array[] = []
    let received = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > 1_500_000) { await reader.cancel(); throw new Error('This page is too large to preview.') }
      chunks.push(value)
    }
    const html = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8')
    return { success: true, preview: pageMetadata(html, url) }
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Could not load this link preview.' } }
})

function getAssociatedFilePath(args: string[]) {
  return args.find((arg) => path.extname(arg).toLowerCase() === '.drftl' && fs.existsSync(arg)) || null
}

function openAssociatedFile(filePath: string) {
  if (!win) return
  try {
    const payload = { filePath, name: path.basename(filePath), content: fs.readFileSync(filePath, 'utf-8') }
    const send = () => win?.webContents.send('file:open-from-association', payload)
    if (win.webContents.isLoading()) win.webContents.once('did-finish-load', send)
    else send()
  } catch (error) {
    console.error('Unable to open associated Draftill file:', error)
  }
}

const initialAssociatedFile = getAssociatedFilePath(process.argv)
const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, args) => {
    const filePath = getAssociatedFilePath(args)
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
      if (filePath) openAssociatedFile(filePath)
    }
  })
}

function createWindow() {
  win = new BrowserWindow({
    width: 1300,
    height: 900,
    titleBarStyle: 'hidden',
    icon: path.join(process.env.VITE_PUBLIC, 'appicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: true,
      contextIsolation: true
    },
  })

  // Spell checker suggestions and text formatting context menu
  win.webContents.on('context-menu', (_, params) => {
    const menu = new Menu()

    // Add spelling suggestions
    if (params.misspelledWord) {
      if (params.dictionarySuggestions && params.dictionarySuggestions.length > 0) {
        for (const suggestion of params.dictionarySuggestions) {
          menu.append(new MenuItem({
            label: suggestion,
            click: () => win?.webContents.replaceMisspelling(suggestion)
          }))
        }
      } else {
        menu.append(new MenuItem({
          label: 'No spelling suggestions',
          enabled: false
        }))
      }
      menu.append(new MenuItem({ type: 'separator' }))
      menu.append(new MenuItem({
        label: 'Add to Dictionary',
        click: () => win?.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
      }))
      menu.append(new MenuItem({ type: 'separator' }))
    }

    // Standard edit actions if editable
    if (params.isEditable) {
      menu.append(new MenuItem({ label: 'Undo', role: 'undo' }))
      menu.append(new MenuItem({ label: 'Redo', role: 'redo' }))
      menu.append(new MenuItem({ type: 'separator' }))
      menu.append(new MenuItem({ label: 'Cut', role: 'cut' }))
      menu.append(new MenuItem({ label: 'Copy', role: 'copy' }))
      menu.append(new MenuItem({ label: 'Paste', role: 'paste' }))
      menu.append(new MenuItem({ label: 'Select All', role: 'selectAll' }))
    } else {
      // Just copy if something is selected but not editable
      if (params.selectionText) {
        menu.append(new MenuItem({ label: 'Copy', role: 'copy' }))
      }
    }

    // Only show the menu if there is something in it
    if (menu.items.length > 0) {
      menu.popup({ window: win! })
    }
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Draftill AI: built-in llama.cpp runtime and encrypted provider configuration.
type AIProvider = 'local' | 'openai' | 'gemini' | 'anthropic' | 'glm' | 'deepseek' | 'moonshot' | 'openrouter' | 'groq' | 'xai' | 'llama' | 'compatible'
type AIConfig = { provider: AIProvider; model: string; endpoint: string }
type AIToolCall = { id: string; function: { name: string; arguments: string } }
type AISource = { title: string; url: string }
type AIGeneratedImage = { dataUrl: string; mime: string; revisedPrompt?: string }
type AIProviderEvent = { name: 'web_search' | 'image_generation'; detail: string }

type LocalModelAsset = { file: string; bytes: number; url: string; sha256: string }
type LocalModel = LocalModelAsset & { id: string; name: string; size: string; note: string; projector: LocalModelAsset; supportsVision: true; supportsReasoning?: true }

const localModelCatalog: LocalModel[] = [
  {
    id: 'gemma-4-e2b-vision',
    name: 'Gemma 4 E2B Vision',
    size: '3.2 GB',
    note: 'Image understanding and built-in thinking',
    supportsVision: true,
    supportsReasoning: true,
    file: 'gemma-4-E2B-it-Q4_0.gguf',
    bytes: 2841481184,
    url: 'https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q4_0.gguf?download=true',
    sha256: '8e30dff3ac4c8434c49a7036fa15564bdbb6044e42bf04550bf1a096ad7e6a52',
    projector: { file: 'mmproj-gemma-4-E2B-it-Q8_0.gguf', bytes: 557368064, url: 'https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF/resolve/main/mmproj-gemma-4-E2B-it-Q8_0.gguf?download=true', sha256: '9406f99c16d68cda4f1f0552192dcc99021ea1fc6d2fd50b1dc3ccf30d04b292' }
  },
  {
    id: 'gemma-4-e4b-vision', name: 'Gemma 4 E4B Vision', size: '4.8 GB', note: 'Higher-quality vision and built-in thinking', supportsVision: true, supportsReasoning: true,
    file: 'gemma-4-E4B-it-Q4_0.gguf', bytes: 4590807392, url: 'https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q4_0.gguf?download=true', sha256: 'a555b900214b477d8880e7832e0b8925e139b0159640036b09fe472b6f2097f2',
    projector: { file: 'mmproj-gemma-4-E4B-it-Q8_0.gguf', bytes: 559874816, url: 'https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/main/mmproj-gemma-4-E4B-it-Q8_0.gguf?download=true', sha256: '197f49a93027f9843772bd24a6a9e0be2a32a788de5a3def330e9c585d86edd1' }
  },
  {
    id: 'gemma-4-12b-vision', name: 'Gemma 4 12B Vision', size: '6.9 GB', note: 'Advanced vision and built-in thinking', supportsVision: true, supportsReasoning: true,
    file: 'gemma-4-12B-it-Q4_0.gguf', bytes: 7219673216, url: 'https://huggingface.co/ggml-org/gemma-4-12B-it-GGUF/resolve/main/gemma-4-12B-it-Q4_0.gguf?download=true', sha256: '3712b9bd32cae83a22f67ee7a4466d8d7a4f21646ac8a07d19bf9418e8767a70',
    projector: { file: 'mmproj-gemma-4-12B-it-Q8_0.gguf', bytes: 158987616, url: 'https://huggingface.co/ggml-org/gemma-4-12B-it-GGUF/resolve/main/mmproj-gemma-4-12B-it-Q8_0.gguf?download=true', sha256: '59e62255435dda870e2d1de97cc031330b31a898bac12b38a182cecff9cd3738' }
  },
  {
    id: 'gemma-4-26b-a4b-vision', name: 'Gemma 4 26B A4B Vision', size: '14.4 GB', note: 'High-capacity vision and built-in thinking', supportsVision: true, supportsReasoning: true,
    file: 'gemma-4-26B-A4B-it-Q4_0.gguf', bytes: 14618145824, url: 'https://huggingface.co/ggml-org/gemma-4-26B-A4B-it-GGUF/resolve/main/gemma-4-26B-A4B-it-Q4_0.gguf?download=true', sha256: 'd208665ab1cd3a69f7a9a4bc59430e8448c8093d9b06334f566ac59d6d504a03',
    projector: { file: 'mmproj-gemma-4-26B-A4B-it-Q8_0.gguf', bytes: 806408320, url: 'https://huggingface.co/ggml-org/gemma-4-26B-A4B-it-GGUF/resolve/main/mmproj-gemma-4-26B-A4B-it-Q8_0.gguf?download=true', sha256: 'cc4e855736da450bf1e162d8cccfe0ad685727d0c9e04ef7dd8d884f3121039b' }
  },
  {
    id: 'gemma-4-31b-vision', name: 'Gemma 4 31B Vision', size: '17.5 GB', note: 'Largest Gemma 4 vision model with thinking', supportsVision: true, supportsReasoning: true,
    file: 'gemma-4-31B-it-Q4_0.gguf', bytes: 17992313088, url: 'https://huggingface.co/ggml-org/gemma-4-31B-it-GGUF/resolve/main/gemma-4-31B-it-Q4_0.gguf?download=true', sha256: '031dc1c5fa9c5a0abbf3c39c5173fb2af65f5ac2dc2a090268561d3c72dcd834',
    projector: { file: 'mmproj-gemma-4-31B-it-Q8_0.gguf', bytes: 809541728, url: 'https://huggingface.co/ggml-org/gemma-4-31B-it-GGUF/resolve/main/mmproj-gemma-4-31B-it-Q8_0.gguf?download=true', sha256: '8872f1dd7ba6a750a039c04b45812511f4ecf004e229420cea58c8049a970fb6' }
  },
  {
    id: 'phi-4-multimodal-vision',
    name: 'Phi-4 Multimodal Vision',
    size: '3.1 GB',
    note: 'Image understanding with text and audio foundation',
    supportsVision: true,
    file: 'phi4-mm-Q4_K_M.gguf',
    bytes: 2493840768,
    url: 'https://huggingface.co/Swicked86/phi4-mm-gguf/resolve/main/phi4-mm-Q4_K_M.gguf?download=true',
    sha256: '3f6ce167990dc4b73dcff7af00c62630c20fb5d40035affdd8bb77ace195c726',
    projector: { file: 'mmproj-phi4-mm-f16.gguf', bytes: 825297088, url: 'https://huggingface.co/Swicked86/phi4-mm-gguf/resolve/main/mmproj-phi4-mm-f16.gguf?download=true', sha256: 'd4a05e61d2485afd651d69bc2a69c1b79e06a6661689523c3a17124cf9cf40a3' }
  }
]
let localServer: ChildProcess | null = null
let activeLocalModel = ''

function aiDataDirectory() { return path.join(app.getPath('userData'), 'ai') }
function aiConfigPath() { return path.join(aiDataDirectory(), 'settings.json') }
function aiSecretsPath() { return path.join(aiDataDirectory(), 'secrets.bin') }
function localModelsDirectory() { return path.join(aiDataDirectory(), 'models') }
function runnerDirectory() { return app.isPackaged ? path.join(process.resourcesPath, 'llama') : path.join(process.env.APP_ROOT!, 'resources', 'llama') }
function readAIConfig(): AIConfig | null {
  try { return JSON.parse(fs.readFileSync(aiConfigPath(), 'utf8')) as AIConfig } catch { return null }
}
function readAPIKey() {
  try {
    if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(aiSecretsPath())) return ''
    return safeStorage.decryptString(fs.readFileSync(aiSecretsPath())).trim()
  } catch { return '' }
}
function saveAIConfig(config: AIConfig, apiKey?: string, clearApiKey?: boolean) {
  fs.mkdirSync(aiDataDirectory(), { recursive: true })
  fs.writeFileSync(aiConfigPath(), JSON.stringify(config, null, 2), 'utf8')
  if (clearApiKey) fs.rmSync(aiSecretsPath(), { force: true })
  else if (apiKey?.trim()) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows secure storage is unavailable on this device.')
    fs.writeFileSync(aiSecretsPath(), safeStorage.encryptString(apiKey.trim()))
  }
}

const screenplayBlockSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['sceneHeading', 'action', 'character', 'dialogue', 'parenthetical', 'transition', 'shot'] },
    text: { type: 'string' }
  },
  required: ['type', 'text']
} as const

const draftillTools = [
  {
    type: 'function',
    function: {
      name: 'edit_screenplay_pages',
      description: 'Write or revise one or several screenplay pages. Use the active page unless the user names another page. A scene location is a sceneHeading block.',
      parameters: { type: 'object', properties: { edits: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'object', properties: { page: { type: 'number' }, mode: { type: 'string', enum: ['append', 'replace_text', 'replace_page'] }, targetText: { type: 'string' }, blocks: { type: 'array', minItems: 1, items: screenplayBlockSchema } }, required: ['page', 'mode', 'blocks'] } } }, required: ['edits'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_scene',
      description: 'Create a formatted scene on a page. heading must be a production slug such as INT. APARTMENT - NIGHT; action is optional.',
      parameters: { type: 'object', properties: { page: { type: 'number' }, locationId: { type: 'string', description: 'Existing Location-library id when available.' }, heading: { type: 'string' }, action: { type: 'string' } }, required: ['page', 'heading'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_freeflow_node',
      description: 'Create, update, or delete a real Freeflow canvas node, including link-preview and checklist nodes. Use supplied node ids for updates and deletes.',
      parameters: { type: 'object', properties: { action: { type: 'string', enum: ['create', 'update', 'delete'] }, id: { type: 'string' }, type: { type: 'string', enum: ['scene', 'shot', 'character', 'note', 'link', 'checklist'] }, title: { type: 'string' }, detail: { type: 'string' }, url: { type: 'string' }, checklist: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, checked: { type: 'boolean' } }, required: ['text'] } }, x: { type: 'number' }, y: { type: 'number' }, width: { type: 'number' } }, required: ['action'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'connect_freeflow_nodes',
      description: 'Connect Freeflow nodes or merge groups, change a connection style, or delete a connection. Groups support three zero-based input and output ports.',
      parameters: { type: 'object', properties: { action: { type: 'string', enum: ['connect', 'update', 'delete'] }, edgeId: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, fromPort: { type: 'number' }, toPort: { type: 'number' }, style: { type: 'string', enum: ['curve', 'straight', 'elbow'] } }, required: ['action'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_character',
      description: 'Create, update, or delete a Character Bible entry. Use the exact existing id for updates and deletes.',
      parameters: { type: 'object', properties: { action: { type: 'string', enum: ['create', 'update', 'delete'] }, id: { type: 'string' }, name: { type: 'string' }, role: { type: 'string' }, description: { type: 'string' }, arc: { type: 'string' }, notes: { type: 'string' } }, required: ['action'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_location',
      description: 'Create, update, or delete a Location-library entry. Use create_scene separately when the location must also be inserted into the screenplay.',
      parameters: { type: 'object', properties: { action: { type: 'string', enum: ['create', 'update', 'delete'] }, id: { type: 'string' }, heading: { type: 'string', description: 'Production slug such as INT. APARTMENT - NIGHT.' }, description: { type: 'string' }, notes: { type: 'string' } }, required: ['action'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_comment',
      description: 'Create, update, or delete a screenplay comment. nodeIndex is the zero-based page index; selectionText anchors a new comment.',
      parameters: { type: 'object', properties: { action: { type: 'string', enum: ['create', 'update', 'delete'] }, id: { type: 'string' }, nodeIndex: { type: 'number' }, text: { type: 'string' }, selectionText: { type: 'string' } }, required: ['action'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_version_checkpoint',
      description: 'Create an explicit named screenplay checkpoint without changing content. Draftill automatically checkpoints only before screenplay mutations.',
      parameters: { type: 'object', properties: { label: { type: 'string' } } }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_editor_settings',
      description: 'Update editor settings only when explicitly requested.',
      parameters: {
        type: 'object',
        properties: {
          wordGoal: { type: 'number' },
          pageGoal: { type: 'number' },
          screenplayFontFamily: { type: 'string', description: 'Installed font family to use across the entire screenplay.' },
          lockSceneNumbers: { type: 'boolean' },
          revisionMode: { type: 'string', enum: ['none', 'blue', 'pink', 'yellow', 'green'] },
          pageBackground: { type: 'string', description: 'Six-digit hex color, e.g. #ffffff.' }
        }
      }
    }
  }
] as const

const draftillToolNames = new Set<string>(draftillTools.map((tool) => tool.function.name))

function normalizeToolCalls(calls: AIToolCall[]) {
  return calls.filter((call) => draftillToolNames.has(call?.function?.name) && typeof call.function.arguments === 'string').slice(0, 16)
}

function dedupeSources(sources: AISource[]) {
  const seen = new Set<string>()
  return sources.filter((source) => {
    try {
      const url = new URL(source.url)
      if (!['http:', 'https:'].includes(url.protocol) || seen.has(url.href)) return false
      seen.add(url.href)
      source.url = url.href
      source.title = source.title.trim().slice(0, 180) || url.hostname
      return true
    } catch { return false }
  }).slice(0, 12)
}

function requestWantsWebSearch(messages: Array<{ role: string; content: string }>) {
  const prompt = [...messages].reverse().find((message) => message.role === 'user')?.content || ''
  return /\b(web|online|internet|search|look\s*up|browse|verify|source|citation|latest|current|today|recent|news|weather|price|release|schedule|trend)\b/i.test(prompt)
}

function requestWantsImageGeneration(messages: Array<{ role: string; content: string }>) {
  const prompt = [...messages].reverse().find((message) => message.role === 'user')?.content || ''
  return /\b(generate|create|draw|design|make|render|illustrate|edit)\b[\s\S]{0,60}\b(image|picture|illustration|concept\s*art|poster|storyboard|frame|photo|visual)\b|\b(image|picture|illustration|concept\s*art|poster|storyboard|frame|photo|visual)\b[\s\S]{0,40}\b(generate|create|draw|design|make|render|edit)\b/i.test(prompt)
}

function openAIResponsesEndpoint(endpoint: string) {
  const cleaned = endpoint.replace(/\/$/, '')
  if (/\/chat\/completions$/i.test(cleaned)) return cleaned.replace(/\/chat\/completions$/i, '/responses')
  if (/\/v1$/i.test(cleaned)) return `${cleaned}/responses`
  return cleaned.includes('/responses') ? cleaned : 'https://api.openai.com/v1/responses'
}

function supportsOpenAIHostedTools(model: string) {
  return /^(gpt-(?:4\.1|4o|5)(?:[-.]|$)|o[34](?:[-.]|$))/i.test(model)
}

function supportsOpenAIImageTool(model: string) {
  return /^(gpt-(?:4\.1|4o|5)(?:[-.]|$)|o3(?:[-.]|$))/i.test(model)
}

function supportsGeminiSearch(model: string) { return /^gemini-(?:2\.0|2\.5|3)/i.test(model) }
function supportsGeminiCombinedTools(model: string) { return /^gemini-3/i.test(model) }
function supportsGeminiImages(model: string) { return /image/i.test(model) }
function supportsAnthropicSearch(model: string) { return /^claude-(?:(?:opus|sonnet|haiku|fable|mythos)-)?(?:[45](?:[-.]|$))/i.test(model) || /^claude-(?:opus|sonnet|haiku|fable|mythos)-(?:[45])/i.test(model) }

function escapeJsonControlCharacters(value: string) {
  let result = ''
  let insideString = false
  let escaped = false
  for (const character of value) {
    if (escaped) { result += character; escaped = false; continue }
    if (character === '\\' && insideString) { result += character; escaped = true; continue }
    if (character === '"') { insideString = !insideString; result += character; continue }
    if (insideString && character === '\n') { result += '\\n'; continue }
    if (insideString && character === '\r') { result += '\\r'; continue }
    if (insideString && character === '\t') { result += '\\t'; continue }
    result += character
  }
  return result
}

function fallbackToolCalls(content: string): { content: string; toolCalls: AIToolCall[] } {
  const tagged = content.match(/<draftill-actions>\s*([\s\S]*?)\s*<\/draftill-actions>/i)
  if (!tagged) return { content, toolCalls: [] }
  try {
    let actions: unknown
    try { actions = JSON.parse(tagged[1]) }
    catch { actions = JSON.parse(escapeJsonControlCharacters(tagged[1])) }
    if (!Array.isArray(actions)) return { content, toolCalls: [] }
    const validNames = new Set(draftillTools.map((tool) => tool.function.name))
    const normalizeLegacyAction = (action: { name: string; arguments?: any }) => {
      const args = action.arguments || {}
      if (action.name === 'append_screenplay_blocks') return { name: 'edit_screenplay_pages', arguments: { edits: [{ mode: 'append', blocks: args.blocks || [] }] } }
      if (action.name === 'update_screenplay_blocks') return { name: 'edit_screenplay_pages', arguments: { edits: [{ mode: args.mode === 'replace_all' ? 'replace_page' : 'replace_text', targetText: args.targetText, blocks: args.blocks || [] }] } }
      if (action.name === 'create_canvas_element') return { name: 'edit_freeflow_node', arguments: { ...args, action: 'create' } }
      if (action.name === 'update_canvas_element') return { name: 'edit_freeflow_node', arguments: args }
      if (action.name === 'create_character') return { name: 'edit_character', arguments: { ...args, action: 'create' } }
      if (action.name === 'update_character') return { name: 'edit_character', arguments: args }
      if (action.name === 'add_comment') return { name: 'edit_comment', arguments: { ...args, action: 'create' } }
      return action
    }
    const toolCalls = actions
      .filter((action): action is { name: string; arguments?: unknown } => action && typeof action.name === 'string')
      .map(normalizeLegacyAction)
      .filter((action) => validNames.has(action.name as any))
      .slice(0, 12)
      .map((action) => ({ id: `fallback_${randomUUID()}`, function: { name: action.name, arguments: JSON.stringify(action.arguments || {}) } }))
    return { content: content.replace(tagged[0], '').trim(), toolCalls }
  } catch {
    return { content: content.replace(tagged[0], '').trim() || 'The model returned an invalid Draftill action, so no project changes were made.', toolCalls: [] }
  }
}
const modelValidationCache = new Map<string, { size: number; modified: number; valid: boolean }>()

function hasExpectedModelShape(filePath: string, expectedBytes: number) {
  try {
    const stat = fs.statSync(filePath)
    if (!stat.isFile() || stat.size !== expectedBytes) return false
    const handle = fs.openSync(filePath, 'r')
    try {
      const header = Buffer.alloc(8)
      if (fs.readSync(handle, header, 0, header.length, 0) !== header.length) return false
      const version = header.readUInt32LE(4)
      return header.subarray(0, 4).toString('ascii') === 'GGUF' && version >= 2 && version <= 3
    } finally {
      fs.closeSync(handle)
    }
  } catch {
    return false
  }
}
async function fileHashMatches(filePath: string, expectedHash: string, expectedBytes: number) {
  if (!hasExpectedModelShape(filePath, expectedBytes)) return false
  const stat = fs.statSync(filePath)
  const cached = modelValidationCache.get(filePath)
  if (cached && cached.size === stat.size && cached.modified === stat.mtimeMs) return cached.valid
  const hash = createHash('sha256')
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk)
  const valid = hash.digest('hex') === expectedHash
  modelValidationCache.set(filePath, { size: stat.size, modified: stat.mtimeMs, valid })
  return valid
}
function localModelAssets(model: LocalModel) { return [{ file: model.file, bytes: model.bytes, url: model.url, sha256: model.sha256 }, model.projector] }
async function localModelIsValid(model: LocalModel) {
  return (await Promise.all(localModelAssets(model).map((asset) => fileHashMatches(path.join(localModelsDirectory(), asset.file), asset.sha256, asset.bytes)))).every(Boolean)
}
async function getInstalledModels() {
  return Promise.all(localModelCatalog.map(async (model) => {
    const installed = await localModelIsValid(model)
    const hasPartialDownload = localModelAssets(model).some((asset) => fs.existsSync(path.join(localModelsDirectory(), asset.file)))
    return { ...model, installed, needsRepair: hasPartialDownload && !installed }
  }))
}
async function waitForLocalServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:51347/health')
      if (response.ok) return
    } catch { /* Runtime is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('Draftill local AI could not start. Please choose a smaller model or restart the app.')
}
async function startLocalServer(modelId: string) {
  const model = localModelCatalog.find((entry) => entry.id === modelId)
  if (!model) throw new Error('Choose a Draftill local model in Settings.')
  const modelPath = path.join(localModelsDirectory(), model.file)
  const projectorPath = path.join(localModelsDirectory(), model.projector.file)
  if (!await localModelIsValid(model)) throw new Error(`${model.name} is corrupted or incomplete. Remove it in Global Settings and download it again.`)
  if (localServer && activeLocalModel === modelId && !localServer.killed) return
  if (localServer && !localServer.killed) localServer.kill()
  const executable = path.join(runnerDirectory(), 'llama-server.exe')
  if (!fs.existsSync(executable)) throw new Error('Draftill local runtime is missing. Reinstall Draftill.')
  localServer = spawn(executable, ['-m', modelPath, '--mmproj', projectorPath, '--host', '127.0.0.1', '--port', '51347', '-c', '16384', '--jinja', '--reasoning', 'auto'], { cwd: runnerDirectory(), windowsHide: true })
  activeLocalModel = modelId
  localServer.once('exit', () => { localServer = null; activeLocalModel = '' })
  await waitForLocalServer()
}

ipcMain.handle('ai:getConfig', async () => ({ config: readAIConfig(), hasApiKey: Boolean(readAPIKey()), secureStorageAvailable: safeStorage.isEncryptionAvailable() }))
ipcMain.handle('ai:saveConfig', async (_event, payload: AIConfig & { apiKey?: string; clearApiKey?: boolean }) => {
  try {
    if (!payload.provider || !payload.model) throw new Error('Choose a provider and model.')
    if (payload.provider === 'local') {
      const localModel = localModelCatalog.find((entry) => entry.id === payload.model)
      if (!localModel || !await localModelIsValid(localModel)) throw new Error('Download a valid local vision model before selecting it.')
    }
    if (payload.provider !== 'local' && !payload.endpoint) throw new Error('Add the provider endpoint.')
    if (payload.provider !== 'local' && !payload.apiKey?.trim() && !readAPIKey()) throw new Error('Add an API key.')
    saveAIConfig({ provider: payload.provider, model: payload.model, endpoint: payload.endpoint }, payload.apiKey, payload.clearApiKey)
    return { success: true }
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Could not save AI settings.' } }
})
ipcMain.handle('ai:getLocalModels', async () => getInstalledModels())
ipcMain.handle('ai:downloadLocalModel', async (_event, modelId: string) => {
  const model = localModelCatalog.find((entry) => entry.id === modelId)
  if (!model) return { success: false, error: 'That model is not in the Draftill catalog.' }
  try {
    fs.mkdirSync(localModelsDirectory(), { recursive: true })
    const assets = localModelAssets(model)
    const total = assets.reduce((sum, asset) => sum + asset.bytes, 0)
    let completedBytes = 0
    for (const asset of assets) {
      const target = path.join(localModelsDirectory(), asset.file)
      const temporary = `${target}.download`
      fs.rmSync(temporary, { force: true })
      const response = await fetch(asset.url, { redirect: 'follow' })
      if (!response.ok || !response.body) throw new Error(`Model download failed (${response.status}).`)
      let received = 0
      const hash = createHash('sha256')
      const stream = Readable.fromWeb(response.body as any)
      const meter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          received += chunk.length
          hash.update(chunk)
          win?.webContents.send('ai:model-download-progress', { modelId, received: completedBytes + received, total })
          callback(null, chunk)
        }
      })
      await pipeline(stream, meter, fs.createWriteStream(temporary))
      const downloadedHash = hash.digest('hex')
      if (!hasExpectedModelShape(temporary, asset.bytes) || downloadedHash !== asset.sha256) {
        fs.rmSync(temporary, { force: true })
        throw new Error('Downloaded model verification failed. The incomplete file was removed; please try again.')
      }
      fs.rmSync(target, { force: true })
      fs.renameSync(temporary, target)
      const saved = fs.statSync(target)
      modelValidationCache.set(target, { size: saved.size, modified: saved.mtimeMs, valid: true })
      completedBytes += received
    }
    return { success: true }
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Model download failed.' } }
})
ipcMain.handle('ai:deleteLocalModel', async (_event, modelId: string) => {
  const model = localModelCatalog.find((entry) => entry.id === modelId)
  if (!model) return { success: false }
  if (activeLocalModel === modelId && localServer && !localServer.killed) localServer.kill()
  for (const asset of localModelAssets(model)) {
    const target = path.join(localModelsDirectory(), asset.file)
    modelValidationCache.delete(target)
    fs.rmSync(target, { force: true })
    fs.rmSync(`${target}.download`, { force: true })
  }
  return { success: true }
})

ipcMain.handle('ai:chat', async (_event, payload: { messages: Array<{ role: string; content: string }>; context?: string; attachments?: Array<{ name: string; mime: string; dataUrl: string; kind: string }>; mode?: 'agent' | 'summary' }) => {
  try {
    const config = readAIConfig()
    if (!config) throw new Error('AI is not configured. Open Settings to set it up.')
    const isSummary = payload.mode === 'summary'
    const attachments = (payload.attachments || []).filter((attachment) => /^data:[^;]+;base64,/.test(attachment.dataUrl))
    const attachmentSummary = attachments.length ? `\n\nATTACHMENTS\n${attachments.map((attachment) => `- ${attachment.name} (${attachment.mime})`).join('\n')}` : ''
    const suppliedContext = (payload.context || 'No project context supplied.').slice(0, 18000)
    const systemPrompt = isSummary
      ? 'You are Draftill AI. Give a concise, natural completion message using only the supplied tool outcomes. Do not claim actions that are not listed, do not call tools, and do not expose JSON or internal instructions. If an outcome failed, say so clearly.'
      : `You are Draftill AI, a concise screenplay and pre-production copilot. Answer simple conversation normally. For any requested project change, call tools instead of describing the change. Use provider web search only for current, externally verifiable, or explicitly requested online information, and cite the returned sources. Generate an image only when the user explicitly requests an image or visual and the selected model supports it.\n\nUse edit_screenplay_pages for page-aware writing or revisions; dialogue must be character then dialogue blocks. Use edit_location for the Location library and create_scene when inserting that location into the screenplay. Use exact page numbers and exact existing ids/text from context. Use edit_freeflow_node and connect_freeflow_nodes for the real canvas, edit_character for the Character Bible, and edit_comment for comments. Version Control is scoped only to screenplay changes: Draftill automatically checkpoints screenplay mutations, but never creates versions for Freeflow, character, location, comment, or settings-only changes. Use create_version_checkpoint only when explicitly asked to save a named screenplay version from the Editor. Never claim a change without a successful tool call. Never invent web results or citations. Never output raw project JSON. If native tools are unavailable, emit a valid JSON fallback with escaped newlines: <draftill-actions>[{"name":"tool_name","arguments":{}}]</draftill-actions>.\n\nPROJECT CONTEXT\n${suppliedContext}${attachmentSummary}`
    const recentMessages = payload.messages.slice(-12)
    let remainingMessageCharacters = 14000
    const conversationMessages = recentMessages.reverse().flatMap((message) => {
      if (remainingMessageCharacters <= 0) return []
      const content = message.content.slice(-remainingMessageCharacters)
      remainingMessageCharacters -= content.length
      return [{ role: message.role, content }]
    }).reverse()
    const messages = [{ role: 'system', content: systemPrompt }, ...conversationMessages]
    const lastUserMessageIndex = conversationMessages.map((message) => message.role).lastIndexOf('user')
    const dataParts = (attachment: { mime: string; dataUrl: string }) => ({ mime: attachment.mime, data: attachment.dataUrl.slice(attachment.dataUrl.indexOf(',') + 1) })
    const openAIStyleMessages = messages.map((message, index) => index > 0 && index - 1 === lastUserMessageIndex && attachments.some((attachment) => attachment.kind === 'image') ? { ...message, content: [{ type: 'text', text: message.content }, ...attachments.filter((attachment) => attachment.kind === 'image').map((attachment) => ({ type: 'image_url', image_url: { url: attachment.dataUrl } }))] } : message)
    const wantsWebSearch = !isSummary && requestWantsWebSearch(conversationMessages)
    const wantsImageGeneration = !isSummary && requestWantsImageGeneration(conversationMessages)
    let response: Response
    let content = ''
    const finalize = (rawContent: string, toolCalls: AIToolCall[], attachmentNotice?: string, reasoning?: string, sources: AISource[] = [], generatedImages: AIGeneratedImage[] = [], providerEvents: AIProviderEvent[] = []) => {
      const normalized = normalizeToolCalls(toolCalls)
      const fallback = normalized.length ? { content: rawContent, toolCalls: normalized } : fallbackToolCalls(rawContent)
      return { success: true, content: fallback.content, toolCalls: fallback.toolCalls, attachmentNotice, reasoning: reasoning?.trim() || undefined, sources: dedupeSources(sources), generatedImages: generatedImages.slice(0, 4), providerEvents }
    }

    if (config.provider === 'local') {
      await startLocalServer(config.model)
      const body: Record<string, unknown> = { messages: openAIStyleMessages, temperature: 0.3, max_tokens: isSummary ? 1200 : 3072 }
      if (!isSummary) Object.assign(body, { tools: draftillTools, tool_choice: 'auto', parallel_tool_calls: true })
      response = await fetch('http://127.0.0.1:51347/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await response.json() as { choices?: Array<{ message?: { content?: string; tool_calls?: AIToolCall[]; reasoning_content?: string; reasoning?: string } }>; error?: { message?: string } }
      if (!response.ok) throw new Error(data.error?.message || 'Local model request failed.')
      const message = data.choices?.[0]?.message
      content = message?.content || ''
      return finalize(content, message?.tool_calls || [], attachments.some((attachment) => attachment.kind !== 'image') ? 'Local vision models can analyse image attachments. Audio and video need a cloud multimodal model.' : undefined, message?.reasoning_content || message?.reasoning)
    } else if (config.provider === 'openai') {
      const responseTools: Array<Record<string, unknown>> = []
      if (!isSummary) responseTools.push(...draftillTools.map((tool) => ({ type: 'function', name: tool.function.name, description: tool.function.description, parameters: tool.function.parameters })))
      if (wantsWebSearch && supportsOpenAIHostedTools(config.model)) responseTools.push({ type: 'web_search', search_context_size: 'medium' })
      if (wantsImageGeneration && supportsOpenAIImageTool(config.model)) responseTools.push({ type: 'image_generation', quality: 'medium', size: 'auto' })
      const responseInput = conversationMessages.map((message, index) => index === lastUserMessageIndex && attachments.some((attachment) => attachment.kind === 'image')
        ? { role: message.role, content: [{ type: 'input_text', text: message.content }, ...attachments.filter((attachment) => attachment.kind === 'image').map((attachment) => ({ type: 'input_image', image_url: attachment.dataUrl }))] }
        : { role: message.role, content: message.content })
      const responsesBody: Record<string, unknown> = { model: config.model, instructions: systemPrompt, input: responseInput, max_output_tokens: isSummary ? 1200 : 4096 }
      if (responseTools.length) Object.assign(responsesBody, { tools: responseTools, tool_choice: 'auto', parallel_tool_calls: true })
      if (responseTools.some((tool) => tool.type === 'web_search')) responsesBody.include = ['web_search_call.action.sources']
      response = await fetch(openAIResponsesEndpoint(config.endpoint), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${readAPIKey()}` }, body: JSON.stringify(responsesBody) })
      let data = await response.json() as any
      if (!response.ok) {
        const fallbackEndpoint = config.endpoint.replace(/\/responses\/?$/i, '/chat/completions')
        const fallbackBody: Record<string, unknown> = { model: config.model, messages: openAIStyleMessages, temperature: 0.3, max_tokens: isSummary ? 1200 : 4096 }
        if (!isSummary) Object.assign(fallbackBody, { tools: draftillTools, tool_choice: 'auto', parallel_tool_calls: true })
        const fallbackResponse = await fetch(fallbackEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${readAPIKey()}` }, body: JSON.stringify(fallbackBody) })
        const fallbackData = await fallbackResponse.json() as any
        if (!fallbackResponse.ok) throw new Error(fallbackData.error?.message || data.error?.message || 'OpenAI request failed.')
        const fallbackMessage = fallbackData.choices?.[0]?.message
        return finalize(fallbackMessage?.content || '', fallbackMessage?.tool_calls || [], wantsImageGeneration || wantsWebSearch ? 'The selected OpenAI model used its compatible chat mode, so hosted web and image tools were unavailable for this response.' : undefined, fallbackMessage?.reasoning_content || fallbackMessage?.reasoning)
      }
      const output = Array.isArray(data.output) ? data.output : []
      const messageParts = output.filter((item: any) => item.type === 'message').flatMap((item: any) => Array.isArray(item.content) ? item.content : [])
      content = messageParts.filter((part: any) => part.type === 'output_text' || part.type === 'text').map((part: any) => part.text || '').join('')
      const toolCalls = output.flatMap((item: any) => item.type === 'function_call' && item.name ? [{ id: item.call_id || item.id || `openai_${randomUUID()}`, function: { name: item.name, arguments: typeof item.arguments === 'string' ? item.arguments : JSON.stringify(item.arguments || {}) } }] : [])
      const webCalls = output.filter((item: any) => item.type === 'web_search_call')
      const imageCalls = output.filter((item: any) => item.type === 'image_generation_call' && typeof item.result === 'string')
      const sources: AISource[] = [
        ...messageParts.flatMap((part: any) => (part.annotations || []).flatMap((annotation: any) => annotation.type === 'url_citation' && annotation.url ? [{ title: annotation.title || annotation.url, url: annotation.url }] : [])),
        ...webCalls.flatMap((item: any) => (item.action?.sources || []).flatMap((source: any) => source.url ? [{ title: source.title || source.url, url: source.url }] : []))
      ]
      const generatedImages = imageCalls.map((item: any) => ({ dataUrl: `data:image/png;base64,${item.result}`, mime: 'image/png', revisedPrompt: typeof item.revised_prompt === 'string' ? item.revised_prompt : undefined }))
      const providerEvents: AIProviderEvent[] = [
        ...webCalls.map((item: any) => ({ name: 'web_search' as const, detail: item.action?.query ? `Searched the web for: ${item.action.query}` : 'Searched the web and checked current sources' })),
        ...imageCalls.map(() => ({ name: 'image_generation' as const, detail: 'Generated an image with the selected OpenAI model' }))
      ]
      const reasoning = output.filter((item: any) => item.type === 'reasoning').flatMap((item: any) => item.summary || []).map((item: any) => item.text || '').join('\n')
      return finalize(content, toolCalls, attachments.some((attachment) => attachment.kind !== 'image') ? 'OpenAI image inputs were included. Audio and video attachments depend on the selected model.' : undefined, reasoning, sources, generatedImages, providerEvents)
    } else if (config.provider === 'gemini') {
      const apiKey = readAPIKey()
      const base = config.endpoint.replace(/\/$/, '')
      const functionTool = { functionDeclarations: draftillTools.map((tool) => ({ name: tool.function.name, description: tool.function.description, parameters: tool.function.parameters })) }
      const geminiTools: Array<Record<string, unknown>> = []
      if (!isSummary && !(wantsWebSearch && !supportsGeminiCombinedTools(config.model)) && !(wantsImageGeneration && supportsGeminiImages(config.model))) geminiTools.push(functionTool)
      if (wantsWebSearch && supportsGeminiSearch(config.model)) geminiTools.push({ googleSearch: {} })
      const generationConfig: Record<string, unknown> = { temperature: 0.3, maxOutputTokens: isSummary ? 1200 : 4096 }
      if (wantsImageGeneration && supportsGeminiImages(config.model)) generationConfig.responseModalities = ['TEXT', 'IMAGE']
      const requestBody: Record<string, unknown> = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: conversationMessages.map((message, index) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }, ...(index === lastUserMessageIndex ? attachments.map((attachment) => ({ inlineData: { mimeType: dataParts(attachment).mime, data: dataParts(attachment).data } })) : [])] })),
        generationConfig
      }
      if (geminiTools.length) requestBody.tools = geminiTools
      if (geminiTools.some((tool) => 'functionDeclarations' in tool)) requestBody.toolConfig = { functionCallingConfig: { mode: 'AUTO' } }
      response = await fetch(`${base}/models/${config.model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })
      const data = await response.json() as any
      if (!response.ok) throw new Error(data.error?.message || 'Gemini request failed.')
      const candidate = data.candidates?.[0] || {}
      const parts = candidate.content?.parts || []
      content = parts.filter((part: any) => !part.thought).map((part: any) => part.text || '').join('')
      const reasoning = parts.filter((part: any) => part.thought).map((part: any) => part.text || '').join('\n').trim()
      const toolCalls = parts.flatMap((part: any) => part.functionCall?.name ? [{ id: `gemini_${randomUUID()}`, function: { name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args || {}) } }] : [])
      const generatedImages = parts.flatMap((part: any) => part.inlineData?.data ? [{ dataUrl: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`, mime: part.inlineData.mimeType || 'image/png' }] : [])
      const grounding = candidate.groundingMetadata || {}
      const sources: AISource[] = (grounding.groundingChunks || []).flatMap((chunk: any) => chunk.web?.uri ? [{ title: chunk.web.title || chunk.web.uri, url: chunk.web.uri }] : [])
      const providerEvents: AIProviderEvent[] = [
        ...((grounding.webSearchQueries || []).length ? [{ name: 'web_search' as const, detail: `Searched Google for: ${(grounding.webSearchQueries || []).join(', ')}` }] : []),
        ...(generatedImages.length ? [{ name: 'image_generation' as const, detail: 'Generated an image with the selected Gemini image model' }] : [])
      ]
      return finalize(content, toolCalls, undefined, reasoning, sources, generatedImages, providerEvents)
    } else if (config.provider === 'anthropic') {
      const anthropicTools: Array<Record<string, unknown>> = []
      if (!isSummary) anthropicTools.push(...draftillTools.map((tool) => ({ name: tool.function.name, description: tool.function.description, input_schema: tool.function.parameters })))
      if (wantsWebSearch && supportsAnthropicSearch(config.model)) anthropicTools.push({ type: 'web_search_20250305', name: 'web_search', max_uses: 5 })
      const anthropicBody: Record<string, unknown> = { model: config.model, max_tokens: isSummary ? 1200 : 4096, system: systemPrompt, messages: conversationMessages.map((message, index) => index === lastUserMessageIndex && attachments.some((attachment) => attachment.kind === 'image') ? { ...message, content: [...attachments.filter((attachment) => attachment.kind === 'image').map((attachment) => ({ type: 'image', source: { type: 'base64', media_type: dataParts(attachment).mime, data: dataParts(attachment).data } })), { type: 'text', text: message.content }] } : message) }
      if (anthropicTools.length) anthropicBody.tools = anthropicTools
      response = await fetch(config.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': readAPIKey(), 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(anthropicBody)
      })
      const data = await response.json() as any
      if (!response.ok) throw new Error(data.error?.message || 'Anthropic request failed.')
      content = data.content?.filter((item: any) => item.type === 'text').map((item: any) => item.text || '').join('') || ''
      const reasoning = data.content?.filter((item: any) => item.type === 'thinking').map((item: any) => item.thinking || '').join('\n').trim()
      const toolCalls = (data.content || []).flatMap((item: any) => item.type === 'tool_use' && item.name ? [{ id: item.id || `anthropic_${randomUUID()}`, function: { name: item.name, arguments: JSON.stringify(item.input || {}) } }] : [])
      const sources: AISource[] = (data.content || []).flatMap((item: any) => [
        ...(item.citations || []).flatMap((citation: any) => citation.url ? [{ title: citation.title || citation.url, url: citation.url }] : []),
        ...(item.type === 'web_search_tool_result' && Array.isArray(item.content) ? item.content.flatMap((result: any) => result.url ? [{ title: result.title || result.url, url: result.url }] : []) : [])
      ])
      const searchCalls = (data.content || []).filter((item: any) => item.type === 'server_tool_use' && item.name === 'web_search')
      const providerEvents: AIProviderEvent[] = searchCalls.map((item: any) => ({ name: 'web_search', detail: item.input?.query ? `Searched the web for: ${item.input.query}` : 'Searched the web and checked current sources' }))
      return finalize(content, toolCalls, undefined, reasoning, sources, [], providerEvents)
    } else {
      const compatibleBody: Record<string, unknown> = { model: config.model, messages: openAIStyleMessages, temperature: 0.3, max_tokens: isSummary ? 1200 : 4096 }
      if (!isSummary) Object.assign(compatibleBody, { tools: draftillTools, tool_choice: 'auto', parallel_tool_calls: true })
      response = await fetch(config.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${readAPIKey()}` },
        body: JSON.stringify(compatibleBody)
      })
      const data = await response.json() as { choices?: Array<{ message?: { content?: string; tool_calls?: AIToolCall[]; reasoning_content?: string; reasoning?: string } }>; error?: { message?: string } }
      if (!response.ok) throw new Error(data.error?.message || 'AI provider request failed.')
      const message = data.choices?.[0]?.message
      content = message?.content || ''
      return finalize(content, message?.tool_calls || [], undefined, message?.reasoning_content || message?.reasoning)
    }
    return { success: true, content: content || 'The model returned an empty response.' }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'AI request failed.' }
  }
})

ipcMain.handle('ai:saveGeneratedImage', async (_event, payload: { dataUrl?: string; mime?: string; suggestedName?: string }) => {
  try {
    const match = payload.dataUrl?.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/)
    if (!match) throw new Error('The generated image data is invalid.')
    const buffer = Buffer.from(match[2], 'base64')
    if (!buffer.length || buffer.length > 32 * 1024 * 1024) throw new Error('The generated image is empty or too large to save.')
    const extension = match[1] === 'image/jpeg' ? 'jpg' : match[1].split('/')[1]
    const suggestedName = (payload.suggestedName || `Draftill-AI-${Date.now()}`).replace(/[^a-z0-9 _-]/gi, '').trim().slice(0, 80) || 'Draftill-AI'
    const result = await dialog.showSaveDialog(win!, { defaultPath: `${suggestedName}.${extension}`, filters: [{ name: 'Generated image', extensions: [extension] }] })
    if (result.canceled || !result.filePath) return { success: false, canceled: true }
    fs.writeFileSync(result.filePath, buffer)
    return { success: true, filePath: result.filePath }
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Could not save the generated image.' } }
})

ipcMain.handle('file:open', async () => {
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openFile'],
    filters: [
      { name: 'Draftill Scripts', extensions: ['drftl', 'fountain', 'fdx', 'fdxt', 'txt'] }
    ]
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  const filePath = result.filePaths[0]
  const content = fs.readFileSync(filePath, 'utf-8')
  return {
    filePath,
    name: path.basename(filePath),
    content
  }
})

ipcMain.handle('file:save', async (_, filePath: string, content: string) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8')
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('file:saveAs', async (_, content: string, defaultName: string) => {
  const result = await dialog.showSaveDialog(win!, {
    defaultPath: defaultName,
    filters: [
      { name: 'Draftill Script (.drftl)', extensions: ['drftl'] },
      { name: 'Fountain Screenplay (.fountain)', extensions: ['fountain'] },
      { name: 'Final Draft (.fdx)', extensions: ['fdx'] },
      { name: 'Plain Text (.txt)', extensions: ['txt'] },
      { name: 'HTML Document (.html)', extensions: ['html'] }
    ]
  })
  if (result.canceled || !result.filePath) {
    return null
  }
  fs.writeFileSync(result.filePath, content, 'utf-8')
  return {
    filePath: result.filePath,
    name: path.basename(result.filePath)
  }
})

ipcMain.handle('file:exportPdf', async (_, payload: { html: string, defaultName: string }) => {
  const result = await dialog.showSaveDialog(win!, {
    defaultPath: payload.defaultName,
    filters: [{ name: 'PDF Document (.pdf)', extensions: ['pdf'] }]
  })
  if (result.canceled || !result.filePath) return null

  const printWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
  try {
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(payload.html)}`)
    const pdf = await printWindow.webContents.printToPDF({ pageSize: 'Letter', printBackground: true })
    fs.writeFileSync(result.filePath, pdf)
    return { filePath: result.filePath, name: path.basename(result.filePath) }
  } finally {
    if (!printWindow.isDestroyed()) printWindow.close()
  }
})

// File lock manager. Keep runtime lock files in Draftill's private app-data
// directory so screenplay folders contain only the user's actual documents.
function getInternalLockPath(filePath: string) {
  const normalizedPath = path.resolve(filePath).toLowerCase()
  const lockId = createHash('sha256').update(normalizedPath).digest('hex')
  const lockDirectory = path.join(app.getPath('userData'), 'locks')
  fs.mkdirSync(lockDirectory, { recursive: true })
  return path.join(lockDirectory, `${lockId}.lock`)
}

function removeLegacyVisibleLock(filePath: string) {
  const legacyLockPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.lock`)
  if (fs.existsSync(legacyLockPath)) fs.unlinkSync(legacyLockPath)
}

ipcMain.handle('lock:acquire', async (_, filePath: string, username: string) => {
  try {
    removeLegacyVisibleLock(filePath)
    const lockPath = getInternalLockPath(filePath)
    if (fs.existsSync(lockPath)) {
      const lockData = fs.readFileSync(lockPath, 'utf-8')
      const parsed = JSON.parse(lockData)
      if (parsed.username !== username) {
        return { locked: true, owner: parsed.username }
      }
    }
    // Create lock
    fs.writeFileSync(lockPath, JSON.stringify({ filePath: path.resolve(filePath), username, timestamp: Date.now() }))
    return { locked: false }
  } catch (e: any) {
    return { locked: false, error: e.message }
  }
})

ipcMain.handle('lock:release', async (_, filePath: string) => {
  try {
    removeLegacyVisibleLock(filePath)
    const lockPath = getInternalLockPath(filePath)
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath)
    }
    return { success: true }
  } catch (e) {
    return { success: false }
  }
})

// Git Operations
function runGitCommand(cwd: string, args: string): string {
  try {
    return execSync(`git ${args}`, { cwd, encoding: 'utf-8', stdio: 'pipe' })
  } catch (e: any) {
    return ''
  }
}

function getScreenplayHistoryPath(filePath: string) {
  const versionId = createHash('sha256').update(path.resolve(filePath).toLowerCase()).digest('hex').slice(0, 16)
  const relativePath = `.draftill-version-control/${versionId}.screenplay.json`
  return { relativePath, absolutePath: path.join(path.dirname(filePath), '.draftill-version-control', `${versionId}.screenplay.json`) }
}

ipcMain.handle('git:init', async (_, dirPath: string) => {
  try {
    if (!fs.existsSync(path.join(dirPath, '.git'))) {
      runGitCommand(dirPath, 'init')
      runGitCommand(dirPath, 'config user.name "Draftill User"')
      runGitCommand(dirPath, 'config user.email "user@draftill.local"')
    }
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('git:commit', async (_, filePath: string, message: string, screenplayContent: string) => {
  try {
    const dir = path.dirname(filePath)
    const historyPath = getScreenplayHistoryPath(filePath)
    const git = (args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf-8', stdio: 'pipe', windowsHide: true })

    if (!screenplayContent) throw new Error('Screenplay content is required for a version checkpoint.')
    const parsedContent = JSON.parse(screenplayContent)
    const screenplaySnapshot = parsedContent?.scriptContent ? parsedContent : { scriptContent: parsedContent }
    fs.mkdirSync(path.dirname(historyPath.absolutePath), { recursive: true })
    fs.writeFileSync(historyPath.absolutePath, JSON.stringify({
      scriptContent: screenplaySnapshot.scriptContent,
      checkpoint: { id: randomUUID(), createdAt: new Date().toISOString() }
    }), 'utf-8')

    // Init git repo if missing
    if (!fs.existsSync(path.join(dir, '.git'))) {
      git(['init'])
      git(['config', 'user.name', 'Draftill User'])
      git(['config', 'user.email', 'user@draftill.local'])
    }

    // Version Control deliberately tracks only the screenplay snapshot. The
    // project file can keep changing without pulling Freeflow or library data
    // into screenplay history.
    git(['add', '-f', '--', historyPath.relativePath])
    git(['commit', '-m', message.slice(0, 120) || 'Draftill checkpoint', '--', historyPath.relativePath])
    return { success: true }
  } catch (e: any) {
    const stderr = typeof e?.stderr === 'string' ? e.stderr.trim() : ''
    return { success: false, error: stderr || e.message }
  }
})

ipcMain.handle('git:log', async (_, filePath: string) => {
  try {
    const dir = path.dirname(filePath)
    const fileName = path.basename(filePath)
    const historyPath = getScreenplayHistoryPath(filePath)

    if (!fs.existsSync(path.join(dir, '.git'))) {
      return []
    }
    // Include the legacy project-file path so screenplay checkpoints created
    // by older Draftill versions remain available.
    const logOut = execFileSync('git', ['log', '--pretty=format:%h|%s|%ad|%an', '--date=short', '--', historyPath.relativePath, fileName], { cwd: dir, encoding: 'utf-8', stdio: 'pipe', windowsHide: true })
    if (!logOut) return []

    return logOut.split('\n').map((line) => {
      const [hash, msg, date, author] = line.split('|')
      return { hash, message: msg, date, author }
    })
  } catch (e) {
    return []
  }
})

ipcMain.handle('git:show', async (_, filePath: string, hash: string) => {
  try {
    const dir = path.dirname(filePath)
    const fileName = path.basename(filePath)
    const historyPath = getScreenplayHistoryPath(filePath)
    const git = (args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf-8', stdio: 'pipe', windowsHide: true })
    try {
      return git(['show', `${hash}:${historyPath.relativePath}`]) || null
    } catch {
      // Backward compatibility for checkpoints that previously stored the
      // complete project file. The renderer extracts only scriptContent.
      return git(['show', `${hash}:${fileName}`]) || null
    }
  } catch (e) {
    return null
  }
})

// Auto-backup snapshots
ipcMain.handle('backup:save', async (_, filePath: string, content: string) => {
  try {
    const dir = path.dirname(filePath)
    const backupDir = path.join(dir, '.draftill-backup')
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const baseName = path.basename(filePath, path.extname(filePath))
    const ext = path.extname(filePath)
    const backupPath = path.join(backupDir, `${baseName}-${timestamp}${ext}`)
    fs.writeFileSync(backupPath, content, 'utf-8')
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})

// Local FileSystem Workspace handlers
function isScriptFile(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  return ['.drftl', '.fountain', '.fdx', '.txt'].includes(ext);
}

function getTemplateNameByExt(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.drftl') return 'Draftill Screenplay';
  if (ext === '.fountain') return 'Fountain Screenplay';
  if (ext === '.fdx') return 'Final Draft Screenplay';
  return 'Plain Text Screenplay';
}

ipcMain.handle('workspace:getDefault', async () => {
  const defaultPath = path.join(app.getPath('documents'), 'Draftill Workspace');
  if (!fs.existsSync(defaultPath)) {
    fs.mkdirSync(defaultPath, { recursive: true });
  }
  return defaultPath;
})

ipcMain.handle('workspace:select', async () => {
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
})

ipcMain.handle('workspace:scan', async (_, workspacePath: string) => {
  try {
    if (!fs.existsSync(workspacePath)) {
      fs.mkdirSync(workspacePath, { recursive: true });
    }
    const items = fs.readdirSync(workspacePath, { withFileTypes: true });
    const folders: any[] = [];
    const projects: any[] = [];

    for (const item of items) {
      if (item.isDirectory()) {
        if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === '.draftill-backup') continue;

        const folderPath = path.join(workspacePath, item.name);
        folders.push({
          id: item.name,
          name: item.name,
          createdAt: fs.statSync(folderPath).birthtimeMs
        });

        // Scan scripts inside subfolder
        const subItems = fs.readdirSync(folderPath, { withFileTypes: true });
        for (const subItem of subItems) {
          if (subItem.isFile() && isScriptFile(subItem.name)) {
            const filePath = path.join(folderPath, subItem.name);
            const stats = fs.statSync(filePath);
            projects.push({
              id: filePath,
              name: path.basename(subItem.name, path.extname(subItem.name)),
              folderId: item.name,
              createdAt: stats.birthtimeMs,
              updatedAt: stats.mtimeMs,
              templateName: getTemplateNameByExt(subItem.name)
            });
          }
        }
      } else if (item.isFile() && isScriptFile(item.name)) {
        const filePath = path.join(workspacePath, item.name);
        const stats = fs.statSync(filePath);
        projects.push({
          id: filePath,
          name: path.basename(item.name, path.extname(item.name)),
          folderId: null,
          createdAt: stats.birthtimeMs,
          updatedAt: stats.mtimeMs,
          templateName: getTemplateNameByExt(item.name)
        });
      }
    }
    return { folders, projects };
  } catch (e: any) {
    console.error(e);
    return { folders: [], projects: [] };
  }
})

ipcMain.handle('workspace:createFolder', async (_, workspacePath: string, folderName: string) => {
  try {
    const folderPath = path.join(workspacePath, folderName);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
})

ipcMain.handle('workspace:createProject', async (_, filePath: string, content: string) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
})

ipcMain.handle('workspace:delete', async (_, targetPath: string) => {
  try {
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
})

ipcMain.handle('workspace:rename', async (_, oldPath: string, newPath: string) => {
  try {
    fs.renameSync(oldPath, newPath);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
})

ipcMain.handle('workspace:move', async (_, oldPath: string, newPath: string) => {
  try {
    fs.renameSync(oldPath, newPath);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
})

ipcMain.handle('workspace:readProject', async (_, filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    return null;
  } catch (e) {
    return null;
  }
})

ipcMain.handle('workspace:writeProject', async (_, filePath: string, content: string) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
})

// Custom window controls IPC
ipcMain.handle('window:minimize', () => {
  win?.minimize()
})
ipcMain.handle('window:toggle-maximize', () => {
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
    return win.isMaximized()
  }
  return false
})
ipcMain.handle('window:close', () => {
  win?.close()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  // Use Draftill's identity for Windows taskbar and jump-list entries.
  app.setAppUserModelId('com.draftill.app')
  app.name = 'Draftill'
  createWindow()
  if (initialAssociatedFile) openAssociatedFile(initialAssociatedFile)
})
