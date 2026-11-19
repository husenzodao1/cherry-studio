package tj.dukhtarikhubam.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.text.TextUtils;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * The launcher icon: one of the activity aliases in AndroidManifest.xml (IconDefault, Icon_<id>) is enabled
 * at a time. With "change by itself" on, the next icon of the list is switched in each time the app goes
 * to the background (never while it is on screen).
 */
@CapacitorPlugin(name = "AppIcon")
public class AppIconPlugin extends Plugin {
    private static final String PREFS = "dk_app_icon";

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static String alias(String id) {
        return id == null || id.isEmpty() || id.equals("default") ? "IconDefault" : "Icon_" + id;
    }

    /** Enables the alias of `id` and disables every other one. */
    static void apply(Context ctx, String id, List<String> ids) {
        PackageManager pm = ctx.getPackageManager();
        String pkg = ctx.getPackageName();
        List<String> all = new ArrayList<>(ids);
        if (!all.contains("default")) all.add(0, "default");
        if (!all.contains(id)) all.add(id);
        // first the new one on, then the others off, so there is always one entry in the launcher
        pm.setComponentEnabledSetting(new ComponentName(pkg, pkg + "." + alias(id)),
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
        for (String other : all) {
            if (other.equals(id)) continue;
            pm.setComponentEnabledSetting(new ComponentName(pkg, pkg + "." + alias(other)),
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
        }
    }

    private static List<String> list(PluginCall call) {
        List<String> ids = new ArrayList<>();
        JSArray arr = call.getArray("ids", new JSArray());
        try {
            for (int i = 0; i < arr.length(); i++) ids.add(arr.getString(i));
        } catch (JSONException ignored) {
            // an unreadable list: only the chosen icon and the default are touched
        }
        return ids;
    }

    @PluginMethod
    public void setIcon(PluginCall call) {
        String id = call.getString("id", "default");
        List<String> ids = list(call);
        try {
            apply(getContext(), id, ids);
            prefs().edit().putString("current", id).putString("ids", TextUtils.join(",", ids)).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("icon_failed", e);
        }
    }

    @PluginMethod
    public void getState(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("id", prefs().getString("current", "default"));
        ret.put("rotate", prefs().getBoolean("rotate", false));
        call.resolve(ret);
    }

    @PluginMethod
    public void setRotate(PluginCall call) {
        List<String> ids = list(call);
        prefs().edit().putBoolean("rotate", Boolean.TRUE.equals(call.getBoolean("on", false))).putString("ids", TextUtils.join(",", ids)).apply();
        call.resolve();
    }

    @Override
    protected void handleOnStop() {
        super.handleOnStop();
        SharedPreferences p = prefs();
        if (!p.getBoolean("rotate", false)) return;
        String joined = p.getString("ids", "");
        if (joined.isEmpty()) return;
        List<String> ids = new ArrayList<>(Arrays.asList(joined.split(",")));
        int at = ids.indexOf(p.getString("current", "default"));
        String next = ids.get((at + 1) % ids.size());
        try {
            apply(getContext(), next, ids);
            p.edit().putString("current", next).apply();
        } catch (Exception ignored) {
            // the launcher keeps the icon it has
        }
    }
}
