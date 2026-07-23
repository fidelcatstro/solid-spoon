# S2000 Digital Gauge Cluster v1.6

A real-time digital gauge cluster for Honda S2000 vehicles with Hondata KPro V4 ECU integration. Runs on a Raspberry Pi 3B+ with offline WiFi hotspot support, and ships as a standalone Android APK that **works fully offline** on Samsung phones and tablets (Galaxy Tab / Tab Active / Galaxy S / A series).

## How do I publish a new version?

The standalone Android APK is built automatically by GitHub Actions whenever a version tag is created — and **no computer is required**: you can create the tag from a phone or tablet browser using GitHub's "Draft a new release" page. The full plain-language walkthrough (browser-only method, command-line method, watching the build, what to do if it fails) is in **[`RELEASE.md`](./RELEASE.md)**. No Android tools or build environment needed anywhere.

## Features

- Live telemetry: RPM, speed, coolant temp, AFR, MAP, oil temp, oil pressure, battery, IAT, and more
- Tachometer with VTEC zone (yellow) and red zone (always locked at correct RPM thresholds)
- Multi-page navigation: Home, Gauges, Quarter Mile, Diagnostics, Settings
- Diagnostics page with expandable live sensor graphs and offline DTC code lookup (60+ Honda/KPro codes)
- Drag-and-drop gauge layout, 6 color presets, per-gauge custom colors
- Auto-connect: gauges show live ECU data or demo data immediately on page load — no button clicks needed
- WiFi hotspot (KProGauges) for phone-based customization while driving

## Quick Start (Raspberry Pi)

### 1. Download the package

From the Gauges page, click **Pi Headless Package** or **Pi + Chromium Package** to download.

### 2. Copy to your Pi

```bash
scp kpro-native-raspi-v1.4.zip pi@raspberrypi.local:~
```

### 3. Run the installer

```bash
unzip kpro-native-raspi-v1.4.zip
cd kpro-native
sudo bash install.sh
```

The installer:
- Installs Node.js 20 LTS (if needed)
- Installs `build-essential`, `libusb-1.0-0-dev`, `libudev-dev` for native USB support
- Installs the `usb` npm module for direct KPro V4 USB communication
- Writes udev rules for KPro V4 (`1c40:0434`) and V2/V3 (`0403:f5f8`) — no `sudo` needed for USB
- Adds your user to `dialout` and `plugdev` groups
- Sets up a WiFi hotspot: **SSID: KProGauges / Password: s2000kpro**
- Installs and enables the `kpro-gauges` systemd service (auto-starts on boot)

### 4. Open gauges

- Pi screen: `http://localhost:8080` (or auto-launched in surf/midori after install)
- Phone: Connect to WiFi **KProGauges**, then open `http://192.168.4.1:8080`

## KPro V4 USB Connection

The server auto-detects the KPro V4 on startup. When the ECU is found:

- The server connects via native USB (vendor `0x1C40`, product `0x0434`)
- The browser receives `_source: 'ecu'` telemetry and shows **LIVE ECU** in the header
- No user interaction required — gauges unlock automatically

**Troubleshooting:**

| Problem | Fix |
|---|---|
| `LIBUSB_ERROR_ACCESS` | Run `sudo bash install.sh` to install udev rules, then reboot |
| `usb module not found` | `cd ~/kpro-native && npm install usb` |
| `npm install usb` fails | `sudo apt-get install -y build-essential libusb-1.0-0-dev libudev-dev` first |
| ECU not detected | Check USB cable; ensure ignition is ON; verify `lsusb` shows `1c40:0434` |

## Connection Priority

1. **KPro V4 USB** (automatic, server-side) — best for Pi
2. **KPro V2/V3 USB** (FTDI-based, automatic, server-side)
3. **ELM327 Serial** (server-side fallback, set `SERIAL_PORT=/dev/ttyUSBx`)
4. **Demo Mode** (automatic when no ECU connected)

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:5000` in your browser.

## Architecture

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Node.js + Express |
| Real-time | WebSocket (`ws` library) |
| Styling | Tailwind CSS + shadcn/ui |
| ECU protocol | KPro V4 native USB (bulk transfer, 0x40/0x60/0x61/0x62/0x65) |

See `replit.md` for full architecture details.

## Standalone Android App

The same dashboard ships as a sideload-ready Android APK so a tablet or
phone can run the gauges directly — with USB-OTG to a KPro V4 / ELM327
adapter, with a Bluetooth ELM327, or pointed at a server running on
your own laptop / desktop / Pi.

- **Real native app, not a Chrome shortcut.** The APK installs its own
  launcher icon ("S2000 Gauges") on the Android home screen and runs in
  its own window — Chrome does not have to be open or even installed.
- **Branded launch.** Custom S2000 launcher icon, dark splash screen,
  and true immersive fullscreen (no Android status bar, no nav bar) so
  the gauges fill the entire display.
- **Build the APK:** `bash scripts/build-android.sh` (requires
  Android SDK + JDK 17 — see `android/README.md` for the one-time setup).
- **Install on a tablet:** copy the APK over and open it from a file
  manager, or `adb install -r android/app/build/outputs/apk/release/app-release.apk`.
- **Point at your computer:** in the app, open **Settings → Server**,
  enter your laptop's LAN address (e.g. `192.168.1.42:5000`) and tap
  Save. The app uses that host for all WebSocket / API calls.
- **Share it:** the running Node server serves the APK at
  `/api/download-apk` (also linked from Settings → Download Packages
  and the gauge cluster downloads area). The raw APK file can also be
  shared directly via email, Drive, USB, etc.

Full Android docs (USB plugin shape, branding files, troubleshooting,
signing notes) are in `android/README.md` and `branding/android/README.md`.

## Self-Hosting the Download Site

A "Master Bundle (Self-Host Kit)" download is available in the **Downloads** section of App Settings (and in the gauge cluster downloads area). It's password-protected.

- **Default password:** `0709281001`
- **Override:** set the `MASTER_PASSWORD` env var on the server, or edit `config.json` in the unzipped bundle.

The bundle contains the full Node server, the pre-built frontend, a bundled `ws` module, `start.sh` / `start.bat` launchers, a `README.md`, and a `config.example.json`. Unzip it on any computer with Node 18+, run the launcher, and the same site is now live at `http://your-ip:8080` so people can download builds from a host you control.

Drop additional artifacts (Android APK, replacement Pi zips) into `public/downloads/` of the unzipped bundle to expose them at `http://your-ip:8080/downloads/<filename>`.

## Changelog

See the **Updates** button in the sidebar for the full version history.
