import path from "path";
import fs from "fs";
import archiver from "archiver";
import { build as viteBuild } from "vite";

export const MASTER_BUNDLE_VERSION = "1.4";
export const MASTER_BUNDLE_FILENAME = `kpro-gauges-self-host-v${MASTER_BUNDLE_VERSION}.zip`;
export const MASTER_BUNDLE_DIR = path.resolve(process.cwd(), "dist", "master-bundle");
export const MASTER_BUNDLE_PATH = path.join(MASTER_BUNDLE_DIR, MASTER_BUNDLE_FILENAME);

const ROOT = "kpro-gauges-self-host";

function configExample(): string {
  return JSON.stringify({
    port: 8080,
    masterPassword: "0709281001",
    notes: [
      "Copy this file to config.json and edit as needed.",
      "PORT and MASTER_PASSWORD env vars override these values.",
      "Default master password matches the one shipped with the official site.",
    ],
  }, null, 2);
}

function startSh(): string {
  return `#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is not installed. Install Node 18+ from https://nodejs.org and try again."
  exit 1
fi

if [ -f config.json ]; then
  PORT_FROM_CONFIG=$(node -e "try{console.log(require('./config.json').port||'')}catch(e){}")
  PASS_FROM_CONFIG=$(node -e "try{console.log(require('./config.json').masterPassword||'')}catch(e){}")
  [ -n "$PORT_FROM_CONFIG" ] && export PORT="$PORT_FROM_CONFIG"
  [ -n "$PASS_FROM_CONFIG" ] && export MASTER_PASSWORD="$PASS_FROM_CONFIG"
fi

export PORT="\${PORT:-8080}"
export MASTER_PASSWORD="\${MASTER_PASSWORD:-0709281001}"

if [ ! -f "${MASTER_BUNDLE_FILENAME}" ]; then
  echo "Building master bundle from local files..."
  node tools/build-master-bundle.mjs || echo "WARN: master bundle build failed; /api/download-master will return 'bundle not built'."
fi

IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$IP" ] && IP=$(ipconfig getifaddr en0 2>/dev/null || echo "localhost")

echo "================================================================"
echo "  KPro Gauges Self-Host Kit v${MASTER_BUNDLE_VERSION}"
echo "  Local:    http://localhost:$PORT"
echo "  Network:  http://$IP:$PORT"
echo "  Master password: \${MASTER_PASSWORD}  (change in config.json)"
echo "================================================================"

node server.js
`;
}

function startBat(): string {
  // CRLF line endings + config.json reading + LAN IP discovery
  const lines = [
    `@echo off`,
    `setlocal enabledelayedexpansion`,
    `cd /d "%~dp0"`,
    ``,
    `where node >nul 2>nul`,
    `if errorlevel 1 (`,
    `  echo ERROR: Node.js is not installed. Install Node 18+ from https://nodejs.org and try again.`,
    `  pause`,
    `  exit /b 1`,
    `)`,
    ``,
    `if exist config.json (`,
    `  for /f "delims=" %%i in ('node -e "try{console.log(require('./config.json').port||'')}catch(e){}"') do set CFG_PORT=%%i`,
    `  for /f "delims=" %%i in ('node -e "try{console.log(require('./config.json').masterPassword||'')}catch(e){}"') do set CFG_PASS=%%i`,
    `  if not "!CFG_PORT!"=="" set PORT=!CFG_PORT!`,
    `  if not "!CFG_PASS!"=="" set MASTER_PASSWORD=!CFG_PASS!`,
    `)`,
    ``,
    `if "%PORT%"=="" set PORT=8080`,
    `if "%MASTER_PASSWORD%"=="" set MASTER_PASSWORD=0709281001`,
    ``,
    `if not exist "${MASTER_BUNDLE_FILENAME}" (`,
    `  echo Building master bundle from local files...`,
    `  node tools\\build-master-bundle.mjs`,
    `)`,
    ``,
    `set LAN_IP=`,
    `for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (`,
    `  if not defined LAN_IP set LAN_IP=%%a`,
    `)`,
    `if defined LAN_IP set LAN_IP=!LAN_IP: =!`,
    `if not defined LAN_IP set LAN_IP=localhost`,
    ``,
    `echo ================================================================`,
    `echo   KPro Gauges Self-Host Kit v${MASTER_BUNDLE_VERSION}`,
    `echo   Local:    http://localhost:%PORT%`,
    `echo   Network:  http://!LAN_IP!:%PORT%`,
    `echo   Master password: %MASTER_PASSWORD%  (change in config.json)`,
    `echo ================================================================`,
    ``,
    `node server.js`,
    `pause`,
    ``,
  ];
  return lines.join("\r\n");
}

function readme(): string {
  return `# KPro Gauges — Self-Host Kit v${MASTER_BUNDLE_VERSION}

This bundle lets you run the KPro digital gauge cluster website on your own
computer or server, so people can download the gauge app from a URL you
control instead of relying on Replit.

## What's inside

- server.js                       The Node server (gauges + downloads + master)
- public/                         The pre-built website
- public/downloads/               Drop replacement build files here (APK, Pi zip, etc.)
- node_modules/ws/                Bundled WebSocket library
- tools/build-master-bundle.mjs   Pure-Node zip builder for /api/download-master
- start.sh / start.bat            One-click launchers
- config.example.json             Optional config (copy to config.json)

## Requirements

- Node.js 18 or newer  (https://nodejs.org)
- A free port on your machine (default 8080)

## Run it

### Mac / Linux

    chmod +x start.sh
    ./start.sh

### Windows

Double-click start.bat.

The launcher prints the local and network URLs. On first launch it builds
its own master bundle from the files in this folder and saves it as
\`${MASTER_BUNDLE_FILENAME}\` so the password-locked download works
out of the box.

## Sharing with friends

Tell your friends to open the URL the launcher printed
(e.g. http://192.168.1.42:8080). Your computer must be powered on and on
the same network. To make it reachable from outside your home network,
point a domain at your computer or use a tunnelling service (ngrok,
Cloudflare Tunnel, etc.).

## The Master Bundle download

The site itself includes a "Master Bundle (Self-Host Kit)" download in
the Downloads section, locked by a password. By default the password is
\`0709281001\` — the same one shipped with the official site, so behaviour
matches out of the box.

To change the password on your self-hosted copy:

1. Copy \`config.example.json\` to \`config.json\`.
2. Edit \`masterPassword\`.
3. Restart the server.

Or set the \`MASTER_PASSWORD\` environment variable before running.

If \`/api/download-master\` returns "bundle not built", run:

    node tools/build-master-bundle.mjs

then refresh.

## Adding more downloads

Drop any file into \`public/downloads/\` and it will be reachable at
\`http://your-ip:PORT/downloads/<filename>\`. Use this to host the Android
APK, Pi packages, or any other build artifact you want to share.

## Changing the port

Edit \`port\` in \`config.json\`, or set the \`PORT\` environment variable.
`;
}

// Pure-Node zip builder shipped inside the bundle. Uses only Node built-ins
// (fs, path, zlib) so it works in the bundle without any npm install.
function buildMasterBundleScript(): string {
  return `#!/usr/bin/env node
// Pure-Node ZIP writer (DEFLATE) — no npm deps. Builds
// ${MASTER_BUNDLE_FILENAME} from this self-host kit's own files so
// /api/download-master works on the self-hosted copy.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const ZIP_NAME = '${MASTER_BUNDLE_FILENAME}';
const ROOT_PREFIX = '${ROOT}';
const OUT_PATH = path.join(ROOT_DIR, ZIP_NAME);

const SKIP_TOP = new Set([ZIP_NAME, 'config.json', 'node_modules']);

function walk(dir, prefix) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (prefix === '' && SKIP_TOP.has(name)) continue;
    const full = path.join(dir, name);
    const rel = prefix ? prefix + '/' + name : name;
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full, rel));
    } else if (st.isFile()) {
      out.push({ full, rel });
    }
  }
  return out;
}

function dosTime(d) {
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((Math.floor(d.getSeconds() / 2)) & 0x1f);
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
  return { time, date };
}

function buildZip(entries) {
  const localChunks = [];
  const central = [];
  let offset = 0;
  const now = new Date();
  const { time, date } = dosTime(now);

  for (const e of entries) {
    const data = fs.readFileSync(e.full);
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const useDeflate = compressed.length < data.length;
    const stored = useDeflate ? compressed : data;
    const method = useDeflate ? 8 : 0;
    const crc = zlib.crc32(data);
    const nameBuf = Buffer.from(e.rel, 'utf8');

    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);                // version
    local.writeUInt16LE(1 << 11, 6);           // flags: utf-8
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(stored.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);                // extra len
    nameBuf.copy(local, 30);

    localChunks.push(local, stored);

    const cd = Buffer.alloc(46 + nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(0x031e, 4);               // version made by (Unix, 3.0)
    cd.writeUInt16LE(20, 6);                   // version needed
    cd.writeUInt16LE(1 << 11, 8);              // flags
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(time, 12);
    cd.writeUInt16LE(date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(stored.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);                   // extra len
    cd.writeUInt16LE(0, 32);                   // comment len
    cd.writeUInt16LE(0, 34);                   // disk #
    cd.writeUInt16LE(0, 36);                   // internal attrs
    const isExec = e.rel.endsWith('.sh');
    const unixMode = isExec ? 0o100755 : 0o100644;
    cd.writeUInt32LE((unixMode << 16) >>> 0, 38); // external attrs (Unix mode)
    cd.writeUInt32LE(offset, 42);              // offset of local header
    nameBuf.copy(cd, 46);

    central.push(cd);
    offset += local.length + stored.length;
  }

  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);                    // disk #
  eocd.writeUInt16LE(0, 6);                    // disk w/ central dir
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);              // central dir offset
  eocd.writeUInt16LE(0, 20);                   // comment len

  return Buffer.concat([...localChunks, centralBuf, eocd]);
}

const files = walk(ROOT_DIR, '').map(e => ({ full: e.full, rel: ROOT_PREFIX + '/' + e.rel }));
console.log('Packing ' + files.length + ' files into ' + ZIP_NAME + '...');
const zip = buildZip(files);
fs.writeFileSync(OUT_PATH, zip);
console.log('Wrote ' + OUT_PATH + ' (' + zip.length + ' bytes).');
`;
}

let buildPromise: Promise<void> | null = null;

function addDirRecursive(archive: archiver.Archiver, dirPath: string, zipPrefix: string) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const zipPath = zipPrefix + "/" + entry.name;
    if (entry.isDirectory()) {
      addDirRecursive(archive, fullPath, zipPath);
    } else if (entry.name !== "index.html") {
      archive.file(fullPath, { name: zipPath });
    }
  }
}

async function buildOnce(): Promise<void> {
  const distClientPath = path.resolve(process.cwd(), "dist", "public");
  if (!fs.existsSync(distClientPath)) {
    console.log("[master-bundle] Building frontend...");
    await viteBuild();
  }
  if (!fs.existsSync(distClientPath)) {
    throw new Error("frontend build output missing");
  }

  fs.mkdirSync(MASTER_BUNDLE_DIR, { recursive: true });
  const tmpPath = MASTER_BUNDLE_PATH + ".tmp";

  await new Promise<void>((resolve, reject) => {
    const out = fs.createWriteStream(tmpPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    out.on("close", () => resolve());
    out.on("error", reject);
    archive.on("error", reject);
    archive.pipe(out);

    // 1. Built frontend
    addDirRecursive(archive, distClientPath, `${ROOT}/public`);

    // 1b. Cleaned index.html
    const indexHtmlPath = path.join(distClientPath, "index.html");
    let indexHtml = fs.readFileSync(indexHtmlPath, "utf-8");
    indexHtml = indexHtml.replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/g, "");
    indexHtml = indexHtml.replace(/<link[^>]*fonts\.gstatic\.com[^>]*>/g, "");
    indexHtml = indexHtml.replace(/<link[^>]*preconnect[^>]*>/g, "");
    archive.append(indexHtml, { name: `${ROOT}/public/index.html` });

    // 2. Server
    const standaloneServer = fs.readFileSync(
      path.resolve(process.cwd(), "standalone-server.js"),
      "utf-8",
    );
    archive.append(standaloneServer, { name: `${ROOT}/server.js` });

    // 3. Bundled ws module
    const wsModuleDir = path.resolve(process.cwd(), "node_modules", "ws");
    if (fs.existsSync(wsModuleDir)) {
      archive.file(path.join(wsModuleDir, "index.js"), { name: `${ROOT}/node_modules/ws/index.js` });
      archive.file(path.join(wsModuleDir, "package.json"), { name: `${ROOT}/node_modules/ws/package.json` });
      const wsLibDir = path.join(wsModuleDir, "lib");
      if (fs.existsSync(wsLibDir)) {
        for (const file of fs.readdirSync(wsLibDir)) {
          if (file.endsWith(".js")) {
            archive.file(path.join(wsLibDir, file), { name: `${ROOT}/node_modules/ws/lib/${file}` });
          }
        }
      }
    }

    // 4. package.json
    archive.append(JSON.stringify({
      name: "kpro-gauges-self-host",
      version: MASTER_BUNDLE_VERSION,
      private: true,
      type: "commonjs",
      scripts: { start: "node server.js" },
      engines: { node: ">=18" },
    }, null, 2), { name: `${ROOT}/package.json` });

    // 5. Drop-in slot
    const artifactsDir = path.resolve(process.cwd(), "public", "downloads");
    if (fs.existsSync(artifactsDir)) {
      addDirRecursive(archive, artifactsDir, `${ROOT}/public/downloads`);
    } else {
      archive.append(
        "Drop replacement build files here (APK, Pi zip, etc.) and they will be served at /downloads/<filename>.\n",
        { name: `${ROOT}/public/downloads/README.txt` },
      );
    }

    // 6. config + scripts + docs + bundle builder
    archive.append(configExample(), { name: `${ROOT}/config.example.json` });
    archive.append(startSh(), { name: `${ROOT}/start.sh`, mode: 0o755 });
    archive.append(startBat(), { name: `${ROOT}/start.bat` });
    archive.append(readme(), { name: `${ROOT}/README.md` });
    archive.append(buildMasterBundleScript(), {
      name: `${ROOT}/tools/build-master-bundle.mjs`,
      mode: 0o755,
    });

    archive.finalize();
  });

  fs.renameSync(tmpPath, MASTER_BUNDLE_PATH);
  const size = fs.statSync(MASTER_BUNDLE_PATH).size;
  console.log(`[master-bundle] Built ${MASTER_BUNDLE_PATH} (${size} bytes).`);
}

export function ensureMasterBundleBuilt(): Promise<void> {
  if (fs.existsSync(MASTER_BUNDLE_PATH)) return Promise.resolve();
  if (!buildPromise) {
    buildPromise = buildOnce().catch((err) => {
      buildPromise = null;
      throw err;
    });
  }
  return buildPromise;
}

export function rebuildMasterBundle(): Promise<void> {
  buildPromise = buildOnce().catch((err) => {
    buildPromise = null;
    throw err;
  });
  return buildPromise;
}
