const { app, BrowserWindow, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// Explicitly register Windows Application User Model ID for proper taskbar grouping & icon display
if (process.platform === 'win32') {
  app.setAppUserModelId('com.smartabsensi.guru.desktop');
}

let mainWindow = null;

/**
 * Resolve application icon with fallback strategy:
 * 1. build/icon.ico (Packaged multi-resolution Windows ICO)
 * 2. dist/school-logo.png (Packaged dist web asset)
 * 3. build/icon.png
 * 4. public/school-logo.png (Local dev mode)
 */
function resolveAppIcon() {
  const candidates = [
    path.join(__dirname, '../build/icon.ico'),
    path.join(__dirname, '../dist/school-logo.png'),
    path.join(__dirname, '../build/icon.png'),
    path.join(__dirname, '../public/school-logo.png'),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // Ignore and check next candidate
    }
  }
  return undefined;
}

function createWindow() {
  const appIcon = resolveAppIcon();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'Smart Absensi Guru',
    icon: appIcon,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    show: false,
  });

  // Load production dist web assets
  const indexPath = path.join(__dirname, '../dist/index.html');
  mainWindow.loadFile(indexPath);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Block unsafe in-app popup windows and open external URLs in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle management
app.whenReady().then(() => {
  const distDir = path.join(__dirname, '../dist');

  // Intercept root-relative file requests (e.g. file:///C:/school-logo.png or file:///school-logo.png)
  // which occur in Chromium DOM (<img src="/school-logo.png">) under file:// protocol,
  // and redirect them to their physical location inside dist/
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['file:///*'] }, (details, callback) => {
    try {
      const parsed = new URL(details.url);
      const decodedPath = decodeURIComponent(parsed.pathname);

      // Normalize Windows file path (strip leading slash before drive letter e.g. /C:/foo -> C:/foo)
      const normalizedFsPath = process.platform === 'win32' && /^\/[a-zA-Z]:/.test(decodedPath)
        ? decodedPath.slice(1)
        : decodedPath;

      // If file exists at exact disk location, allow normal loading
      if (fs.existsSync(normalizedFsPath)) {
        return callback({});
      }

      // 1. Try relative path inside dist directory (e.g. /audio/bell.mp3 -> dist/audio/bell.mp3)
      const relativePath = decodedPath.replace(/^\/[a-zA-Z]:\/?/, '').replace(/^\/+/, '');
      if (relativePath) {
        const candidatePath = path.join(distDir, relativePath);
        if (fs.existsSync(candidatePath)) {
          return callback({ redirectURL: pathToFileURL(candidatePath).href });
        }
      }

      // 2. Fallback: check filename directly inside dist (e.g. /school-logo.png -> dist/school-logo.png)
      const basename = path.basename(decodedPath);
      if (basename) {
        const candidateBasename = path.join(distDir, basename);
        if (fs.existsSync(candidateBasename)) {
          return callback({ redirectURL: pathToFileURL(candidateBasename).href });
        }
      }
    } catch {
      // Ignore URL parsing errors and allow standard fallback
    }

    callback({});
  });

  // Grant camera & geolocation permissions for QR scanning and attendance
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'geolocation', 'notifications'].includes(permission);
    callback(allowed);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
