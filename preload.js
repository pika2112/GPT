const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktopApp', true);
contextBridge.exposeInMainWorld('desktopSettings', {
    getStartup: () => ipcRenderer.invoke('faria:get-startup'),
    setStartup: enabled => ipcRenderer.invoke('faria:set-startup', enabled)
});
