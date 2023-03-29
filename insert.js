// const { contextBridge, ipcRenderer } = require('electron')

// // only work when contextIsolation: true
// contextBridge.exposeInMainWorld('electron', {
//     preloaded: Date.now()
// })

function commonInject(params) {
    console.log('get nativeQuery params', params)
}

// only work when contextIsolation: false and webview webpreferences="contextIsolation=no"
// window.nativeQuery = commonInject;
window.preloaded = Date.now()

console.log('insert.js')

setInterval(() => {
    console.log('insert.js ', window.test) // 可以访问到 web 赋值，被远程利用
  }, 2000)