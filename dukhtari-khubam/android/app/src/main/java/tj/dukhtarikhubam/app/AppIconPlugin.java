package tj.dukhtarikhubam.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Calendar;

/**
 * The launcher icon follows the time of day: the glass flower by day, the crescent moon in the evening
 * and at night. Two activity aliases in AndroidManifest.xml (IconDefault, IconMoon); the switch is made
 * only when the app goes to the background, never while it is on screen.
 */
@CapacitorPlugin(name = "AppIcon")
public class AppIconPlugin extends Plugin {
    private static final String DAY = "IconDefault";
    private static final String NIGHT = "IconMoon";

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

    @Override
    protected void handleOnStop() {
        super.handleOnStop();
        try {
            apply(getContext());
        } catch (Exception ignored) {
            // the launcher keeps the icon it has
        }
    }
}
