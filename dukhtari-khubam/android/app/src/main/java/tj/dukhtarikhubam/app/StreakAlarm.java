package tj.dukhtarikhubam.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;
import android.widget.RemoteViews;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/**
 * "Last chance" for the day streak: a few times each evening (18:00, 21:00, 23:00 by default), when the
 * streak is alive (studied yesterday) but today is still empty, a notification — each one a step
 * stronger — shows the words and a red clock counting down to midnight; it disappears by itself when the
 * day — and the streak — is over. The web layer keeps the
 * last study day, the streak and the texts (edited in the panel) here; the alarm survives a restart.
 */
public final class StreakAlarm {
    static final String PREFS = "dk_streak";
    private static final String CHANNEL = "streak";
    private static final int NOTIFICATION_ID = 7301;
    private static final int REQUEST = 7302;

    private StreakAlarm() {}

    static String day(Calendar c) {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(c.getTime());
    }

    /** The reminder times of a day, in minutes after midnight (e.g. 18:00, 21:00, 23:00). */
    static int[] times(SharedPreferences p) {
        try {
            JSONArray a = new JSONArray(p.getString("times", "[1080,1260,1380]"));
            int[] out = new int[a.length()];
            for (int i = 0; i < a.length(); i++) out[i] = a.getInt(i);
            java.util.Arrays.sort(out);
            return out.length == 0 ? new int[] { 1080 } : out;
        } catch (Exception e) {
            return new int[] { 1080, 1260, 1380 };
        }
    }

    /** The next reminder moment (later today, otherwise the first one tomorrow). */
    static long next(int[] times) {
        Calendar now = Calendar.getInstance();
        for (int t : times) {
            Calendar c = Calendar.getInstance();
            c.set(Calendar.HOUR_OF_DAY, t / 60);
            c.set(Calendar.MINUTE, t % 60);
            c.set(Calendar.SECOND, 0);
            c.set(Calendar.MILLISECOND, 0);
            if (c.getTimeInMillis() > now.getTimeInMillis() + 1000) return c.getTimeInMillis();
        }
        Calendar c = Calendar.getInstance();
        c.add(Calendar.DAY_OF_MONTH, 1);
        c.set(Calendar.HOUR_OF_DAY, times[0] / 60);
        c.set(Calendar.MINUTE, times[0] % 60);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    /** Which reminder of the day this is (0 = the first, gentlest; the last is the "last chance"). */
    static int stage(int[] times) {
        Calendar now = Calendar.getInstance();
        int m = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        int stage = 0;
        for (int i = 0; i < times.length; i++) if (m >= times[i] - 2) stage = i;
        return stage;
    }

    static PendingIntent alarmIntent(Context ctx) {
        Intent i = new Intent(ctx, Receiver.class).setAction("tj.dukhtarikhubam.app.STREAK");
        return PendingIntent.getBroadcast(ctx, REQUEST, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void schedule(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        am.cancel(alarmIntent(ctx));
        if (!p.getBoolean("on", false)) return;
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next(times(p)), alarmIntent(ctx));
    }

    private static String pick(String json, int salt) {
        try {
            JSONArray a = new JSONArray(json);
            return a.length() == 0 ? "" : a.optString(Math.abs(salt) % a.length(), "");
        } catch (Exception e) {
            return "";
        }
    }

    static void fire(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        Calendar now = Calendar.getInstance();
        Calendar yesterday = Calendar.getInstance();
        yesterday.add(Calendar.DAY_OF_MONTH, -1);
        String last = p.getString("lastDay", "");
        int streak = p.getInt("streak", 0);
        // alive but not yet kept today: studied yesterday, nothing today
        if (!p.getBoolean("on", false) || streak < 1 || !last.equals(day(yesterday))) return;

        Calendar midnight = Calendar.getInstance();
        midnight.add(Calendar.DAY_OF_MONTH, 1);
        midnight.set(Calendar.HOUR_OF_DAY, 0);
        midnight.set(Calendar.MINUTE, 0);
        midnight.set(Calendar.SECOND, 0);
        midnight.set(Calendar.MILLISECOND, 0);
        long left = midnight.getTimeInMillis() - now.getTimeInMillis();
        if (left < 60_000) return;

        // each reminder of the evening is a step stronger: the lines are kept in that order in the panel
        int salt = stage(times(p));
        String name = p.getString("name", "");
        String title = pick(p.getString("titles", "[]"), salt).replace("{streak}", String.valueOf(streak)).replace("{name}", name);
        String body = pick(p.getString("bodies", "[]"), salt).replace("{streak}", String.valueOf(streak)).replace("{name}", name);
        if (title.isEmpty()) title = "🔥 " + streak;
        String leftLabel = p.getString("leftLabel", "⏳");

        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, p.getString("channel", "Рӯзҳои пай дар пай"), NotificationManager.IMPORTANCE_HIGH);
            nm.createNotificationChannel(ch);
        }
        RemoteViews view = new RemoteViews(ctx.getPackageName(), R.layout.notif_streak);
        view.setTextViewText(R.id.n_title, title);
        view.setTextViewText(R.id.n_body, body);
        view.setTextViewText(R.id.n_left, leftLabel);
        view.setChronometer(R.id.n_clock, SystemClock.elapsedRealtime() + left, null, true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) view.setChronometerCountDown(R.id.n_clock, true);

        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse(ctx.getPackageName() + "://open/"), ctx, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap = PendingIntent.getActivity(ctx, REQUEST + 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_notify)
            .setColor(0xFFD9344F)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
            .setCustomContentView(view)
            .setCustomBigContentView(view)
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setWhen(midnight.getTimeInMillis())
            .setShowWhen(true)
            .setTimeoutAfter(left)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(tap);
        try {
            NotificationManagerCompat.from(ctx).notify(NOTIFICATION_ID, b.build());
        } catch (SecurityException ignored) {
            // notifications are not allowed on this phone
        }
    }

    static void cancelShown(Context ctx) {
        NotificationManagerCompat.from(ctx).cancel(NOTIFICATION_ID);
    }

    /** Alarm and phone restart: show (if due) and plan the next day. */
    public static class Receiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context ctx, Intent intent) {
            if ("tj.dukhtarikhubam.app.STREAK".equals(intent.getAction())) fire(ctx);
            schedule(ctx);
        }
    }

    @CapacitorPlugin(name = "StreakAlarm")
    public static class StreakPlugin extends Plugin {
        @PluginMethod
        public void configure(PluginCall call) {
            Context ctx = getContext();
            String lastDay = call.getString("lastDay", "");
            SharedPreferences.Editor e = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putBoolean("on", Boolean.TRUE.equals(call.getBoolean("on", false)))
                .putString("times", call.getArray("times", new JSArray()).toString())
                .putString("lastDay", lastDay)
                .putInt("streak", call.getInt("streak", 0))
                .putString("name", call.getString("name", ""))
                .putString("leftLabel", call.getString("leftLabel", "⏳"))
                .putString("channel", call.getString("channel", "Рӯзҳои пай дар пай"))
                .putString("titles", call.getArray("titles", new JSArray()).toString())
                .putString("bodies", call.getArray("bodies", new JSArray()).toString());
            e.apply();
            // studied today: a "last chance" already on screen is no longer true
            if (lastDay.equals(day(Calendar.getInstance()))) cancelShown(ctx);
            schedule(ctx);
            call.resolve();
        }
    }
}
