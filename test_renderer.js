document.addEventListener('DOMContentLoaded', () => {
    const pingButton = document.getElementById('ping-button');
    const arraybufferButton = document.getElementById('arraybuffer-button');
    const statusDiv = document.getElementById('status');

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
