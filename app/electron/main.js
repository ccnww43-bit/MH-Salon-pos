const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { startServer } = require('./server');

let mainWindow;

// Windows uses this to group the app correctly in the taskbar and to show
// notifications under the right name, instead of a generic "Electron".
app.setAppUserModelId('com.mhdigital.salonpos');

// Only one copy of the app should ever run at once. Without this, opening
// the app twice would start two separate local servers, and the two
// windows could show two different snapshots of the data at the same time.
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // Store Electron's writable data outside Program Files.
  // This prevents "Access is denied (0x5)" cache errors after installation.
  const appDataPath = app.getPath('appData');
  const userDataPath = path.join(appDataPath, 'MH Digital Salon POS');

  app.setPath('userData', userDataPath);
  app.setPath('cache', path.join(userDataPath, 'Cache'));

  const iconPath = path.join(__dirname, 'icon.png');

  // Builds a stable ID tied to this physical computer (hostname + network
  // hardware address), used to lock a paid license to one machine. This is
  // what lib/license.ts expects to receive through the preload bridge.
  function computeMachineId() {
    const nets = os.networkInterfaces();
    let mac = '';

    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
          mac = net.mac;
          break;
        }
      }
      if (mac) break;
    }

    const raw = [os.hostname(), os.platform(), os.arch(), mac].join('|');
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 24).toUpperCase();
  }

  ipcMain.handle('mh-digital-get-machine-id', () => computeMachineId());

  async function createWindow() {
    let serverPort;

    try {
      serverPort = await startServer();
    } catch (err) {
      dialog.showErrorBox(
        'Salon POS failed to start',
        'The app could not start its local server. Please restart the app. ' +
          'If this keeps happening, contact support.\n\nDetails: ' + (err && err.message ? err.message : String(err))
      );
      app.quit();
      return;
    }

    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1024,
      minHeight: 700,
      autoHideMenuBar: true,
      icon: iconPath,

      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    mainWindow.loadURL(`http://127.0.0.1:${serverPort}/`);

    // Keep the app fully self-contained: block any attempt to open a new
    // native window or navigate away from the local app.
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    mainWindow.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith(`http://127.0.0.1:${serverPort}`)) {
        event.preventDefault();
      }
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  app.whenReady().then(createWindow);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}
