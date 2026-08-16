const { contextBridge } = require('electron');

// Expose safe platform metadata to client application if needed
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isDesktop: true,
});
