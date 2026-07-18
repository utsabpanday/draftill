import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { useAppStore } from './store/store.ts'

// Draftill is dark-only. Clear any preference left by older builds before render.
localStorage.removeItem('draftill_dark_mode')
document.documentElement.classList.add('dark')
document.body.classList.add('dark')
document.documentElement.style.colorScheme = 'dark'
useAppStore.setState({ isDarkMode: true })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Use contextBridge
window.ipcRenderer.on('main-process-message', (_event, message) => {
  console.log(message)
})
