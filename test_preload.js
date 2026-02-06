// ============================================================
// 简化版 Preload: 仅用于 SharedArrayBuffer 零拷贝测试
// 不使用 contextBridge，直接挂载到 window
// ============================================================

console.log('test_preload.js loaded');

// ============================================================
// MVP: SharedArrayBuffer 零拷贝图像传输
// ============================================================

// 创建小图像缓冲区 (192x108 RGBA)
const width = 192;
const height = 108;
const bufferSize = width * height * 4;
const sharedBuffer = new SharedArrayBuffer(bufferSize);

// 将共享缓冲区和尺寸信息挂载到 window 对象
// 由于 sandbox: false 和 contextIsolation: false，渲染进程可以直接访问
window.sharedImageBuffer = sharedBuffer;
window.imageSpecs = { width, height };

// 使用 Uint8ClampedArray 直接操作共享内存
const data = new Uint8ClampedArray(sharedBuffer);

// 简单动画：渐变颜色效果
let hue = 0;

function updateFrame() {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // 基于位置和时间的颜色
      const r = Math.floor((x / width) * 255);
      const g = Math.floor((y / height) * 255);
      const b = Math.floor((hue + (x + y) / 2) % 255);

      data[idx] = r;         // R
      data[idx + 1] = g;     // G
      data[idx + 2] = b;     // B
      data[idx + 3] = 255;   // Alpha
    }
  }
  hue = (hue + 1) % 255;

  // 标记数据已更新
  window.sharedBufferDirty = true;

  // 使用 setImmediate 在下次事件循环继续更新
  setImmediate(updateFrame);
}

// 启动更新循环
updateFrame();

console.log('test_preload: SharedArrayBuffer initialized, size:', bufferSize, 'bytes');