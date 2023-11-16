const { app, BrowserWindow, ipcMain, nativeImage, NativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const https = require('https')

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

  ipcMain.handle('ping', () => 'pong')

  // win.loadFile('index.html')
  win.loadFile('webview.html')
  win.webContents.openDevTools()
  // win.open('https://baidu.com', '_blank', 'top=500,left=200,frame=false,nodeIntegration=no')
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

app.whenReady().then(createWindow)

fs.readFile('./README.md', 'utf8', (err, data) => {
  if (err) {
    console.error(err)
    return
  }
  console.log(data)
})


ipcMain.on('drag-start', (event, filePath) => {
  event.sender.startDrag({
    file: path.join(tempDir, filePath),
    icon: iconName,
  })
})

// 监听从渲染进程发送过来的请求
ipcMain.on('get-image-data', (event) => {
  // 在这里处理获取RGBA数据的逻辑
  const imageData = getImageData(); // 这是一个自定义函数，用于获取RGBA数据
  event.reply('image-data', imageData);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})


// 模拟获取RGBA数据的函数，实际中应该根据你的需求进行处理
function getImageData() {
  const width = 5000; // 图片宽度
  const height = 5000; // 图片高度
  const rgbaData = Buffer.alloc(width * height * 4); // 每个像素4字节

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

