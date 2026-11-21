package tj.dukhtarikhubam.app;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;

import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

/**
 * The app's single screen. It registers the app's own plugins and hands Google's permission answers
 * (asked for the birthday, to fill in the age) back to the sign-in plugin. Opened by Mahliyo's call
 * (MahliyoCall.java), it shows over the lock screen and wakes it, and her voice may play at once.
 */
public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GallerySaverPlugin.class);
        registerPlugin(AppIconPlugin.class);
        registerPlugin(WidgetsPlugin.class);
        registerPlugin(StreakAlarm.StreakPlugin.class);
        registerPlugin(MahliyoCall.CallPlugin.class);
        super.onCreate(savedInstanceState);
        // her words play as soon as her call is answered (also when answered from the notification)
        if (getBridge() != null && getBridge().getWebView() != null) getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
        fromCall(getIntent());
    }

    @Override
    public void onResume() {
        super.onResume();
        MahliyoCall.foreground = true;
    }

    @Override
    public void onPause() {
        MahliyoCall.foreground = false;
        super.onPause();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        fromCall(intent);
    }

    /** Opened by her call: over the lock screen, the screen on, until the call ends (MahliyoCall.done). */
    private void fromCall(Intent intent) {
        if (intent == null || !intent.hasExtra(MahliyoCall.EXTRA)) return;
        overLock(true);
        MahliyoCall.openedBy(this, intent);
    }

    void overLock(boolean on) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(on);
            setTurnScreenOn(on);
        } else if (on) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        } else {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN || requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) return;
        PluginHandle handle = getBridge().getPlugin("SocialLogin");
        if (handle == null) return;
        Plugin plugin = handle.getInstance();
        if (plugin instanceof SocialLoginPlugin) ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
    }

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}
