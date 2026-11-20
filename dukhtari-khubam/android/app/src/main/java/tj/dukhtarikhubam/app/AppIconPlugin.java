package tj.dukhtarikhubam.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Calendar;

/**
 * The launcher icon follows the time of day: the glass flower by day (06:00–17:59), the crescent moon
 * in the evening and at night. Two activity aliases in AndroidManifest.xml (IconDefault, IconMoon).
 * The switch happens by itself at 06:00 and 18:00 (an alarm, also after the phone restarts), and when
 * the app goes to the background; never while the app is on screen (switching then could close it).
 */
@CapacitorPlugin(name = "AppIcon")
public class AppIconPlugin extends Plugin {
    private static final String DAY = "IconDefault";
    private static final String NIGHT = "IconMoon";
    private static final String ACTION = "tj.dukhtarikhubam.app.ICON_SWITCH";
    /** the app's screen is showing (set by the plugin; false whenever the process was not running) */
    static volatile boolean onScreen = false;

    /** Evening and night: 18:00–05:59. */
    static boolean night() {
        int h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        return h >= 18 || h < 6;
    }

    /** Whether an alias is on, counting the manifest's own setting (day on, night off). */
    private static boolean enabled(PackageManager pm, ComponentName c, boolean byDefault) {
        int st = pm.getComponentEnabledSetting(c);
        return st == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT ? byDefault : st == PackageManager.COMPONENT_ENABLED_STATE_ENABLED;
    }

    static void apply(Context ctx) {
        PackageManager pm = ctx.getPackageManager();
        String pkg = ctx.getPackageName();
        boolean nightNow = night();
        ComponentName day = new ComponentName(pkg, pkg + "." + DAY);
        ComponentName moon = new ComponentName(pkg, pkg + "." + NIGHT);
        ComponentName on = nightNow ? moon : day;
        ComponentName off = nightNow ? day : moon;
        if (enabled(pm, on, !nightNow) && !enabled(pm, off, nightNow)) return; // already right
        // first the new one on, then the other off, so there is always one entry in the launcher
        pm.setComponentEnabledSetting(on, PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
        pm.setComponentEnabledSetting(off, PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
    }

    /** The next 06:00 or 18:00 (a minute after, so the hour has surely turned). */
    static long nextSwitch() {
        Calendar c = Calendar.getInstance();
        int h = c.get(Calendar.HOUR_OF_DAY);
        c.set(Calendar.MINUTE, 1);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        if (h < 6) c.set(Calendar.HOUR_OF_DAY, 6);
        else if (h < 18) c.set(Calendar.HOUR_OF_DAY, 18);
        else { c.add(Calendar.DAY_OF_MONTH, 1); c.set(Calendar.HOUR_OF_DAY, 6); }
        return c.getTimeInMillis();
    }

    static void schedule(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Intent i = new Intent(ctx, Switch.class).setAction(ACTION);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent pi = PendingIntent.getBroadcast(ctx, 7301, i, flags);
        // inexact is enough (a few minutes either way); it still fires in Doze
        if (Build.VERSION.SDK_INT >= 23) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextSwitch(), pi);
        else am.set(AlarmManager.RTC_WAKEUP, nextSwitch(), pi);
    }

    /** The alarm at 06:00 / 18:00 and the phone's restart: switch now (unless the app is showing), plan the next. */
    public static class Switch extends BroadcastReceiver {
        @Override
        public void onReceive(Context ctx, Intent intent) {
            try {
                if (!onScreen) apply(ctx);
            } catch (Exception ignored) {
                // the launcher keeps the icon it has
            }
            schedule(ctx);
        }
    }

    @Override
    public void load() {
        onScreen = true;
        schedule(getContext());
    }

    @Override
    protected void handleOnStart() {
        super.handleOnStart();
        onScreen = true;
    }

    @Override
    protected void handleOnStop() {
        super.handleOnStop();
        onScreen = false;
        try {
            apply(getContext());
        } catch (Exception ignored) {
            // the launcher keeps the icon it has
        }
        schedule(getContext());
    }
}
