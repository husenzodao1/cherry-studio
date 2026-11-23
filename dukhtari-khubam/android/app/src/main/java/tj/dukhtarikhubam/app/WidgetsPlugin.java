package tj.dukhtarikhubam.app;

import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Receives the summary the widgets show (streak, week, today's lessons, words of the day) and redraws them. */
@CapacitorPlugin(name = "Widgets")
public class WidgetsPlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        JSObject data = call.getData();
        getContext().getSharedPreferences(DkWidgets.PREFS, Context.MODE_PRIVATE).edit().putString("data", data.toString()).apply();
        DkWidgets.updateAll(getContext());
        DkWidgets.schedule(getContext());
        call.resolve();
    }
}
