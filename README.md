# electron-quick-start

## 大文件跨进程传输

100MB 随机图像
get-image-data: 766.00634765625 ms
renderer.js:69 render-image-data: 110.618896484375 ms

200MB 随机图像
get-image-data: 813.030029296875 ms
renderer.js:69 render-image-data: 101.62890625 ms

提前生成图像
get-image-data: 149.540771484375 ms

生成图象，时间复杂度 O(w & h * 4)

每 10MB 16ms

[How to efficiently pass large array from main to render? · Issue #1948 · electron/electron](https://github.com/electron/electron/issues/1948#issuecomment-864191345)

> 需要注意的是，共享变量（SharedArrayBuffer）在 Electron 中需要启用 nodeIntegration 和 contextIsolation 选项。确保在创建 BrowserWindow 时正确设置这些选项。
> 相比将整个大型数组通过 IPC 传输，使用共享变量可以避免数据的复制和序列化过程，从而减少了传输的时间和内存占用。这对于传输大型数组或大量数据时特别有效。

共享变量，需要用 remote，有安全风险

直接发送SharedArrayBuffer可能会面临安全难题，因为在进程之间共享这样的对象可能引入安全漏洞

官网 issues 没有找到有效解决方案，这可能不是一个有意义的使用场景？或者，IPC 就是最好解法。