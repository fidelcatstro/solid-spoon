import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import type { TelemetryData } from "@shared/schema";
import { defaultTelemetry, defaultSettings, defaultLayout, defaultTripData } from "@shared/schema";
import archiver from "archiver";
import path from "path";
import fs from "fs";
import { build as viteBuild } from "vite";
import {
  MASTER_BUNDLE_FILENAME,
  MASTER_BUNDLE_PATH,
  ensureMasterBundleBuilt,
  rebuildMasterBundle,
} from "./master-bundle";

interface KProClient {
  ws: WebSocket;
  lastPing: number;
}

const clients = new Map<WebSocket, KProClient>();

// ── Log broadcast system ──────────────────────────────────────────────────────
interface LogEntry {
  level: 'info' | 'warn' | 'error';
  source: string;
  message: string;
  ts: number;
}

const LOG_BUFFER_MAX = 200;
const logBuffer: LogEntry[] = [];

function broadcastLog(level: 'info' | 'warn' | 'error', source: string, message: string) {
  const entry: LogEntry = { level, source, message, ts: Date.now() };
  logBuffer.push(entry);
  if (logBuffer.length > LOG_BUFFER_MAX) logBuffer.splice(0, logBuffer.length - LOG_BUFFER_MAX);
  const packet = JSON.stringify({ type: 'log', ...entry });
  clients.forEach((_c, ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(packet);
  });
}
// ─────────────────────────────────────────────────────────────────────────────

function generateDemoTelemetry(time: number): TelemetryData {
  const baseRpm = 2500;
  const rpmVariation = Math.sin(time * 0.5) * 2000 + Math.sin(time * 1.3) * 1000 + Math.sin(time * 0.2) * 500;
  const rpm = Math.max(800, Math.min(8500, baseRpm + rpmVariation));
  
  const speed = Math.max(0, (rpm - 1000) / 80 + Math.sin(time * 0.7) * 1.5);
  const coolantBase = 85 + Math.sin(time * 0.08) * 10 + Math.sin(time * 0.03) * 3;
  const fuelLevel = 75 - (time * 0.0008) % 65;
  const afr = 14.7 + Math.sin(time * 1.8) * 0.3 + Math.sin(time * 0.4) * 0.15 + (rpm > 6000 ? -0.5 : 0);
  const map = 30 + (rpm / 9000) * 70 + Math.sin(time * 1.1) * 4;
  const throttle = Math.max(0, Math.min(100, (rpm - 800) / 77 + Math.sin(time * 0.9) * 3));

  const vtcDeg = parseFloat(((Math.sin(time * 0.3) * 15 + 20) + Math.sin(time * 0.8) * 3).toFixed(1));
  const timingAdv = parseFloat((15 + (rpm / 9000) * 20 + Math.sin(time * 0.6) * 4).toFixed(1));
  const injPw = parseFloat((1.5 + (rpm / 9000) * 6 + Math.sin(time * 0.4) * 0.5).toFixed(2));
  const injDuty = parseFloat(Math.min(95, Math.max(2, (injPw * rpm) / (1200))).toFixed(1));
  const iatVal = parseFloat((35 + Math.sin(time * 0.05) * 8 + Math.sin(time * 0.15) * 3).toFixed(1));
  const oilTempVal = parseFloat((90 + Math.sin(time * 0.04) * 12 + Math.sin(time * 0.1) * 4).toFixed(1));
  const oilPressVal = parseFloat((40 + (rpm / 9000) * 35 + Math.sin(time * 0.7) * 5).toFixed(1));
  const batVal = parseFloat((13.8 + Math.sin(time * 0.12) * 0.6).toFixed(1));
  const stftVal = parseFloat((Math.sin(time * 1.5) * 4 + Math.sin(time * 0.3) * 2).toFixed(1));
  const ltftVal = parseFloat((Math.sin(time * 0.05) * 3 + 1).toFixed(1));
  const knockVal = Math.sin(time * 0.01) > 0.95 ? Math.floor(Math.random() * 3) : 0;
  const gearVal = speed < 5 ? 0 : speed < 20 ? 1 : speed < 40 ? 2 : speed < 60 ? 3 : speed < 80 ? 4 : 5;
  
  return {
    rpm: parseFloat(rpm.toFixed(1)),
    speed: parseFloat(speed.toFixed(1)),
    coolantTemp: parseFloat(coolantBase.toFixed(1)),
    fuelLevel: Math.max(10, parseFloat(fuelLevel.toFixed(1))),
    afr: parseFloat(afr.toFixed(2)),
    map: parseFloat(map.toFixed(1)),
    throttlePosition: parseFloat(throttle.toFixed(1)),
    oilPressure: oilPressVal,
    oilTemp: oilTempVal,
    batteryVoltage: batVal,
    iat: iatVal,
    gear: gearVal,
    vtcDegree: vtcDeg,
    timingAdvance: timingAdv,
    injectorPulseWidth: injPw,
    injectorDutyCycle: injDuty,
    stft: stftVal,
    ltft: ltftVal,
    knockCount: knockVal,
    dtcCodes: [],
    checkEngine: false,
    vtec: rpm > 5800,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  let demoTime = 0;
  let demoInterval: ReturnType<typeof setInterval> | null = null;
  
  const startDemoMode = () => {
    if (demoInterval) return;
    broadcastLog('info', 'Server', 'Demo mode started — no ECU connected');
    demoInterval = setInterval(() => {
      demoTime += 0.033;
      const telemetry = generateDemoTelemetry(demoTime);
      
      clients.forEach((client, ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(telemetry));
        }
      });
    }, 33);
  };
  
  const stopDemoMode = () => {
    if (demoInterval) {
      clearInterval(demoInterval);
      demoInterval = null;
      broadcastLog('info', 'Server', 'Demo mode stopped');
    }
  };
  
  wss.on('connection', (ws) => {
    broadcastLog('info', 'WS', 'Browser client connected');
    
    clients.set(ws, {
      ws,
      lastPing: Date.now(),
    });
    
    if (clients.size === 1) {
      startDemoMode();
    }
    
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to KPro Gauge Cluster Server v1.6',
      timestamp: Date.now(),
    }));

    // Replay recent log history to new client
    if (logBuffer.length > 0) {
      ws.send(JSON.stringify({ type: 'log_batch', entries: [...logBuffer] }));
    }
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'ping') {
          const client = clients.get(ws);
          if (client) {
            client.lastPing = Date.now();
          }
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
        
        if (data.type === 'telemetry') {
          clients.forEach((client, clientWs) => {
            if (clientWs !== ws && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify(data.payload));
            }
          });
        }

        if (data.type === 'settings_sync' || data.type === 'layout_sync') {
          clients.forEach((_client, clientWs) => {
            if (clientWs !== ws && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: data.type, payload: data.payload }));
            }
          });
        }
      } catch (e) {
        broadcastLog('error', 'WS', `Failed to parse client message: ${e}`);
      }
    });
    
    ws.on('close', () => {
      broadcastLog('info', 'WS', 'Browser client disconnected');
      clients.delete(ws);
      
      if (clients.size === 0) {
        stopDemoMode();
      }
    });
    
    ws.on('error', (error) => {
      broadcastLog('error', 'WS', `WebSocket error: ${error}`);
      clients.delete(ws);
    });
  });
  
  const pingInterval = setInterval(() => {
    const now = Date.now();
    clients.forEach((client, ws) => {
      if (now - client.lastPing > 30000) {
        ws.terminate();
        clients.delete(ws);
      } else if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    });
  }, 10000);
  
  httpServer.on('close', () => {
    clearInterval(pingInterval);
    stopDemoMode();
  });

  app.get('/api/settings', (_req, res) => {
    res.json(defaultSettings);
  });
  
  app.get('/api/layout', (_req, res) => {
    res.json(defaultLayout);
  });
  
  app.get('/api/trip-data', (_req, res) => {
    res.json(defaultTripData);
  });
  
  app.get('/api/status', (_req, res) => {
    res.json({
      status: 'ok',
      connectedClients: clients.size,
      demoMode: demoInterval !== null,
      ecuConnected: false,
      ecuConnectionMode: null,
      ecuDeviceName: null,
      usbLibAvailable: false,
      serialLibAvailable: false,
      timestamp: Date.now(),
    });
  });

  app.get('/api/usb/devices', (_req, res) => {
    res.json({
      devices: [],
      ecuConnected: false,
      ecuConnectionMode: null,
      ecuDeviceName: null,
      usbLibAvailable: false,
      serialLibAvailable: false,
    });
  });

  app.post('/api/usb/connect', (_req, res) => {
    res.json({
      success: false,
      ecuConnected: false,
      ecuConnectionMode: null,
      ecuDeviceName: null,
      message: 'USB connection only available on standalone Pi server',
    });
  });

  app.post('/api/usb/disconnect', (_req, res) => {
    res.json({ success: true, ecuConnected: false });
  });

  app.get('/api/download-offline', async (_req, res) => {
    try {
      const distClientPath = path.resolve(process.cwd(), 'dist', 'public');
      let clientDir = distClientPath;

      if (!fs.existsSync(distClientPath)) {
        console.log('Building frontend for offline package...');
        await viteBuild();
      }

      if (!fs.existsSync(clientDir)) {
        return res.status(500).json({ error: 'Build failed - no output found' });
      }

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="kpro-gauges-raspi.zip"');

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (err: Error) => { throw err; });
      archive.pipe(res);

      const addDirRecursive = (dirPath: string, zipPrefix: string) => {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          const zipPath = zipPrefix + '/' + entry.name;
          if (entry.isDirectory()) {
            addDirRecursive(fullPath, zipPath);
          } else if (entry.name !== 'index.html') {
            archive.file(fullPath, { name: zipPath });
          }
        }
      };
      addDirRecursive(clientDir, 'kpro-gauges/public');

      const indexHtmlPath = path.join(clientDir, 'index.html');
      let indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
      indexHtml = indexHtml.replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/g, '');
      indexHtml = indexHtml.replace(/<link[^>]*fonts\.gstatic\.com[^>]*>/g, '');
      indexHtml = indexHtml.replace(/<link[^>]*preconnect[^>]*>/g, '');
      archive.append(indexHtml, { name: 'kpro-gauges/public/index.html' });

      const standaloneServer = fs.readFileSync(path.resolve(process.cwd(), 'standalone-server.js'), 'utf-8');
      archive.append(standaloneServer, { name: 'kpro-gauges/server.js' });

      const wsModuleDir = path.resolve(process.cwd(), 'node_modules', 'ws');
      if (fs.existsSync(wsModuleDir)) {
        const wsIndex = fs.readFileSync(path.join(wsModuleDir, 'index.js'), 'utf-8');
        archive.append(wsIndex, { name: 'kpro-gauges/node_modules/ws/index.js' });
        const wsPackageJson = fs.readFileSync(path.join(wsModuleDir, 'package.json'), 'utf-8');
        archive.append(wsPackageJson, { name: 'kpro-gauges/node_modules/ws/package.json' });
        const wsLibDir = path.join(wsModuleDir, 'lib');
        if (fs.existsSync(wsLibDir)) {
          const wsLibFiles = fs.readdirSync(wsLibDir);
          for (const file of wsLibFiles) {
            if (file.endsWith('.js')) {
              const content = fs.readFileSync(path.join(wsLibDir, file), 'utf-8');
              archive.append(content, { name: `kpro-gauges/node_modules/ws/lib/${file}` });
            }
          }
        }
      }

      const packageJson = JSON.stringify({
        name: "kpro-gauges-offline",
        version: "1.4",
        private: true,
        scripts: {
          start: "node server.js",
        },
      }, null, 2);
      archive.append(packageJson, { name: 'kpro-gauges/package.json' });

      const startSh = `#!/bin/bash
# S2000 KPro Gauge Cluster - Raspberry Pi Startup Script
# No internet required - everything is self-contained

cd "$(dirname "$0")"

PORT=\${PORT:-8080}
export SERIAL_PORT=\${SERIAL_PORT:-}
export SERIAL_BAUD=\${SERIAL_BAUD:-38400}

# Check Node.js is installed
if ! command -v node &> /dev/null; then
  echo ""
  echo "ERROR: Node.js is not installed!"
  echo ""
  echo "Install it with:"
  echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "  sudo apt-get install -y nodejs"
  echo ""
  echo "Then run ./start.sh again."
  exit 1
fi

# Add user to dialout group for serial port access (needs one reboot)
if ! groups | grep -q dialout; then
  echo "Adding user to dialout group for serial port access..."
  sudo usermod -a -G dialout $USER 2>/dev/null
  echo ""
  echo "IMPORTANT: You need to reboot once for serial port access."
  echo "Run: sudo reboot"
  echo "Then run ./start.sh again after reboot."
  echo ""
fi

echo ""
echo "Starting KPro Gauge Cluster on port $PORT..."
echo ""

node server.js &
SERVER_PID=$!

sleep 3

CHROMIUM=""
for cmd in chromium-browser chromium google-chrome; do
  if command -v $cmd &> /dev/null; then
    CHROMIUM=$cmd
    break
  fi
done

if [ -n "$CHROMIUM" ]; then
  echo "Launching $CHROMIUM in kiosk mode..."
  $CHROMIUM --kiosk --disable-infobars --disable-session-crashed-bubble \\
    --noerrdialogs --enable-features=WebBluetooth,WebSerial \\
    --enable-experimental-web-platform-features \\
    --no-first-run --start-fullscreen \\
    --disable-pinch --overscroll-history-navigation=0 \\
    --disable-translate --disable-extensions \\
    http://localhost:$PORT 2>/dev/null &
else
  echo "Chromium not found. Open http://localhost:$PORT manually."
fi

echo ""
echo "Gauge cluster is running!"
echo "Press Ctrl+C to stop."
echo ""

cleanup() {
  echo "Shutting down..."
  kill $SERVER_PID 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

wait $SERVER_PID
`;
      archive.append(startSh, { name: 'kpro-gauges/start.sh', mode: 0o755 });

      const stopSh = `#!/bin/bash
# Stop the KPro Gauge Cluster
pkill -f "node server.js" 2>/dev/null
pkill -f "chromium.*kpro\\|chromium.*localhost" 2>/dev/null
echo "Gauge cluster stopped."
`;
      archive.append(stopSh, { name: 'kpro-gauges/stop.sh', mode: 0o755 });

      const setupHotspotSh = `#!/bin/bash
# ============================================================
# S2000 KPro Gauge Cluster - WiFi Hotspot Setup
# ============================================================
# Creates a WiFi network from your Pi so your phone can connect
# and view/control the gauge cluster. No internet required.
#
# USAGE:
#   sudo bash setup-hotspot.sh
#   sudo bash setup-hotspot.sh MyWiFiName MyPassword
#
# DEFAULT:
#   WiFi Name:     KProGauges
#   WiFi Password: s2000kpro
# ============================================================

HOTSPOT_SSID="\${1:-KProGauges}"
HOTSPOT_PASS="\${2:-s2000kpro}"
HOTSPOT_CHANNEL="6"
HOTSPOT_IP="192.168.4.1"

if [ "\$(id -u)" -ne 0 ]; then
  echo "ERROR: Run with sudo:  sudo bash setup-hotspot.sh"
  exit 1
fi

if [ \${#HOTSPOT_PASS} -lt 8 ]; then
  echo "ERROR: WiFi password must be at least 8 characters."
  exit 1
fi

echo ""
echo "============================================"
echo "  KPro Gauges - WiFi Hotspot Setup"
echo "============================================"
echo ""
echo "  WiFi Name:     $HOTSPOT_SSID"
echo "  WiFi Password: $HOTSPOT_PASS"
echo "  Pi IP Address: $HOTSPOT_IP"
echo "  Gauge URL:     http://$HOTSPOT_IP:8080"
echo ""

# ---- STEP 1: Install packages ----
echo "[1/7] Installing hostapd and dnsmasq..."
apt-get update -qq 2>/dev/null
apt-get install -y hostapd dnsmasq 2>/dev/null
if ! command -v hostapd &>/dev/null; then
  echo "  ERROR: hostapd failed to install."
  echo "  Make sure your Pi has internet for this first-time setup."
  exit 1
fi
echo "  Done."

# ---- STEP 2: Stop ALL conflicting services ----
echo "[2/7] Stopping conflicting services..."
systemctl stop hostapd 2>/dev/null || true
systemctl stop dnsmasq 2>/dev/null || true

# wpa_supplicant fights with hostapd for control of wlan0
# We need to stop it AND prevent it from auto-restarting
systemctl stop wpa_supplicant 2>/dev/null || true
systemctl mask wpa_supplicant 2>/dev/null || true
killall wpa_supplicant 2>/dev/null || true

# If NetworkManager is running, tell it to stop managing wlan0
# (don't disable NM entirely - it may manage ethernet)
if command -v nmcli &>/dev/null; then
  echo "  Removing wlan0 from NetworkManager..."
  nmcli device set wlan0 managed no 2>/dev/null || true
  mkdir -p /etc/NetworkManager/conf.d
  cat > /etc/NetworkManager/conf.d/kpro-hotspot.conf << NMEOF
[keyfile]
unmanaged-devices=interface-name:wlan0
NMEOF
  systemctl reload NetworkManager 2>/dev/null || true
fi
echo "  Done."

# ---- STEP 3: Unblock WiFi radio and set country ----
echo "[3/7] Unblocking WiFi radio..."
rfkill unblock wifi 2>/dev/null || true
# Set regulatory domain (required on some Pis for WiFi to work)
iw reg set US 2>/dev/null || true
raspi-config nonint do_wifi_country US 2>/dev/null || true
echo "  Done."

# ---- STEP 4: Configure static IP ----
echo "[4/7] Configuring static IP ($HOTSPOT_IP) for wlan0..."
# Remove any previous KPro hotspot config to prevent duplicates
if [ -f /etc/dhcpcd.conf ]; then
  sed -i '/# KPro Gauge Cluster WiFi Hotspot/,/nohook wpa_supplicant/d' /etc/dhcpcd.conf 2>/dev/null || true
  cat >> /etc/dhcpcd.conf << DHCPEOF

# KPro Gauge Cluster WiFi Hotspot
interface wlan0
    static ip_address=$HOTSPOT_IP/24
    nohook wpa_supplicant
DHCPEOF
fi
echo "  Done."

# ---- STEP 5: Configure dnsmasq ----
echo "[5/7] Configuring dnsmasq (DHCP server)..."
if [ -f /etc/dnsmasq.conf ] && [ ! -f /etc/dnsmasq.conf.kpro-backup ]; then
  cp /etc/dnsmasq.conf /etc/dnsmasq.conf.kpro-backup
fi
cat > /etc/dnsmasq.conf << DNSEOF
# KPro Gauge Cluster - DHCP for hotspot
interface=wlan0
bind-dynamic
dhcp-range=192.168.4.10,192.168.4.50,255.255.255.0,24h
domain=local
address=/kpro.local/$HOTSPOT_IP
DNSEOF
echo "  Done."

# ---- STEP 6: Configure hostapd ----
echo "[6/7] Configuring hostapd (WiFi access point)..."
mkdir -p /etc/hostapd
cat > /etc/hostapd/hostapd.conf << HAPEOF
# KPro Gauge Cluster WiFi Hotspot
interface=wlan0
driver=nl80211
ssid=$HOTSPOT_SSID
hw_mode=g
channel=$HOTSPOT_CHANNEL
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=$HOTSPOT_PASS
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP
country_code=US
ieee80211n=1
ieee80211d=1
HAPEOF

# Set DAEMON_CONF - replace existing or add it
if [ -f /etc/default/hostapd ]; then
  sed -i '/^[#]*DAEMON_CONF/d' /etc/default/hostapd
  echo 'DAEMON_CONF="/etc/hostapd/hostapd.conf"' >> /etc/default/hostapd
fi
echo "  Done."

# ---- STEP 7: Enable services and start ----
echo "[7/7] Enabling and starting hotspot..."

systemctl unmask hostapd 2>/dev/null || true
systemctl unmask dnsmasq 2>/dev/null || true
systemctl enable hostapd 2>/dev/null || true
systemctl enable dnsmasq 2>/dev/null || true

# Bring wlan0 down, flush it, set our IP, bring it back up
ip link set wlan0 down 2>/dev/null || true
sleep 1
ip addr flush dev wlan0 2>/dev/null || true
ip addr add $HOTSPOT_IP/24 dev wlan0 2>/dev/null || true
ip link set wlan0 up 2>/dev/null || true
sleep 1

# Start the services
systemctl restart dnsmasq 2>/dev/null || true
sleep 1
systemctl restart hostapd 2>/dev/null || true
sleep 3

# Check result
echo ""
echo "============================================"
if systemctl is-active --quiet hostapd; then
  echo "  HOTSPOT IS ACTIVE!"
  echo "============================================"
  echo ""
  echo "  Look for WiFi '$HOTSPOT_SSID' on your phone NOW."
  echo "  Password: $HOTSPOT_PASS"
  echo ""
  echo "  Connect and open: http://$HOTSPOT_IP:8080"
  echo ""
  echo "  It will also auto-start on every boot."
else
  echo "  REBOOT NEEDED"
  echo "============================================"
  echo ""
  echo "  The hotspot is configured but needs a reboot"
  echo "  to fully take effect."
  echo ""
  echo "  Run:  sudo reboot"
  echo ""
  echo "  After reboot, look for WiFi '$HOTSPOT_SSID'"
  echo "  Password: $HOTSPOT_PASS"
  echo "  Then open: http://$HOTSPOT_IP:8080"
fi
echo ""
echo "  TO UNDO (restore normal WiFi):"
echo "    sudo bash undo-hotspot.sh && sudo reboot"
echo ""
echo "  TROUBLESHOOTING (if WiFi still doesn't appear):"
echo "    sudo systemctl status hostapd"
echo "    sudo journalctl -u hostapd -n 30"
echo "    sudo rfkill list"
echo "    ip addr show wlan0"
echo ""
echo "============================================"
`;
      archive.append(setupHotspotSh, { name: 'kpro-gauges/setup-hotspot.sh', mode: 0o755 });

      const undoHotspotSh = `#!/bin/bash
# ============================================================
# Undo WiFi hotspot and restore normal WiFi
# Usage: sudo bash undo-hotspot.sh
# ============================================================

if [ "\$(id -u)" -ne 0 ]; then
  echo "ERROR: Run with sudo:  sudo bash undo-hotspot.sh"
  exit 1
fi

echo ""
echo "Restoring normal WiFi..."
echo ""

# Stop hotspot services
echo "  Stopping hotspot services..."
systemctl stop hostapd 2>/dev/null || true
systemctl stop dnsmasq 2>/dev/null || true
systemctl disable hostapd 2>/dev/null || true
systemctl disable dnsmasq 2>/dev/null || true

# Re-enable wpa_supplicant (was masked during hotspot setup)
echo "  Re-enabling normal WiFi (wpa_supplicant)..."
systemctl unmask wpa_supplicant 2>/dev/null || true
systemctl enable wpa_supplicant 2>/dev/null || true

# Remove NetworkManager ignore rule for wlan0
if [ -f /etc/NetworkManager/conf.d/kpro-hotspot.conf ]; then
  echo "  Restoring NetworkManager control of wlan0..."
  rm -f /etc/NetworkManager/conf.d/kpro-hotspot.conf
  if command -v nmcli &>/dev/null; then
    nmcli device set wlan0 managed yes 2>/dev/null || true
  fi
  systemctl reload NetworkManager 2>/dev/null || true
fi

# Remove static IP config from dhcpcd.conf
echo "  Removing static IP config..."
if [ -f /etc/dhcpcd.conf ]; then
  sed -i '/# KPro Gauge Cluster WiFi Hotspot/,/nohook wpa_supplicant/d' /etc/dhcpcd.conf 2>/dev/null || true
fi

# Restore dnsmasq config
if [ -f /etc/dnsmasq.conf.kpro-backup ]; then
  echo "  Restoring original dnsmasq config..."
  mv /etc/dnsmasq.conf.kpro-backup /etc/dnsmasq.conf
fi

echo ""
echo "============================================"
echo "  Done! Reboot to restore normal WiFi:"
echo ""
echo "    sudo reboot"
echo ""
echo "  After reboot, your Pi will connect to your"
echo "  home WiFi network again as usual."
echo "============================================"
echo ""
`;
      archive.append(undoHotspotSh, { name: 'kpro-gauges/undo-hotspot.sh', mode: 0o755 });

      const readme = `================================================================
  S2000 KPRO GAUGE CLUSTER - RASPBERRY PI SETUP GUIDE
================================================================

  Complete offline digital gauge cluster for Honda S2000
  with Hondata KPro ECU. Displays live telemetry data:
  RPM, Speed, Coolant Temperature, Fuel Level, AFR, MAP,
  Throttle Position, and VTEC engagement status.

  This package runs 100% offline on your Raspberry Pi.
  No WiFi, no internet, no cloud services needed.

================================================================
  TABLE OF CONTENTS
================================================================

  1. What You Need (Hardware & Software)
  2. Downloading the Package
  3. Preparing Your Raspberry Pi (One-Time Setup)
  4. Copying Files to the Pi
  5. Setting Permissions
  6. Starting the Gauge Cluster
  7. Connecting to Your KPro ECU (USB Wired)
  8. Using the Web Serial Browser Connection
  9. Using Bluetooth Connection
  10. Using Demo Mode (Testing)
  11. Phone Remote Control (Edit Gauges From Your Phone)
  12. Auto-Start on Boot (So It Runs When You Turn On the Pi)
  13. Stopping the Gauge Cluster
  14. What Each File Does
  15. Telemetry Data Displayed
  16. Troubleshooting
  17. Advanced Configuration
  18. Technical Reference

================================================================
  1. WHAT YOU NEED (HARDWARE & SOFTWARE)
================================================================

  REQUIRED HARDWARE:

    - Raspberry Pi 3B+ or Raspberry Pi 4 (either works)
    - MicroSD card (8GB minimum) with Raspberry Pi OS
    - Power supply for the Pi (official 5V/3A recommended)
    - Display connected to the Pi:
        - HDMI monitor or TV, OR
        - Official Raspberry Pi 7" touchscreen, OR
        - Any HDMI-compatible screen
    - Keyboard and mouse (for initial setup only,
      not needed after auto-start is configured)

  REQUIRED SOFTWARE (comes with Raspberry Pi OS):

    - Chromium browser (pre-installed on Raspberry Pi OS)
    - Node.js version 18 or newer (installation in Step 3)

  FOR WIRED ECU CONNECTION:

    - Hondata KPro V4 ECU with USB cable
    - The KPro USB cable plugs into any USB port on the Pi
    - An ELM327 OBD-II USB adapter also works

  FOR BLUETOOTH ECU CONNECTION (optional):

    - Hondata KPro V4 with Bluetooth Low Energy (BLE)
    - Built-in Pi Bluetooth works (no extra hardware)

================================================================
  2. DOWNLOADING THE PACKAGE
================================================================

  You already have this package! It was downloaded as:
  
    kpro-gauges-raspi.zip

  When you unzip it, you get a folder called "kpro-gauges"
  containing everything you need. Nothing else to download.

  The package includes:
    - The gauge cluster web app (HTML, JavaScript, CSS)
    - All fonts bundled locally (no internet needed to load them)
    - A lightweight web server (server.js)
    - The WebSocket library (pre-bundled in node_modules/)
    - Startup and shutdown scripts
    - This README file

================================================================
  3. PREPARING YOUR RASPBERRY PI (ONE-TIME SETUP)
================================================================

  These steps only need to be done ONCE. After this, the Pi
  works completely offline forever.

  STEP 3a: Boot up your Raspberry Pi and connect to WiFi
  (just for this initial setup, then you can disconnect WiFi)

  STEP 3b: Open a Terminal
  
    Click the black terminal icon in the top menu bar,
    or press Ctrl+Alt+T on the keyboard.

  STEP 3c: Update your Pi's software (recommended)

    Type this command and press Enter:

      sudo apt-get update && sudo apt-get upgrade -y

    This may take a few minutes. Wait for it to finish.

  STEP 3d: Install Node.js

    WHAT IS NODE.JS?

      Node.js is a free program that lets your Raspberry Pi
      run the gauge cluster's server software. Think of it
      like a small engine that powers the app behind the
      scenes - it serves the gauge display to Chromium and
      handles communication with your KPro ECU.

      Without Node.js, the gauge cluster server can't start.
      You only need to install it once, and it takes about
      2 minutes. After that, it stays on your Pi forever and
      works completely offline.

      Node.js is free, open-source, and trusted by millions
      of developers worldwide. It's safe to install.

    HOW TO INSTALL NODE.JS:

      Type this first command and press Enter:

        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

      What this does: It tells your Pi where to download
      Node.js from. You'll see some text scroll by - that's
      normal. Wait until you see your command prompt again
      (the blinking cursor on an empty line).

      Now type this second command and press Enter:

        sudo apt-get install -y nodejs

      What this does: It downloads and installs Node.js.
      This may take 1-2 minutes depending on your internet
      speed. Wait for it to finish completely.

    IF THE ABOVE DOESN'T WORK (alternative method):

      Some older Raspberry Pi OS versions need a different
      approach. Try this instead:

        sudo apt-get install -y nodejs npm

      If that also doesn't work, you can download Node.js
      directly from the official website. On any computer
      with internet, go to:

        https://nodejs.org/en/download

      Download the "Linux ARM" version, copy it to your Pi
      via USB stick, and extract it.

  STEP 3e: Verify Node.js installed correctly

    Type this command:

      node --version

    You should see something like: v20.18.0
    (any number starting with v18 or v20 is fine)

    If you see "command not found" instead, the installation
    didn't work. Try the alternative method above, or reboot
    your Pi and try the install commands again.

    Also check npm (Node's package helper tool):

      npm --version

    You should see a number like 10.8.2 or similar.
    npm is used if you want to add the optional USB serial
    module later (see Section 16).

  STEP 3f: Give your user permission to access USB serial ports

    Type this command:

      sudo usermod -a -G dialout $USER

    Then reboot the Pi:

      sudo reboot

    After it reboots, open the terminal again.

  ** NODE.JS IS THE ONLY THING THAT NEEDS INTERNET **
  ** AFTER THIS STEP, DISCONNECT WIFI IF YOU WANT **

================================================================
  4. COPYING FILES TO THE PI
================================================================

  You need to get the "kpro-gauges" folder onto your Pi.

  OPTION A: Using a USB Flash Drive (Easiest)

    1. On your computer, unzip "kpro-gauges-raspi.zip"
    2. Copy the "kpro-gauges" folder to a USB flash drive
    3. Plug the USB flash drive into your Raspberry Pi
    4. The drive should auto-mount. Open the file manager
       and you should see it listed on the left sidebar
    5. Open a terminal and type:

         cp -r /media/$USER/*/kpro-gauges ~/kpro-gauges

       If that doesn't work, find your USB drive name:

         ls /media/$USER/

       Then use the exact name:

         cp -r /media/$USER/YOUR_DRIVE_NAME/kpro-gauges ~/kpro-gauges

  OPTION B: Using SCP from Another Computer (If on same network)

    On your OTHER computer (not the Pi), open a terminal and type:

      scp -r kpro-gauges/ pi@raspberrypi.local:~/kpro-gauges

    Enter the Pi password when asked (default is "raspberry"
    unless you changed it).

  OPTION C: Using a MicroSD Card Reader

    1. Unzip the package on your computer
    2. Put the Pi's MicroSD card in a card reader
    3. Copy kpro-gauges to the "boot" partition or home folder
    4. Put the card back in the Pi

  After copying, verify the files are there. Open a terminal
  on the Pi and type:

    ls ~/kpro-gauges

  You should see: node_modules  package.json  public
                  README.txt  server.js  start.sh  stop.sh

================================================================
  5. SETTING PERMISSIONS
================================================================

  Open a terminal on the Pi and type these commands:

    cd ~/kpro-gauges
    chmod +x start.sh stop.sh

  This makes the startup and shutdown scripts runnable.

  Verify it worked:

    ls -la start.sh

  You should see "-rwxr-xr-x" at the start of the line
  (the "x" means executable).

================================================================
  6. STARTING THE GAUGE CLUSTER
================================================================

  Open a terminal and type:

    cd ~/kpro-gauges
    ./start.sh

  You will see output like this:

    Starting KPro Gauge Cluster on port 8080...

    =====================================================
      S2000 KPro Gauge Cluster - Standalone Server
    =====================================================
      Web UI:       http://localhost:8080
      Serial ECU:   Not connected
    =====================================================

    Launching chromium-browser in kiosk mode...

    Gauge cluster is running!
    Press Ctrl+C to stop.

  Chromium will open in fullscreen showing your gauge cluster.
  If your KPro ECU is plugged in and running, gauges will
  start showing live data automatically. If no ECU is connected,
  demo data starts automatically so you can see the gauges.
  No clicks needed — the browser connects to the server automatically.

  IF CHROMIUM DOES NOT OPEN:
    Open Chromium manually and go to: http://localhost:8080

================================================================
  7. CONNECTING TO YOUR KPRO ECU (USB WIRED)
================================================================

  This Chromium package uses the BROWSER's built-in Web Serial
  API to talk to the ECU. No server-side npm modules needed.
  Chromium handles everything — just plug in and click connect.

  STEP-BY-STEP (Web Serial — recommended for Chromium package):

    1. Make sure the gauge cluster is running (./start.sh)
    2. Plug the KPro USB cable into any USB port on the Pi
    3. On the gauge screen, click the "USB / Wired" button
    4. Chromium shows a popup listing available USB devices
    5. Select your KPro device from the list and click "Connect"
    6. The header shows "USB Connected" in green
    7. Gauges show live ECU data immediately

    DATA BEING READ (via ELM327 OBD-II protocol):
      - PID 010C: Engine RPM (updated ~20 times per second)
      - PID 010D: Vehicle Speed
      - PID 0105: Coolant Temperature
      - PID 010B: Manifold Absolute Pressure (MAP)
      - PID 0111: Throttle Position
      - PID 012F: Fuel Tank Level

    The browser sends ELM327 OBD-II commands to the KPro and
    parses the responses to update each gauge in real-time.
    All 6 parameters are polled continuously at ~50ms intervals.

  IF THE POPUP SHOWS NO DEVICES:
    - Make sure start.sh launched Chromium (it enables Web Serial)
    - Try unplugging and replugging the USB cable
    - Open Chromium manually with the Web Serial flag:
      chromium-browser --enable-features=WebSerial http://localhost:8080

  IF YOU DON'T SEE ANY DEVICE:
    - Try a different USB port on the Pi
    - Try a different USB cable
    - Check that the KPro ECU has power (ignition on)

  WANT MORE DATA CHANNELS (KPro V4 Native USB)?

    This Chromium package uses the ELM327/OBD-II protocol via
    Web Serial, which reads 6 standard PIDs. For the full KPro
    V4 native USB protocol with 14+ channels (including IAT,
    battery, VTC degree, VTEC, gear, oil temp/pressure, AFR),
    use the NATIVE package instead. It includes install.sh
    which sets up the "usb" npm module, udev rules, and
    libusb dependencies automatically.

================================================================
  8. USING AN ELM327 OBD-II ADAPTER (ALTERNATIVE)
================================================================

  If you have an ELM327 USB adapter (instead of KPro V4 USB),
  you can install the "serialport" module for server-side access:

      cd ~/kpro-gauges
      npm install serialport

  Then restart:

      ./stop.sh
      SERIAL_PORT=/dev/ttyUSB0 ./start.sh

  The server reads ELM327 data in the background and streams
  it to the browser. Gauges start automatically on page load.

================================================================
  9. USING BLUETOOTH CONNECTION
================================================================

  Requires a KPro V4 with Bluetooth Low Energy (BLE) capability.

  STEP 1: Pair the KPro with your Pi's Bluetooth

    Click the Bluetooth icon in the top-right of the Pi desktop.
    Click "Add Device" and select your KPro.
    Follow the pairing prompts.

  STEP 2: Connect in the gauge cluster

    1. On the gauge screen, click "Bluetooth Scan"
    2. A browser popup shows nearby Bluetooth devices
    3. Select your KPro and click "Pair"
    4. Gauges start showing live ECU data

  NOTE: Chromium must be launched with the WebBluetooth flag.
  The start.sh script does this automatically. If you opened
  Chromium manually, close it and use ./start.sh instead.

================================================================
  10. USING DEMO MODE (TESTING)
================================================================

  Demo mode shows simulated engine data so you can test
  your setup without being connected to the car.

  1. Open the gauges page in any browser (no ECU needed)
  2. Demo data starts automatically when no ECU is detected
  3. The header shows "DEMO MODE" in yellow

  This is great for:
    - Verifying the Pi setup works before going to the car
    - Testing gauge layouts and settings
    - Making sure fonts and display look correct

  If you later plug in a real KPro USB cable, the server
  automatically switches from demo data to live ECU data.
  The header changes from "DEMO MODE" to "LIVE ECU".

================================================================
  11. PHONE REMOTE CONTROL (EDIT GAUGES FROM YOUR PHONE)
================================================================

  Just like the Hondash app, you can connect your phone to
  the Pi and customize everything from your phone screen.
  No internet needed - the Pi creates its own WiFi network.

  HOW IT WORKS:

    The Pi broadcasts its own WiFi hotspot. You connect your
    phone to this WiFi, open a web address in your phone's
    browser, and you see the full gauge cluster. Any changes
    you make on your phone (dragging gauges, changing settings)
    instantly update on the Pi's screen too.

  STEP-BY-STEP SETUP:

  STEP 11a: Run the hotspot setup script (one time, needs internet)

    Open a terminal on your Pi and type:

      cd ~/kpro-gauges
      sudo bash setup-hotspot.sh

    This installs two small programs (hostapd and dnsmasq)
    that let the Pi create its own WiFi network. You only
    need internet for this one step.

    The script will show you:
      WiFi Name:     KProGauges
      WiFi Password: s2000kpro

    You can customize the name and password:

      sudo bash setup-hotspot.sh MyCarWiFi mypassword123

  STEP 11b: Reboot the Pi

      sudo reboot

    After rebooting, the Pi creates a WiFi network called
    "KProGauges" (or whatever name you chose).

  STEP 11c: Connect your phone

    1. On your phone, go to WiFi settings
    2. Find "KProGauges" in the list and connect
    3. Enter password: s2000kpro
    4. Your phone will say "No internet" - that's normal!
       The Pi is only creating a local network for the gauges

  STEP 11d: Open the gauges on your phone

    Open your phone's web browser (Safari, Chrome, etc.)
    and go to this address:

      http://192.168.4.1:8080

    You'll see the full gauge cluster on your phone!

  WHAT YOU CAN DO FROM YOUR PHONE:

    - See all live gauge data (RPM, speed, temp, etc.)
    - Tap the settings gear icon to open settings
    - Change units (MPH/KMH, Fahrenheit/Celsius)
    - Adjust warning thresholds (coolant temp, fuel level)
    - Set redline RPM, shift light RPM, max RPM
    - Adjust brightness
    - Enable "Edit Mode" to drag and reposition gauges
    - Resize gauges by dragging their corners
    - Show/hide individual gauges
    - Reset layout to default

    ALL CHANGES SYNC INSTANTLY to the Pi's display.
    When you drag a gauge on your phone, it moves on the
    Pi screen at the same time.

  TO UNDO THE HOTSPOT (restore normal WiFi):

      cd ~/kpro-gauges
      sudo bash undo-hotspot.sh
      sudo reboot

  NOTES:
    - The Pi cannot connect to the internet while in hotspot
      mode. If you need internet, undo the hotspot first.
    - Multiple phones can connect at the same time
    - The hotspot has a range of about 30-50 feet
    - The WiFi password must be at least 8 characters

================================================================
  12. AUTO-START ON BOOT
================================================================

  Make the gauge cluster launch automatically when the Pi
  powers on - no keyboard or mouse needed after setup.

  STEP 12a: Open the autostart config file

    Type this in a terminal:

      sudo nano /etc/xdg/lxsession/LXDE-pi/autostart

  STEP 12b: Add the startup command

    Use the arrow keys to go to the very end of the file.
    Add this new line at the bottom:

      @bash /home/pi/kpro-gauges/start.sh

    IMPORTANT: Make sure "pi" matches your username. If your
    Pi username is different, replace "pi" with your username.
    Check your username with: whoami

  STEP 12c: Save and exit

    Press Ctrl+X (to exit)
    Press Y (to confirm save)
    Press Enter (to confirm filename)

  STEP 12d: Disable screen blanking (so the screen stays on)

    Type this:

      sudo raspi-config

    Navigate to:
      Display Options > Screen Blanking > No

    Select "Finish" and reboot when asked.

  STEP 12e: Test it

    Reboot the Pi:

      sudo reboot

    After it boots up, you should see the gauge cluster
    appear automatically in fullscreen!

  TO REMOVE AUTO-START LATER:

    sudo nano /etc/xdg/lxsession/LXDE-pi/autostart

    Delete the line that says "@bash /home/pi/kpro-gauges/start.sh"
    Save and exit (Ctrl+X, Y, Enter).

================================================================
  13. STOPPING THE GAUGE CLUSTER
================================================================

  METHOD A: Press Ctrl+C in the terminal that started it.

  METHOD B: Run the stop script:

    Open a terminal (or press Alt+F4 to close Chromium first):

      cd ~/kpro-gauges
      ./stop.sh

  METHOD C: Press Alt+F4 to close Chromium, then stop the
  server with:

      pkill -f "node server.js"

================================================================
  14. WHAT EACH FILE DOES
================================================================

  kpro-gauges/
  |
  |-- server.js
  |     The web server. Serves the gauge cluster page to
  |     Chromium and handles WebSocket connections for
  |     real-time data streaming. Also reads from USB
  |     serial ports if the serialport module is installed.
  |     Auto-detects KPro on /dev/ttyUSB0, /dev/ttyACM0, etc.
  |
  |-- package.json
  |     Project info file for Node.js.
  |
  |-- start.sh
  |     Startup script. Launches the server, then opens
  |     Chromium in fullscreen kiosk mode with Bluetooth
  |     and Web Serial features enabled.
  |
  |-- stop.sh
  |     Shutdown script. Stops the server and Chromium.
  |
  |-- setup-hotspot.sh
  |     WiFi hotspot setup. Run once with sudo to turn
  |     the Pi into a WiFi access point so your phone
  |     can connect and control the gauges remotely.
  |
  |-- undo-hotspot.sh
  |     Reverses the hotspot setup and restores normal WiFi.
  |
  |-- README.txt
  |     This file.
  |
  |-- node_modules/
  |   |-- ws/
  |         The WebSocket library. Pre-bundled so you
  |         don't need to run npm install or have internet.
  |
  |-- public/
      |-- index.html
      |     The main web page that loads the gauge cluster.
      |
      |-- favicon.png
      |     The icon shown in the browser tab.
      |
      |-- fonts/
      |   |-- fonts.css
      |   |     Defines the custom fonts used by the gauges.
      |   |-- *.woff2
      |         Font files: Orbitron (numbers), Rajdhani (labels),
      |         Inter (UI text), Roboto Mono (data readouts).
      |         All bundled locally - no internet needed.
      |
      |-- assets/
          |-- index-*.js
          |     The compiled gauge cluster application code.
          |-- index-*.css
                All the styles and visual design.

================================================================
  15. TELEMETRY DATA DISPLAYED
================================================================

  The gauge cluster reads these values from your KPro ECU:

  GAUGE           OBD-II PID    DESCRIPTION
  -----           ----------    -----------
  Tachometer      010C          Engine RPM (0-9000)
  Speedometer     010D          Vehicle speed (mph or km/h)
  Coolant Temp    0105          Engine coolant temperature
  MAP             010B          Manifold absolute pressure
  Throttle        0111          Throttle position (0-100%)
  Fuel Level      012F          Fuel tank level (0-100%)
  AFR             Calculated    Air-fuel ratio
  VTEC            From RPM      VTEC engagement indicator

  The gauges update approximately 20 times per second.
  Warning indicators activate when values exceed thresholds:
    - Coolant temp warning: above 105C (221F) by default
    - Low fuel warning: below 15% by default
    - VTEC indicator: above 5800 RPM

  You can customize these thresholds in the Settings panel
  (gear icon in the top-right corner of the gauge screen).

================================================================
  16. TROUBLESHOOTING
================================================================

  PROBLEM: "bash: node: command not found"

    This means Node.js is not installed yet. Node.js is
    the free program that runs the gauge cluster server
    (explained in Section 3d above).

    You need internet access for this one-time installation.
    Connect your Pi to WiFi, then open a terminal and run:

      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
      sudo apt-get install -y nodejs

    Then verify it worked:

      node --version

    You should see a version number like v20.18.0.
    After this, disconnect WiFi - you won't need it again.

    If those commands don't work, try the alternative:

      sudo apt-get install -y nodejs npm

    See Section 3d for more details and a third option
    if neither command works.

  -------------------------------------------------------

  PROBLEM: "This site can't be reached" in Chromium

    The server is not running. Open a terminal and try
    starting it manually to see any error messages:

      cd ~/kpro-gauges
      node server.js

    If you see "Cannot find module 'ws'":
      The node_modules folder is missing. Make sure you
      copied the entire kpro-gauges folder including
      node_modules/ws/ from the ZIP file.

    Check the folder:
      ls ~/kpro-gauges/node_modules/ws/

    You should see: index.js  lib  package.json

  -------------------------------------------------------

  PROBLEM: USB device not detected (no serial port found)

    1. Check if the Pi sees any USB serial device:

         ls /dev/ttyUSB*
         ls /dev/ttyACM*

       If nothing shows up:
         - Is the USB cable plugged in firmly?
         - Try a different USB port on the Pi
         - Is the KPro ECU powered? (ignition must be on)
         - Try a different USB cable

    2. Check if the Pi recognizes the USB device at all:

         lsusb

       You should see your device listed (e.g., "FTDI" or
       "Silicon Labs" or similar USB-serial chip).

    3. Check kernel messages for USB activity:

         dmesg | tail -20

       After plugging in the cable, you should see messages
       about a new USB device being attached.

  -------------------------------------------------------

  PROBLEM: "Permission denied" when accessing serial port

    Your user needs to be in the "dialout" group:

      sudo usermod -a -G dialout $USER
      sudo reboot

    After rebooting, verify you're in the group:

      groups

    You should see "dialout" in the list.

  -------------------------------------------------------

  PROBLEM: The gauges show data but it looks wrong or stuck

    The baud rate might not match your adapter. The default
    is 38400. Try different baud rates:

      cd ~/kpro-gauges
      ./stop.sh
      SERIAL_BAUD=9600 ./start.sh

    Common baud rates for ELM327 adapters:
      9600, 38400, 115200, 500000

  -------------------------------------------------------

  PROBLEM: Bluetooth "Scan" button does nothing

    Chromium must be launched with the WebBluetooth flag.
    The start.sh script does this automatically. If you
    opened Chromium manually, close it and run:

      cd ~/kpro-gauges
      ./start.sh

    If Bluetooth still doesn't work:

      sudo systemctl status bluetooth

    If it says "inactive", start it:

      sudo systemctl enable bluetooth
      sudo systemctl start bluetooth

  -------------------------------------------------------

  PROBLEM: "USB / Wired" button shows no devices in the popup

    Chromium needs the WebSerial flag. Make sure you launched
    Chromium using start.sh. If you opened it manually:

      chromium-browser --enable-features=WebSerial http://localhost:8080

    If still no devices:
      - Is the USB cable plugged in?
      - Run "ls /dev/ttyUSB*" to verify the system sees it
      - Try unplugging and replugging the cable

  -------------------------------------------------------

  PROBLEM: Fonts look wrong / default system fonts showing

    The fonts folder must be inside public/. Verify:

      ls ~/kpro-gauges/public/fonts/

    You should see fonts.css and several .woff2 files.
    If the fonts folder is missing, re-extract the ZIP file
    and make sure to copy the entire kpro-gauges folder.

  -------------------------------------------------------

  PROBLEM: Screen goes to sleep / display turns off

    Disable screen blanking:

      sudo raspi-config

    Navigate to: Display Options > Screen Blanking > No
    Select "Finish" and reboot.

    Alternatively, run these commands:

      xset s off
      xset -dpms
      xset s noblank

    To make those permanent, add them to your autostart file:

      sudo nano /etc/xdg/lxsession/LXDE-pi/autostart

    Add these lines:

      @xset s off
      @xset -dpms
      @xset s noblank

  -------------------------------------------------------

  PROBLEM: Want to change the server port (default is 8080)

    Stop the current server and start with a new port:

      cd ~/kpro-gauges
      ./stop.sh
      PORT=3000 ./start.sh

  -------------------------------------------------------

  PROBLEM: Chromium kiosk mode - can't access other windows

    Press Alt+F4 to close Chromium kiosk mode.
    Or press Ctrl+Alt+T to open a terminal behind Chromium.

  -------------------------------------------------------

  PROBLEM: Pi boots to a blank screen (auto-start not working)

    Check the autostart file for typos:

      cat /etc/xdg/lxsession/LXDE-pi/autostart

    Make sure the line reads exactly:
      @bash /home/pi/kpro-gauges/start.sh

    Replace "pi" with your actual username if different.
    Check your username: whoami

    Also check that start.sh is executable:
      ls -la ~/kpro-gauges/start.sh

    The line should start with -rwxr-xr-x. If not:
      chmod +x ~/kpro-gauges/start.sh

  PROBLEM: Phone can't find "KProGauges" WiFi network

    Make sure you ran setup-hotspot.sh and rebooted:
      cd ~/kpro-gauges
      sudo bash setup-hotspot.sh
      sudo reboot

    Check if hostapd is running:
      sudo systemctl status hostapd

    If it says "failed", check the log:
      sudo journalctl -u hostapd -n 20

    Common fix: Another WiFi process is blocking hostapd.
      sudo systemctl stop wpa_supplicant
      sudo systemctl start hostapd

  PROBLEM: Phone connects to WiFi but can't load the page

    Make sure the gauge cluster server is running first:
      cd ~/kpro-gauges
      bash start.sh

    On your phone, make sure you typed the address exactly:
      http://192.168.4.1:8080

    Try turning off mobile data on your phone temporarily -
    some phones prefer mobile data over WiFi with no internet.

  PROBLEM: Changes on phone don't sync to Pi display

    Both the Pi's Chromium and your phone must be connected
    to the same gauge cluster server. Refresh both browsers.
    The Pi should be at http://localhost:8080 and your phone
    at http://192.168.4.1:8080.

================================================================
  17. ADVANCED CONFIGURATION
================================================================

  ENVIRONMENT VARIABLES:

    PORT=8080           Web server port (default: 8080)
    SERIAL_PORT=        Force a specific serial port path
                        (e.g., /dev/ttyUSB0, /dev/ttyACM0)
    SERIAL_BAUD=38400   Serial baud rate (default: 38400)

    Example:
      PORT=3000 SERIAL_PORT=/dev/ttyACM0 SERIAL_BAUD=9600 ./start.sh

  INSTALLING SERVER-SIDE SERIAL SUPPORT (OPTIONAL):

    The browser's "USB / Wired" button works without any
    extra modules. But if you want the server to automatically
    read from the USB ECU in the background (so gauges show
    live data as soon as the browser loads), install
    the serialport module:

      cd ~/kpro-gauges
      npm install serialport

    This needs internet once. After that, the server
    auto-detects the KPro USB and streams real data
    to the browser over WebSocket. No extra clicks needed.

  SUPPORTED SERIAL DEVICES:

    The server scans these paths for USB serial devices:
      /dev/ttyUSB0, /dev/ttyUSB1
      /dev/ttyACM0, /dev/ttyACM1
      /dev/ttyAMA0
      /dev/serial0

    If your device uses a different path, set SERIAL_PORT:
      SERIAL_PORT=/dev/ttyS0 ./start.sh

  CHECKING THE API:

    The server has a status API you can check in a browser:
      http://localhost:8080/api/status

    This shows: connected clients, serial status, and
    whether demo mode or live ECU data is active.

================================================================
  18. TECHNICAL REFERENCE
================================================================

  System Architecture:
    - Server: Pure Node.js HTTP server (no Express or frameworks)
    - WebSocket: Bundled ws module for real-time data streaming
    - Protocol: ELM327 OBD-II commands over UART serial
    - Frontend: React application compiled to static files
    - Fonts: Locally bundled woff2 format (Latin subset)
    - Browser: Chromium with WebBluetooth + WebSerial flags

  Serial Communication:
    - Default baud: 38400
    - Data bits: 8, Stop bits: 1, Parity: none
    - ELM327 initialization: ATZ, ATE0, ATL0, ATS0, ATH0, ATSP0
    - Polling interval: 50ms per PID (6 PIDs = ~300ms full cycle)
    - Auto-reconnect: If USB is unplugged and replugged,
      the server reconnects automatically within 10 seconds

  WebSocket Endpoint:
    - Path: /ws (e.g., ws://localhost:8080/ws)
    - Sends JSON telemetry at 20Hz
    - Includes _source field: "ecu" for live, "demo" for simulated

  API Endpoints:
    - GET /api/status     Server status and connection info
    - GET /api/settings   Gauge configuration
    - GET /api/layout     Gauge positions
    - GET /api/trip-data  Trip meter data
    - GET /api/serial/ports  Available serial ports

  Package Size: ~400KB total (compressed in ZIP)
  Memory Usage: ~50MB (Node.js server + Chromium)
  CPU Usage: <10% on Raspberry Pi 3B+ during normal operation

================================================================
  END OF SETUP GUIDE
================================================================
`;
      archive.append(readme, { name: 'kpro-gauges/README.txt' });

      await archive.finalize();
    } catch (error) {
      console.error('Failed to create offline package:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create offline package' });
      }
    }
  });

  app.get('/api/download-native', async (_req, res) => {
    try {
      const distClientPath = path.resolve(process.cwd(), 'dist', 'public');
      let clientDir = distClientPath;

      console.log('Building frontend for native package v1.4...');
      try {
        if (fs.existsSync(distClientPath)) {
          fs.rmSync(distClientPath, { recursive: true, force: true });
        }
      } catch (_e) {}
      await viteBuild();

      if (!fs.existsSync(clientDir)) {
        return res.status(500).json({ error: 'Build failed - no output found' });
      }

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="kpro-native-raspi-v1.4.zip"');

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (err: Error) => { throw err; });
      archive.pipe(res);

      const addDirRecursive = (dirPath: string, zipPrefix: string) => {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          const zipPath = zipPrefix + '/' + entry.name;
          if (entry.isDirectory()) {
            addDirRecursive(fullPath, zipPath);
          } else if (entry.name !== 'index.html') {
            archive.file(fullPath, { name: zipPath });
          }
        }
      };
      addDirRecursive(clientDir, 'kpro-native/public');

      const indexHtmlPath = path.join(clientDir, 'index.html');
      let indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
      indexHtml = indexHtml.replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/g, '');
      indexHtml = indexHtml.replace(/<link[^>]*fonts\.gstatic\.com[^>]*>/g, '');
      indexHtml = indexHtml.replace(/<link[^>]*preconnect[^>]*>/g, '');
      archive.append(indexHtml, { name: 'kpro-native/public/index.html' });

      const standaloneServer = fs.readFileSync(path.resolve(process.cwd(), 'standalone-server.js'), 'utf-8');
      archive.append(standaloneServer, { name: 'kpro-native/server.js' });

      const wsModuleDir = path.resolve(process.cwd(), 'node_modules', 'ws');
      if (fs.existsSync(wsModuleDir)) {
        const wsIndex = fs.readFileSync(path.join(wsModuleDir, 'index.js'), 'utf-8');
        archive.append(wsIndex, { name: 'kpro-native/node_modules/ws/index.js' });
        const wsPackageJson = fs.readFileSync(path.join(wsModuleDir, 'package.json'), 'utf-8');
        archive.append(wsPackageJson, { name: 'kpro-native/node_modules/ws/package.json' });
        const wsLibDir = path.join(wsModuleDir, 'lib');
        if (fs.existsSync(wsLibDir)) {
          const wsLibFiles = fs.readdirSync(wsLibDir);
          for (const file of wsLibFiles) {
            if (file.endsWith('.js')) {
              const content = fs.readFileSync(path.join(wsLibDir, file), 'utf-8');
              archive.append(content, { name: `kpro-native/node_modules/ws/lib/${file}` });
            }
          }
        }
      }

      const packageJson = JSON.stringify({
        name: "kpro-native-headless",
        version: "1.4",
        private: true,
        scripts: {
          start: "node server.js",
        },
      }, null, 2);
      archive.append(packageJson, { name: 'kpro-native/package.json' });

      const nativeStartSh = `#!/bin/bash
# ==============================================================
# S2000 KPro Gauge Cluster - Native Start Script
# ==============================================================
# Starts the gauge server and optionally launches a lightweight
# browser (surf or midori) to display gauges on the Pi's screen.
#
# If no browser is installed, runs as headless server only.
# View gauges from your phone via WiFi hotspot in that case.
#
# To skip the browser even if installed:
#   HEADLESS=1 ./start.sh
# ==============================================================

cd "$(dirname "$0")"

PORT=\${PORT:-8080}
export SERIAL_PORT=\${SERIAL_PORT:-}
export SERIAL_BAUD=\${SERIAL_BAUD:-38400}
HEADLESS=\${HEADLESS:-0}

# Check Node.js is installed
if ! command -v node &> /dev/null; then
  echo ""
  echo "============================================"
  echo "  ERROR: Node.js is not installed!"
  echo "============================================"
  echo ""
  echo "  Install Node.js by running these TWO commands:"
  echo ""
  echo "    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "    sudo apt-get install -y nodejs"
  echo ""
  echo "  Then run this script again:"
  echo "    ./start.sh"
  echo ""
  exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ] 2>/dev/null; then
  echo ""
  echo "WARNING: Node.js version $(node --version) detected."
  echo "Version 18 or newer is recommended."
  echo "Update with:"
  echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "  sudo apt-get install -y nodejs"
  echo ""
fi

# Check serial port access
if ! groups | grep -q dialout; then
  echo ""
  echo "NOTE: Your user is not in the 'dialout' group."
  echo "USB serial ECU connections may not work."
  echo "Fix with:"
  echo "  sudo usermod -a -G dialout \\$USER"
  echo "  sudo reboot"
  echo ""
fi

# Check USB device access
if ! groups | grep -q plugdev; then
  echo ""
  echo "NOTE: Your user is not in the 'plugdev' group."
  echo "KPro USB direct connections may not work."
  echo "Fix with:"
  echo "  sudo usermod -a -G plugdev \\$USER"
  echo "  sudo reboot"
  echo ""
fi

# Try to install usb module if not present
if [ ! -d "node_modules/usb" ] && command -v npm &> /dev/null; then
  echo "Installing USB support for KPro native protocol..."
  echo "  Installing build dependencies (build-essential, libusb-1.0-0-dev, libudev-dev)..."
  sudo apt-get install -y build-essential libusb-1.0-0-dev libudev-dev 2>/dev/null || {
    echo "  WARNING: Failed to install build dependencies."
    echo "  npm install usb will likely fail without them."
    echo "  Install manually: sudo apt-get install -y build-essential libusb-1.0-0-dev libudev-dev"
  }
  npm install usb 2>/dev/null || echo "  (optional: npm install usb failed - ELM327 serial will still work)"
fi

# Get the Pi's IP address for display
PI_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$PI_IP" ]; then
  PI_IP="(no network)"
fi

# Detect available lightweight browser and display
BROWSER=""
if [ "$HEADLESS" != "1" ]; then
  # Try to detect DISPLAY if not set (for manual script runs)
  if [ -z "\${DISPLAY:-}" ]; then
    # Check common display values
    for d in :0 :1; do
      if [ -e "/tmp/.X11-unix/X\${d#:}" ]; then
        export DISPLAY="$d"
        break
      fi
    done
  fi

  # Try to detect XAUTHORITY if not set
  if [ -z "\${XAUTHORITY:-}" ]; then
    for f in /home/*/.[Xx]authority; do
      if [ -f "$f" ]; then
        export XAUTHORITY="$f"
        break
      fi
    done
  fi

  # Only look for browsers if we have a display
  if [ -n "\${DISPLAY:-}" ]; then
    for cmd in surf midori; do
      if command -v $cmd &> /dev/null; then
        BROWSER=$cmd
        break
      fi
    done
  fi
fi

echo ""
echo "======================================================="
echo "  S2000 KPro Gauge Cluster - Native Server  v1.4"
echo "======================================================="
echo ""
echo "  Server starting on port $PORT..."
if [ -n "$BROWSER" ]; then
echo "  Display browser: $BROWSER"
else
echo "  Display: Headless (no browser on Pi screen)"
echo "  View from phone: http://$PI_IP:$PORT"
fi
echo ""

# Start the Node.js server in the background
node server.js &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Launch lightweight browser if available
BROWSER_PID=""
if [ -n "$BROWSER" ]; then
  # Disable screen blanking if possible
  xset s off 2>/dev/null
  xset -dpms 2>/dev/null
  xset s noblank 2>/dev/null

  case "$BROWSER" in
    surf)
      echo "Launching surf in fullscreen kiosk mode..."
      surf -F http://localhost:$PORT 2>/dev/null &
      BROWSER_PID=$!
      ;;
    midori)
      echo "Launching midori in fullscreen mode..."
      midori -e Fullscreen -a http://localhost:$PORT 2>/dev/null &
      BROWSER_PID=$!
      ;;
  esac

  echo ""
  echo "  Gauges displayed on Pi screen via $BROWSER"
  echo "  Also accessible from phone: http://$PI_IP:$PORT"
else
  echo ""
  echo "  No browser detected on Pi."
  echo "  To show gauges on Pi screen, install surf:"
  echo "    sudo apt-get install -y surf"
  echo "  Then run ./start.sh again."
  echo ""
  echo "  Or view from your phone at: http://$PI_IP:$PORT"
fi

echo ""
echo "  Gauge cluster is running!"
echo "  Press Ctrl+C to stop."
echo ""

cleanup() {
  echo "Shutting down..."
  if [ -n "$BROWSER_PID" ]; then
    kill $BROWSER_PID 2>/dev/null
  fi
  kill $SERVER_PID 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

wait $SERVER_PID
`;
      archive.append(nativeStartSh, { name: 'kpro-native/start.sh', mode: 0o755 });

      const nativeStopSh = `#!/bin/bash
# Stop the KPro Gauge Cluster
pkill -f "node server.js" 2>/dev/null
pkill -f "node /home/.*/kpro-native/server.js" 2>/dev/null
pkill -f "surf.*localhost" 2>/dev/null
pkill -f "midori.*localhost" 2>/dev/null
echo "Gauge cluster stopped."
`;
      archive.append(nativeStopSh, { name: 'kpro-native/stop.sh', mode: 0o755 });

      const nativeInstallSh = `#!/bin/bash
# ==============================================================
# S2000 KPro Gauge Cluster - COMPLETE AUTOMATED INSTALLER
# ==============================================================
# This script does EVERYTHING for you:
#   1. Installs Node.js (if not already installed)
#   2. Installs lightweight browser (surf) for Pi screen display
#   3. Adds your user to the dialout group (for USB serial)
#   4. Installs the systemd service (auto-start on boot)
#   5. Sets file permissions
#   6. Sets up WiFi hotspot (KProGauges) and starts the gauge cluster
#
# USAGE:
#   cd ~/kpro-native
#   sudo bash install.sh
#
# HEADLESS ONLY (skip browser install):
#   cd ~/kpro-native
#   sudo HEADLESS=1 bash install.sh
# ==============================================================

set -e

INSTALL_DIR="$(cd "$(dirname "$0")" && pwd)"
CURRENT_USER="\${SUDO_USER:-$USER}"
HEADLESS="\${HEADLESS:-0}"

echo ""
echo "======================================================="
echo "  S2000 KPro Gauge Cluster - Automated Installer"
echo "======================================================="
echo ""
echo "  Install directory: $INSTALL_DIR"
echo "  User: $CURRENT_USER"
if [ "$HEADLESS" = "1" ]; then
echo "  Mode: Headless (no browser on Pi screen)"
else
echo "  Mode: Full (with lightweight browser for Pi screen)"
fi
echo ""

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: This script must be run with sudo."
  echo ""
  echo "  Run:  sudo bash install.sh"
  echo ""
  exit 1
fi

# ---- STEP 1: Install Node.js ----
echo "[1/6] Checking Node.js..."
if command -v node &> /dev/null; then
  NODE_VER=$(node --version)
  echo "  Node.js $NODE_VER is already installed."
else
  echo "  Node.js not found. Installing Node.js 20 LTS..."
  echo ""
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  echo ""
  echo "  Node.js $(node --version) installed successfully."
fi
echo ""

# ---- STEP 2: Install lightweight browser ----
echo "[2/6] Setting up display browser..."
if [ "$HEADLESS" = "1" ]; then
  echo "  Skipped (headless mode)."
  echo "  View gauges from phone via WiFi hotspot."
elif command -v surf &> /dev/null; then
  echo "  surf browser already installed."
elif command -v midori &> /dev/null; then
  echo "  midori browser already installed."
else
  echo "  Installing surf (lightweight browser, ~2MB)..."
  apt-get update -qq
  apt-get install -y surf 2>/dev/null || {
    echo "  surf not available. Trying midori..."
    apt-get install -y midori 2>/dev/null || {
      echo "  Could not install a browser automatically."
      echo "  The gauge server will still work - view gauges"
      echo "  from your phone via WiFi hotspot instead."
      echo "  Or install a browser manually later:"
      echo "    sudo apt-get install surf"
      echo "    sudo apt-get install midori"
    }
  }
fi
echo ""

# ---- STEP 3: USB and serial port access ----
echo "[3/7] Setting up USB and serial port access..."
if groups "$CURRENT_USER" 2>/dev/null | grep -q dialout; then
  echo "  User '$CURRENT_USER' already has serial port access."
else
  usermod -a -G dialout "$CURRENT_USER"
  echo "  Added '$CURRENT_USER' to dialout group."
fi

if groups "$CURRENT_USER" 2>/dev/null | grep -q plugdev; then
  echo "  User '$CURRENT_USER' already has USB device access."
else
  usermod -a -G plugdev "$CURRENT_USER"
  echo "  Added '$CURRENT_USER' to plugdev group."
fi

# Install udev rules for KPro V4 USB access (vendor 0x1C40, product 0x0434)
echo "  Installing KPro V4 USB permissions (udev rules)..."
cat > /etc/udev/rules.d/99-kpro.rules << UDEVEOF
# Hondata KPro V4 USB ECU (vendor 0x1C40, product 0x0434)
SUBSYSTEM=="usb", ATTRS{idVendor}=="1c40", ATTRS{idProduct}=="0434", MODE="0666", GROUP="plugdev"
# Hondata KPro V2/V3 (FTDI-based, vendor 0x0403, product 0xF5F8)
SUBSYSTEM=="usb", ATTRS{idVendor}=="0403", ATTRS{idProduct}=="f5f8", MODE="0666", GROUP="plugdev"
# Generic USB-Serial adapters for ELM327
SUBSYSTEM=="tty", ATTRS{idVendor}=="067b", MODE="0666", GROUP="dialout"
SUBSYSTEM=="tty", ATTRS{idVendor}=="1a86", MODE="0666", GROUP="dialout"
UDEVEOF
udevadm control --reload-rules 2>/dev/null || true
udevadm trigger 2>/dev/null || true
echo "  udev rules installed. KPro USB will be accessible without sudo."
echo "  (A reboot is needed for group changes to take effect)"
echo ""

# ---- STEP 4: Install systemd service ----
echo "[4/7] Installing systemd service (auto-start on boot)..."

# Determine the browser launch command for the service
BROWSER_CMD=""
if [ "$HEADLESS" != "1" ]; then
  if command -v surf &> /dev/null; then
    BROWSER_CMD="surf -F http://localhost:8080"
  elif command -v midori &> /dev/null; then
    BROWSER_CMD="midori -e Fullscreen -a http://localhost:8080"
  fi
fi

cat > /etc/systemd/system/kpro-gauges.service << SERVICEEOF
[Unit]
Description=S2000 KPro Gauge Cluster
After=network.target
Wants=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$(which node) $INSTALL_DIR/server.js
Restart=always
RestartSec=5
Environment=PORT=8080
Environment=SERIAL_BAUD=38400

StandardOutput=journal
StandardError=journal
SyslogIdentifier=kpro-gauges

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl enable kpro-gauges.service
echo "  Server service installed and enabled."

# Create browser launch wrapper script (always created)
cat > "$INSTALL_DIR/launch-display.sh" << 'LAUNCHEOF'
#!/bin/bash
# Wrapper script for kpro-display service
# Auto-detects the best available browser at launch time
PORT=\${PORT:-8080}

# Wait for server to be ready
sleep 4

# Disable screen blanking
xset s off 2>/dev/null
xset -dpms 2>/dev/null
xset s noblank 2>/dev/null

# Detect best available browser
BROWSER=""
for cmd in surf midori; do
  if command -v $cmd &> /dev/null; then
    BROWSER=$cmd
    break
  fi
done

if [ -z "$BROWSER" ]; then
  echo "No lightweight browser found."
  echo "Install surf: sudo apt-get install -y surf"
  exit 1
fi

echo "Launching $BROWSER for gauge display..."

case "$BROWSER" in
  surf)
    exec surf -F http://localhost:$PORT
    ;;
  midori)
    exec midori -e Fullscreen -a http://localhost:$PORT
    ;;
esac
LAUNCHEOF
chmod +x "$INSTALL_DIR/launch-display.sh"

# Always create the display service
cat > /etc/systemd/system/kpro-display.service << DISPLAYEOF
[Unit]
Description=S2000 KPro Gauge Display (Browser)
After=kpro-gauges.service graphical.target
Wants=kpro-gauges.service
Requires=graphical.target

[Service]
Type=simple
User=$CURRENT_USER
Environment=DISPLAY=:0
Environment=XAUTHORITY=/home/$CURRENT_USER/.Xauthority
ExecStart=$INSTALL_DIR/launch-display.sh
Restart=on-failure
RestartSec=10

StandardOutput=journal
StandardError=journal
SyslogIdentifier=kpro-display

[Install]
WantedBy=graphical.target
DISPLAYEOF

systemctl daemon-reload

# Enable display service if a browser is available, otherwise just install it
if [ -n "$BROWSER_CMD" ]; then
  systemctl enable kpro-display.service
  echo "  Display service installed and enabled."
  echo "  Gauges will show on Pi screen after boot."
else
  echo "  Display service installed (disabled - no browser found)."
  echo "  Install surf and enable: sudo apt-get install -y surf"
  echo "  Then: sudo systemctl enable kpro-display && sudo systemctl start kpro-display"
fi
echo ""

# ---- STEP 5: Set file permissions ----
echo "[5/7] Setting file permissions..."
chmod +x "$INSTALL_DIR/start.sh"
chmod +x "$INSTALL_DIR/stop.sh"
chmod +x "$INSTALL_DIR/setup-hotspot.sh"
chmod +x "$INSTALL_DIR/undo-hotspot.sh"
chown -R "$CURRENT_USER:$CURRENT_USER" "$INSTALL_DIR"
echo "  Permissions set."
echo ""

# ---- STEP 6: Auto-setup WiFi hotspot ----
echo "[6/7] Setting up WiFi hotspot (KProGauges)..."
if [ "\${SKIP_HOTSPOT:-0}" = "1" ]; then
  echo "  Skipped (SKIP_HOTSPOT=1)."
  echo "  Run 'sudo bash setup-hotspot.sh' later if you want hotspot."
else
  if command -v hostapd &> /dev/null && [ -f /etc/hostapd/hostapd.conf ]; then
    echo "  Hotspot already configured (hostapd found)."
    systemctl enable hostapd 2>/dev/null || true
    systemctl enable dnsmasq 2>/dev/null || true
  else
    echo "  Running hotspot setup automatically..."
    echo "  WiFi Name: KProGauges  |  Password: s2000kpro"
    bash "$INSTALL_DIR/setup-hotspot.sh" KProGauges s2000kpro || {
      echo "  WARNING: Hotspot setup failed (may need internet for first install)."
      echo "  You can run it manually later: sudo bash setup-hotspot.sh"
    }
  fi
fi
echo ""

# ---- STEP 7: Install USB native module ----
echo "[7/7] Installing KPro USB native protocol support..."
cd "$INSTALL_DIR"
if [ -d "node_modules/usb" ]; then
  echo "  USB module already installed."
else
  echo "  Installing usb module (requires build tools)..."
  apt-get install -y build-essential libusb-1.0-0-dev libudev-dev 2>/dev/null || true
  sudo -u "$CURRENT_USER" npm install usb 2>/dev/null && {
    echo "  USB module installed successfully."
    echo "  KPro V4 native USB protocol is ready."
    # Quick sanity check — ensure native binding actually compiled
    node -e "require('./node_modules/usb')" 2>/dev/null && \\
      echo "  Native binding OK." || \\
      echo "  WARNING: usb module loaded but native binding may be missing."
  } || {
    echo "  USB module installation failed (optional)."
    echo "  ELM327 serial will still work as fallback."
    echo "  To install manually later: npm install usb"
    echo "  Requires: build-essential libusb-1.0-0-dev libudev-dev"
  }
fi
echo ""

# ---- START THE SERVICE ----
echo "Starting KPro Gauge Cluster..."
systemctl start kpro-gauges.service
sleep 2

if systemctl is-active --quiet kpro-gauges.service; then
  echo ""
  echo "======================================================="
  echo "  INSTALLATION COMPLETE!"
  echo "======================================================="
  echo ""
  echo "  The gauge cluster server is now RUNNING."
  echo ""
  echo "  Access from this Pi:  http://localhost:8080"
  echo "  Access from phone:    http://192.168.4.1:8080"
  echo ""
  echo "  WiFi HOTSPOT:"
  echo "    Network: KProGauges"
  echo "    Password: s2000kpro"
  echo "    The hotspot starts automatically on boot."
  echo "    WiFi client is disabled so the Pi runs its own network."
  echo ""
  if [ -n "$BROWSER_CMD" ]; then
  echo "  Display: Gauges will show on Pi screen after reboot."
  echo "  (The browser auto-starts via kpro-display service)"
  echo ""
  fi
  echo "  SERVICES:"
  echo "    Server:  sudo systemctl status kpro-gauges"
  if [ -n "$BROWSER_CMD" ]; then
  echo "    Display: sudo systemctl status kpro-display"
  fi
  echo "    Logs:    sudo journalctl -u kpro-gauges -f"
  echo ""
  echo "  TO UNDO HOTSPOT (restore normal WiFi):"
  echo "    cd $INSTALL_DIR"
  echo "    sudo bash undo-hotspot.sh"
  echo ""
  echo "  Please reboot to activate the hotspot:"
  echo "    sudo reboot"
  echo ""
  echo "======================================================="
else
  echo ""
  echo "WARNING: Service may not have started correctly."
  echo "Check with: sudo journalctl -u kpro-gauges -n 30"
  echo ""
fi
`;
      archive.append(nativeInstallSh, { name: 'kpro-native/install.sh', mode: 0o755 });

      const nativeSetupHotspotSh = `#!/bin/bash
# ============================================================
# S2000 KPro Gauge Cluster - WiFi Hotspot Setup
# ============================================================
# Creates a WiFi network from your Pi so your phone can connect
# and view/control the gauge cluster. No internet required.
#
# USAGE:
#   sudo bash setup-hotspot.sh
#   sudo bash setup-hotspot.sh MyWiFiName MyPassword
#
# DEFAULT:
#   WiFi Name:     KProGauges
#   WiFi Password: s2000kpro
# ============================================================

HOTSPOT_SSID="\${1:-KProGauges}"
HOTSPOT_PASS="\${2:-s2000kpro}"
HOTSPOT_CHANNEL="6"
HOTSPOT_IP="192.168.4.1"

if [ "\$(id -u)" -ne 0 ]; then
  echo "ERROR: Run with sudo:  sudo bash setup-hotspot.sh"
  exit 1
fi

if [ \${#HOTSPOT_PASS} -lt 8 ]; then
  echo "ERROR: WiFi password must be at least 8 characters."
  exit 1
fi

echo ""
echo "============================================"
echo "  KPro Gauges - WiFi Hotspot Setup"
echo "============================================"
echo ""
echo "  WiFi Name:     $HOTSPOT_SSID"
echo "  WiFi Password: $HOTSPOT_PASS"
echo "  Pi IP Address: $HOTSPOT_IP"
echo "  Gauge URL:     http://$HOTSPOT_IP:8080"
echo ""

# ---- STEP 1: Install packages ----
echo "[1/7] Installing hostapd and dnsmasq..."
apt-get update -qq 2>/dev/null
apt-get install -y hostapd dnsmasq 2>/dev/null
if ! command -v hostapd &>/dev/null; then
  echo "  ERROR: hostapd failed to install."
  echo "  Make sure your Pi has internet for this first-time setup."
  exit 1
fi
echo "  Done."

# ---- STEP 2: Stop ALL conflicting services ----
echo "[2/7] Stopping conflicting services..."
systemctl stop hostapd 2>/dev/null || true
systemctl stop dnsmasq 2>/dev/null || true

# wpa_supplicant fights with hostapd for control of wlan0
# We need to stop it AND prevent it from auto-restarting
systemctl stop wpa_supplicant 2>/dev/null || true
systemctl mask wpa_supplicant 2>/dev/null || true
killall wpa_supplicant 2>/dev/null || true

# If NetworkManager is running, tell it to stop managing wlan0
# (don't disable NM entirely - it may manage ethernet)
if command -v nmcli &>/dev/null; then
  echo "  Removing wlan0 from NetworkManager..."
  nmcli device set wlan0 managed no 2>/dev/null || true
  mkdir -p /etc/NetworkManager/conf.d
  cat > /etc/NetworkManager/conf.d/kpro-hotspot.conf << NMEOF
[keyfile]
unmanaged-devices=interface-name:wlan0
NMEOF
  systemctl reload NetworkManager 2>/dev/null || true
fi
echo "  Done."

# ---- STEP 3: Unblock WiFi radio and set country ----
echo "[3/7] Unblocking WiFi radio..."
rfkill unblock wifi 2>/dev/null || true
# Set regulatory domain (required on some Pis for WiFi to work)
iw reg set US 2>/dev/null || true
raspi-config nonint do_wifi_country US 2>/dev/null || true
echo "  Done."

# ---- STEP 4: Configure static IP ----
echo "[4/7] Configuring static IP ($HOTSPOT_IP) for wlan0..."
# Remove any previous KPro hotspot config to prevent duplicates
if [ -f /etc/dhcpcd.conf ]; then
  sed -i '/# KPro Gauge Cluster WiFi Hotspot/,/nohook wpa_supplicant/d' /etc/dhcpcd.conf 2>/dev/null || true
  cat >> /etc/dhcpcd.conf << DHCPEOF

# KPro Gauge Cluster WiFi Hotspot
interface wlan0
    static ip_address=$HOTSPOT_IP/24
    nohook wpa_supplicant
DHCPEOF
fi
echo "  Done."

# ---- STEP 5: Configure dnsmasq ----
echo "[5/7] Configuring dnsmasq (DHCP server)..."
if [ -f /etc/dnsmasq.conf ] && [ ! -f /etc/dnsmasq.conf.kpro-backup ]; then
  cp /etc/dnsmasq.conf /etc/dnsmasq.conf.kpro-backup
fi
cat > /etc/dnsmasq.conf << DNSEOF
# KPro Gauge Cluster - DHCP for hotspot
interface=wlan0
bind-dynamic
dhcp-range=192.168.4.10,192.168.4.50,255.255.255.0,24h
domain=local
address=/kpro.local/$HOTSPOT_IP
DNSEOF
echo "  Done."

# ---- STEP 6: Configure hostapd ----
echo "[6/7] Configuring hostapd (WiFi access point)..."
mkdir -p /etc/hostapd
cat > /etc/hostapd/hostapd.conf << HAPEOF
# KPro Gauge Cluster WiFi Hotspot
interface=wlan0
driver=nl80211
ssid=$HOTSPOT_SSID
hw_mode=g
channel=$HOTSPOT_CHANNEL
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=$HOTSPOT_PASS
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP
country_code=US
ieee80211n=1
ieee80211d=1
HAPEOF

# Set DAEMON_CONF - replace existing or add it
if [ -f /etc/default/hostapd ]; then
  sed -i '/^[#]*DAEMON_CONF/d' /etc/default/hostapd
  echo 'DAEMON_CONF="/etc/hostapd/hostapd.conf"' >> /etc/default/hostapd
fi
echo "  Done."

# ---- STEP 7: Enable services and start ----
echo "[7/7] Enabling and starting hotspot..."

systemctl unmask hostapd 2>/dev/null || true
systemctl unmask dnsmasq 2>/dev/null || true
systemctl enable hostapd 2>/dev/null || true
systemctl enable dnsmasq 2>/dev/null || true

# Bring wlan0 down, flush it, set our IP, bring it back up
ip link set wlan0 down 2>/dev/null || true
sleep 1
ip addr flush dev wlan0 2>/dev/null || true
ip addr add $HOTSPOT_IP/24 dev wlan0 2>/dev/null || true
ip link set wlan0 up 2>/dev/null || true
sleep 1

# Start the services
systemctl restart dnsmasq 2>/dev/null || true
sleep 1
systemctl restart hostapd 2>/dev/null || true
sleep 3

# Check result
echo ""
echo "============================================"
if systemctl is-active --quiet hostapd; then
  echo "  HOTSPOT IS ACTIVE!"
  echo "============================================"
  echo ""
  echo "  Look for WiFi '$HOTSPOT_SSID' on your phone NOW."
  echo "  Password: $HOTSPOT_PASS"
  echo ""
  echo "  Connect and open: http://$HOTSPOT_IP:8080"
  echo ""
  echo "  It will also auto-start on every boot."
else
  echo "  REBOOT NEEDED"
  echo "============================================"
  echo ""
  echo "  The hotspot is configured but needs a reboot"
  echo "  to fully take effect."
  echo ""
  echo "  Run:  sudo reboot"
  echo ""
  echo "  After reboot, look for WiFi '$HOTSPOT_SSID'"
  echo "  Password: $HOTSPOT_PASS"
  echo "  Then open: http://$HOTSPOT_IP:8080"
fi
echo ""
echo "  TO UNDO (restore normal WiFi):"
echo "    sudo bash undo-hotspot.sh && sudo reboot"
echo ""
echo "  TROUBLESHOOTING (if WiFi still doesn't appear):"
echo "    sudo systemctl status hostapd"
echo "    sudo journalctl -u hostapd -n 30"
echo "    sudo rfkill list"
echo "    ip addr show wlan0"
echo ""
echo "============================================"
`;
      archive.append(nativeSetupHotspotSh, { name: 'kpro-native/setup-hotspot.sh', mode: 0o755 });

      const nativeUndoHotspotSh = `#!/bin/bash
# ============================================================
# Undo WiFi hotspot and restore normal WiFi
# Usage: sudo bash undo-hotspot.sh
# ============================================================

if [ "\$(id -u)" -ne 0 ]; then
  echo "ERROR: Run with sudo:  sudo bash undo-hotspot.sh"
  exit 1
fi

echo ""
echo "Restoring normal WiFi..."
echo ""

# Stop hotspot services
echo "  Stopping hotspot services..."
systemctl stop hostapd 2>/dev/null || true
systemctl stop dnsmasq 2>/dev/null || true
systemctl disable hostapd 2>/dev/null || true
systemctl disable dnsmasq 2>/dev/null || true

# Re-enable wpa_supplicant (was masked during hotspot setup)
echo "  Re-enabling normal WiFi (wpa_supplicant)..."
systemctl unmask wpa_supplicant 2>/dev/null || true
systemctl enable wpa_supplicant 2>/dev/null || true

# Remove NetworkManager ignore rule for wlan0
if [ -f /etc/NetworkManager/conf.d/kpro-hotspot.conf ]; then
  echo "  Restoring NetworkManager control of wlan0..."
  rm -f /etc/NetworkManager/conf.d/kpro-hotspot.conf
  if command -v nmcli &>/dev/null; then
    nmcli device set wlan0 managed yes 2>/dev/null || true
  fi
  systemctl reload NetworkManager 2>/dev/null || true
fi

# Remove static IP config from dhcpcd.conf
echo "  Removing static IP config..."
if [ -f /etc/dhcpcd.conf ]; then
  sed -i '/# KPro Gauge Cluster WiFi Hotspot/,/nohook wpa_supplicant/d' /etc/dhcpcd.conf 2>/dev/null || true
fi

# Restore dnsmasq config
if [ -f /etc/dnsmasq.conf.kpro-backup ]; then
  echo "  Restoring original dnsmasq config..."
  mv /etc/dnsmasq.conf.kpro-backup /etc/dnsmasq.conf
fi

echo ""
echo "============================================"
echo "  Done! Reboot to restore normal WiFi:"
echo ""
echo "    sudo reboot"
echo ""
echo "  After reboot, your Pi will connect to your"
echo "  home WiFi network again as usual."
echo "============================================"
echo ""
`;
      archive.append(nativeUndoHotspotSh, { name: 'kpro-native/undo-hotspot.sh', mode: 0o755 });

      const nativeUninstallSh = `#!/bin/bash
# ==============================================================
# Uninstall KPro Gauge Cluster service
# ==============================================================
# Stops and removes the systemd service. Does NOT delete files.
#
# USAGE:  sudo bash uninstall.sh
# ==============================================================

if [ "\$(id -u)" -ne 0 ]; then
  echo "ERROR: Run with sudo:  sudo bash uninstall.sh"
  exit 1
fi

echo "Stopping and removing KPro Gauge Cluster services..."

systemctl stop kpro-display.service 2>/dev/null || true
systemctl disable kpro-display.service 2>/dev/null || true
rm -f /etc/systemd/system/kpro-display.service

systemctl stop kpro-gauges.service 2>/dev/null || true
systemctl disable kpro-gauges.service 2>/dev/null || true
rm -f /etc/systemd/system/kpro-gauges.service

systemctl daemon-reload

echo ""
echo "Services removed. The gauge cluster will no longer"
echo "auto-start on boot."
echo ""
echo "Your files are still in this folder - not deleted."
echo "To completely remove, delete this folder:"
echo "  rm -rf $(cd "$(dirname "$0")" && pwd)"
echo ""
`;
      archive.append(nativeUninstallSh, { name: 'kpro-native/uninstall.sh', mode: 0o755 });

      const nativeReadme = `================================================================
  S2000 KPRO GAUGE CLUSTER - NATIVE RASPBERRY PI GUIDE
================================================================

  Complete offline digital gauge cluster for Honda S2000
  with Hondata KPro ECU integration.

  ** LIGHTWEIGHT NATIVE VERSION (NO CHROMIUM NEEDED) **

  This package runs the gauge cluster on your Pi using a
  lightweight browser called "surf" (~2MB vs Chromium's ~300MB).
  The gauges display directly on the Pi's screen.

  You can ALSO view/control gauges from your PHONE by
  connecting to the Pi's WiFi hotspot.

  Works on both Raspberry Pi OS Desktop AND Lite.
  If no desktop/display is available, it runs as a headless
  server and you view gauges from your phone only.

  WHAT IT DISPLAYS:
    RPM, Speed, Coolant Temperature, Fuel Level,
    Air-Fuel Ratio (AFR), Manifold Absolute Pressure (MAP),
    Throttle Position, VTEC engagement status

================================================================
  TABLE OF CONTENTS
================================================================

  1. What You Need
  2. Quick Install (Copy-Paste Commands)
  3. Detailed Step-by-Step Instructions
  4. Displaying Gauges on Pi Screen
  5. WiFi Hotspot Setup (Phone Access)
  6. Connecting to Your KPro ECU (USB)
  7. Using Demo Mode (Testing)
  8. Managing the Service
  9. Phone Remote Control
  10. Auto-Start on Boot
  11. What Each File Does
  12. Troubleshooting (with Solutions)
  13. Advanced Configuration
  14. Uninstalling
  15. Technical Reference

================================================================
  1. WHAT YOU NEED
================================================================

  HARDWARE:
    - Raspberry Pi 3B+ (or Pi 4, Pi Zero 2W)
    - MicroSD card (8GB minimum) with Raspberry Pi OS
      (Desktop or Lite - both work)
    - Power supply (5V/2.5A minimum for Pi 3B+)
    - OPTIONAL: Display connected to Pi (HDMI or touchscreen)
      (If no display, view from phone instead)

  FOR WIRED ECU CONNECTION:
    - Hondata KPro V4 ECU with USB cable
    - Or any ELM327 OBD-II USB adapter

  SOFTWARE (installed automatically by install.sh):
    - Node.js 18 or newer
    - surf browser (lightweight, ~2MB) - auto-installed

  INTERNET: Only needed once for initial setup.
  After that, everything runs 100% offline.

================================================================
  2. QUICK INSTALL (COPY-PASTE COMMANDS)
================================================================

  If you're comfortable with the terminal, here are ALL the
  commands you need. Copy and paste them one at a time.

  STEP 1: Get the files onto your Pi
  (see Section 3 for detailed file transfer methods)

  If using USB flash drive:
  -----------------------------------------------------------
  cp -r /media/$USER/*/kpro-native ~/kpro-native
  -----------------------------------------------------------

  If using SCP from another computer:
  -----------------------------------------------------------
  scp -r kpro-native/ pi@raspberrypi.local:~/kpro-native
  -----------------------------------------------------------

  STEP 2: Run the automated installer
  -----------------------------------------------------------
  cd ~/kpro-native
  sudo bash install.sh
  -----------------------------------------------------------

  That's it! The installer does everything:
    - Installs Node.js if missing
    - Installs surf browser for Pi screen display
    - Sets up serial port permissions
    - Creates systemd services for auto-start
    - Sets file permissions
    - Starts the gauge cluster

  For headless mode only (no browser on Pi screen):
  -----------------------------------------------------------
  cd ~/kpro-native
  sudo HEADLESS=1 bash install.sh
  -----------------------------------------------------------

  STEP 3: Set up WiFi hotspot (so phone can connect)
  -----------------------------------------------------------
  cd ~/kpro-native
  sudo bash setup-hotspot.sh
  sudo reboot
  -----------------------------------------------------------

  STEP 4: Connect your phone
  -----------------------------------------------------------
  1. On phone WiFi settings, connect to "KProGauges"
  2. Password: s2000kpro
  3. Open browser, go to: http://192.168.4.1:8080
  -----------------------------------------------------------

  STEP 5 (OPTIONAL): Install USB serial support
  -----------------------------------------------------------
  cd ~/kpro-native
  npm install serialport
  sudo systemctl restart kpro-gauges
  -----------------------------------------------------------

================================================================
  3. DETAILED STEP-BY-STEP INSTRUCTIONS
================================================================

  STEP 3a: Prepare your Raspberry Pi

    You need Raspberry Pi OS installed on a MicroSD card.
    Both "Lite" (no desktop) and "Desktop" versions work.

    Download Raspberry Pi Imager from:
      https://www.raspberrypi.com/software/

    Flash the OS to your SD card, insert it in the Pi,
    and boot up. Connect a keyboard and monitor for the
    initial setup, or use SSH if you set it up in the imager.

  STEP 3b: Connect to WiFi (temporarily, for setup only)

    Desktop version:
      Click the WiFi icon in the top-right corner.
      Select your WiFi network and enter the password.

    Lite version (terminal):
  -----------------------------------------------------------
  sudo raspi-config
  -----------------------------------------------------------
      Go to: System Options > Wireless LAN
      Enter your WiFi network name and password.

  STEP 3c: Get the files onto your Pi

    OPTION A - USB Flash Drive (easiest):

      1. On your computer, unzip "kpro-native-raspi.zip"
      2. Copy the "kpro-native" folder to a USB drive
      3. Plug the USB drive into your Pi
      4. Open a terminal and run:

  -----------------------------------------------------------
  sudo mkdir -p /media/usb
  sudo mount /dev/sda1 /media/usb
  cp -r /media/usb/kpro-native ~/kpro-native
  sudo umount /media/usb
  -----------------------------------------------------------

      If /dev/sda1 doesn't work, find your drive:
  -----------------------------------------------------------
  lsblk
  -----------------------------------------------------------
      Look for your USB drive (usually sda1) and use that.

    OPTION B - SCP from another computer:

      On your OTHER computer (not the Pi), run:
  -----------------------------------------------------------
  scp -r kpro-native/ pi@raspberrypi.local:~/kpro-native
  -----------------------------------------------------------
      Enter password when asked (default: "raspberry").

      If raspberrypi.local doesn't work, find Pi's IP:
      On the Pi, run:
  -----------------------------------------------------------
  hostname -I
  -----------------------------------------------------------
      Then use that IP:
  -----------------------------------------------------------
  scp -r kpro-native/ pi@YOUR_PI_IP:~/kpro-native
  -----------------------------------------------------------

    OPTION C - Direct download on Pi (if you have the URL):

  -----------------------------------------------------------
  cd ~
  wget YOUR_DOWNLOAD_URL -O kpro-native-raspi.zip
  unzip kpro-native-raspi.zip
  -----------------------------------------------------------

  STEP 3d: Verify the files are on your Pi

  -----------------------------------------------------------
  ls ~/kpro-native
  -----------------------------------------------------------

    You should see:
      install.sh    package.json    public      setup-hotspot.sh
      node_modules  README.txt      server.js   start.sh
      stop.sh       undo-hotspot.sh uninstall.sh

  STEP 3e: Run the automated installer

  -----------------------------------------------------------
  cd ~/kpro-native
  sudo bash install.sh
  -----------------------------------------------------------

    The installer will:
      [1/7] Check/install Node.js
      [2/7] Install lightweight browser (surf/midori)
      [3/7] Set up USB and serial port access (udev rules)
      [4/7] Install systemd services (server + display)
      [5/7] Set file permissions
      [6/7] Set up WiFi hotspot (KProGauges)
      [7/7] Install KPro USB native module (usb)

    When it finishes, you'll see:
      "INSTALLATION COMPLETE!"
      "The gauge cluster is now RUNNING."

  STEP 3f: Verify it's running

  -----------------------------------------------------------
  sudo systemctl status kpro-gauges
  -----------------------------------------------------------

    You should see: "Active: active (running)"

    Test it from the Pi itself:
  -----------------------------------------------------------
  curl http://localhost:8080/api/status
  -----------------------------------------------------------

    You should see a JSON response with "status":"ok"

================================================================
  4. DISPLAYING GAUGES ON PI SCREEN
================================================================

  The installer automatically installs "surf" - a lightweight
  browser (~2MB) that displays the gauges on your Pi's screen
  in fullscreen. This is much lighter than Chromium (~300MB).

  HOW IT WORKS:

    After install.sh runs, two systemd services are created:
      - kpro-gauges:  The gauge server (always runs)
      - kpro-display: The browser display (runs if screen available)

    The display service waits for the gauge server to start,
    then opens surf in fullscreen showing the gauge cluster.

  REQUIREMENTS FOR PI SCREEN DISPLAY:

    - Raspberry Pi OS Desktop (not Lite)
    - A display connected (HDMI, touchscreen, etc.)
    - surf or midori browser (auto-installed by install.sh)

    If you're using Pi OS Lite (no desktop), the display
    service won't start but the gauge server still runs.
    View from your phone via WiFi hotspot instead.

  CHOOSE YOUR LIGHTWEIGHT BROWSER:

    You have two options. Both are lightweight and work great
    on a Raspberry Pi. Pick whichever you prefer:

    -------------------------------------------------------
    OPTION A: surf (Recommended - smallest, ~2MB)
    -------------------------------------------------------

      surf is an extremely minimal browser. It uses very
      little RAM and CPU, perfect for a dedicated gauge
      display. The installer tries to install it by default.

      To install surf manually:
  -----------------------------------------------------------
  sudo apt-get update
  sudo apt-get install -y surf
  -----------------------------------------------------------

    -------------------------------------------------------
    OPTION B: midori (Feature-rich lightweight, ~15MB)
    -------------------------------------------------------

      midori has more features than surf (tabs, bookmarks)
      but still uses far less resources than Chromium.
      Good choice if surf has display issues on your Pi.

      To install midori manually:
  -----------------------------------------------------------
  sudo apt-get update
  sudo apt-get install -y midori
  -----------------------------------------------------------

    -------------------------------------------------------

    After installing either browser, run the installer
    to set up the display service:
  -----------------------------------------------------------
  cd ~/kpro-native
  sudo bash install.sh
  -----------------------------------------------------------

    The installer auto-detects which browser is installed.
    Priority: surf first, then midori.

  SWITCHING BROWSERS:

    To switch from surf to midori (or vice versa):

    1. Install the browser you want:
  -----------------------------------------------------------
  sudo apt-get install -y midori
  -----------------------------------------------------------
       (or: sudo apt-get install -y surf)

    2. Remove the one you don't want:
  -----------------------------------------------------------
  sudo apt-get remove -y surf
  -----------------------------------------------------------
       (or: sudo apt-get remove -y midori)

    3. Re-run the installer to update the service:
  -----------------------------------------------------------
  cd ~/kpro-native
  sudo bash install.sh
  -----------------------------------------------------------

    4. Reboot to apply:
  -----------------------------------------------------------
  sudo reboot
  -----------------------------------------------------------

  HEADLESS MODE (no Pi screen, phone only):

    If you do NOT want a browser on the Pi screen at all,
    install with the HEADLESS flag:
  -----------------------------------------------------------
  sudo HEADLESS=1 bash install.sh
  -----------------------------------------------------------

    To switch from headless to screen display later:
  -----------------------------------------------------------
  sudo apt-get install -y surf
  sudo bash install.sh
  -----------------------------------------------------------

  DISABLE SCREEN BLANKING (keep screen always on):

  -----------------------------------------------------------
  sudo raspi-config
  -----------------------------------------------------------
    Navigate to: Display Options > Screen Blanking > No

    Or run these commands:
  -----------------------------------------------------------
  xset s off && xset -dpms && xset s noblank
  -----------------------------------------------------------

    To make permanent, add to /etc/xdg/lxsession/LXDE-pi/autostart:
  -----------------------------------------------------------
  sudo bash -c 'echo "@xset s off" >> /etc/xdg/lxsession/LXDE-pi/autostart'
  sudo bash -c 'echo "@xset -dpms" >> /etc/xdg/lxsession/LXDE-pi/autostart'
  sudo bash -c 'echo "@xset s noblank" >> /etc/xdg/lxsession/LXDE-pi/autostart'
  -----------------------------------------------------------

  CHECK IF DISPLAY SERVICE IS RUNNING:

  -----------------------------------------------------------
  sudo systemctl status kpro-display
  -----------------------------------------------------------

  RESTART THE DISPLAY:

  -----------------------------------------------------------
  sudo systemctl restart kpro-display
  -----------------------------------------------------------

================================================================
  5. WIFI HOTSPOT SETUP (PHONE ACCESS)
================================================================

  The WiFi hotspot turns your Pi into a WiFi access point.
  Your phone connects directly to the Pi's WiFi - no
  router or internet needed. Perfect for in-car use.

  STEP 4a: Run the hotspot setup script

  -----------------------------------------------------------
  cd ~/kpro-native
  sudo bash setup-hotspot.sh
  -----------------------------------------------------------

    Default settings:
      WiFi Name:     KProGauges
      WiFi Password: s2000kpro

    Custom name and password:
  -----------------------------------------------------------
  sudo bash setup-hotspot.sh MyCarWiFi mypassword123
  -----------------------------------------------------------

    (Password must be at least 8 characters)

  STEP 4b: Reboot the Pi

  -----------------------------------------------------------
  sudo reboot
  -----------------------------------------------------------

  STEP 4c: Connect your phone

    1. Go to your phone's WiFi settings
    2. Find "KProGauges" (or your custom name) and tap it
    3. Enter password: s2000kpro (or your custom password)
    4. Your phone will say "No internet" - that's normal!
    5. If your phone asks "Stay connected?" tap YES

  STEP 4d: Open gauges on your phone

    Open your phone's browser (Safari, Chrome, etc.)
    Type this address:

      http://192.168.4.1:8080

    You'll see the full gauge cluster on your phone!

  TO UNDO THE HOTSPOT (restore normal WiFi):

  -----------------------------------------------------------
  cd ~/kpro-native
  sudo bash undo-hotspot.sh
  sudo reboot
  -----------------------------------------------------------

================================================================
  6. CONNECTING TO YOUR KPRO ECU (USB)
================================================================

  KPRO V4 NATIVE USB (Automatic — install.sh handles this)

    If you ran install.sh, KPro V4 native USB is already set up.
    No extra steps needed — just plug in and go:

    1. Plug the KPro V4 USB cable into any USB port on the Pi
    2. The server auto-detects it within 10 seconds
    3. Open gauges on your phone — live ECU data is streaming!
    4. The header shows "LIVE ECU" in green

    The server uses the KPro V4 native USB protocol
    (vendor 0x1C40, product 0x0434, bulk transfer commands
    0x40/0x60/0x61/0x62/0x65) matching the HonDash approach.

    install.sh already:
      - Installed build-essential, libusb-1.0-0-dev, libudev-dev
      - Compiled the "usb" npm module for native USB access
      - Written udev rules (99-kpro.rules) for no-sudo access
      - Added your user to dialout + plugdev groups

  IF IT'S NOT WORKING:

    Check that the Pi sees the USB device:
  -----------------------------------------------------------
  lsusb | grep 1c40
  -----------------------------------------------------------

    You should see "1c40:0434" (KPro V4). If you see it but
    the server can't open it, re-run the installer:
  -----------------------------------------------------------
  cd ~/kpro-native
  sudo bash install.sh
  sudo reboot
  -----------------------------------------------------------

    If lsusb shows nothing:
      - Try a different USB port on the Pi
      - Try a different USB cable
      - Check that the KPro ECU has power (ignition on)

  MANUAL USB MODULE SETUP (if you skipped install.sh):

    If you set things up manually, you need:
  -----------------------------------------------------------
  sudo apt-get install -y build-essential libusb-1.0-0-dev libudev-dev
  cd ~/kpro-native
  npm install usb
  -----------------------------------------------------------

    And udev rules for no-sudo USB access:
  -----------------------------------------------------------
  echo 'SUBSYSTEM=="usb", ATTRS{idVendor}=="1c40", ATTRS{idProduct}=="0434", MODE="0666", GROUP="plugdev"' | sudo tee /etc/udev/rules.d/99-kpro.rules
  sudo udevadm control --reload-rules && sudo udevadm trigger
  sudo usermod -a -G plugdev $USER
  sudo reboot
  -----------------------------------------------------------

  FALLBACK: ELM327 Serial (for OBD-II adapters, not KPro V4)

    If you have an ELM327 OBD-II USB adapter instead:
  -----------------------------------------------------------
  cd ~/kpro-native
  npm install serialport
  sudo systemctl restart kpro-gauges
  -----------------------------------------------------------

    If auto-detection doesn't find it, specify the port:
  -----------------------------------------------------------
  SERIAL_PORT=/dev/ttyUSB0 node ~/kpro-native/server.js
  -----------------------------------------------------------

  OPTION B: Browser Web Serial (Chrome only)

    If you open the gauges in Chrome on a device that supports
    Web Serial, you can click "USB / Wired" on the gauge screen.
    This works without any npm modules.
    Note: Phone browsers do NOT support Web Serial.

  DATA BEING READ FROM YOUR ECU (KPro V4 Native):
    RPM                   Engine speed
    Vehicle Speed         mph or km/h
    Coolant Temp          Engine coolant temperature
    Intake Air Temp       Intake manifold temperature
    MAP                   Manifold absolute pressure
    Throttle Position     Throttle opening percentage
    Fuel Level            Remaining fuel percentage
    Battery Voltage       ECU supply voltage
    VTC Degree            Variable Timing Control angle
    VTEC State            VTEC engagement (on/off)
    Gear                  Current gear position
    Oil Temperature       Engine oil temp
    Oil Pressure          Engine oil pressure
    Air-Fuel Ratio        Wideband AFR reading

================================================================
  7. USING DEMO MODE (TESTING)
================================================================

  Demo mode shows simulated engine data so you can verify
  your setup works without being connected to the car.

  Open the gauges on your phone or any browser:
    1. Demo data starts automatically when no ECU is detected
    2. Gauges animate with realistic simulated data
    3. The header shows "DEMO MODE" in yellow

  If a real USB ECU is plugged in, the server automatically
  switches from demo to live data. The header changes from
  "DEMO MODE" to "LIVE ECU".

================================================================
  8. MANAGING THE SERVICE
================================================================

  The gauge cluster runs as a systemd service. Here are
  all the commands you need:

  Check if it's running:
  -----------------------------------------------------------
  sudo systemctl status kpro-gauges
  -----------------------------------------------------------

  Start the service:
  -----------------------------------------------------------
  sudo systemctl start kpro-gauges
  -----------------------------------------------------------

  Stop the service:
  -----------------------------------------------------------
  sudo systemctl stop kpro-gauges
  -----------------------------------------------------------

  Restart (after changing settings or plugging in USB):
  -----------------------------------------------------------
  sudo systemctl restart kpro-gauges
  -----------------------------------------------------------

  View live logs (press Ctrl+C to exit):
  -----------------------------------------------------------
  sudo journalctl -u kpro-gauges -f
  -----------------------------------------------------------

  View last 50 log lines:
  -----------------------------------------------------------
  sudo journalctl -u kpro-gauges -n 50
  -----------------------------------------------------------

  Disable auto-start on boot:
  -----------------------------------------------------------
  sudo systemctl disable kpro-gauges
  -----------------------------------------------------------

  Re-enable auto-start on boot:
  -----------------------------------------------------------
  sudo systemctl enable kpro-gauges
  -----------------------------------------------------------

================================================================
  9. PHONE REMOTE CONTROL
================================================================

  Once connected to the Pi's WiFi hotspot (or same network),
  open http://192.168.4.1:8080 on your phone.

  WHAT YOU CAN DO FROM YOUR PHONE:

    - See all live gauge data in real-time
    - Tap the gear icon to open settings
    - Switch units (MPH/KMH, Fahrenheit/Celsius, kPa/PSI)
    - Set warning thresholds (coolant temp, fuel level)
    - Set redline RPM and shift light RPM
    - Adjust gauge brightness
    - Enable "Edit Mode" to rearrange gauges
    - Drag gauges to new positions
    - Resize gauges by dragging corners
    - Zoom individual gauges (50% to 300%)
    - Show or hide specific gauges
    - Reset layout to defaults

  MULTI-DEVICE SYNC:

    Multiple phones/tablets can connect at the same time.
    Settings and layout changes sync between all connected
    devices via WebSocket in real-time.

================================================================
  10. AUTO-START ON BOOT
================================================================

  The install.sh script already sets up auto-start using
  systemd. The gauge cluster starts automatically when
  the Pi powers on - no keyboard or monitor needed.

  To verify auto-start is enabled:
  -----------------------------------------------------------
  sudo systemctl is-enabled kpro-gauges
  -----------------------------------------------------------

  Should say: "enabled"

  DISABLE SCREEN BLANKING (if using a monitor):

  -----------------------------------------------------------
  sudo raspi-config
  -----------------------------------------------------------

    Navigate to: Display Options > Screen Blanking > No
    Select "Finish" and reboot when asked.

  Or run these commands:
  -----------------------------------------------------------
  sudo bash -c 'cat >> /etc/rc.local << "EOF"
# Disable screen blanking
setterm --blank 0 --powerdown 0 2>/dev/null || true
EOF'
  -----------------------------------------------------------

================================================================
  11. WHAT EACH FILE DOES
================================================================

  kpro-native/
  |
  |-- install.sh
  |     Automated installer. Installs Node.js, surf browser,
  |     sets up systemd services, and configures permissions.
  |     Run once: sudo bash install.sh
  |
  |-- uninstall.sh
  |     Removes both systemd services (server + display).
  |     Does not delete files. Run: sudo bash uninstall.sh
  |
  |-- server.js
  |     The web server. Serves the gauge UI, handles
  |     WebSocket connections for live data streaming,
  |     and reads from USB serial ports if available.
  |
  |-- launch-display.sh
  |     Browser launcher for kpro-display service.
  |     Auto-detects surf or midori at runtime.
  |
  |-- start.sh
  |     Manual start script. Use if not using systemd.
  |     Set HEADLESS=1 to skip browser launch.
  |
  |-- stop.sh
  |     Manual stop script. Kills server and browser.
  |
  |-- setup-hotspot.sh
  |     WiFi hotspot setup. Run once with sudo.
  |
  |-- undo-hotspot.sh
  |     Reverses the hotspot setup.
  |
  |-- package.json
  |     Node.js project config.
  |
  |-- README.txt
  |     This file.
  |
  |-- node_modules/ws/
  |     WebSocket library (pre-bundled, no install needed).
  |
  |-- public/
  |     The gauge cluster web app (HTML, JS, CSS, fonts).
  |     Served by server.js to any connected browser.

================================================================
  12. TROUBLESHOOTING (WITH SOLUTIONS)
================================================================

  PROBLEM: "bash: node: command not found"
  CAUSE: Node.js is not installed.
  SOLUTION:
  -----------------------------------------------------------
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
  -----------------------------------------------------------
  Verify:
  -----------------------------------------------------------
  node --version
  -----------------------------------------------------------
  Should show v18.x.x or v20.x.x or newer.

  If that doesn't work, try:
  -----------------------------------------------------------
  sudo apt-get install -y nodejs npm
  -----------------------------------------------------------

  -------------------------------------------------------

  PROBLEM: "sudo bash install.sh" says permission denied
  CAUSE: Script is not executable.
  SOLUTION:
  -----------------------------------------------------------
  chmod +x ~/kpro-native/install.sh
  sudo bash ~/kpro-native/install.sh
  -----------------------------------------------------------

  -------------------------------------------------------

  PROBLEM: Service won't start / shows "failed"
  CAUSE: Various - check the logs.
  SOLUTION:
  -----------------------------------------------------------
  sudo journalctl -u kpro-gauges -n 30
  -----------------------------------------------------------

  Common fixes:
    - "Cannot find module 'ws'":
      The node_modules folder is missing.
  -----------------------------------------------------------
  ls ~/kpro-native/node_modules/ws/
  -----------------------------------------------------------
      Should show: index.js  lib  package.json
      If missing, re-extract the ZIP file.

    - "EADDRINUSE" (port already in use):
  -----------------------------------------------------------
  sudo lsof -i :8080
  sudo kill $(sudo lsof -t -i :8080)
  sudo systemctl restart kpro-gauges
  -----------------------------------------------------------

  -------------------------------------------------------

  PROBLEM: Can't access http://192.168.4.1:8080 from phone
  CAUSE: Hotspot not set up, or server not running.
  SOLUTION:
    1. Check hotspot is running:
  -----------------------------------------------------------
  sudo systemctl status hostapd
  -----------------------------------------------------------
    If it says "inactive" or "failed":
  -----------------------------------------------------------
  cd ~/kpro-native
  sudo bash setup-hotspot.sh
  sudo reboot
  -----------------------------------------------------------

    2. Check gauge server is running:
  -----------------------------------------------------------
  sudo systemctl status kpro-gauges
  -----------------------------------------------------------
    If it says "inactive":
  -----------------------------------------------------------
  sudo systemctl start kpro-gauges
  -----------------------------------------------------------

    3. Make sure phone is on "KProGauges" WiFi
    4. Turn OFF mobile data on your phone temporarily
    5. Type the address exactly: http://192.168.4.1:8080

  -------------------------------------------------------

  PROBLEM: Phone says "No internet connection"
  CAUSE: This is NORMAL! The hotspot has no internet.
  SOLUTION: Tap "Stay connected" or "Use WiFi anyway"
  on your phone. The gauge cluster works without internet.

  -------------------------------------------------------

  PROBLEM: USB ECU not detected
  CAUSE: serialport module not installed, or wrong port.
  SOLUTION:
    1. Install the serial module:
  -----------------------------------------------------------
  cd ~/kpro-native
  npm install serialport
  sudo systemctl restart kpro-gauges
  -----------------------------------------------------------

    2. Check if Pi sees the USB device:
  -----------------------------------------------------------
  ls /dev/ttyUSB*
  ls /dev/ttyACM*
  lsusb
  -----------------------------------------------------------

    3. If the device is listed, set it explicitly:
  -----------------------------------------------------------
  sudo systemctl stop kpro-gauges
  SERIAL_PORT=/dev/ttyUSB0 node ~/kpro-native/server.js
  -----------------------------------------------------------

  -------------------------------------------------------

  PROBLEM: "Permission denied" on serial port
  CAUSE: User not in dialout group.
  SOLUTION:
  -----------------------------------------------------------
  sudo usermod -a -G dialout $USER
  sudo reboot
  -----------------------------------------------------------
  Verify after reboot:
  -----------------------------------------------------------
  groups
  -----------------------------------------------------------
  Should include "dialout" in the list.

  -------------------------------------------------------

  PROBLEM: Gauge data looks wrong or values are stuck
  CAUSE: Baud rate mismatch with your adapter.
  SOLUTION: Try different baud rates:
  -----------------------------------------------------------
  sudo systemctl stop kpro-gauges
  SERIAL_BAUD=9600 node ~/kpro-native/server.js
  -----------------------------------------------------------
  Common baud rates: 9600, 38400, 115200, 500000

  To set permanently:
  -----------------------------------------------------------
  sudo systemctl edit kpro-gauges
  -----------------------------------------------------------
  Add:
  -----------------------------------------------------------
  [Service]
  Environment=SERIAL_BAUD=9600
  -----------------------------------------------------------
  Then:
  -----------------------------------------------------------
  sudo systemctl daemon-reload
  sudo systemctl restart kpro-gauges
  -----------------------------------------------------------

  -------------------------------------------------------

  PROBLEM: Pi's IP address changed / can't find Pi
  SOLUTION: Find the Pi's current IP:
  -----------------------------------------------------------
  hostname -I
  -----------------------------------------------------------
  Or from another computer:
  -----------------------------------------------------------
  ping raspberrypi.local
  -----------------------------------------------------------

  -------------------------------------------------------

  PROBLEM: Phone WiFi "KProGauges" not showing up
  CAUSE: hostapd not running or WiFi hardware issue.
  SOLUTION:
  -----------------------------------------------------------
  sudo systemctl status hostapd
  -----------------------------------------------------------
  If failed:
  -----------------------------------------------------------
  sudo journalctl -u hostapd -n 20
  -----------------------------------------------------------

  Common fix - another process blocking WiFi:
  -----------------------------------------------------------
  sudo systemctl stop wpa_supplicant
  sudo rfkill unblock wifi
  sudo systemctl restart hostapd
  -----------------------------------------------------------

  If still not working, redo the setup:
  -----------------------------------------------------------
  cd ~/kpro-native
  sudo bash undo-hotspot.sh
  sudo bash setup-hotspot.sh
  sudo reboot
  -----------------------------------------------------------

  -------------------------------------------------------

  PROBLEM: Multiple phones can't connect at same time
  CAUSE: dnsmasq DHCP range too small.
  SOLUTION: Edit the dnsmasq config:
  -----------------------------------------------------------
  sudo nano /etc/dnsmasq.conf
  -----------------------------------------------------------
  Change dhcp-range line to:
  -----------------------------------------------------------
  dhcp-range=192.168.4.10,192.168.4.100,255.255.255.0,24h
  -----------------------------------------------------------
  Then:
  -----------------------------------------------------------
  sudo systemctl restart dnsmasq
  -----------------------------------------------------------

  -------------------------------------------------------

  PROBLEM: Server uses too much memory on Pi 3B+
  CAUSE: Node.js defaults may use too much RAM.
  SOLUTION: Limit Node.js memory:
  -----------------------------------------------------------
  sudo systemctl edit kpro-gauges
  -----------------------------------------------------------
  Add:
  -----------------------------------------------------------
  [Service]
  Environment=NODE_OPTIONS=--max-old-space-size=128
  -----------------------------------------------------------
  Then:
  -----------------------------------------------------------
  sudo systemctl daemon-reload
  sudo systemctl restart kpro-gauges
  -----------------------------------------------------------

  -------------------------------------------------------

  PROBLEM: Want to change the port (default 8080)
  SOLUTION:
  -----------------------------------------------------------
  sudo systemctl edit kpro-gauges
  -----------------------------------------------------------
  Add:
  -----------------------------------------------------------
  [Service]
  Environment=PORT=3000
  -----------------------------------------------------------
  Then:
  -----------------------------------------------------------
  sudo systemctl daemon-reload
  sudo systemctl restart kpro-gauges
  -----------------------------------------------------------
  Remember to use the new port in your browser URL.

  -------------------------------------------------------

  PROBLEM: Changes on phone don't show up / sync broken
  CAUSE: WebSocket connection issue.
  SOLUTION:
    1. Refresh the page on your phone
    2. Check the server is running:
  -----------------------------------------------------------
  sudo systemctl status kpro-gauges
  -----------------------------------------------------------
    3. Restart the server:
  -----------------------------------------------------------
  sudo systemctl restart kpro-gauges
  -----------------------------------------------------------

  -------------------------------------------------------

  PROBLEM: Gauges not showing on Pi screen (blank screen)
  CAUSE: Display service not running or no desktop environment.
  SOLUTION:
    1. Check if the display service exists and is running:
  -----------------------------------------------------------
  sudo systemctl status kpro-display
  -----------------------------------------------------------

    If it says "not found", re-run the installer:
  -----------------------------------------------------------
  cd ~/kpro-native
  sudo bash install.sh
  -----------------------------------------------------------

    If it says "failed", check logs:
  -----------------------------------------------------------
  sudo journalctl -u kpro-display -n 20
  -----------------------------------------------------------

    2. Make sure you have a desktop environment:
       Pi OS Lite has no GUI - the display service needs
       the graphical desktop to show a browser.
       Either use Pi OS Desktop, or view from phone instead.

    3. Make sure surf is installed:
  -----------------------------------------------------------
  which surf
  -----------------------------------------------------------
       If not found:
  -----------------------------------------------------------
  sudo apt-get install -y surf
  sudo bash install.sh
  -----------------------------------------------------------

    4. Make sure the DISPLAY variable is set:
  -----------------------------------------------------------
  echo $DISPLAY
  -----------------------------------------------------------
       Should show ":0". If empty, the desktop isn't running.

  -------------------------------------------------------

  PROBLEM: surf browser shows white/blank page
  CAUSE: Server not ready when browser opened.
  SOLUTION:
    The display service waits 4 seconds for the server.
    If your Pi is slow, increase the delay:
  -----------------------------------------------------------
  sudo systemctl edit kpro-display
  -----------------------------------------------------------
    Add:
  -----------------------------------------------------------
  [Service]
  ExecStartPre=/bin/sleep 8
  -----------------------------------------------------------
    Then:
  -----------------------------------------------------------
  sudo systemctl daemon-reload
  sudo systemctl restart kpro-display
  -----------------------------------------------------------

  -------------------------------------------------------

  PROBLEM: Want to switch between headless and screen display
  SOLUTION:
    To disable screen display (headless only):
  -----------------------------------------------------------
  sudo systemctl stop kpro-display
  sudo systemctl disable kpro-display
  -----------------------------------------------------------

    To re-enable screen display:
  -----------------------------------------------------------
  sudo systemctl enable kpro-display
  sudo systemctl start kpro-display
  -----------------------------------------------------------

  -------------------------------------------------------

  PROBLEM: How do I update to a new version?
  SOLUTION:
    1. Download the new kpro-native-raspi.zip
    2. Stop the service:
  -----------------------------------------------------------
  sudo systemctl stop kpro-gauges
  -----------------------------------------------------------
    3. Backup your current installation:
  -----------------------------------------------------------
  cp -r ~/kpro-native ~/kpro-native-backup
  -----------------------------------------------------------
    4. Extract new files over the old:
  -----------------------------------------------------------
  unzip -o kpro-native-raspi.zip -d ~/
  -----------------------------------------------------------
    5. Restart:
  -----------------------------------------------------------
  sudo systemctl start kpro-gauges
  -----------------------------------------------------------

================================================================
  13. ADVANCED CONFIGURATION
================================================================

  ENVIRONMENT VARIABLES:

    PORT=8080           Web server port (default: 8080)
    SERIAL_PORT=        Force specific serial port path
                        (e.g., /dev/ttyUSB0, /dev/ttyACM0)
    SERIAL_BAUD=38400   Serial baud rate (default: 38400)
    HEADLESS=1          Skip browser launch (start.sh only)

  SET VARIABLES PERMANENTLY:
  -----------------------------------------------------------
  sudo systemctl edit kpro-gauges
  -----------------------------------------------------------
  Add:
  -----------------------------------------------------------
  [Service]
  Environment=PORT=8080
  Environment=SERIAL_PORT=/dev/ttyUSB0
  Environment=SERIAL_BAUD=38400
  -----------------------------------------------------------
  Then:
  -----------------------------------------------------------
  sudo systemctl daemon-reload
  sudo systemctl restart kpro-gauges
  -----------------------------------------------------------

  RUNNING MANUALLY (without systemd):
  -----------------------------------------------------------
  cd ~/kpro-native
  PORT=8080 SERIAL_PORT=/dev/ttyUSB0 node server.js
  -----------------------------------------------------------

  RUNNING ON A DIFFERENT PORT:
  -----------------------------------------------------------
  cd ~/kpro-native
  PORT=3000 ./start.sh
  -----------------------------------------------------------

  CHECKING THE API:
    Open in any browser on the same network:
      http://192.168.4.1:8080/api/status
    Shows: connected clients, serial status, demo mode state.

  SUPPORTED SERIAL DEVICES:
    The server scans these paths:
      /dev/ttyUSB0, /dev/ttyUSB1
      /dev/ttyACM0, /dev/ttyACM1
      /dev/ttyAMA0, /dev/serial0

================================================================
  14. UNINSTALLING
================================================================

  Remove the systemd service (keeps files):
  -----------------------------------------------------------
  cd ~/kpro-native
  sudo bash uninstall.sh
  -----------------------------------------------------------

  Completely remove everything:
  -----------------------------------------------------------
  cd ~/kpro-native
  sudo bash uninstall.sh
  sudo bash undo-hotspot.sh
  cd ~
  rm -rf ~/kpro-native
  sudo reboot
  -----------------------------------------------------------

================================================================
  15. TECHNICAL REFERENCE
================================================================

  System Architecture:
    - Server: Pure Node.js HTTP server (no Express)
    - Display: surf browser (~2MB) or midori (lightweight)
    - WebSocket: Bundled ws module for real-time streaming
    - Protocol: ELM327 OBD-II commands over UART serial
    - Frontend: React app compiled to static files
    - Fonts: Locally bundled woff2 (Orbitron, Rajdhani,
      Inter, Roboto Mono)
    - Services: kpro-gauges (server) + kpro-display (browser)

  Serial Communication:
    - Default baud: 38400 (configurable)
    - Data bits: 8, Stop bits: 1, Parity: none
    - ELM327 init: ATZ, ATE0, ATL0, ATS0, ATH0, ATSP0
    - Polling: 50ms per PID (6 PIDs = ~300ms cycle)
    - Auto-reconnect: 10 seconds after unplug

  WebSocket:
    - Endpoint: /ws (ws://PI_IP:8080/ws)
    - Telemetry at ~30Hz (33ms interval)
    - JSON payload with _source field ("ecu" or "demo")

  REST API:
    - GET /api/status       Server info
    - GET /api/settings     Gauge configuration
    - GET /api/layout       Gauge positions
    - GET /api/trip-data    Trip meter data
    - GET /api/serial/ports Available serial ports

  Resource Usage (Raspberry Pi 3B+):
    - Package size: ~400KB (compressed ZIP)
    - Memory: ~30-50MB (server) + ~50MB (surf browser)
    - CPU: <5% during normal operation
    - Startup time: ~5 seconds (server + browser)

  Compared to Chromium Version:
    - surf uses ~2MB disk vs Chromium's ~300MB
    - Uses ~150MB less RAM than Chromium
    - Faster startup
    - More reliable auto-start via dual systemd services
    - Still supports phone access via WiFi hotspot
    - Falls back to headless if no display available

================================================================
  END OF SETUP GUIDE
================================================================
`;
      archive.append(nativeReadme, { name: 'kpro-native/README.txt' });

      await archive.finalize();
    } catch (error) {
      console.error('Failed to create native package:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create native package' });
      }
    }
  });

  // ----------------------------------------------------------------
  // Master Bundle (Self-Host Kit) — password-protected download.
  // Served from a prebuilt zip cached on disk. The bundle is built once
  // at startup (and rebuildable on demand) so this endpoint never has to
  // archive a large tree per request.
  // ----------------------------------------------------------------
  const MASTER_PASSWORD = process.env.MASTER_PASSWORD || '0709281001';

  // Kick off the build in the background; never block boot.
  ensureMasterBundleBuilt().catch((err) => {
    console.error('[master-bundle] initial build failed:', err);
  });

  app.post('/api/download-master/rebuild', async (req, res) => {
    const provided = (req.headers['x-master-password'] as string | undefined) || (req.query.key as string | undefined);
    if (!provided || provided !== MASTER_PASSWORD) {
      res.status(401).json({ error: 'Incorrect password.' });
      return;
    }
    try {
      await rebuildMasterBundle();
      res.json({ ok: true, path: MASTER_BUNDLE_PATH });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Rebuild failed: ${msg}` });
    }
  });

  // ── Android APK download ────────────────────────────────────────────────
  // Serves the standalone Android APK built via Capacitor. The build
  // pipeline (scripts/build-android.sh) drops the signed-for-sideload APK
  // at android/app/build/outputs/apk/release/app-release.apk; we also accept
  // a manually-placed file at public/downloads/app-release.apk so users on
  // machines without an Android SDK can drop in a prebuilt artifact.
  const APK_CANDIDATE_PATHS = [
    path.resolve(process.cwd(), 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
    path.resolve(process.cwd(), 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
    path.resolve(process.cwd(), 'public', 'downloads', 'app-release.apk'),
    path.resolve(process.cwd(), 'dist', 'app-release.apk'),
  ];

  // Single source of truth for the Android app version label served to
  // users. Bump this in lockstep with a new tag push so the downloaded
  // file name matches what people see in the app's About section.
  const ANDROID_APP_VERSION = 'v1.6';
  const ANDROID_APP_FILENAME = `s2000-gauges-${ANDROID_APP_VERSION}.apk`;

  function findApk(): string | null {
    for (const p of APK_CANDIDATE_PATHS) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  // Lightweight status check the in-app download button polls so it can
  // honestly say "preparing" vs "ready", and show file size, instead of
  // sending the user to a broken 503 download.
  app.get('/api/download-apk/status', (_req, res) => {
    const apkPath = findApk();
    res.setHeader('Cache-Control', 'no-store');
    if (!apkPath) {
      res.json({
        available: false,
        version: ANDROID_APP_VERSION,
        filename: ANDROID_APP_FILENAME,
        sizeBytes: 0,
      });
      return;
    }
    let sizeBytes = 0;
    try { sizeBytes = fs.statSync(apkPath).size; } catch { /* ignore */ }
    res.json({
      available: true,
      version: ANDROID_APP_VERSION,
      filename: ANDROID_APP_FILENAME,
      sizeBytes,
    });
  });

  app.get('/api/download-apk', (_req, res) => {
    const apkPath = findApk();
    if (!apkPath) {
      res.status(503).json({
        error: 'APK not built yet',
        hint: 'Run scripts/build-android.sh on a machine with the Android SDK installed, '
            + 'or drop a prebuilt app-release.apk into public/downloads/.',
        searched: APK_CANDIDATE_PATHS,
      });
      return;
    }
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename="${ANDROID_APP_FILENAME}"`);
    fs.createReadStream(apkPath).pipe(res);
  });

  app.get('/api/download-master', async (req, res) => {
    const provided = (req.headers['x-master-password'] as string | undefined) || (req.query.key as string | undefined);
    if (!provided || provided !== MASTER_PASSWORD) {
      res.status(401).json({ error: 'Incorrect password.' });
      return;
    }

    try {
      await ensureMasterBundleBuilt();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(503).json({
        error: 'Bundle not built',
        detail: msg,
        hint: 'POST /api/download-master/rebuild with the same password to retry.',
      });
      return;
    }

    if (!fs.existsSync(MASTER_BUNDLE_PATH)) {
      res.status(503).json({
        error: 'Bundle not built',
        hint: 'POST /api/download-master/rebuild with the same password to build it.',
      });
      return;
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${MASTER_BUNDLE_FILENAME}"`);
    fs.createReadStream(MASTER_BUNDLE_PATH).pipe(res);
  });

  return httpServer;
}
