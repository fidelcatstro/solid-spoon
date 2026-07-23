# Standalone Android App — KPro Gauges

The same React frontend used in the web/Pi build is wrapped with
[Capacitor](https://capacitorjs.com/) to produce a sideloadable Android
APK. The Pi installer, web app, and `npm run dev` workflow are
unaffected — Capacitor is purely additive.

> **Fully offline after install.** The APK bundles every font, image,
> script, and gauge asset it needs. Once installed it makes **zero
> network requests** unless you explicitly configure a custom server
> in Settings → Server. Cold-launches in airplane mode work the same
> as online.
>
> **Runs on Samsung phones and tablets.** Tested layout flags +
> universal APK (arm64-v8a, armeabi-v7a, x86_64) cover Galaxy S /
> A series phones, Galaxy Tab S / A / Active series tablets, and
> generic in-dash head units. The launcher icon installs as a real
> home-screen app — no Chrome shortcut, no browser chrome, no URL
> bar.

For a plain-language guide to publishing a new APK release (push a
tag, GitHub builds it for you), see [`../RELEASE.md`](../RELEASE.md).

## What works in the APK

- **USB-OTG (auto-connect).** Plug a KPro V4 (`1C40:0434`), KPro V2/V3
  (FTDI `0403:F5F8`), or any common ELM327 USB-serial adapter into the
  tablet via a USB-OTG cable. The app detects the device, prompts once
  for permission, and starts streaming telemetry within a couple of
  seconds with no taps required.
- **Bluetooth ELM327.** "Bluetooth Scan" pairs an ELM327 BLE adapter
  and runs the same `ATZ / ATE0 / ATL0 / ATS0 / ATH0 / ATSP0` init
  sequence and PID polling (`010C 010D 0105 010B 0111 012F`) used by
  the web build.
- **Custom server (LAN).** In Settings → Server, enter the address of
  any computer running the dashboard server (e.g. `192.168.1.42:5000`)
  and tap Save. The app uses that host for WebSocket telemetry sync,
  settings sync, and `/api/...` calls. Replit is not required for any
  online feature.
- **Local persistence.** Gauge layout, theme, warnings, and the saved
  server host all survive app restarts with no server connection.
- **Connection priority.** USB (if attached) → Bluetooth (if connected)
  → Custom server (if configured) → Demo mode.
- **Smart orientation.** Tablets (smallest dimension ≥ 600 dp — Galaxy
  Tab, head units, etc.) auto-lock to landscape on launch. Phones
  follow the device's natural rotation. Settings → Display →
  Orientation lets the user override either way (Auto / Always /
  Never).
- **Standalone shell.** Status bar hidden (true immersive
  fullscreen), screen kept awake, demo telemetry on first launch so
  it never starts blank.

## One-time setup on your build machine

You need:

- Node.js 20+
- Java 17 (Temurin recommended)
- Android SDK with platform 34 and build-tools 34.0.0
- `ANDROID_HOME` (or `ANDROID_SDK_ROOT`) pointing at your SDK

Install Capacitor and the plugins (this does **not** modify the
project's `package.json` — they are dev-only on your build machine):

```bash
npm install --no-save \
  @capacitor/core @capacitor/cli @capacitor/android \
  @capacitor/app @capacitor/preferences @capacitor/screen-orientation \
  @capacitor/status-bar @capacitor/splash-screen \
  @capacitor/assets \
  @capacitor-community/bluetooth-le \
  @capacitor-community/keep-awake

npx cap add android
```

Optional (for the JS-side nav-bar hide; the native MainActivity already
hides it via `WindowInsetsControllerCompat`, so this is belt-and-braces):

```bash
npm install --no-save @capawesome/capacitor-android-edge-to-edge-support
```

For USB-OTG, install any Capacitor USB-serial plugin you prefer and
register it under the name `UsbSerial`. The expected method shape is
documented at the top of `client/src/lib/native-usb.ts`. A
`registerPlugin('UsbSerial', { … })` shim around `usb-serial-for-android`
or similar works.

## Build the APK

```bash
bash scripts/build-android.sh         # release
bash scripts/build-android.sh debug   # debug build
```

The script:

1. Builds the web assets (`vite build`).
2. Runs `npx cap add android` if the `android/` folder is missing.
3. Applies branding (see [Branding](#branding-icon-splash-app-name-immersive-fullscreen)
   below): generates icons + splash from `branding/android/` and copies
   `MainActivity.java`, `styles.xml`, `strings.xml` into the project.
4. Runs `npx cap sync android`.
5. Runs `./gradlew assembleRelease` (or `assembleDebug`).
6. Signs the release APK with your real keystore if the four
   `ANDROID_KEYSTORE_*` env vars are set (see below); otherwise falls
   back to the Android debug key so the APK still sideloads.

### Release signing (optional)

To produce a properly-signed release APK (so Android doesn't flag it as
debug-only and MDM/launcher tools accept it), set these four env vars
before running the script. In the GitHub Actions workflow they are read
from repository **Settings → Secrets and variables → Actions** under
exactly these names:

| Secret / env var | Meaning |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Your `.jks` / `.keystore` file, base64-encoded (`base64 -w0 my-release.keystore`). |
| `ANDROID_KEYSTORE_PASSWORD` | Store password for that keystore. |
| `ANDROID_KEY_ALIAS` | Alias of the signing key inside the keystore. |
| `ANDROID_KEY_PASSWORD` | Password for that specific key. |

If **any** of the four is missing, the build script prints a notice and
falls back to debug signing — the workflow still completes successfully,
but the resulting APK is debug-signed (sideload only). Generate a
keystore once with:

```bash
keytool -genkeypair -v \
  -keystore kpro-gauges-release.keystore \
  -alias kpro-gauges -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 kpro-gauges-release.keystore > keystore.b64   # paste into ANDROID_KEYSTORE_BASE64
```

Keep the keystore file out of git — only the base64 secret lives in
GitHub. Locally you can run a release-signed build with:

```bash
ANDROID_KEYSTORE_BASE64="$(base64 -w0 kpro-gauges-release.keystore)" \
ANDROID_KEYSTORE_PASSWORD=••• \
ANDROID_KEY_ALIAS=kpro-gauges \
ANDROID_KEY_PASSWORD=••• \
bash scripts/build-android.sh release
```

The output is at:

```
android/app/build/outputs/apk/release/app-release.apk
```

## Install on a tablet

1. On the tablet, enable **Settings → Apps → Special access → Install
   unknown apps** for your file manager / browser.
2. Copy the APK to the tablet (USB, Drive, email, AirDroid, whatever).
3. Open the APK from the file manager and confirm the install.

Or with `adb`:

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

## Point the app at your laptop

1. On your laptop, run:

   ```bash
   npm run dev
   ```

2. Find the laptop's LAN IP (e.g. `192.168.1.42`).
3. On the tablet, open **Settings → Server**, type
   `192.168.1.42:5000`, tap **Save**. The status chip turns green when
   the server is reachable.
4. Done. The tablet now uses your laptop as its backend for WebSocket
   telemetry sync, settings sync, and downloads.

To go fully standalone again, tap **Clear** in the same section.

## Sharing the APK with friends

- The running server exposes the APK at `/api/download-apk`. Anyone on
  the same network (or anyone you port-forward to) can hit that URL in
  a browser to download it.
- You can also share the raw APK file directly — email, Drive, USB,
  AirDrop-equivalents — Android sideload accepts the file from any
  source as long as "Install unknown apps" is enabled.

## Branding (icon, splash, app name, immersive fullscreen)

Source assets live in [`branding/android/`](../branding/android/) and are
applied automatically by `scripts/build-android.sh` after `npx cap add
android`. The script:

1. Runs `npx capacitor-assets generate --android --assetPath branding/android`
   to produce every `mipmap-*/ic_launcher*.png`, the adaptive-icon XML in
   `mipmap-anydpi-v26/`, and `drawable*/splash.png` from the source PNGs.
2. Copies `branding/android/MainActivity.java` over the default Capacitor
   one. The override enables true **immersive fullscreen** via
   `WindowInsetsControllerCompat` so the Android status bar and software
   nav bar are hidden and stay hidden across resumes / rotations. Bars
   reappear briefly on a swipe-from-edge then auto-hide again.
3. Copies `branding/android/strings.xml` so the launcher label reads
   **"S2000 Gauges"** (matches `appName` in `capacitor.config.ts`).
4. Copies `branding/android/styles.xml` so the AppTheme has a black
   background, transparent system bars, and a dark splash drawable —
   no white flash on launch.

The splash hide timing and background colour are configured under
`SplashScreen` in `capacitor.config.ts`.

To swap the artwork, drop new `ic_launcher.png`, `ic_launcher_foreground.png`,
and `splash.png` files into `branding/android/` (sizes documented in
[`branding/android/README.md`](../branding/android/README.md)) and re-run
the build script. Nothing else needs to change.

> The first-time `npm install --no-save …` line in this README already
> includes `@capacitor/assets` and `@capacitor/splash-screen` so this all
> works on a fresh checkout.

## Refreshing the bundled APK

The `/api/download-apk` endpoint serves the first file it finds in
this order:

1. `android/app/build/outputs/apk/release/app-release.apk` (fresh build)
2. `android/app/build/outputs/apk/debug/app-debug.apk`
3. **`public/downloads/app-release.apk`** ← the file shipped with the repo
4. `dist/app-release.apk`

Slot #3 is the one to keep current so a freshly cloned checkout (or a
deployed server with no Android SDK) can serve the download
immediately, without anyone needing to run a build first.

### Preferred: let CI rebuild it

A GitHub Actions workflow at
[`.github/workflows/build-android-apk.yml`](../.github/workflows/build-android-apk.yml)
installs JDK 17 + the Android SDK, runs `bash scripts/build-android.sh`,
and refreshes `public/downloads/app-release.apk` for you. It runs on:

- **Any version tag push (`v*.*.*`).** The workflow builds the APK,
  commits the refreshed `public/downloads/app-release.apk` back to the
  default branch (with `[skip ci]` so it doesn't loop), and attaches
  the APK to the matching GitHub Release.
- **Manual dispatch.** From the Actions tab pick "Build Android APK" →
  *Run workflow*. You can choose whether to commit the APK back to the
  default branch and optionally attach it to a release tag.

The tag can also be created entirely from the GitHub web UI (Releases
→ Draft a new release) — no computer needed; see
[`../RELEASE.md`](../RELEASE.md) for the step-by-step. From a
command line, the normal flow for cutting a new download is just:

```bash
# bump the version label served by /api/download-apk if needed,
# then tag and push:
git tag v1.2.3
git push origin v1.2.3
```

CI will produce the APK and update the repo within a few minutes.
Every run also uploads the APK as a downloadable workflow artifact
(`app-release-apk`) for ad-hoc testing without committing.

### Fallback: manual refresh

Only needed if CI is unavailable or you're cutting a one-off build:

```bash
# 1. On a machine with JDK 17 + Android SDK (see "One-time setup" above)
bash scripts/build-android.sh

# 2. Copy the signed APK into the repo's public download slot
cp android/app/build/outputs/apk/release/app-release.apk \
   public/downloads/app-release.apk

# 3. Commit it
git add public/downloads/app-release.apk
git commit -m "Refresh bundled Android APK"
```

Notes:

- Bump the filename version in the `/api/download-apk` route in
  `server/routes.ts` (`kpro-gauges-vX.Y.apk`) when you ship a new
  build so users see the version they downloaded.
- If the four `ANDROID_KEYSTORE_*` secrets are configured, the APK is
  release-signed with your real keystore; otherwise it falls back to
  debug-signed (sideload only). See "Release signing" above.
- The Replit dev container does **not** have a JDK or the Android
  SDK, so this refresh has to happen in CI (preferred) or on a
  developer machine; it cannot be done from inside the Replit
  workspace.

## Troubleshooting

| Problem | Fix |
|---|---|
| `No server configured. Open Settings → Server to set one.` | The action requires a server (e.g. shared settings). Either add a server in Settings → Server or use the local-only flows (USB / Bluetooth / demo). |
| USB device shows up in Android but never connects | Confirm the Capacitor USB-serial plugin is installed and registered as `UsbSerial`. Verify the vendor ID is in the supported list (`1C40`, `0403`, common ELM327 chips). |
| Bluetooth scan finds nothing | Ensure Bluetooth is on and the OS-level location permission is granted. Older Android requires location for BLE scans. |
| `JAVA_HOME` errors during `gradlew` | Install JDK 17 and `export JAVA_HOME=/path/to/jdk-17`. |
| `SDK location not found` | Set `ANDROID_HOME=/path/to/Android/Sdk`. |

## What is not in scope

- Google Play Store listing / upload to Play Console — sideload only.
  (Release-key signing for sideload distribution *is* supported via the
  `ANDROID_KEYSTORE_*` secrets described above.)
- iOS / iPad build.
- Porting the Node backend to run on-device.
