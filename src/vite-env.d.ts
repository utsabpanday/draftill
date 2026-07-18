/// <reference types="vite/client" />

interface Window {
  ipcRenderer: {
    on: (channel: string, listener: (...args: any[]) => void) => any;
    off: (channel: string, ...args: any[]) => any;
    send: (channel: string, ...args: any[]) => any;
    invoke: (channel: string, ...args: any[]) => Promise<any>;
  };
}
