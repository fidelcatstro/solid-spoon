import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { isStandaloneApp } from "@/lib/runtime";

// Indirection: Vite tries to resolve string-literal dynamic imports even
// with /* @vite-ignore */, so we hide the specifier behind a variable so
// the missing optional plugins don't break the dev server.
function dynImport(spec: string): Promise<any> {
  return import(/* @vite-ignore */ spec);
}

// When running as the standalone Android APK, lock to landscape, hide the
// system bars (true immersive fullscreen — no Android status bar, no nav
// bar) and keep the screen awake. Plugins are loaded dynamically so the
// regular web build does not require them. The native MainActivity also
// enforces immersive mode at the OS level; this is the JS-side belt-and-
// braces so the bars stay hidden across resumes / orientation changes.
// Decide whether to force-lock the app to landscape. We lock when:
//   - the device's smallest dimension is >= 600 logical px (tablet
//     class — Samsung Galaxy Tab S/A/Active, generic 7"+ tablets,
//     in-dash head units), OR
//   - the user has explicitly opted in via Settings → Display.
// On a phone with the toggle off, we leave orientation alone so the
// app rotates naturally with the device. The user-facing toggle is
// persisted in localStorage under FORCE_LANDSCAPE_KEY.
const FORCE_LANDSCAPE_KEY = 'kpro-force-landscape';

function shouldLockLandscape(): boolean {
  try {
    const explicit = localStorage.getItem(FORCE_LANDSCAPE_KEY);
    if (explicit === 'true') return true;
    if (explicit === 'false') return false;
  } catch { /* ignore */ }
  // Auto: tablets get landscape, phones get free rotation.
  if (typeof window === 'undefined') return false;
  const w = window.innerWidth || screen.width || 0;
  const h = window.innerHeight || screen.height || 0;
  const minSide = Math.min(w, h);
  return minSide >= 600;
}

async function applyOrientationPreference() {
  try {
    const { ScreenOrientation } = await dynImport('@capacitor/screen-orientation');
    if (shouldLockLandscape()) {
      await ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => { /* ignore */ });
    } else {
      await ScreenOrientation.unlock?.().catch(() => { /* ignore */ });
    }
  } catch { /* plugin not installed yet */ }
}

async function initStandaloneShell() {
  if (!isStandaloneApp()) return;

  await applyOrientationPreference();

  // Re-apply when the user flips the Settings toggle (storage event
  // fires on the same tab via our custom dispatch in app-settings.tsx).
  if (typeof window !== 'undefined') {
    window.addEventListener('kpro-force-landscape-changed', () => {
      applyOrientationPreference();
    });
  }

  const hideStatusBar = async () => {
    try {
      const { StatusBar } = await dynImport('@capacitor/status-bar');
      await StatusBar.hide().catch(() => { /* ignore */ });
      await StatusBar.setOverlaysWebView?.({ overlay: true }).catch(() => { /* ignore */ });
    } catch { /* plugin not installed yet */ }
  };
  await hideStatusBar();

  // Hide the Android software navigation bar. Tries the official-style
  // edge-to-edge plugin first, then a generic NavigationBar plugin if a
  // contributor wired one up. Either is optional — the MainActivity
  // override already hides it via WindowInsetsControllerCompat.
  const hideNavBar = async () => {
    for (const spec of [
      '@capawesome/capacitor-android-edge-to-edge-support',
      '@hugotomazi/capacitor-navigation-bar',
    ]) {
      try {
        const mod = await dynImport(spec);
        const api = mod.EdgeToEdge || mod.NavigationBar;
        if (api?.hide) {
          await api.hide().catch(() => { /* ignore */ });
          return;
        }
      } catch { /* plugin not installed */ }
    }
  };
  await hideNavBar();

  // Re-hide system bars whenever the app comes back to the foreground or
  // the user swipes them in temporarily.
  try {
    const { App } = await dynImport('@capacitor/app');
    App.addListener?.('appStateChange', (state: { isActive: boolean }) => {
      if (state?.isActive) {
        hideStatusBar();
        hideNavBar();
      }
    });
  } catch { /* plugin not installed */ }

  try {
    const { KeepAwake } = await dynImport('@capacitor-community/keep-awake');
    await KeepAwake.keepAwake().catch(() => { /* ignore */ });
  } catch { /* plugin not installed yet */ }

  // Hide the splash screen once React has had a tick to mount the gauges.
  try {
    const { SplashScreen } = await dynImport('@capacitor/splash-screen');
    setTimeout(() => SplashScreen.hide?.().catch(() => { /* ignore */ }), 800);
  } catch { /* plugin not installed yet */ }
}

initStandaloneShell();

createRoot(document.getElementById("root")!).render(<App />);
