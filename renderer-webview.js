const webview = document.getElementById('foo');
webview.addEventListener('dom-ready', () => {
    console.log('Page is ready to be displayed');
    const information = document.getElementById('info')
    information.innerText = `This app is using Chrome (v${versions.chrome()}), Node.js (v${versions.node()}), and Electron (v${versions.electron()})`
});

const func = async () => {
    console.log('window', window.versions)
    const response = await window.versions.ping()
    console.log(response) // prints out 'pong'
}
  
func()