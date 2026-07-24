#!/usr/bin/env bash
# ============================================================
# S2000 KPro Gauges — Android APK build helper
# ============================================================
# Builds a sideload-ready APK from the existing Vite frontend
# using Capacitor. Run this on a machine with:
#   - Node.js 20+
#   - Java 17 (e.g. Temurin)
#   - Android SDK with platform 34 + build-tools 34.0.0
#   - The ANDROID_HOME (or ANDROID_SDK_ROOT) env var pointing at it
#
# First-time setup (run once):
#   npm install --no-save \
#     @capacitor/core @capacitor/cli @capacitor/android \
#     @capacitor/preferences @capacitor/screen-orientation \
#     @capacitor/status-bar @capacitor/splash-screen \
#     @capacitor/assets \
#     @capacitor-community/bluetooth-le \
#     @capacitor-community/keep-awake
#   npx cap add android
#
#   For USB-OTG, install any community USB-serial Capacitor plugin and
#   register it under the name "UsbSerial" (see client/src/lib/native-usb.ts
#   for the expected method shape).
#
# Build:
#   bash scripts/build-android.sh         # release (signed with real keystore
#                                         #          if ANDROID_KEYSTORE_BASE64
#                                         #          et al. are set; otherwise
#                                         #          debug-signed for sideload)
#   bash scripts/build-android.sh debug   # debug build
#
# Optional release signing (set all four to enable, e.g. via GitHub Secrets):
#   ANDROID_KEYSTORE_BASE64    base64-encoded .jks/.keystore file
#   ANDROID_KEYSTORE_PASSWORD  store password
#   ANDROID_KEY_ALIAS          key alias inside the keystore
#   ANDROID_KEY_PASSWORD       key password
#
# Output:
#   android/app/build/outputs/apk/<flavor>/app-<flavor>.apk
#   This file is what /api/download-apk serves.
# ============================================================

set -euo pipefail

FLAVOR="${1:-release}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -d "node_modules/@capacitor/cli" ]; then
  echo "ERROR: Capacitor is not installed. See the comment at the top of this script."
  exit 1
fi

echo "[1/4] Building web assets..."
npx vite build

echo "[2/4] Syncing assets to the Android project..."
if [ ! -d "android" ]; then
  echo "  android/ project missing — running 'npx cap add android'..."
  npx cap add android
fi

# ------------------------------------------------------------
# Apply S2000 branding (icon, splash, app name, immersive MainActivity).
# Source assets live in branding/android/. Done before `cap sync` so the
# generated icon/splash drawables get picked up by the sync step.
# ------------------------------------------------------------
BRANDING_DIR="$ROOT_DIR/branding/android"
if [ -d "$BRANDING_DIR" ]; then
  echo "  Applying branding from $BRANDING_DIR..."

  if [ -d "node_modules/@capacitor/assets" ]; then
    npx capacitor-assets generate --android --assetPath "$BRANDING_DIR" \
      --iconBackgroundColor '#0a0e14' \
      --iconBackgroundColorDark '#0a0e14' \
      --splashBackgroundColor '#000000' \
      --splashBackgroundColorDark '#000000' \
      || echo "  WARN: capacitor-assets generation failed; falling back to template icon."
  else
    echo "  NOTE: @capacitor/assets is not installed (npm install --no-save @capacitor/assets)."
    echo "        Skipping icon/splash regeneration; the default Capacitor icon will ship."
  fi

  RES_DIR="$ROOT_DIR/android/app/src/main/res"
  JAVA_PKG_DIR="$ROOT_DIR/android/app/src/main/java/com/s2000/kprogauges"
  mkdir -p "$RES_DIR/values" "$JAVA_PKG_DIR"

  [ -f "$BRANDING_DIR/strings.xml"      ] && cp "$BRANDING_DIR/strings.xml"      "$RES_DIR/values/strings.xml"
  [ -f "$BRANDING_DIR/styles.xml"       ] && cp "$BRANDING_DIR/styles.xml"       "$RES_DIR/values/styles.xml"
  [ -f "$BRANDING_DIR/MainActivity.java" ] && cp "$BRANDING_DIR/MainActivity.java" "$JAVA_PKG_DIR/MainActivity.java"

  # AndroidManifest override — adds <supports-screens>, optional
  # touchscreen/USB-host features, and queries needed for Android 11+
  # so the APK installs cleanly on Samsung phones, Galaxy Tabs, Tab
  # Active, and generic head units.
  MANIFEST_DST="$ROOT_DIR/android/app/src/main/AndroidManifest.xml"
  if [ -f "$BRANDING_DIR/AndroidManifest.xml" ] && [ -f "$MANIFEST_DST" ]; then
    cp "$BRANDING_DIR/AndroidManifest.xml" "$MANIFEST_DST"
    echo "  AndroidManifest.xml override applied (supports-screens, optional touchscreen/USB-host, package-visibility queries)."
  fi

  echo "  Branding applied: app name, immersive MainActivity, theme overrides, manifest tablet-friendly tags."
else
  echo "  No branding/android/ directory found — using Capacitor defaults."
fi

npx cap sync android

echo "[3/4] Assembling APK ($FLAVOR)..."

# ------------------------------------------------------------
# Optional release signing.
#
# If ANDROID_KEYSTORE_BASE64 (and friends) are set, decode the keystore and
# pass the credentials to Gradle so assembleRelease produces a properly-signed
# APK. Otherwise fall back to debug-signing the unsigned APK below so it still
# sideloads. The Gradle signingConfig (in android/app/build.gradle) is expected
# to read these from -P properties; if it doesn't, jarsigner below uses them
# as a fallback.
#
# Required secrets/env vars for release signing:
#   ANDROID_KEYSTORE_BASE64  - base64 of the .jks/.keystore file
#   ANDROID_KEYSTORE_PASSWORD
#   ANDROID_KEY_ALIAS
#   ANDROID_KEY_PASSWORD
# ------------------------------------------------------------
RELEASE_KEYSTORE=""
GRADLE_SIGNING_ARGS=()

# Always remove any decoded keystore on exit (success, failure, or signal) so
# the secret file never lingers in the workspace or workflow artifact bundle.
cleanup_release_keystore() {
  if [ -n "${RELEASE_KEYSTORE:-}" ] && [ -f "$RELEASE_KEYSTORE" ]; then
    rm -f "$RELEASE_KEYSTORE"
  fi
}
trap cleanup_release_keystore EXIT INT TERM

if [ "$FLAVOR" != "debug" ]; then
  missing_signing_vars=()
  [ -z "${ANDROID_KEYSTORE_BASE64:-}" ]   && missing_signing_vars+=("ANDROID_KEYSTORE_BASE64")
  [ -z "${ANDROID_KEYSTORE_PASSWORD:-}" ] && missing_signing_vars+=("ANDROID_KEYSTORE_PASSWORD")
  [ -z "${ANDROID_KEY_ALIAS:-}" ]         && missing_signing_vars+=("ANDROID_KEY_ALIAS")
  [ -z "${ANDROID_KEY_PASSWORD:-}" ]      && missing_signing_vars+=("ANDROID_KEY_PASSWORD")

  if [ ${#missing_signing_vars[@]} -eq 0 ]; then
    RELEASE_KEYSTORE="$ROOT_DIR/android/app/release.keystore"
    echo "  Release signing: decoding keystore from ANDROID_KEYSTORE_BASE64..."
    mkdir -p "$(dirname "$RELEASE_KEYSTORE")"
    echo "$ANDROID_KEYSTORE_BASE64" | base64 -d > "$RELEASE_KEYSTORE"
    GRADLE_SIGNING_ARGS=(
      "-Pandroid.injected.signing.store.file=$RELEASE_KEYSTORE"
      "-Pandroid.injected.signing.store.password=$ANDROID_KEYSTORE_PASSWORD"
      "-Pandroid.injected.signing.key.alias=$ANDROID_KEY_ALIAS"
      "-Pandroid.injected.signing.key.password=$ANDROID_KEY_PASSWORD"
    )
  else
    echo "  Release signing: missing env var(s): ${missing_signing_vars[*]} — falling back to debug signing."
  fi
fi

pushd android > /dev/null
chmod +x cd android cd android ./gradlew./gradlew ./gradlewcd android ./gradlew./gradlew ./gradlew cd android ./gradlew./gradlew ./gradlew 2>/dev/null || true
if [ "$FLAVOR" = "debug" ]; then
  cd android cd android ./gradlew./gradlew ./gradlewcd android ./gradlew./gradlew ./gradlew cd android ./gradlew./gradlew ./gradlew assembleDebug
  APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
else
  cd android cd android ./gradlew./gradlew ./gradlewcd android ./gradlew./gradlew ./gradlew cd android ./gradlew./gradlew ./gradlew assembleRelease "${GRADLE_SIGNING_ARGS[@]}"
  APK_PATH="app/build/outputs/apk/release/app-release.apk"
  if [ ! -f "$APK_PATH" ]; then
    # Some Capacitor templates produce app-release-unsigned.apk. Sign it with
    # the release keystore (if available) so the output APK isn't flagged as
    # debug-only; otherwise fall back to the debug key for sideloading.
    UNSIGNED="app/build/outputs/apk/release/app-release-unsigned.apk"
    if [ -f "$UNSIGNED" ]; then
      cp "$UNSIGNED" "$APK_PATH"
      if [ -n "$RELEASE_KEYSTORE" ] && [ -f "$RELEASE_KEYSTORE" ]; then
        echo "  Signing with release key (alias=$ANDROID_KEY_ALIAS)..."
        jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
          -keystore "$RELEASE_KEYSTORE" \
          -storepass "$ANDROID_KEYSTORE_PASSWORD" \
          -keypass "$ANDROID_KEY_PASSWORD" \
          "$APK_PATH" "$ANDROID_KEY_ALIAS"
      else
        DEBUG_KEYSTORE="$HOME/.android/debug.keystore"
        if [ ! -f "$DEBUG_KEYSTORE" ]; then
          echo "  Generating debug keystore..."
          mkdir -p "$HOME/.android"
          keytool -genkey -v \
            -keystore "$DEBUG_KEYSTORE" -storepass android -alias androiddebugkey \
            -keypass android -dname "CN=Android Debug,O=Android,C=US" \
            -keyalg RSA -keysize 2048 -validity 10000
        fi
        echo "  Signing with debug key (release keystore not configured)..."
        jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
          -keystore "$DEBUG_KEYSTORE" -storepass android -keypass android \
          "$APK_PATH" androiddebugkey
      fi
    fi
  fi
fi
popd > /dev/null

# Decoded keystore (if any) is removed by the EXIT trap registered above.

# ------------------------------------------------------------
# Verify the produced APK is a UNIVERSAL APK that includes the CPU
# architectures every Samsung phone / tablet ships with. If a future
# Capacitor / Gradle change accidentally enables ABI splits and ships
# (say) only arm64-v8a, this guard fails the build before the APK
# reaches users instead of leaving owners of older Galaxy A / Tab A
# devices with a "this app is not compatible with your device" error.
# ------------------------------------------------------------
APK_FULL_PATH="$ROOT_DIR/android/$APK_PATH"
if [ -f "$APK_FULL_PATH" ] && command -v unzip >/dev/null 2>&1; then
  echo "  Verifying universal APK (must contain arm64-v8a + armeabi-v7a)..."
  ABIS_PRESENT=$(unzip -l "$APK_FULL_PATH" 2>/dev/null | awk '/lib\/[^/]+\//{print $4}' | awk -F/ '{print $2}' | sort -u | tr '\n' ' ')
  echo "  ABIs in APK: ${ABIS_PRESENT:-<none>}"
  MISSING_ABIS=()
  for required in arm64-v8a armeabi-v7a x86_64; do
    if ! echo " $ABIS_PRESENT " | grep -q " $required "; then
      MISSING_ABIS+=("$required")
    fi
  done
  if [ ${#MISSING_ABIS[@]} -gt 0 ]; then
    if [ -z "$ABIS_PRESENT" ]; then
      # Some Capacitor builds ship no native libs at all (pure JS); that
      # is still universal — every device can install it.
      echo "  No native libs in APK — pure JS build, universal by definition. OK."
    else
      echo "  ERROR: APK is missing required ABI(s): ${MISSING_ABIS[*]}" >&2
      echo "  This APK would NOT install on Samsung devices using those ABIs." >&2
      echo "  Check android/app/build.gradle for ABI splits / abiFilters." >&2
      exit 1
    fi
  fi
fi

echo "[4/4] Done."
echo ""
echo "APK ready at:"
echo "  android/$APK_PATH"
echo ""
echo "Sideload:"
echo "  adb install -r android/$APK_PATH"
echo ""
echo "Or distribute via /api/download-apk (the running Node server picks it up automatically)."
