package tj.dukhtarikhubam.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationManager;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.telephony.SmsManager;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * SOS on the phone itself, without opening the app: while the guard runs (its quiet notification says so), the
 * power button pressed five times quickly sends an SOS — her place to her people on WhatsApp through the app's
 * server, and a plain SMS when there is no internet or WhatsApp could not be reached. While an alert is open her
 * place is sent every half minute; "Ман бехатарам" on its notification closes it. A walk home is watched here
 * too: when its time is over, she is asked "Расидед?", and with no answer in three minutes an SOS goes out.
 */
public class SosGuard {
    static final String PREFS = "dk_sos";
    static final int ID = 7801;
    static final int ID_ASK = 7802;
    static final String CHANNEL = "sos_guard";
    static final String CHANNEL_ALERT = "sos_alert";
    static final String ACTION_SAFE = "tj.dukhtarikhubam.app.SOS_SAFE";
    static final String ACTION_TRIGGER = "tj.dukhtarikhubam.app.SOS_TRIGGER";
    static final String ACTION_REFRESH = "tj.dukhtarikhubam.app.SOS_REFRESH";
    static final long PRESS_WINDOW_MS = 4000;
    static final int PRESSES = 5;
    static final long UPDATE_MS = 30_000;
    static final long ASK_MS = 3 * 60_000;

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static boolean granted(Context c, String perm) {
        return ContextCompat.checkSelfPermission(c, perm) == PackageManager.PERMISSION_GRANTED;
    }

    static boolean located(Context c) {
        return granted(c, Manifest.permission.ACCESS_FINE_LOCATION) || granted(c, Manifest.permission.ACCESS_COARSE_LOCATION);
    }

    /** The guard's words in her language (Tajik, Russian or English). */
    static String say(Context c, String key) {
        String lang = prefs(c).getString("lang", "tg");
        boolean ru = "ru".equals(lang), en = !ru && !"tg".equals(lang);
        switch (key) {
            case "guard_title": return ru ? "SOS включён" : en ? "SOS is on" : "SOS фаъол аст";
            case "guard_text": return ru ? "5 раз нажмите кнопку питания — родные получат ваше место" : en ? "Press the power button 5 times — your people get your place" : "5 бор тугмаи қувваро пахш кунед — наздиконатон ҷойи шуморо мегиранд";
            case "sent_title": return ru ? "SOS отправлен" : en ? "SOS sent" : "SOS фиристода шуд";
            case "sent_text": return ru ? "Ваше место отправляется родным каждые 30 секунд" : en ? "Your place goes to your people every 30 seconds" : "Ҷойи шумо ҳар 30 сония ба наздиконатон меравад";
            case "walk_title": return ru ? "Иду домой" : en ? "Walking home" : "Ба хона меравам";
            case "walk_text": return ru ? "Родные видят ваш путь. Дошли — нажмите «Я дошла»" : en ? "Your people see your way. Arrived? Tap “I arrived”" : "Наздиконатон роҳатонро мебинанд. Расидед — «Расидам»-ро пахш кунед";
            case "safe": return ru ? "Я в безопасности" : en ? "I am safe" : "Ман бехатарам";
            case "arrived": return ru ? "Я дошла" : en ? "I arrived" : "Расидам";
            case "ask_title": return ru ? "Вы дошли?" : en ? "Did you arrive?" : "Расидед?";
            case "ask_text": return ru ? "Без ответа через 3 минуты родным уйдёт SOS" : en ? "With no answer in 3 minutes an SOS goes to your people" : "Агар дар 3 дақиқа ҷавоб надиҳед, ба наздиконатон SOS меравад";
            case "sms": return ru ? "SOS! %s нужна помощь. Где она: %s" : en ? "SOS! %s needs help. Where she is: %s" : "SOS! %s ёрӣ мехоҳад. Ҷояш: %s";
            default: return key;
        }
    }

    // ---------------------------------------------------------------- the service

    public static class Service extends android.app.Service {
        static volatile boolean running = false;
        private final ArrayDeque<Long> presses = new ArrayDeque<>();
        private HandlerThread thread;
        private Handler work;
        private BroadcastReceiver screen;

        @Override public IBinder onBind(Intent intent) { return null; }

        @Override
        public int onStartCommand(Intent intent, int flags, int startId) {
            SharedPreferences p = prefs(this);
            if (!p.getBoolean("enabled", false) && p.getString("token", null) == null) { stopSelf(); return START_NOT_STICKY; }
            channels();
            try {
                Notification n = ongoing();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
                else startForeground(ID, n);
            } catch (Exception e) {
                // the place is not allowed (or not while the app is away): the guard cannot run
                stopSelf();
                return START_NOT_STICKY;
            }
            if (thread == null) {
                thread = new HandlerThread("sos-guard");
                thread.start();
                work = new Handler(thread.getLooper());
                work.post(this::tick);
            }
            if (screen == null && p.getBoolean("enabled", false)) {
                screen = new BroadcastReceiver() {
                    @Override public void onReceive(Context c, Intent i) { pressed(); }
                };
                IntentFilter f = new IntentFilter();
                f.addAction(Intent.ACTION_SCREEN_ON);
                f.addAction(Intent.ACTION_SCREEN_OFF);
                registerReceiver(screen, f);
            }
            running = true;
            String action = intent != null ? intent.getAction() : null;
            if (ACTION_SAFE.equals(action)) work.post(this::safe);
            else if (ACTION_TRIGGER.equals(action)) work.post(() -> trigger("sos"));
            return START_STICKY;
        }

        @Override
        public void onDestroy() {
            running = false;
            if (screen != null) { try { unregisterReceiver(screen); } catch (Exception ignored) {} screen = null; }
            if (thread != null) { thread.quitSafely(); thread = null; }
            super.onDestroy();
        }

        /** each press of the power button turns the screen on or off: five within four seconds is an SOS */
        private void pressed() {
            long now = System.currentTimeMillis();
            presses.addLast(now);
            while (!presses.isEmpty() && now - presses.peekFirst() > PRESS_WINDOW_MS) presses.removeFirst();
            if (presses.size() >= PRESSES) {
                presses.clear();
                buzz(new long[] { 0, 400, 150, 400, 150, 400 });
                work.post(() -> trigger("sos"));
            }
        }

        /** every half minute: her place for an open alert; the walk's time looked at */
        private void tick() {
            try {
                SharedPreferences p = prefs(this);
                long now = System.currentTimeMillis();
                String token = p.getString("token", null);
                if (token != null && p.getLong("until", 0) < now) { clearAlert(this); token = null; }
                if (token != null) {
                    Location at = here();
                    if (at != null) {
                        JSONObject b = base(p).put("token", token).put("lat", at.getLatitude()).put("lng", at.getLongitude())
                            .put("accuracy", (double) at.getAccuracy());
                        int battery = battery();
                        if (battery >= 0) b.put("battery", battery);
                        JSONObject r = post(p.getString("api", ""), "/sos/update", b);
                        if (r != null && !r.optBoolean("open", true)) clearAlert(this);
                    }
                }
                long due = p.getLong("walkDue", 0);
                if (due > 0 && now > due) {
                    long asked = p.getLong("askedAt", 0);
                    if (asked == 0) { p.edit().putLong("askedAt", now).apply(); ask(); }
                    else if (now - asked > ASK_MS) { p.edit().putLong("walkDue", 0).putLong("askedAt", 0).apply(); trigger("late"); }
                }
                notifyOngoing();
                if (!p.getBoolean("enabled", false) && p.getString("token", null) == null && p.getLong("walkDue", 0) == 0) { stopSelf(); return; }
            } catch (Exception ignored) {
                // tried again in half a minute
            }
            if (work != null) work.postDelayed(this::tick, UPDATE_MS);
        }

        /** an SOS (or a walk run over its time): to the server; without it, an SMS to her people */
        private void trigger(String kind) {
            SharedPreferences p = prefs(this);
            Location at = here();
            boolean sent = false;
            try {
                JSONObject b = base(p).put("kind", kind)
                    .put("lat", at != null ? at.getLatitude() : JSONObject.NULL)
                    .put("lng", at != null ? at.getLongitude() : JSONObject.NULL);
                if (at != null) b.put("accuracy", (double) at.getAccuracy());
                JSONObject r = post(p.getString("api", ""), "/sos/start", b);
                if (r != null && r.has("token")) {
                    p.edit().putString("token", r.getString("token")).putString("kind", "sos").putString("link", r.optString("link"))
                        .putLong("until", System.currentTimeMillis() + 6 * 3600_000L).putLong("walkDue", 0).putLong("askedAt", 0).apply();
                    sent = r.optInt("sent", 0) > 0;
                }
            } catch (Exception ignored) {}
            if (!sent) sms(at);
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.cancel(ID_ASK);
            notifyOngoing();
            if (SosPlugin.instance != null) SosPlugin.instance.changed();
        }

        /** "I am safe" / "I arrived" from the notification */
        private void safe() {
            SharedPreferences p = prefs(this);
            String token = p.getString("token", null);
            if (token != null) {
                try { post(p.getString("api", ""), "/sos/stop", base(p).put("token", token)); } catch (Exception ignored) {}
            }
            clearAlert(this);
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.cancel(ID_ASK);
            notifyOngoing();
            if (SosPlugin.instance != null) SosPlugin.instance.changed();
        }

        private void sms(Location at) {
            if (!granted(this, Manifest.permission.SEND_SMS)) return;
            SharedPreferences p = prefs(this);
            String where = at != null ? "https://maps.google.com/?q=" + at.getLatitude() + "," + at.getLongitude() : p.getString("link", "—");
            String text = String.format(say(this, "sms"), p.getString("name", ""), where);
            try {
                JSONArray people = new JSONArray(p.getString("guardians", "[]"));
                SmsManager sm = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? getSystemService(SmsManager.class) : SmsManager.getDefault();
                ArrayList<String> parts = sm.divideMessage(text);
                for (int i = 0; i < people.length(); i++) {
                    String phone = "+" + people.getJSONObject(i).optString("phone");
                    sm.sendMultipartTextMessage(phone, null, parts, null, null);
                }
            } catch (Exception ignored) {}
        }

        /** her place now (a fresh fix for up to 12 seconds, else the newest one the phone knows) */
        private Location here() {
            if (!located(this)) return null;
            LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            if (lm == null) return null;
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    String provider = lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ? LocationManager.GPS_PROVIDER
                        : lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) ? LocationManager.NETWORK_PROVIDER : null;
                    if (provider != null) {
                        final Location[] got = { null };
                        CountDownLatch done = new CountDownLatch(1);
                        lm.getCurrentLocation(provider, null, ContextCompat.getMainExecutor(this), (l) -> { got[0] = l; done.countDown(); });
                        done.await(12, TimeUnit.SECONDS);
                        if (got[0] != null) return got[0];
                    }
                }
                Location best = null;
                for (String provider : lm.getProviders(true)) {
                    Location l = lm.getLastKnownLocation(provider);
                    if (l != null && (best == null || l.getTime() > best.getTime())) best = l;
                }
                return best;
            } catch (SecurityException | InterruptedException e) {
                return null;
            }
        }

        private int battery() {
            BatteryManager bm = (BatteryManager) getSystemService(Context.BATTERY_SERVICE);
            return bm != null ? bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) : -1;
        }

        private void buzz(long[] pattern) {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) v.vibrate(VibrationEffect.createWaveform(pattern, -1));
            else v.vibrate(pattern, -1);
        }

        private void ask() {
            buzz(new long[] { 0, 600, 300, 600 });
            Notification n = new NotificationCompat.Builder(this, CHANNEL_ALERT)
                .setSmallIcon(R.drawable.ic_stat_notify).setColor(0xFFE5484D)
                .setContentTitle(say(this, "ask_title")).setContentText(say(this, "ask_text"))
                .setPriority(NotificationCompat.PRIORITY_MAX).setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC).setAutoCancel(true)
                .addAction(0, say(this, "arrived"), action(ACTION_SAFE, 2))
                .setContentIntent(open())
                .build();
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(ID_ASK, n);
        }

        private Notification ongoing() {
            SharedPreferences p = prefs(this);
            boolean open = p.getString("token", null) != null || p.getLong("walkDue", 0) > 0;
            boolean walk = open && "walk".equals(p.getString("kind", "sos"));
            NotificationCompat.Builder b = new NotificationCompat.Builder(this, open ? CHANNEL_ALERT : CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_notify).setColor(open ? 0xFFE5484D : 0xFF7A4FD8)
                .setContentTitle(say(this, walk ? "walk_title" : open ? "sent_title" : "guard_title"))
                .setContentText(say(this, walk ? "walk_text" : open ? "sent_text" : "guard_text"))
                .setOngoing(true).setOnlyAlertOnce(true)
                .setPriority(open ? NotificationCompat.PRIORITY_HIGH : NotificationCompat.PRIORITY_MIN)
                .setContentIntent(open());
            if (open) b.addAction(0, say(this, walk ? "arrived" : "safe"), action(ACTION_SAFE, 1));
            return b.build();
        }

        private void notifyOngoing() {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(ID, ongoing());
        }

        private PendingIntent open() {
            Intent i = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(getString(R.string.custom_url_scheme) + "://open/sos"), this, MainActivity.class);
            return PendingIntent.getActivity(this, 3, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        }

        private PendingIntent action(String what, int code) {
            Intent i = new Intent(this, Service.class).setAction(what);
            return PendingIntent.getService(this, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        }

        private void channels() {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || nm == null) return;
            if (nm.getNotificationChannel(CHANNEL) == null) {
                NotificationChannel ch = new NotificationChannel(CHANNEL, "SOS — посбон", NotificationManager.IMPORTANCE_MIN);
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
            }
            if (nm.getNotificationChannel(CHANNEL_ALERT) == null) {
                NotificationChannel ch = new NotificationChannel(CHANNEL_ALERT, "SOS — огоҳӣ", NotificationManager.IMPORTANCE_HIGH);
                ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                nm.createNotificationChannel(ch);
            }
        }
    }

    static JSONObject base(SharedPreferences p) throws Exception {
        return new JSONObject().put("code", p.getString("code", "")).put("lang", p.getString("lang", "tg"));
    }

    static void clearAlert(Context c) {
        prefs(c).edit().remove("token").remove("kind").remove("link").remove("until").putLong("walkDue", 0).putLong("askedAt", 0).apply();
    }

    /** POST to the app's API (…/api/v1 + path); the answer, or null when it could not be reached */
    static JSONObject post(String api, String path, JSONObject body) {
        if (api == null || api.isEmpty()) return null;
        HttpURLConnection con = null;
        try {
            con = (HttpURLConnection) new URL(api + path).openConnection();
            con.setRequestMethod("POST");
            con.setConnectTimeout(10_000);
            con.setReadTimeout(15_000);
            con.setDoOutput(true);
            con.setRequestProperty("content-type", "application/json");
            try (OutputStream o = con.getOutputStream()) { o.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
            int status = con.getResponseCode();
            if (status < 200 || status >= 300) return null;
            try (InputStream in = con.getInputStream()) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[4096];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                return new JSONObject(out.toString("UTF-8"));
            }
        } catch (Exception e) {
            return null;
        } finally {
            if (con != null) con.disconnect();
        }
    }

    static void start(Context c, String action) {
        Intent i = new Intent(c, Service.class);
        if (action != null) i.setAction(action);
        try { ContextCompat.startForegroundService(c, i); } catch (Exception ignored) {}
    }

    /** back after a restart of the phone, when the guard was on */
    public static class Boot extends BroadcastReceiver {
        @Override
        public void onReceive(Context c, Intent i) {
            if (Intent.ACTION_BOOT_COMPLETED.equals(i.getAction()) && prefs(c).getBoolean("enabled", false) && located(c)) start(c, null);
        }
    }

    // ---------------------------------------------------------------- the plugin

    @CapacitorPlugin(name = "SosGuard", permissions = {
        @Permission(alias = "sms", strings = { Manifest.permission.SEND_SMS })
    })
    public static class SosPlugin extends Plugin {
        static SosPlugin instance;

        @Override public void load() { instance = this; }

        void changed() { notifyListeners("change", state(getContext())); }

        static JSObject state(Context c) {
            SharedPreferences p = prefs(c);
            JSObject r = new JSObject();
            r.put("enabled", p.getBoolean("enabled", false));
            r.put("running", Service.running);
            r.put("sms", granted(c, Manifest.permission.SEND_SMS));
            r.put("place", located(c));
            r.put("token", p.getString("token", null));
            r.put("kind", p.getString("kind", null));
            r.put("link", p.getString("link", null));
            long due = p.getLong("walkDue", 0);
            if (due > 0) r.put("walkDue", due);
            return r;
        }

        @PluginMethod public void state(PluginCall call) { call.resolve(state(getContext())); }

        /** what the guard needs to send an SOS by itself: { code, api, lang, name, guardians: [{ name, phone }] } */
        @PluginMethod
        public void configure(PluginCall call) {
            SharedPreferences.Editor e = prefs(getContext()).edit()
                .putString("code", call.getString("code", ""))
                .putString("api", call.getString("api", ""))
                .putString("lang", call.getString("lang", "tg"))
                .putString("name", call.getString("name", ""));
            if (call.getArray("guardians") != null) e.putString("guardians", call.getArray("guardians").toString());
            e.apply();
            call.resolve(state(getContext()));
        }

        /** the power-button guard on or off (her place must be allowed first) */
        @PluginMethod
        public void enable(PluginCall call) {
            boolean on = Boolean.TRUE.equals(call.getBoolean("on", true));
            Context c = getContext();
            if (on && !located(c)) { call.reject("place"); return; }
            prefs(c).edit().putBoolean("enabled", on).apply();
            if (on) start(c, null);
            else if (prefs(c).getString("token", null) == null) c.stopService(new Intent(c, Service.class));
            call.resolve(state(c));
        }

        /** an alert the app opened: { token, kind: 'sos' | 'walk', link, dueAt (ms) } — kept going in the background */
        @PluginMethod
        public void alert(PluginCall call) {
            Context c = getContext();
            String kind = call.getString("kind", "sos");
            long due = call.getLong("dueAt", 0L);
            prefs(c).edit().putString("token", call.getString("token")).putString("kind", kind).putString("link", call.getString("link", ""))
                .putLong("until", System.currentTimeMillis() + ("walk".equals(kind) ? 4 : 6) * 3600_000L)
                .putLong("walkDue", "walk".equals(kind) ? due : 0).putLong("askedAt", 0).apply();
            if (located(c)) start(c, ACTION_REFRESH);
            call.resolve(state(c));
        }

        /** the alert closed in the app ("safe" was sent by the app itself) */
        @PluginMethod
        public void clear(PluginCall call) {
            Context c = getContext();
            clearAlert(c);
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.cancel(ID_ASK);
            if (prefs(c).getBoolean("enabled", false)) start(c, ACTION_REFRESH);
            else c.stopService(new Intent(c, Service.class));
            call.resolve(state(c));
        }

        @PluginMethod
        public void askSms(PluginCall call) {
            if (getPermissionState("sms") == PermissionState.GRANTED) { call.resolve(state(getContext())); return; }
            requestPermissionForAlias("sms", call, "smsAnswered");
        }

        @PermissionCallback
        private void smsAnswered(PluginCall call) { call.resolve(state(getContext())); }
    }
}
