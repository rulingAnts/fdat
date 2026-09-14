// Bridge between the bundled renderer and the LCM sidecar (via the main process).
// Everything here is Promise-based and limited to the methods main.js allows.
const { contextBridge, ipcRenderer } = require('electron');

const rpc = (method, params) => ipcRenderer.invoke('fdat:rpc', method, params);

contextBridge.exposeInMainWorld('fdatHost', {
  version: 1,
  ping: () => rpc('ping'),
  listProjects: () => rpc('listProjects'),
  openProject: (name, write = false) => rpc('openProject', { name, write }),
  closeProject: () => rpc('closeProject'),
  listCharts: () => rpc('listCharts'),
  getChartXml: (guid) => rpc('exportChart', { guid })
});
