const { contextBridge, ipcRenderer } = require('electron')

// 桥接渲染进程与主进程
contextBridge.exposeInMainWorld('electron', {
  startDrag: (fileName) => {
    ipcRenderer.send('drag-start', fileName)
  },
  requestMainData: () => {
    return new Promise((resolve) => {
      ipcRenderer.send('request-data');
      ipcRenderer.once('response-data', (event, data) => {
        resolve(data);
      });
    });
  },
  // getImageData: () => {
  //   return ipcRenderer.sendSync('getGlobalVariable');
  //   // return global;
  // }
})

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  ping: () => ipcRenderer.invoke('ping'),
})

// not accessibleby web context
// function nativeQuery(params) {
//   console.log('get nativeQuery params', params)
// }

// window.nativeQuery = nativeQuery;

console.log('preload.js')
// 在contextBridge中暴露ipcRenderer，以确保安全性
contextBridge.exposeInMainWorld('ipcRenderer', {
  send: (channel, data) => {
    ipcRenderer.send(channel, data);
  },
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  }
});

function listenChannelPort() {
   // port 类型必须用 message channel 传递（带 message 的方法）
    window.onmessage = function (e) {
        if (e.data === 'trans-port') {
            const port = e.ports[0];
            ipcRenderer.postMessage('mainprocess:trans-port', null, [port]);
        }
    };
}
listenChannelPort();
