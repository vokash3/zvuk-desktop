
const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
  const backButton = document.getElementById('back');
  const forwardButton = document.getElementById('forward');
  const webview = document.getElementById('webview');

  backButton.addEventListener('click', () => {
    webview.goBack();
  });

  forwardButton.addEventListener('click', () => {
    webview.goForward();
  });
});
