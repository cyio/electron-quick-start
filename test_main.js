const { app, BrowserWindow, ipcMain } = require('electron');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;

function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      // The preload script is still needed to set up the MessageChannel from the renderer.
      preload: require('path').join(__dirname, 'test_preload.js'),
      // 关闭沙箱和上下文隔离，允许 Preload 和渲染进程共享内存
      sandbox: false,
      contextIsolation: false,
      nodeIntegration: true,
      // 启用 SharedArrayBuffer 支持
      sharedArrayBuffer: true
    }
  });

  // SharedArrayBuffer 需要安全头
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Cross-Origin-Embedder-Policy': ['require-corp'],
        'Cross-Origin-Opener-Policy': ['same-origin']
      }
    });
  });

  win.loadFile('test_index.html');
  win.webContents.openDevTools();

  win.on('closed', () => {
    win = null;
  });
}

// This listener is the core of our test. It sets up the MessageChannel.
ipcMain.on('mainprocess:trans-port', (e) => {
  const [port] = e.ports;

  port.on('message', (event) => {
    console.log(`Main process received message: "${event.data}"`);

    if (event.data === 'ping') {
      // WORKING SCENARIO: Send back a simple string. This works.
      try {
        port.postMessage('pong');
        console.log('Main process: Replied with "pong".');
      } catch (error) {
        console.error('Main process: Error during simple postMessage:', error);
      }
    } else if (event.data === 'arraybuffer-test') {
      // BUG DEMONSTRATION: Attempt to transfer an ArrayBuffer.
      console.log('Main process: Attempting to transfer ArrayBuffer...');
      const buffer = new ArrayBuffer(8);
      try {
        // This line is expected to fail with a "TypeError: Port at index 0 is not a valid port"
        // This demonstrates the bug in Electron's MessagePortMain implementation.
        // const shared = new SharedArrayBuffer(buffer.byteLength);
        // new Uint8Array(shared).set(new Uint8Array(buffer));   
        // Electron 的 message 不支持 transfer list，与浏览器不同。根本上是线程和进程的底层区别。
        port.postMessage({ data: Buffer.from(buffer) });

        // Main process: Attempting to transfer ArrayBuffer...
        // Main process: SUCCESSFULLY CAUGHT EXPECTED ERROR -> Error: An object could not be cloned.
        // const sharedBuffer = new SharedArrayBuffer(8);
        // port.postMessage({ data: sharedBuffer });
        console.log('Main process: SharedArrayBuffer sent successfully');
      } catch (error) {
        console.error('Main process: SUCCESSFULLY CAUGHT EXPECTED ERROR ->', error);
      }
    }
  });

  port.start();
});


app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (win === null) {
    createWindow();
  }
});
