package tj.dukhtarikhubam.app;

import android.app.Activity;
import android.database.ContentObserver;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
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
 * On Mahliyo's chat (`shots`), a screenshot is told to the web layer too ("shot"), which offers to share
 * the whole chat; before Android 14 it is seen as a new picture in the Screenshots folder.
 */
@CapacitorPlugin(name = "ScreenGuard")
public class ScreenGuard extends Plugin {
    static volatile ScreenGuard plugin;
    /** the guard is on (a lesson is on the screen) */
    static volatile boolean on;
    /** her chat is on the screen: a screenshot is offered to be shared */
    static volatile boolean shots;
    private ContentObserver pictures;

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

    /** Screenshots of her chat told to the web layer, or not. */
    @PluginMethod
    public void watchShots(PluginCall call) {
        shots = Boolean.TRUE.equals(call.getBoolean("on", false));
        Activity a = getActivity();
        if (Build.VERSION.SDK_INT < 34) a.runOnUiThread(() -> { if (shots) observe(a); else unobserve(a); });
        call.resolve();
    }

    private void tell(String kind) {
        JSObject what = new JSObject();
        what.put("kind", kind);
        if (on) notifyListeners("capture", what);
        if (shots && "screenshot".equals(kind)) notifyListeners("shot", what);
    }

    /** Before Android 14: a new picture in a Screenshots folder (seen only with the gallery allowed). */
    private void observe(Activity a) {
        if (pictures != null) return;
        pictures = new ContentObserver(new Handler(Looper.getMainLooper())) {
            private long last;
            @Override
            public void onChange(boolean self, Uri uri) {
                long now = System.currentTimeMillis();
                if (now - last < 3000 || !newestIsScreenshot(a)) return;
                last = now;
                tell("screenshot");
            }
        };
        a.getContentResolver().registerContentObserver(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, true, pictures);
    }

    private void unobserve(Activity a) {
        if (pictures == null) return;
        a.getContentResolver().unregisterContentObserver(pictures);
        pictures = null;
    }

    private static boolean newestIsScreenshot(Activity a) {
        String[] cols = { MediaStore.Images.Media.DATA, MediaStore.Images.Media.DATE_ADDED };
        try (Cursor c = a.getContentResolver().query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cols, null, null, MediaStore.Images.Media.DATE_ADDED + " DESC")) {
            if (c == null || !c.moveToFirst()) return false;
            String path = c.getString(0);
            long added = c.getLong(1);
            return path != null && path.toLowerCase().contains("screenshot") && System.currentTimeMillis() / 1000 - added < 15;
        } catch (SecurityException e) {
            // the gallery is not allowed: nothing to see
            return false;
        }
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
