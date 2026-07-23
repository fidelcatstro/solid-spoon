# Android branding assets

Source files used by `scripts/build-android.sh` to brand the standalone
Android APK so it looks like a real app on the home screen instead of a
generic Capacitor template.

## Files

| File                          | Purpose                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `ic_launcher.png`             | Full square launcher icon (1024×1024). Source for every `mipmap-*/ic_launcher.png`.      |
| `ic_launcher_foreground.png`  | Adaptive-icon foreground (1024×1024, transparent BG, ~33% safe zone padding).            |
| `splash.png`                  | Splash artwork (1024×1024 source, scaled to 2732×2732 by capacitor-assets).              |
| `MainActivity.java`           | Drop-in MainActivity that enables immersive fullscreen (no status bar, no nav bar).      |
| `styles.xml`                  | Theme override — transparent system bars, dark windowBackground, `splash` drawable.       |
| `strings.xml`                 | Launcher label "S2000 Gauges" + package metadata.                                         |
| `capacitor-assets-config.json`| Reference values for `@capacitor/assets`. **Note:** the actual icon/splash background colours are set by CLI flags in `scripts/build-android.sh` (which is authoritative); this file is informational. |

## How they're used

`scripts/build-android.sh` runs, in order:

1. `vite build`
2. `npx cap add android` (only if `android/` is missing)
3. **`npx capacitor-assets generate --android --assetPath branding/android`**
   — generates every `mipmap-*/ic_launcher*.png`, `mipmap-anydpi-v26/*.xml`,
   `values/ic_launcher_background.xml`, `drawable*/splash.png`, etc.
4. **Copies `MainActivity.java`, `styles.xml`, `strings.xml` into the
   matching paths under `android/app/src/main/`.**
5. `npx cap sync android`
6. `./gradlew assembleRelease`

## Replacing the icon / splash

Drop a new `ic_launcher.png` (1024×1024 PNG, opaque), refresh
`ic_launcher_foreground.png` (1024×1024 PNG, transparent, content
inside the central 66%) and `splash.png`. Re-run `scripts/build-android.sh`.

If you change the adaptive-icon or splash background colour, edit the
`--iconBackgroundColor` / `--splashBackgroundColor` flags in
`scripts/build-android.sh` (the script passes these on the
`capacitor-assets generate` CLI, which overrides the JSON config).

## Why not commit the generated files?

Capacitor regenerates `android/` from scratch whenever a maintainer runs
`npx cap add android`, so any hand-edited file under `android/app/src/main/res/`
would be wiped on the next clean build. Keeping the source assets in this
folder + scripting the copy makes the branding reproducible.
