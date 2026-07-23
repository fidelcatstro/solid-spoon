// =====================================================================
// S2000 Gauges — MainActivity override
// =====================================================================
// Drop-in replacement for the default Capacitor MainActivity. Adds true
// immersive fullscreen (no Android status bar, no nav bar) using
// WindowInsetsControllerCompat so the gauges fill the whole screen on
// every Android version from API 23 up. The bars stay hidden after the
// user swipes from an edge (BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE).
//
// Copied into android/app/src/main/java/com/s2000/kprogauges/ by
// scripts/build-android.sh after `npx cap add android`.
// =====================================================================
package com.s2000.kprogauges;

import android.os.Bundle;
import android.view.WindowManager;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Keep the screen on while the gauges are visible.
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    enableImmersiveMode();
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) enableImmersiveMode();
  }

  private void enableImmersiveMode() {
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    WindowInsetsControllerCompat controller =
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    if (controller != null) {
      controller.hide(WindowInsetsCompat.Type.systemBars());
      controller.setSystemBarsBehavior(
          WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
  }
}
