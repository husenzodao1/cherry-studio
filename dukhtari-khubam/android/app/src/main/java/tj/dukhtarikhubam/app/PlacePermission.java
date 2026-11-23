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
    permissions = { @Permission(alias = "place", strings = { Manifest.permission.ACCESS_COARSE_LOCATION }) }
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

    private JSObject stateNow() {
        JSObject r = new JSObject();
        r.put("place", getPermissionState("place").toString());
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
