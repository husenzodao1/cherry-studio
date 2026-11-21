package tj.dukhtarikhubam.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;
import androidx.core.graphics.drawable.IconCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Iterator;

/**
 * Mahliyo phones the learner at a reminder's time — also when the app is closed and the phone is asleep
 * or locked. An alarm clock (exact, it wakes the phone) fires; an incoming-call notification in Android's
 * own call style — her face and name, "Answer", "Decline" — rings with her ringtone again and again over
 * the lock screen (full screen where the phone allows it). "Answer" opens the app, which plays her words
 * (web/components/MahliyoCall.tsx); "Decline" ends it; not taken in 30 seconds, it stops. The planned calls
 * come back after the phone restarts. The web layer plans and takes back calls, and learns which rang.
 */
public final class MahliyoCall {
    static final String PREFS = "dk_calls";
    private static final String CHANNEL = "mahliyo_call_v1";
    static final int NOTIFICATION_ID = 7401;
    /** on the intent that opens the app from her call: the call (JSON), and whether it was answered */
    static final String EXTRA = "tj.dukhtarikhubam.app.MAHLIYO_CALL_INFO";
    static final String ANSWERED = "tj.dukhtarikhubam.app.MAHLIYO_CALL_ANSWERED";
    private static final String ACTION_RING = "tj.dukhtarikhubam.app.MAHLIYO_CALL";
    private static final String ACTION_DECLINE = "tj.dukhtarikhubam.app.MAHLIYO_DECLINE";
    private static final long RING_MS = 30_000;
    private static final long[] BUZZ = { 0, 500, 250, 500, 1200 };

    /** the call the app was opened by, until the web layer takes it */
    static volatile JSObject opened;
    static volatile CallPlugin plugin;

    private MahliyoCall() {}

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** the planned calls by id: { at, title, text } */
    static JSONObject planned(Context c) {
        try {
            return new JSONObject(prefs(c).getString("calls", "{}"));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    static void keep(Context c, JSONObject calls) {
        prefs(c).edit().putString("calls", calls.toString()).apply();
    }

    /** ids that rang here (answered, declined or missed): the web layer does not ring them again */
    static void rang(Context c, int id) {
        try {
            JSONArray a = new JSONArray(prefs(c).getString("rang", "[]"));
            a.put(id);
            prefs(c).edit().putString("rang", a.toString()).apply();
        } catch (Exception ignored) {
            // nothing kept
        }
    }

    static PendingIntent alarm(Context ctx, int id) {
        Intent i = new Intent(ctx, Receiver.class).setAction(ACTION_RING).putExtra("id", id);
        return PendingIntent.getBroadcast(ctx, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void schedule(Context ctx, int id, long at) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null || at <= System.currentTimeMillis()) return;
        PendingIntent fire = alarm(ctx, id);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                // no exact alarms allowed: as close as the phone lets us
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fire);
                return;
            }
            Intent show = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent info = PendingIntent.getActivity(ctx, id, show, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, info), fire);
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fire);
        }
    }

    /** After a restart: the calls still ahead are planned again; the past ones are forgotten. */
    static void restore(Context ctx) {
        JSONObject calls = planned(ctx);
        long now = System.currentTimeMillis();
        Iterator<String> ids = calls.keys();
        JSONObject keepIt = new JSONObject();
        while (ids.hasNext()) {
            String id = ids.next();
            JSONObject c = calls.optJSONObject(id);
            if (c == null || c.optLong("at") <= now) continue;
            try { keepIt.put(id, c); } catch (Exception ignored) { /* skipped */ }
            schedule(ctx, Integer.parseInt(id), c.optLong("at"));
        }
        keep(ctx, keepIt);
    }

    static Uri ringtone(Context ctx) {
        return Uri.parse("android.resource://" + ctx.getPackageName() + "/" + R.raw.mahliyo_ring);
    }

    /** Her call rings now. */
    static void ring(Context ctx, int id) {
        JSONObject calls = planned(ctx);
        JSONObject c = calls.optJSONObject(String.valueOf(id));
        if (c == null) return;
        calls.remove(String.valueOf(id));
        keep(ctx, calls);
        rang(ctx, id);

        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Зангҳои Маҳлиё", NotificationManager.IMPORTANCE_HIGH);
            ch.setSound(ringtone(ctx), new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
            ch.enableVibration(true);
            ch.setVibrationPattern(BUZZ);
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(ch);
        }

        JSObject info = new JSObject();
        info.put("id", id);
        info.put("title", c.optString("title"));
        info.put("text", c.optString("text"));
        Intent open = new Intent(ctx, MainActivity.class)
            .putExtra(EXTRA, info.toString())
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent screen = PendingIntent.getActivity(ctx, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent take = new Intent(open).putExtra(ANSWERED, true);
        PendingIntent answer = PendingIntent.getActivity(ctx, id + 1, take, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent no = new Intent(ctx, Receiver.class).setAction(ACTION_DECLINE).putExtra("id", id);
        PendingIntent decline = PendingIntent.getBroadcast(ctx, id + 2, no, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Person caller = new Person.Builder()
            .setName("Маҳлиё AI")
            .setIcon(IconCompat.createWithResource(ctx, R.drawable.mahliyo_face))
            .setImportant(true)
            .build();
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_notify)
            .setColor(0xFF7A4FD8)
            .setContentTitle("Маҳлиё AI")
            .setContentText(c.optString("title"))
            .setStyle(NotificationCompat.CallStyle.forIncomingCall(caller, decline, answer))
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setFullScreenIntent(screen, true)
            .setContentIntent(screen)
            .setOngoing(true)
            .setAutoCancel(true)
            .setTimeoutAfter(RING_MS)
            .setSound(ringtone(ctx), AudioManager.STREAM_RING)
            .setVibrate(BUZZ);
        Notification n = b.build();
        // the ringtone goes on until she answers, declines, or the call times out
        n.flags |= Notification.FLAG_INSISTENT;
        try {
            NotificationManagerCompat.from(ctx).notify(NOTIFICATION_ID, n);
        } catch (SecurityException ignored) {
            // notifications are not allowed on this phone
        }
    }

    static void silence(Context ctx) {
        NotificationManagerCompat.from(ctx).cancel(NOTIFICATION_ID);
    }

    /** The app was opened from her call (MainActivity): kept for the web layer, which plays it. */
    static void openedBy(Context ctx, Intent intent) {
        if (intent == null || !intent.hasExtra(EXTRA)) return;
        try {
            JSObject info = new JSObject(intent.getStringExtra(EXTRA));
            JSObject call = new JSObject();
            call.put("call", info);
            call.put("answered", intent.getBooleanExtra(ANSWERED, false));
            opened = call;
            silence(ctx);
            intent.removeExtra(EXTRA);
            CallPlugin p = plugin;
            if (p != null) p.tell(call);
        } catch (Exception ignored) {
            // not a call
        }
    }

    /** The alarm (her call rings), "Decline", and a restart of the phone (the calls are planned again). */
    public static class Receiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context ctx, Intent intent) {
            String action = intent.getAction();
            if (ACTION_RING.equals(action)) ring(ctx, intent.getIntExtra("id", 0));
            else if (ACTION_DECLINE.equals(action)) silence(ctx);
            else if (Intent.ACTION_BOOT_COMPLETED.equals(action)) restore(ctx);
        }
    }

    @CapacitorPlugin(name = "MahliyoCall")
    public static class CallPlugin extends Plugin {
        @Override
        public void load() {
            plugin = this;
        }

        void tell(JSObject call) {
            notifyListeners("opened", call);
        }

        /** A call at `at` (ms) with her reminder's words. */
        @PluginMethod
        public void plan(PluginCall call) {
            Context ctx = getContext();
            Integer id = call.getInt("id");
            Long at = call.getLong("at");
            if (id == null || at == null) {
                call.reject("id and at are needed");
                return;
            }
            JSONObject calls = planned(ctx);
            try {
                calls.put(String.valueOf(id), new JSONObject().put("at", at).put("title", call.getString("title", "")).put("text", call.getString("text", "")));
            } catch (Exception e) {
                call.reject("not kept");
                return;
            }
            keep(ctx, calls);
            schedule(ctx, id, at);
            call.resolve();
        }

        @PluginMethod
        public void cancel(PluginCall call) {
            Context ctx = getContext();
            Integer id = call.getInt("id");
            if (id != null) {
                JSONObject calls = planned(ctx);
                calls.remove(String.valueOf(id));
                keep(ctx, calls);
                AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
                if (am != null) am.cancel(alarm(ctx, id));
            }
            call.resolve();
        }

        /** The call the app was opened by (once), and the calls that rang here (once). */
        @PluginMethod
        public void taken(PluginCall call) {
            Context ctx = getContext();
            JSObject out = new JSObject();
            JSObject o = opened;
            opened = null;
            if (o != null) out.put("opened", o);
            try {
                out.put("rang", new JSArray(prefs(ctx).getString("rang", "[]")));
            } catch (Exception e) {
                out.put("rang", new JSArray());
            }
            prefs(ctx).edit().putString("rang", "[]").apply();
            call.resolve(out);
        }

        /** The app's own call screen took over: the notification stops ringing. */
        @PluginMethod
        public void stop(PluginCall call) {
            silence(getContext());
            call.resolve();
        }

        /** The call is over: the app no longer shows over the lock screen. */
        @PluginMethod
        public void done(PluginCall call) {
            if (getActivity() instanceof MainActivity) {
                MainActivity a = (MainActivity) getActivity();
                a.runOnUiThread(() -> a.overLock(false));
            }
            call.resolve();
        }
    }
}
