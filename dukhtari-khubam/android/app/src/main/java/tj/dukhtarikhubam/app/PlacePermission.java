package tj.dukhtarikhubam.app;

import android.Manifest;
import android.content.Context;
import android.location.LocationManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * The rough-place permission, on its own. The Geolocation plugin answers "location services are not
 * enabled" instead of the permission whenever the phone's location switch is off (as it mostly is), so the
 * app took that for "not allowed": it opened the settings, and asked again after she had allowed it there.
 * Here the permission is asked and read as Android keeps it, whatever the switch; `services` says whether
 * the switch is on (her place can be found only then).
 */
@CapacitorPlugin(
    name = "DkPlace",
    permissions = {
        @Permission(alias = "place", strings = { Manifest.permission.ACCESS_COARSE_LOCATION }),
        // "Маро бубар" follows her on the street: the precise place
        @Permission(alias = "precise", strings = { Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION })
    }
)
public class PlacePermission extends Plugin {

    /** { place: granted | denied | prompt | prompt-with-rationale, services: boolean } */
    @PluginMethod
    public void state(PluginCall call) {
        call.resolve(stateNow());
    }

    /** Android's own question (none when allowed already, or when she said "never" — then it is "denied") */
    @PluginMethod
    public void ask(PluginCall call) {
        if (getPermissionState("place") == PermissionState.GRANTED) {
            call.resolve(stateNow());
            return;
        }
        requestPermissionForAlias("place", call, "asked");
    }

    @PermissionCallback
    private void asked(PluginCall call) {
        call.resolve(stateNow());
    }

    /** the precise place, for the way on the street (asked only when she starts "Маро бубар") */
    @PluginMethod
    public void askPrecise(PluginCall call) {
        if (getPermissionState("precise") == PermissionState.GRANTED) {
            call.resolve(stateNow());
            return;
        }
        requestPermissionForAlias("precise", call, "asked");
    }

    /** the phone's own location switch, in its settings (it cannot be turned on for her) */
    @PluginMethod
    public void locationSettings(PluginCall call) {
        try {
            android.content.Intent i = new android.content.Intent(android.provider.Settings.ACTION_LOCATION_SOURCE_SETTINGS);
            i.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception e) {
            // no such screen on this phone: the app's own settings
            android.content.Intent i = new android.content.Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                android.net.Uri.fromParts("package", getContext().getPackageName(), null));
            i.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        }
        call.resolve();
    }

    private JSObject stateNow() {
        JSObject r = new JSObject();
        r.put("place", getPermissionState("place").toString());
        r.put("precise", getPermissionState("precise").toString());
        r.put("services", servicesOn());
        return r;
    }

    private boolean servicesOn() {
        LocationManager lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) return lm.isLocationEnabled();
        return lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) || lm.isProviderEnabled(LocationManager.GPS_PROVIDER);
    }
}
