document.addEventListener('DOMContentLoaded', () => {
    const pingButton = document.getElementById('ping-button');
    const arraybufferButton = document.getElementById('arraybuffer-button');
    const statusDiv = document.getElementById('status');

    // ============================================================
    // MVP: SharedArrayBuffer 零拷贝渲染
    // ============================================================

    // 直接从 window 对象访问共享内存（因为 sandbox: false）
    const sharedCanvas = document.getElementById('shared-canvas');
    const ctx = sharedCanvas.getContext('2d', { willReadFrequently: true });

    let imageData; // 复用 ImageData 对象

    function renderFromSharedBuffer() {
        if (window.sharedImageBuffer && window.imageSpecs) {
            const { width, height } = window.imageSpecs;

            // 首次创建 ImageData
            if (!imageData) {
                const buffer = new Uint8ClampedArray(width * height * 4);
                imageData = new ImageData(buffer, width, height);
                console.log('Renderer: ImageData created, using SharedArrayBuffer');
            }

            // 从 SharedArrayBuffer 拷贝数据到 ImageData
            // ImageData 构造时不支持 SharedArrayBuffer，需要拷贝
            // 但我们复用同一块 buffer，最小化开销
            const sharedArray = new Uint8ClampedArray(window.sharedImageBuffer);
            imageData.data.set(sharedArray);

            // 绘制到 Canvas
            ctx.putImageData(imageData, 0, 0);
        }

        // 继续下一帧
        requestAnimationFrame(renderFromSharedBuffer);
    }

    // 启动渲染循环
    renderFromSharedBuffer();
    console.log('Renderer: SharedArrayBuffer rendering started.');

    // ============================================================
    // 原有的 MessageChannel 测试代码
    // ============================================================

    // 1. Create the MessageChannel.
    const { port1, port2 } = new MessageChannel();

    // 2. Send port2 to the preload script.
    window.postMessage('port-transfer', '*', [port2]);
    statusDiv.textContent = 'Port sent to preload. Ready to test.';

    // 3. Listen for messages on port1.
    port1.onmessage = (event) => {
        console.log('Renderer process received data:', event.data);
        if (event.data === 'pong') {
            // Handle the successful ping-pong test
            statusDiv.textContent = `Success! Received message: "${event.data}"`;
            statusDiv.style.color = 'green';
        } else if (event.data && event.data.data instanceof ArrayBuffer) {
            // Handle the ArrayBuffer transfer test
            const data = new Uint8Array(event.data.data);
            statusDiv.textContent = `Success! Received ArrayBuffer with data: [${data.toString()}]`;
            statusDiv.style.color = 'green';
        } else {
            // Handle any other unexpected data
             statusDiv.textContent = `Error: Received unexpected data: ${JSON.stringify(event.data)}`;
             statusDiv.style.color = 'red';
        }
    };

    // 4. Set up buttons to send different messages.
    pingButton.addEventListener('click', () => {
        console.log('Renderer: Sending "ping" message...');
        statusDiv.textContent = 'Ping-Pong test running...';
        try {
            port1.postMessage('ping');
        } catch(e) {
            statusDiv.textContent = 'Error sending message: ' + e.message;
            statusDiv.style.color = 'red';
        }
    });

    arraybufferButton.addEventListener('click', () => {
        console.log('Renderer: Sending "arraybuffer-test" message...');
        statusDiv.textContent = 'ArrayBuffer test running... check main process console for expected error.';
        try {
            port1.postMessage('arraybuffer-test');
        } catch(e) {
            statusDiv.textContent = 'Error sending message: ' + e.message;
            statusDiv.style.color = 'red';
        }
    });
});
