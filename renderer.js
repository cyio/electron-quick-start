// import { ipcRenderer } from 'electron';
// const { ipcRenderer } = require('electron')

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

// 初始化鼠标坐标传输
function initMouseCoordinatesTransfer() {
  // 创建MessageChannel
  const messageChannel = new MessageChannel();
  const port1 = messageChannel.port1;
  const port2 = messageChannel.port2;

  // 将port2发送给主进程
  window.postMessage('trans-port', '*', [port2]);
  
  // 获取显示鼠标坐标的元素
  const mouseCoordinatesElement = document.getElementById('mouse-coordinates');
  
  // 监听鼠标移动事件
  document.addEventListener('mousemove', (event) => {
    const coordinates = {
      x: event.clientX,
      y: event.clientY
    };
    
    // 更新页面上的鼠标坐标显示
    mouseCoordinatesElement.textContent = `鼠标坐标: x=${coordinates.x}, y=${coordinates.y}`;
    
    // 发送鼠标坐标到主进程
    port1.postMessage(coordinates);
  });
  
  console.log('鼠标坐标传输已初始化');
}

// 页面加载完成后初始化鼠标坐标传输
document.addEventListener('DOMContentLoaded', initMouseCoordinatesTransfer);

// document.getElementById('open-1').onclick = () => {
    // window.open('https://baidu.com')
// }

// document.getElementById('open-2').onclick = () => {
    // shell.openExternal('https://github.com')
// }


document.getElementById('large-data-transfer').onclick = async () => {
  // 发送请求获取图片的RGBA数据
  // window.ipcRenderer.send('get-image-data');
  console.time('get-image-data')

  console.time('requestMainData');
  const mainData = await window.electron.requestMainData();
  console.timeEnd('requestMainData');
  console.log('Received data in renderer process:', mainData);
  renderImageData(mainData);
}

// 监听主进程回复的消息
window.ipcRenderer.receive('image-data', (imageData) => {
  // 在这里处理接收到的RGBA数据
  // console.log('Received RGBA data in renderer process:', imageData);
  console.timeEnd('get-image-data')
  console.time('render-image-data')

  // 这里可以进行其他操作，例如将RGBA数据渲染到Canvas上
  renderImageData(imageData);
});


// 示例：将RGBA数据渲染到Canvas上
function renderImageData(imageData) {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  document.body.appendChild(canvas);

  const context = canvas.getContext('2d');
  const imageDataArray = new Uint8ClampedArray(imageData.data);
  const newImageData = new ImageData(imageDataArray, imageData.width, imageData.height);

  context.putImageData(newImageData, 0, 0);
  console.timeEnd('render-image-data')
}
