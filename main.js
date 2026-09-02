const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');

let win = null;
let tray = null;

function createWindow() {
  const primary = screen.getPrimaryDisplay();
  const { width: sw, height: sh } = primary.workAreaSize;

  win = new BrowserWindow({
    width: 380,
    height: 636,
    minWidth: 340,
    minHeight: 200,
    x: sw - 380 - 24,
    y: 24,
    frame: false,
    transparent: true,
    resizable: true,
    hasShadow: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('index.html');

  win.on('close', (e) => {
    // Hide instead of quitting so the tray can bring it back,
    // unless the app is actually quitting (Quit from tray menu).
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

function createTray() {
  // Tiny 16x16 pixel-heart icon built from an embedded PNG so no asset file is required.
  const icon = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL);
  tray = new Tray(icon);
  tray.setToolTip('Cute Pixel Weather Widget');

  const menu = Menu.buildFromTemplate([
    {
      label: 'Show Widget',
      click: () => {
        if (win) {
          win.show();
          win.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: false,
      click: (item) => {
        if (win) win.setAlwaysOnTop(item.checked);
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => {
    if (win) {
      win.isVisible() ? win.hide() : win.show();
    }
  });
}

// Minimal 16x16 pink pixel-heart icon, base64 PNG, so the tray always has something to show.
const TRAY_ICON_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAUUlEQVR4nGNgGPKAEZnzf97W/yiSSd6M+MRRDEBXRNBmqCFMpGjCBuAGIDuLWNsxXECMIehqMLyAzxBscljDAJtCUrwIB//nbf1PauyMAjIAAOcqGCdajAOtAAAAAElFTkSuQmCC';

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else win.show();
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  // Keep running in the tray on all platforms for a widget-like experience.
});

// IPC: window controls from the renderer's custom title bar
ipcMain.on('widget:minimize-to-tray', () => {
  if (win) win.hide();
});
ipcMain.on('widget:drag-resize-toggle', () => {});
ipcMain.on('widget:close-app', () => {
  app.isQuitting = true;
  app.quit();
});