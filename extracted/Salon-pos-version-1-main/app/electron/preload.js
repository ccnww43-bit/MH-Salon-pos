const { contextBridge, ipcRenderer } = require('electron');

// Exposes a single, safe, read-only function to the app's web page:
// window.mhDigitalPOS.getMachineId(). Nothing else from Node or Electron
// is exposed, so the rest of the app still runs fully sandboxed.
contextBridge.exposeInMainWorld('mhDigitalPOS', {
  getMachineId: () => ipcRenderer.invoke('mh-digital-get-machine-id'),
});
