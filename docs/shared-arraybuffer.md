既然你的目标是**在 Preload 脚本中创建图像并直接渲染到窗口上**，且允许**关闭沙箱隔离**，那么确实不需要复杂的 C++ 原生模块。

在这种场景下，最实用的“零拷贝”方案是利用 `SharedArrayBuffer` 在**渲染主线程**和 **Web Worker** 之间同步数据。

---

## 核心逻辑：渲染进程内的“真·零拷贝”

既然 Preload 和 窗口属于**同一个渲染进程**（只是不同的线程或上下文），只要关闭了沙箱和隔离，它们就可以共享同一个内存堆。

### 1. 配置主进程 (`test_main.js`)

必须关闭沙箱并启用 SharedArrayBuffer，同时设置 COOP/COEP 安全头。

```javascript
const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: require('path').join(__dirname, 'test_preload.js'),
      nodeIntegration: true,      // 允许使用 Node API
      contextIsolation: false,    // 关闭上下文隔离（让 Preload 和窗口共享同一作用域）
      sandbox: false,             // 关闭沙箱
      sharedArrayBuffer: true     // 启用 SharedArrayBuffer
    }
  });

  // SharedArrayBuffer 需要的安全头
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
});
```

### 2. Preload 脚本实现 (`test_preload.js`)

⚠️ **注意**：使用 SharedArrayBuffer 时不能使用 `contextBridge`，需要创建独立的 preload 文件。

```javascript
// 创建 RGBA 共享缓冲区 (192x108 演示)
const width = 192;
const height = 108;
const bufferSize = width * height * 4;
const sharedBuffer = new SharedArrayBuffer(bufferSize);

// 挂载到 window 对象，渲染进程可直接访问
window.sharedImageBuffer = sharedBuffer;
window.imageSpecs = { width, height };

// 使用 Uint8ClampedArray 直接操作共享内存
const data = new Uint8ClampedArray(sharedBuffer);

let hue = 0;

function updateFrame() {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx]     = Math.floor((x / width) * 255);       // R
      data[idx + 1] = Math.floor((y / height) * 255);      // G
      data[idx + 2] = Math.floor((hue + (x + y) / 2) % 255); // B
      data[idx + 3] = 255;                                 // Alpha
    }
  }
  hue = (hue + 1) % 255;
  setImmediate(updateFrame);
}
updateFrame();
```

### 3. 窗口渲染逻辑 (`test_renderer.js`)

⚠️ **注意**：`ImageData` 构造时不支持 SharedArrayBuffer，需要用 `data.set()` 拷贝数据。

```javascript
const canvas = document.getElementById('shared-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

let imageData; // 复用 ImageData 对象

function renderFromSharedBuffer() {
  if (window.sharedImageBuffer && window.imageSpecs) {
    const { width, height } = window.imageSpecs;

    // 首次创建 ImageData（使用普通 Uint8ClampedArray）
    if (!imageData) {
      const buffer = new Uint8ClampedArray(width * height * 4);
      imageData = new ImageData(buffer, width, height);
    }

    // 从 SharedArrayBuffer 拷贝数据到 ImageData
    const sharedArray = new Uint8ClampedArray(window.sharedImageBuffer);
    imageData.data.set(sharedArray);

    // 绘制到 Canvas
    ctx.putImageData(imageData, 0, 0);
  }
  requestAnimationFrame(renderFromSharedBuffer);
}
renderFromSharedBuffer();
```

---

## 实践中遇到的问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| `contextBridge API can only be used when contextIsolation is enabled` | `contextBridge` 要求 `contextIsolation: true` | 为 SharedArrayBuffer 创建独立的 preload 文件，不使用 `contextBridge` |
| `SharedArrayBuffer is not defined` | Electron 默认禁用，且需要安全头 | 设置 `webPreferences.sharedArrayBuffer: true` |
| `Failed to construct 'ImageData': The provided Uint8ClampedArray value must not be shared` | `ImageData` 构造时不接受 SharedArrayBuffer 的数组 | 先用普通 `Uint8ClampedArray` 创建 `ImageData`，渲染时用 `data.set()` 拷贝共享内存数据 |
| `new Uint8ClampedArray(Buffer)` 耗时 15ms+，而 `new Uint8ClampedArray(SharedArrayBuffer)` 接近 0ms | Buffer 需要分配新内存并拷贝数据；SharedArrayBuffer 只需创建视图 | 主进程使用 `Uint8Array` 替代 `Buffer`，渲染进程检测类型后直接复用 |
| Canvas/DOM/对象创建开销大 | 每次渲染都 `createElement`、`getContext`、`new ImageData` | 复用 Canvas、Context、ImageData 对象，只测量 `data.set()` + `putImageData` |

---

## 性能优化实践

### 1. 数据类型优化：避免二次拷贝

```javascript
// ❌ 错误：主进程使用 Buffer
const rgbaData = Buffer.alloc(width * height * 4);

// ✅ 正确：主进程使用 Uint8Array
const rgbaData = new Uint8Array(width * height * 4);
```

渲染进程接收后检测类型：

```javascript
// ❌ 错误：直接转换 Buffer
const imageDataArray = new Uint8ClampedArray(data);

// ✅ 正确：如果是 Uint8Array 直接复用
let imageDataArray;
if (data instanceof Uint8Array) {
  imageDataArray = data; // 零拷贝复用
} else {
  imageDataArray = new Uint8ClampedArray(data); // Buffer 才需要转换
}
```

### 2. 对象复用：减少 GC 压力

```javascript
let reuseCanvas;
let reuseContext;
let reuseImageData;

function getReuseCanvas(width, height) {
  if (!reuseCanvas || reuseCanvas.width !== width || reuseCanvas.height !== height) {
    reuseCanvas = document.createElement('canvas');
    reuseCanvas.width = width;
    reuseCanvas.height = height;
    reuseContext = reuseCanvas.getContext('2d', { willReadFrequently: true });
    reuseImageData = new ImageData(new Uint8ClampedArray(width * height * 4), width, height);
  }
  return { canvas: reuseCanvas, context: reuseContext };
}
```

### 3. 公平的基准测试

测量时应只关注核心操作，剔除无关开销：

```javascript
// ❌ 错误：包含对象创建
console.time('render');
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const imageData = new ImageData(...);
ctx.putImageData(imageData, 0, 0);
console.timeEnd('render');

// ✅ 正确：只测量数据拷贝和渲染
console.time('render');
imageData.data.set(sourceArray); // 数据拷贝
ctx.putImageData(imageData, 0, 0); // 绘制
console.timeEnd('render');
```

### 4. 实测数据对比 (4K 图像 31.64MB)

| 路径 | 总耗时 | create-uint8 | data.set() | putImageData |
|------|--------|--------------|------------|--------------|
| SharedArrayBuffer | ~10ms | ~0ms | 快 | 快 |
| IPC (优化后 Uint8Array) | ~10ms | ~0ms | 快 | 快 |
| IPC (原 Buffer) | ~20ms+ | ~15ms | 快 | 快 |

**结论**：IPC + Uint8Array 优化后，与 SharedArrayBuffer 性能基本持平。

---

## 关键结论：IPC 无法满足即时渲染需求

实测数据证明：**IPC / MessagePort 传输 4K 图像（31.64MB）耗时会大幅超过 16ms（实时渲染要求）**

```
# MessagePort 传输耗时
requestMainDataByPort: 37ms

# IPC (requestMainData) 传输耗时
requestMainData: 50ms
```

### 为什么 IPC 这么慢？

1. **序列化/反序列化**：主进程 → 渲染进程，需要将数据序列化为字节流
2. **内存拷贝**：数据在进程间传递时必须复制
3. **线程切换开销**：跨进程通信的固有延迟

### 解决方案：SharedArrayBuffer 共享内存

```
Preload (共享内存) → 渲染进程 (零拷贝访问)
           ↓
        Canvas 绘制
           ↓
      总耗时 ~10ms ✅
```

**结论**：要实现 60fps 即时渲染（16ms/帧），**必须使用 SharedArrayBuffer 共享内存方式**，避免任何跨进程数据传输。

---

## 方案优势与结论

* **低延迟**：Preload 对 `sharedArray` 的任何修改，窗口渲染时会立即反应出来，不需要通过 `postMessage` 传递大数据。
* **架构简单**：避开了 Electron 主进程与渲染进程之间的 IPC 序列化性能瓶颈（IPC 通常会慢 1/3 左右）。
* **最小化拷贝**：虽然 `ImageData` 需要一次 `set()` 拷贝，但复用同一 buffer，开销很小。

如果数据源不是能直接创建视图的格式（比如 Node buffer），还是会引入 10-15ms 左右的一个拷贝开销，但这个不在 SharedArrayBuffer 的范畴，属于额外的优化空间。

