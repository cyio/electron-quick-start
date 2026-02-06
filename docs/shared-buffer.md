## Electron 安全模型与内存访问

### 1. 根本限制

```
Electron 的多进程架构 = Chromium 的安全模型
├─ 主进程（Node.js）
└─ 渲染进程（Chromium + 沙箱）
   ↓
进程隔离 → 内存隔离 → 无法直接互访问
```

### 2. 标准 IPC 的代价

```javascript
// 所有数据必须序列化/拷贝
ipcRenderer.send('data', buffer);
// 流程：序列化 → 拷贝 → 传输 → 反序列化
// 无法避免，这是进程隔离的代价
```

### 3. 特殊需求的解决方案

```
需求：零拷贝的大数据传输（如视频处理、实时渲染）
  ↓
方案：共享内存（通过原生模块）
  ↓
要求：
├─ 主进程：加载原生模块 → 创建/写入共享内存 ✅
└─ 渲染进程：
    ├─ 加载原生模块 → 打开共享内存 ✅
    ├─ 获得 ArrayBuffer/TypedArray (view) ✅
    └─ 传递 view 给渲染代码？ ❌ 
        ↓
        问题：view 无法跨上下文传递
        ↓
        解决：关闭沙箱 + contextIsolation
```

### 4. 为什么必须关闭隔离

```javascript
// 场景 A：保持隔离（推荐，但无法零拷贝）
webPreferences: {
  sandbox: true,
  contextIsolation: true,
  preload: 'preload.js'
}

// preload.js
const native = require('./native.node');
const view = native.open('/shm', 1024);
contextBridge.exposeInMainWorld('api', {
  getData: () => view  // ❌ ArrayBuffer 无法通过 contextBridge
});

// 场景 B：关闭隔离（能零拷贝，但有安全风险）
webPreferences: {
  sandbox: false,           // 允许加载原生模块
  contextIsolation: false,  // 允许直接访问 Node.js API
  nodeIntegration: true
}

// renderer.js
const native = require('./native.node');
const view = native.open('/shm', 1024);  // ✅ 直接获得 view
const uint8 = new Uint8Array(view);      // ✅ 可以直接使用
```

## 完整对比表

| 方案 | 安全性 | 零拷贝 | 复杂度 | 适用场景 |
|------|--------|--------|--------|---------|
| 标准 IPC | ⭐⭐⭐⭐⭐ | ❌ | ⭐ | 小数据、一般应用 |
| MessagePort | ⭐⭐⭐⭐⭐ | ❌ | ⭐⭐ | 中等数据、高频通信 |
| 共享内存 + 沙箱开启 | ⭐⭐⭐⭐ | ❌* | ⭐⭐⭐⭐ | 理论上不可行 |
| 共享内存 + 沙箱关闭 | ⭐⭐ | ✅ | ⭐⭐⭐⭐ | 视频/图像处理 |

*注：技术上可以通过 preload 读写共享内存，但每次都需序列化数组传递给 renderer，失去零拷贝意义

## 安全风险权衡

```javascript
// 关闭沙箱的风险
sandbox: false, contextIsolation: false

// 风险 1: XSS 可执行任意代码
<img src=x onerror="require('child_process').exec('rm -rf /')">

// 风险 2: 恶意网页可读取文件
const fs = require('fs');
const secrets = fs.readFileSync('/etc/passwd');

// 风险 3: 无法使用 Chromium 的安全特性
```

## 推荐架构

```javascript
// 主窗口：保持沙箱（面向用户）
const mainWin = new BrowserWindow({
  webPreferences: {
    sandbox: true,
    contextIsolation: true
  }
});

// 后台窗口：关闭沙箱（处理数据）
const workerWin = new BrowserWindow({
  show: false,  // 隐藏
  webPreferences: {
    sandbox: false,
    contextIsolation: false,
    nodeIntegration: true
  }
});

// 数据流：
// 主窗口 <--IPC--> 主进程 <--共享内存--> 后台窗口
//   (安全)                               (高性能)
```

## 你的总结（精简版）

```
Electron 安全模型：
├─ 进程隔离 → 不允许内存直接互访问
├─ 标准 IPC → 必须序列化/拷贝
└─ 特殊需求（零拷贝）：
    ├─ 编写原生模块（共享内存）
    ├─ 两个进程都需加载模块
    ├─ 获得的 view 无法跨上下文传递
    └─ 必须关闭 sandbox + contextIsolation
       （代价：失去安全保护）
```

**最终结论**：你的理解完全正确。Electron 的安全模型和零拷贝传输是根本性的矛盾，必须在安全性和性能之间做权衡。对于必须零拷贝的场景，关闭隔离是唯一可行方案。

https://claude.ai/chat/b82cc67b-4dbf-489e-9b8b-0ad8297eb42c