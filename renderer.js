// import { shell } from 'electron';
/**
 * This file is loaded via the <script> tag in the index.html file and will
 * be executed in the renderer process for that window. No Node.js APIs are
 * available in this process because `nodeIntegration` is turned off and
 * `contextIsolation` is turned on. Use the contextBridge API in `preload.js`
 * to expose Node.js functionality from the main process.
 */
document.getElementById('big-file').ondragstart = (event) => {
  event.preventDefault()
    console.log('start drag')
  window.electron.startDrag('bigFile.mp4')
}

document.getElementById('big-file').ondragend = (event) => {
    console.log(event)
}

document.getElementById('drag1').ondragstart = (event) => {
  event.preventDefault()
  window.electron.startDrag('drag-and-drop-1.md')
}

document.getElementById('drag2').ondragstart = (event) => {
  event.preventDefault()
  window.electron.startDrag('drag-and-drop-2.md')
}

// document.getElementById('open-1').onclick = () => {
    // window.open('https://baidu.com')
// }

// document.getElementById('open-2').onclick = () => {
    // shell.openExternal('https://github.com')
// }
