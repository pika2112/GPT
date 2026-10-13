const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('desktopApp', true);
