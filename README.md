# electron-quick-start

## 大文件跨进程传输

场景：Electron渲染来自主进程的图像数据

问题：如何高效将大量数据跨进程共享

```
100MB 随机图像
get-image-data: 766.00634765625 ms
renderer.js:69 render-image-data: 110.618896484375 ms

200MB 随机图像
get-image-data: 813.030029296875 ms
renderer.js:69 render-image-data: 101.62890625 ms

提前生成图像
get-image-data: 149.540771484375 ms
```

生成图象，时间复杂度 O(w & h * 4)

每 10MB 16ms

[How to efficiently pass large array from main to render? · Issue #1948 · electron/electron](https://github.com/electron/electron/issues/1948#issuecomment-864191345)

> 需要注意的是，共享内存块（SharedArrayBuffer）在 Electron 中需要启用 nodeIntegration 和 contextIsolation 选项。确保在创建 BrowserWindow 时正确设置这些选项。
> 相比将整个大型数组通过 IPC 传输，使用共享变量可以避免数据的复制和序列化过程，从而减少了传输的时间和内存占用。这对于传输大型数组或大量数据时特别有效。

共享变量，需要用 remote，有安全风险

直接发送SharedArrayBuffer可能会面临安全难题，因为在进程之间共享这样的对象可能引入安全漏洞

官网 issues 没有找到有效解决方案，这可能不是一个有意义的使用场景？或者，IPC 就是最好解法。

每个 Wasm 实例拥有自己的私有内存空间，它不是跨进程共享的。

需要在安全与场景需求上，做取舍。

更新：使用 MessageChannel 可缩短至 1/3 到 1/2，显著减少耗时

Electron 中主进程与渲染进程之间是完全隔离的进程（非线程），即便使用 ArrayBuffer + Transferable，也无法完全避免内核级的内存拷贝。transferables 只是避免了 JS 层结构化克隆的深拷贝，但仍然需要：

💡 一次跨进程的底层 memcpy（或 shared memory mapping）

🔍 为什么会发生拷贝？
Electron（底层是 Chromium + Node.js）中：

主进程和渲染进程是通过 Chromium 的 IPC 系统（Mojo） 通信；

即使你通过 postMessage(..., [ArrayBuffer]) 使用 transferables，依然会触发一次底层数据从一个进程地址空间复制到另一个的过程；

这与浏览器的 worker 内部共享（如 MessagePort 之间）不同，浏览器内的 threads 可直接 transfer，进程不行。

是的，**简单总结就是：**

> ✅ **跨进程通信本质上就不适合传输大数据，数据越大，拷贝耗时越长，影响性能。**

---

### ✅ 补充一句更具体的原则：

> * 小数据（<1MB）：`postMessage`、`ipcRenderer.send` 没问题
> * 中等数据（1–10MB）：推荐使用 `transferables` + `ArrayBuffer`，减少 JS 层负担
> * 大数据（10MB 以上）：**应考虑 SharedArrayBuffer、写临时文件、建立本地服务让子进程拉取**

---

### 🧠 背后原因：

* Electron 主/渲染进程之间是**多进程架构**，每次通信需要**复制数据到另一个进程的内存空间**（不能共享指针）；
* 即使用了 transferables，最多也只是“少拷贝”，**避免结构化克隆，但不是零拷贝**；
* 内存拷贝量大，容易造成：

  * 卡顿、阻塞事件循环
  * 主线程/渲染线程帧率下降
  * 高内存压力甚至崩溃

---

如你所说，跨进程传大数据不是最佳方案，**应该传“引用”，不要传“实体”**，这是高性能 Electron 应用的关键设计原则。

https://chatgpt.com/share/68425348-68e4-8008-8ce5-184b2c0dc211

4K 图上 32MB 
44ms
21ms

## 原生模块 + 必须关闭沙箱 + contextIsolation

这样渲染进程才能直接 require('./native.node') 并访问 ArrayBuffer。

[查看更详细的 Electron 安全模型与内存访问说明](./docs/shared-buffer.md)

