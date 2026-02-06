const { app, BrowserWindow, ipcMain, nativeImage, NativeImage } = require('electron')

// Log uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

const path = require('path')
const fs = require('fs')
const https = require('https')

// 存储上一次接收鼠标坐标的时间
let lastMouseEventTime = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      webviewTag: true,
      // nodeIntegrationInSubFrames: true,
      // nodeIntegration: true,
      // sandbox: false,
      // enableRemoteModule: true,
      // contextIsolation: false, // Electron 12+ webview page context 与 preload node context 隔离，会访问到不同的 window
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // 创建 SDL 子窗口
  // const sdlWindow = new BrowserWindow({
  //   width: 400,
  //   height: 300,
  //   frame: false, // 无边框窗口
  //   transparent: false,
  //   parent: win, // 设置父窗口
  //   webPreferences: {
  //     nodeIntegration: true,
  //     contextIsolation: false
  //   }
  // });

  // 监听MessageChannel
  ipcMain.on('mainprocess:trans-port', (e) => {
    // 获取port2
    const [port] = e.ports;
    
    // 监听port2上的消息
    port.on('message', (event) => {
      const message = event.data;
      if (message.type === 'mouse-coordinates') {
        const currentTime = Date.now();
        const coordinates = message.data;
        
        // 计算时间间隔
        let timeInterval = 0;
        if (lastMouseEventTime) {
          timeInterval = currentTime - lastMouseEventTime;
        }
        lastMouseEventTime = currentTime;
        
        // 打印鼠标坐标和时间间隔
        // console.log(`鼠标坐标: x=${coordinates.x}, y=${coordinates.y}, 时间间隔: ${timeInterval}ms`);
      } else if (message.type === 'large-data-request') {
        // 处理大数据请求
        // const imageData = getImageData(); // 这是一个自定义函数，用于获取RGBA数据
        port.postMessage({ type: 'large-data-response', data: imageData });
      }
    });
    
    // 开始接收消息
    port.start();
  });

  ipcMain.handle('ping', () => 'pong')

  win.loadFile('index.html')
  // sdlWindow.loadFile('sdl/index.html')
  // setupEventHandlers(win, sdlWindow);
  // win.loadFile('webview.html')
  win.webContents.openDevTools()
  // win.open('https://baidu.com', '_blank', 'top=500,left=200,frame=false,nodeIntegration=no')
  
  // Log renderer process crashes
  win.webContents.on('crashed', (event, killed) => {
    console.error(`Renderer process crashed. Killed: ${killed}`, event);
  });

  win.webContents.on('did-finish-load', () => {
    // win.webContents.send('shared-data', '');
  });
}

const tempDir = path.join(__dirname, './temp-files')

const iconName = path.join(tempDir, 'iconForDragAndDrop.png');
const icon = fs.createWriteStream(iconName);

const bigFileName = path.join(tempDir, 'bigFile.mp4');
const bigFile = fs.createWriteStream(bigFileName);

// Create a new file to copy - you can also copy existing files.
fs.writeFileSync(path.join(tempDir, 'drag-and-drop-1.md'), '# First file to test drag and drop')
fs.writeFileSync(path.join(tempDir, 'drag-and-drop-2.md'), '# Second file to test drag and drop')

https.get('https://img.icons8.com/ios/452/drag-and-drop.png', (response) => {
  response.pipe(icon);
});

https.get('https://player.alicdn.com/video/aliyunmedia.mp4', (response) => {
  response.pipe(bigFile);
});

const imageData = getImageData(); // 这是一个自定义函数，用于获取RGBA数据
// global.sharedData = {
//   imageData
// };

app.whenReady().then(createWindow)

fs.readFile('./README.md', 'utf8', (err, data) => {
  if (err) {
    console.error(err)
    return
  }
  // console.log(data)
})


ipcMain.on('drag-start', (event, filePath) => {
  event.sender.startDrag({
    file: path.join(tempDir, filePath),
    icon: iconName,
  })
})

// Listen for errors from the renderer process
ipcMain.on('renderer-error', (event, error) => {
  console.error('Error from renderer process:', error);
});

// 监听从渲染进程发送过来的请求
ipcMain.on('get-image-data', (event) => {

  // 在这里处理获取RGBA数据的逻辑
  // const imageData = getImageData(); // 这是一个自定义函数，用于获取RGBA数据
  event.reply('image-data', imageData);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    // createWindow()
  }
})


// 模拟获取RGBA数据的函数，实际中应该根据你的需求进行处理
function getImageData() {
  // const width = 5000; // 图片宽度 100MB
  // const height = 5000; // 图片高度
  const width = 3840; // 4K 宽度 32MB
  const height = 2160; // 4K 高度
  const rgbaData = new Uint8Array(width * height * 4); // 使用 Uint8Array 避免渲染进程二次拷贝

  // 在这里可以根据需要填充RGBA数据
  for (let i = 0; i < width * height * 4; i += 4) {
    // 使用随机的颜色信息
    rgbaData[i] = Math.floor(Math.random() * 256);       // 红色通道
    rgbaData[i + 1] = Math.floor(Math.random() * 256);   // 绿色通道
    rgbaData[i + 2] = Math.floor(Math.random() * 256);   // 蓝色通道
    rgbaData[i + 3] = 255;                               // Alpha通道
  }

  return { width, height, data: rgbaData };
}

// 监听渲染进程请求数据的事件
ipcMain.on('request-data', (event) => {
  const dataToTransfer = imageData /* 大量数据，可能是一个数组或其他结构 */;
  event.sender.send('response-data', dataToTransfer);
});

function setupEventHandlers(mainWindow, sdlWindow) {
  // 处理主窗口移动
  mainWindow.on('move', () => {
    if (!isDragging) {
      const [x, y] = mainWindow.getPosition();
      sdlWindow.setPosition(x + offset.x, y + offset.y);
    }
  });

  // 处理主窗口最小化
  mainWindow.on('minimize', () => {
    sdlWindow.minimize();
  });

  // 处理主窗口恢复
  mainWindow.on('restore', () => {
    sdlWindow.restore();
  });

  // 处理主窗口关闭
  mainWindow.on('close', () => {
    sdlWindow.close();
  });

  // 监听 SDL 窗口位置更新请求
  ipcMain.on('update-sdl-position', (event, position) => {
    offset = position;
    const [mainX, mainY] = mainWindow.getPosition();
    sdlWindow.setPosition(mainX + position.x, mainY + position.y);
  });

  // 处理 SDL 窗口焦点
  sdlWindow.on('focus', () => {
    mainWindow.focus();
  });
}
