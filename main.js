const {app, BrowserWindow, Menu, dialog, shell, Tray, nativeImage} = require('electron')
const path = require('path')
const windowStateKeeper = require('electron-window-state')
const {autoUpdater} = require('electron-updater')

// Improve background behavior
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-renderer-backgrounding')

let win
let tray
let isQuitting = false

function createMenu(checkUpdates) {
    const template = [...(process.platform === 'darwin' ? [{
        label: app.name,
        submenu: [{role: 'about'}, {type: 'separator'}, {
            label: 'Проверить обновления…',
            click: () => checkUpdates(true)
        }, {type: 'separator'}, {role: 'services'}, {type: 'separator'}, {role: 'hide'}, {role: 'hideothers'}, {role: 'unhide'}, {type: 'separator'}, {role: 'quit'}]
    }] : []), {
        label: 'Правка',
        submenu: [{role: 'undo'}, {role: 'redo'}, {type: 'separator'}, {role: 'cut'}, {role: 'copy'}, {role: 'paste'}, {role: 'selectAll'}]
    }, {
        label: 'Окно',
        submenu: [{role: 'minimize'}, {role: 'zoom'}, ...(process.platform === 'darwin' ? [{role: 'front'}] : [{role: 'close'}])]
    }, {
        label: 'Справка',
        submenu: [{
            label: 'Открыть zvuk.com',
            click: () => shell.openExternal('https://zvuk.com')
        }, {label: 'Проверить обновления…', click: () => checkUpdates(true)}]
    }]
    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
}


function createTray() {
    const iconPath = path.join(__dirname, 'build', 'icon.png')
    let image = nativeImage.createFromPath(iconPath)

    // Принудительно поджать до 16x16
    image = image.resize({width: 16, height: 16})

    tray = new Tray(image)

    const contextMenu = Menu.buildFromTemplate([{
        label: 'Открыть Zvuk', click: () => { /* ... */
        }
    }, {type: 'separator'}, {
        label: 'Выход', click: () => {
            isQuitting = true;
            app.quit()
        }
    }])

    tray.setToolTip('Zvuk')
    tray.setContextMenu(contextMenu)
}

function injectVisibilityPatch() {
    if (!win || win.isDestroyed()) return
    const script = `
    (function(){
      try {
        const define = (obj, prop, val) => {
          try { Object.defineProperty(obj, prop, { get: () => val, configurable: true }); } catch {}
        };
        define(document, 'hidden', false);
        define(document, 'visibilityState', 'visible');
        // Neutralize listeners
        const origAdd = document.addEventListener.bind(document);
        document.addEventListener = function(type, listener, options){
          if (type === 'visibilitychange') return; // ignore
          return origAdd(type, listener, options);
        };
        document.dispatchEvent(new Event('visibilitychange'));
      } catch (e) {}
    })();
  `
    win.webContents.executeJavaScript(script).catch(() => {
    })
}

function createWindow() {
    const mainWindowState = windowStateKeeper({
        defaultWidth: 1300, defaultHeight: 900
    })

    win = new BrowserWindow({
        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        height: mainWindowState.height,
        backgroundColor: '#000000',
        title: 'Zvuk Desktop',
        minimizable: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            backgroundThrottling: false
        }
    })

    mainWindowState.manage(win)

    win.loadURL('https://zvuk.com')
    createMenu(checkForUpdates)
    // createTray()

    // Keep a single window instance alive
    win.on('close', (e) => {
        if (!isQuitting) {
            e.preventDefault()
            win.hide()
        }
    })

    // Patch after load and when we show again
    win.webContents.on('did-finish-load', injectVisibilityPatch)
    win.on('show', injectVisibilityPatch)

    win.webContents.setWindowOpenHandler(({url}) => {
        shell.openExternal(url)
        return {action: 'deny'}
    })
}

// ===== Auto Updates =====
const {dialog: sysDialog} = require('electron')
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

autoUpdater.on('error', (err) => {
    console.error('Update error:', err == null ? 'unknown' : (err.stack || err).toString())
})

autoUpdater.on('update-available', async (info) => {
    const result = await sysDialog.showMessageBox({
        type: 'question',
        buttons: ['Установить', 'Позже'],
        title: 'Доступно обновление',
        message: `Доступна версия ${info.version}. Установить сейчас?`,
        cancelId: 1,
        defaultId: 0
    })
    if (result.response === 0) {
        autoUpdater.downloadUpdate()
    }
})

autoUpdater.on('update-downloaded', async (info) => {
    const result = await sysDialog.showMessageBox({
        type: 'question',
        buttons: ['Перезапустить и установить', 'Позже'],
        title: 'Обновление скачано',
        message: 'Обновление загружено. Перезапустить приложение и установить сейчас?',
        cancelId: 1,
        defaultId: 0
    })
    if (result.response === 0) {
        autoUpdater.quitAndInstall()
    }
})

function checkForUpdates(manual = false) {
    autoUpdater.checkForUpdates().then(result => {
        if (manual && (!result || !result.updateInfo || result.updateInfo.version === app.getVersion())) {
            sysDialog.showMessageBox({
                type: 'info',
                buttons: ['OK'],
                title: 'Проверка обновлений',
                message: 'У вас установлена последняя версия.'
            })
        }
    }).catch(err => {
        if (manual) {
            sysDialog.showErrorBox('Ошибка проверки обновлений', String(err))
        }
    })
}

app.whenReady().then(() => {
    if (process.platform === 'darwin') app.dock.show()
    createWindow()
    createTray()
    checkForUpdates(false)
})

app.on('before-quit', () => {
    isQuitting = true
})
app.on('activate', () => {
    if (!win || win.isDestroyed()) createWindow()
    else {
        win.show();
    }
})
app.on('window-all-closed', () => {

})
