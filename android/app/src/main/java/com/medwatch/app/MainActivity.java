package com.medwatch.app;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureShowWhenLocked();
    }

    @Override
    protected void onResume() {
        super.onResume();
        configureShowWhenLocked();
    }

    @SuppressWarnings("deprecation")
    private void configureShowWhenLocked() {
        if (Build.VERSION.SDK_INT >= 27) {
            try {
                getClass().getMethod("setShowWhenLocked", boolean.class).invoke(this, true);
                getClass().getMethod("setTurnScreenOn", boolean.class).invoke(this, true);
            } catch (Exception ignored) {
            }
        }
        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        );
    }
}
