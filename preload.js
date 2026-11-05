const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktopApp', true);
contextBridge.exposeInMainWorld('desktopSettings', {
    getStartup: () => ipcRenderer.invoke('chamadas:get-startup'),
    setStartup: enabled => ipcRenderer.invoke('chamadas:set-startup', enabled)
});
