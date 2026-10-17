import { app, BrowserWindow } from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || '5000');

let mainWindow;
let serverProcess;

function waitForServer(url) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 20000);
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode >= 200 && res.statusCode < 500) {
          clearTimeout(timeout);
          resolve(true);
          return;
        }
        setTimeout(check, 250);
      });

      req.on('error', () => {
        setTimeout(check, 250);
      });
    };

    check();
  });
}

function startServer() {
  if (serverProcess) return;

  const distEntry = path.join(app.getAppPath(), 'dist', 'index.cjs');
  if (!fs.existsSync(distEntry)) {
    console.log('[electron] dist/index.cjs not found. Run "npm run build" first.');
    return;
  }

  serverProcess = spawn(process.execPath, [distEntry], {
    cwd: app.getAppPath(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(PORT),
    },
    stdio: 'inherit',
  });

  serverProcess.on('exit', (code, signal) => {
    console.log(`[electron] server exited with code=${code ?? 'null'} signal=${signal ?? 'null'}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 980,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    title: 'Solid Spoon',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  startServer();

  const ready = await waitForServer(`http://127.0.0.1:${PORT}/api/status`);
  if (ready) {
    createWindow();
  } else {
    createWindow();
    mainWindow.loadURL(`data:text/html,<html><body style="font-family:Segoe UI,sans-serif;background:#0b0b0d;color:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh;">Server did not respond. Run <strong>npm run build</strong> or <strong>npm run dev:electron</strong>.</body></html>`);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
});
