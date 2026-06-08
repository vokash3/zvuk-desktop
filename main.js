const {
  app,
  BrowserWindow,
  Menu,
  shell,
  Tray,
  nativeImage,
  dialog,
  webContents,
} = require("electron");

const path = require("path");
const windowStateKeeper = require("electron-window-state");
const { autoUpdater } = require("electron-updater");

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-renderer-backgrounding");

let win = null;
let tray = null;
let isQuitting = false;

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function createMenu() {
  const template = [
    ...(process.platform === "darwin"
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              {
                label: "Проверить обновления…",
                click: () => checkForUpdates(true),
              },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideothers" },
              { role: "unhide" },
              { type: "separator" },
              {
                label: "Выход",
                accelerator: "Cmd+Q",
                click: forceQuit,
              },
            ],
          },
        ]
      : []),
    {
      label: "Правка",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "Окно",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(process.platform === "darwin"
          ? [{ role: "front" }]
          : [{ role: "close" }]),
      ],
    },
    {
      label: "Справка",
      submenu: [
        {
          label: "Открыть zvuk.com",
          click: () => shell.openExternal("https://zvuk.com"),
        },
        {
          label: "Проверить обновления…",
          click: () => checkForUpdates(true),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createTray() {
  const iconPath = path.join(__dirname, "resources", "icon.png");

  const image = nativeImage
    .createFromPath(iconPath)
    .resize({ width: 16, height: 16 });

  tray = new Tray(image);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Открыть Zvuk",
      click: showWindow,
    },
    { type: "separator" },
    {
      label: "Проверить обновления…",
      click: () => checkForUpdates(true),
    },
    { type: "separator" },
    {
      label: "Выход",
      click: forceQuit,
    },
  ]);

  tray.setToolTip("Zvuk Desktop");
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (!win || win.isDestroyed()) {
      createWindow();
      return;
    }

    if (win.isVisible()) {
      win.hide();
    } else {
      showWindow();
    }
  });
}

function showWindow() {
  if (!win || win.isDestroyed()) {
    createWindow();
    return;
  }

  if (win.isMinimized()) {
    win.restore();
  }

  win.show();
  win.focus();
}

function injectVisibilityPatch() {
  if (!win || win.isDestroyed()) return;

  const script = `
    (function() {
      try {
        const define = (obj, prop, val) => {
          try {
            Object.defineProperty(obj, prop, {
              get: () => val,
              configurable: true
            });
          } catch {}
        };

        define(document, "hidden", false);
        define(document, "visibilityState", "visible");

        const origAdd = document.addEventListener.bind(document);

        document.addEventListener = function(type, listener, options) {
          if (type === "visibilitychange") return;
          return origAdd(type, listener, options);
        };

        document.dispatchEvent(new Event("visibilitychange"));
      } catch (e) {}
    })();
  `;

  win.webContents.executeJavaScript(script).catch(() => {});
}

function createWindow() {
  const mainWindowState = windowStateKeeper({
    defaultWidth: 1300,
    defaultHeight: 900,
  });

  win = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    backgroundColor: "#000000",
    title: "Zvuk Desktop",
    minimizable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true,
      backgroundThrottling: false,
    },
  });

  mainWindowState.manage(win);

  win.loadURL(`file://${path.join(__dirname, "index.html")}`);

  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  win.on("closed", () => {
    win = null;
  });

  win.webContents.on("will-prevent-unload", (event) => {
    if (isQuitting) {
      event.preventDefault();
    }
  });

  win.webContents.on("did-finish-load", injectVisibilityPatch);
  win.on("show", injectVisibilityPatch);

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

async function killWebview() {
  if (!win || win.isDestroyed()) return;

  const webviewId = await win.webContents
    .executeJavaScript(
      `
      (() => {
        const webview = document.querySelector("webview");
        return webview ? webview.getWebContentsId() : null;
      })();
    `,
    )
    .catch(() => null);

  if (!webviewId) return;

  const guest = webContents.fromId(webviewId);

  if (guest && !guest.isDestroyed()) {
    guest.forcefullyCrashRenderer();
  }
}

async function prepareForRealQuit() {
  isQuitting = true;

  if (tray) {
    tray.destroy();
    tray = null;
  }

  await killWebview();

  if (win && !win.isDestroyed()) {
    win.removeAllListeners("close");
    win.destroy();
    win = null;
  }
}

async function forceQuit() {
  await prepareForRealQuit();
  app.quit();
}

function checkForUpdates(manual = false) {
  autoUpdater
    .checkForUpdates()
    .then((result) => {
      const latestVersion = result?.updateInfo?.version;
      const currentVersion = app.getVersion();

      if (manual && (!latestVersion || latestVersion === currentVersion)) {
        dialog.showMessageBox({
          type: "info",
          buttons: ["OK"],
          title: "Проверка обновлений",
          message: "У вас установлена последняя версия.",
        });
      }
    })
    .catch((err) => {
      if (manual) {
        dialog.showErrorBox("Ошибка проверки обновлений", String(err));
      }

      console.error("Update check error:", err);
    });
}

autoUpdater.on("error", (err) => {
  console.error(
    "Update error:",
    err == null ? "unknown" : (err.stack || err).toString(),
  );
});

autoUpdater.on("update-available", async (info) => {
  const result = await dialog.showMessageBox({
    type: "question",
    buttons: ["Установить", "Позже"],
    title: "Доступно обновление",
    message: `Доступна версия ${info.version}. Установить сейчас?`,
    cancelId: 1,
    defaultId: 0,
  });

  if (result.response === 0) {
    autoUpdater.downloadUpdate();
  }
});

autoUpdater.on("update-downloaded", async () => {
  const result = await dialog.showMessageBox({
    type: "question",
    buttons: ["Перезапустить и установить", "Позже"],
    title: "Обновление скачано",
    message:
      "Обновление загружено. Перезапустить приложение и установить сейчас?",
    cancelId: 1,
    defaultId: 0,
  });

  if (result.response === 0) {
    await prepareForRealQuit();

    setTimeout(() => {
      autoUpdater.quitAndInstall(false, true);
    }, 500);
  }
});

autoUpdater.on("before-quit-for-update", () => {
  isQuitting = true;
});

app.whenReady().then(() => {
  if (process.platform === "darwin") {
    app.dock.show();
  }

  createMenu();
  createWindow();
  createTray();

  checkForUpdates(false);
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("activate", () => {
  if (!isQuitting) {
    showWindow();
  }
});

app.on("window-all-closed", () => {
  if (isQuitting) {
    app.quit();
  }
});
