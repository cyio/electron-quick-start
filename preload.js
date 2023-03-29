// const { contextBridge, ipcRenderer } = require('electron')

// // 桥接渲染进程与主进程
// contextBridge.exposeInMainWorld('electron', {
//   startDrag: (fileName) => {
//     ipcRenderer.send('drag-start', fileName)
//   }
// })

// contextBridge.exposeInMainWorld('versions', {
//   node: () => process.versions.node,
//   chrome: () => process.versions.chrome,
//   electron: () => process.versions.electron,
//   ping: () => ipcRenderer.invoke('ping'),
// })

// not accessibleby web context
// function nativeQuery(params) {
//   console.log('get nativeQuery params', params)
// }

// window.nativeQuery = nativeQuery;

console.log('preload.js ', ['1', '2'].join(','))
setInterval(() => {
  console.log('preload.js ', window.test) // 访问不到
}, 2000)