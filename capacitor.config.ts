import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.s2000.kprogauges',
  appName: 'S2000 Gauges',
  webDir: 'dist/public',
  backgroundColor: '#000000',
  android: {
    allowMixedContent: true,
    backgroundColor: '#000000',
  },
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    BluetoothLe: {
      displayStrings: {
        scanning: 'Scanning ELM327 adapters...',
        cancel: 'Cancel',
        availableDevices: 'Available adapters',
        noDeviceFound: 'No adapters found',
      },
    },
    // No defaultOrientation — we let the device's natural orientation
    // be the default and lock to landscape at runtime in main.tsx ONLY
    // when the screen is tablet-sized OR the user has explicitly
    // enabled "Force landscape" in Settings. This keeps the app
    // comfortable on phones (portrait by default) while preserving the
    // in-dash landscape experience on Samsung Galaxy Tab / Tab Active
    // and other 7"+ tablets.
    ScreenOrientation: {},
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#000000',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
