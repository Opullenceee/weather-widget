const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('widgetAPI', {
  hideToTray: () => ipcRenderer.send('widget:minimize-to-tray'),
  closeApp: () => ipcRenderer.send('widget:close-app'),
});