package tj.dukhtarikhubam.app;

import android.app.Activity;
import android.os.Build;
import android.view.WindowManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.function.Consumer;

/**
 * The lessons stay private: while a lesson, a test or the day's review is on the screen, the window is
 * secure — screenshots and screen recordings show it black, and it is hidden in the list of recent apps.
 * When the phone tells the app a screenshot was taken (Android 14+) or the screen is being recorded
 * (Android 15+), the web layer says it is forbidden. The web layer turns the guard on and off by screen.
 */
@CapacitorPlugin(name = "ScreenGuard")
public class ScreenGuard extends Plugin {
    static volatile ScreenGuard plugin;
    /** the guard is on (a lesson is on the screen) */
    static volatile boolean on;

    private Object captured;
    private Consumer<Integer> recorded;

    @Override
    public void load() {
        plugin = this;
    }

    /** The guard on or off. */
    @PluginMethod
    public void secure(PluginCall call) {
        boolean want = Boolean.TRUE.equals(call.getBoolean("on", false));
        on = want;
        Activity a = getActivity();
        a.runOnUiThread(() -> {
            if (want) a.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            else a.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
        });
        call.resolve();
    }

    private void tell(String kind) {
        if (!on) return;
        JSObject what = new JSObject();
        what.put("kind", kind);
        notifyListeners("capture", what);
    }

    /** MainActivity.onStart: the phone tells when a screenshot is taken, or the screen is recorded. */
    void watch(Activity a) {
        if (Build.VERSION.SDK_INT >= 34 && captured == null) {
            Activity.ScreenCaptureCallback cb = () -> tell("screenshot");
            try {
                a.registerScreenCaptureCallback(a.getMainExecutor(), cb);
                captured = cb;
            } catch (SecurityException ignored) {
                // not allowed on this phone: the window stays secure all the same
            }
        }
        if (Build.VERSION.SDK_INT >= 35 && recorded == null) {
            Consumer<Integer> cb = (state) -> { if (state == WindowManager.SCREEN_RECORDING_STATE_VISIBLE) tell("recording"); };
            try {
                int now = a.getWindowManager().addScreenRecordingCallback(a.getMainExecutor(), cb);
                recorded = cb;
                if (now == WindowManager.SCREEN_RECORDING_STATE_VISIBLE) tell("recording");
            } catch (SecurityException ignored) {
                // not allowed: the recording shows the lesson black all the same
            }
        }
    }

    /** MainActivity.onStop */
    void unwatch(Activity a) {
        if (Build.VERSION.SDK_INT >= 34 && captured != null) {
            a.unregisterScreenCaptureCallback((Activity.ScreenCaptureCallback) captured);
            captured = null;
        }
        if (Build.VERSION.SDK_INT >= 35 && recorded != null) {
            a.getWindowManager().removeScreenRecordingCallback(recorded);
            recorded = null;
        }
    }
}
