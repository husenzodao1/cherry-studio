package tj.dukhtarikhubam.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;
import org.vosk.Model;
import org.vosk.Recognizer;
import org.vosk.SpeakerModel;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * "Эй Маҳлиё" (Standard and Premium): Mahliyo wakes when her owner calls her by name, even with the screen off.
 *
 * Everything that listens stays on the phone (Vosk, offline): the Tajik speech model turns what it hears into
 * words, and the speaker model turns a voice into a 128-number print. Her owner reads three phrases once
 * (the enrolment); their prints, averaged, are her voiceprint. Then a foreground service (with its notification,
 * as Android asks) listens: when the words have "маҳлиё" in them and the voice is hers, the phone wakes and the
 * app opens over the lock screen, listening for what she wants (the web layer: /voice).
 *
 * The models (about 66 MB, and 37–53 MB for each other language she chooses) are downloaded once, in the
 * background, into the app's own files.
 */
public final class HeyMahliyo {
    private HeyMahliyo() {}

    static final int RATE = 16000;
    static final String PREFS = "hey_mahliyo";
    static final String SPK_URL = "https://alphacephei.com/vosk/models/vosk-model-spk-0.4.zip";
    static final long SPK_SIZE = 13_869_103L;
    /**
     * The speech models she may choose (language, address, size): Tajik is always there (her name is heard by
     * it); the others hear her questions in their language when the phone is offline.
     */
    static final String[][] MODELS = {
        { "tg", "https://alphacephei.com/vosk/models/vosk-model-small-tg-0.22.zip", "51879043" },
        { "ru", "https://alphacephei.com/vosk/models/vosk-model-small-ru-0.22.zip", "46236750" },
        { "en", "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip", "41205931" },
        { "uz", "https://alphacephei.com/vosk/models/vosk-model-small-uz-0.22.zip", "51061189" },
        { "tr", "https://alphacephei.com/vosk/models/vosk-model-small-tr-0.3.zip", "36855784" },
        { "fa", "https://alphacephei.com/vosk/models/vosk-model-small-fa-0.42.zip", "53431220" }
    };
    static String[] modelOf(String lang) {
        for (String[] m : MODELS) if (m[0].equals(lang)) return m;
        return null;
    }
    static final String EXTRA_WAKE = "hey_mahliyo_wake";
    /** the app was opened by her name: the web layer takes it once (takeWake) */
    static volatile boolean woke = false;

    // ---------------------------------------------------------------- the models

    static File dir(Context c, String name) { return new File(new File(c.getFilesDir(), "vosk"), name); }
    static boolean has(Context c, String name) { return new File(dir(c, name), "ok").exists(); }
    static boolean ready(Context c) { return has(c, "tg") && has(c, "spk"); }
    static JSArray installed(Context c) {
        JSArray a = new JSArray();
        for (String[] m : MODELS) if (has(c, m[0])) a.put(m[0]);
        return a;
    }

    private static final java.util.Map<String, Model> models = new java.util.HashMap<>();
    private static SpeakerModel spk;
    /** the model of her language when it is there, else the Tajik one */
    static synchronized Model model(Context c, String lang) throws java.io.IOException {
        String l = lang != null && modelOf(lang) != null && has(c, lang) ? lang : "tg";
        Model m = models.get(l);
        if (m == null) { m = new Model(dir(c, l).getAbsolutePath()); models.put(l, m); }
        return m;
    }
    static Model tg(Context c) throws java.io.IOException { return model(c, "tg"); }
    static synchronized SpeakerModel spk(Context c) throws java.io.IOException {
        if (spk == null) spk = new SpeakerModel(dir(c, "spk").getAbsolutePath());
        return spk;
    }

    interface Progress { void at(String part, long done, long total); }

    /** a model downloaded and unpacked into its folder (the zip's own top folder left out), marked when whole */
    static void fetch(Context c, String url, String name, Progress p) throws Exception {
        File target = dir(c, name);
        if (new File(target, "ok").exists()) return;
        deleteAll(target);
        if (!target.mkdirs() && !target.isDirectory()) throw new IllegalStateException("no room");
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        con.setConnectTimeout(20000);
        con.setReadTimeout(60000);
        long total = con.getContentLengthLong();
        try (InputStream raw = new BufferedInputStream(con.getInputStream());
             CountingStream counted = new CountingStream(raw, (n) -> p.at(name, n, total));
             ZipInputStream zip = new ZipInputStream(counted)) {
            ZipEntry e;
            byte[] buf = new byte[64 * 1024];
            while ((e = zip.getNextEntry()) != null) {
                String path = e.getName();
                int slash = path.indexOf('/');
                String inner = slash >= 0 ? path.substring(slash + 1) : path;
                if (inner.isEmpty() || inner.contains("..")) continue;
                File out = new File(target, inner);
                if (e.isDirectory()) { out.mkdirs(); continue; }
                File parent = out.getParentFile();
                if (parent != null) parent.mkdirs();
                try (OutputStream o = new FileOutputStream(out)) {
                    int n;
                    while ((n = zip.read(buf)) > 0) o.write(buf, 0, n);
                }
            }
        } finally {
            con.disconnect();
        }
        if (!new File(target, "ok").createNewFile() && !new File(target, "ok").exists()) throw new IllegalStateException("not marked");
    }

    static void deleteAll(File f) {
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteAll(k);
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }

    /** an input stream that tells how much of it was read */
    static final class CountingStream extends java.io.FilterInputStream {
        interface Told { void read(long n); }
        private long n = 0;
        private long toldAt = 0;
        private final Told told;
        CountingStream(InputStream in, Told told) { super(in); this.told = told; }
        @Override public int read() throws java.io.IOException { int b = super.read(); if (b >= 0) add(1); return b; }
        @Override public int read(byte[] b, int off, int len) throws java.io.IOException { int r = super.read(b, off, len); if (r > 0) add(r); return r; }
        private void add(long k) { n += k; if (n - toldAt > 512 * 1024) { toldAt = n; told.read(n); } }
    }

    // ---------------------------------------------------------------- her voiceprint

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static float[] voiceprint(Context c) {
        String s = prefs(c).getString("print", null);
        if (s == null) return null;
        try {
            JSONArray a = new JSONArray(s);
            float[] v = new float[a.length()];
            for (int i = 0; i < v.length; i++) v[i] = (float) a.getDouble(i);
            return v;
        } catch (Exception e) {
            return null;
        }
    }
    static float threshold(Context c) { return prefs(c).getFloat("threshold", 0.5f); }

    static double cosine(float[] a, float[] b) {
        if (a == null || b == null || a.length != b.length) return -1;
        double ab = 0, aa = 0, bb = 0;
        for (int i = 0; i < a.length; i++) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
        return aa == 0 || bb == 0 ? -1 : ab / Math.sqrt(aa * bb);
    }

    static float[] floats(JSONArray a) {
        if (a == null) return null;
        float[] v = new float[a.length()];
        for (int i = 0; i < v.length; i++) v[i] = (float) a.optDouble(i);
        return v;
    }

    /** her name heard in the words (also as two words, or with the Russian "х") */
    static boolean named(String text) {
        if (text == null) return false;
        String t = " " + text.toLowerCase().replace('х', 'ҳ') + " ";
        return t.contains("маҳлиё") || t.contains("маҳ лиё") || t.contains("маҳ лия");
    }

    static boolean mic(Context c) {
        return ContextCompat.checkSelfPermission(c, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    /** headphones on (wired, USB or Bluetooth): her voice goes there only */
    static boolean headset(Context c) {
        android.media.AudioManager am = (android.media.AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
        if (am == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return false;
        for (android.media.AudioDeviceInfo d : am.getDevices(android.media.AudioManager.GET_DEVICES_OUTPUTS)) {
            int t = d.getType();
            if (t == android.media.AudioDeviceInfo.TYPE_WIRED_HEADSET || t == android.media.AudioDeviceInfo.TYPE_WIRED_HEADPHONES
                || t == android.media.AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || t == android.media.AudioDeviceInfo.TYPE_USB_HEADSET
                || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && t == android.media.AudioDeviceInfo.TYPE_BLE_HEADSET)) return true;
        }
        return false;
    }

    /** a recording as a WAV file (16 kHz, mono, 16-bit), for the server's AI to hear */
    static byte[] wav(byte[] pcm) {
        java.nio.ByteBuffer b = java.nio.ByteBuffer.allocate(44 + pcm.length).order(java.nio.ByteOrder.LITTLE_ENDIAN);
        b.put("RIFF".getBytes()).putInt(36 + pcm.length).put("WAVE".getBytes()).put("fmt ".getBytes()).putInt(16).putShort((short) 1).putShort((short) 1)
            .putInt(RATE).putInt(RATE * 2).putShort((short) 2).putShort((short) 16).put("data".getBytes()).putInt(pcm.length).put(pcm);
        return b.array();
    }

    static AudioRecord recorder() {
        int min = AudioRecord.getMinBufferSize(RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        //noinspection MissingPermission (checked by the callers)
        return new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, Math.max(min, RATE));
    }

    // ---------------------------------------------------------------- the listening service

    /**
     * Listens for her name while it runs (its notification says so). Heard, with her voice: the phone wakes
     * and the app opens (over the lock screen) for what she wants; the service waits until the app says it
     * is done (resume), so it never holds the microphone the app needs.
     */
    public static class Service extends android.app.Service {
        static final String CHANNEL = "hey_mahliyo";
        static final String CHANNEL_WAKE = "hey_mahliyo_wake";
        static final int ID = 7701;
        static final String ACTION_PAUSE = "pause";
        static final String ACTION_RESUME = "resume";
        static volatile boolean running = false;
        static volatile boolean paused = false;
        private Thread worker;
        private volatile boolean stop = false;

        @Override public IBinder onBind(Intent intent) { return null; }

        @Override
        public int onStartCommand(Intent intent, int flags, int startId) {
            String action = intent != null ? intent.getAction() : null;
            if (ACTION_PAUSE.equals(action)) { paused = true; return START_STICKY; }
            if (ACTION_RESUME.equals(action)) { paused = false; return START_STICKY; }
            channels();
            Notification n = new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setColor(0xFF7A4FD8)
                .setContentTitle("«Эй Маҳлиё»")
                .setContentText("Маҳлиё номашро мешунавад — танҳо овози шуморо")
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE))
                .build();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
            else startForeground(ID, n);
            if (worker == null || !worker.isAlive()) {
                stop = false;
                worker = new Thread(this::listen, "hey-mahliyo");
                worker.start();
            }
            running = true;
            return START_STICKY;
        }

        @Override
        public void onDestroy() {
            stop = true;
            running = false;
            if (worker != null) worker.interrupt();
            super.onDestroy();
        }

        private void channels() {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || nm == null) return;
            if (nm.getNotificationChannel(CHANNEL) == null) {
                NotificationChannel ch = new NotificationChannel(CHANNEL, "«Эй Маҳлиё» мешунавад", NotificationManager.IMPORTANCE_LOW);
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
            }
            if (nm.getNotificationChannel(CHANNEL_WAKE) == null) {
                NotificationChannel ch = new NotificationChannel(CHANNEL_WAKE, "«Эй Маҳлиё» — бедор шуд", NotificationManager.IMPORTANCE_HIGH);
                ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                nm.createNotificationChannel(ch);
            }
        }

        private void listen() {
            if (!ready(this) || !mic(this)) { stopSelf(); return; }
            short[] buf = new short[RATE / 5];
            while (!stop) {
                if (paused) { sleep(400); continue; }
                // read again each time: a new enrolment is used at once
                float[] print = voiceprint(this);
                float limit = threshold(this);
                AudioRecord rec = null;
                Recognizer r = null;
                try {
                    r = new Recognizer(tg(this), RATE, spk(this));
                    rec = recorder();
                    rec.startRecording();
                    boolean heardName = false;
                    while (!stop && !paused) {
                        int n = rec.read(buf, 0, buf.length);
                        if (n <= 0) continue;
                        if (r.acceptWaveForm(buf, n)) {
                            JSONObject res = new JSONObject(r.getResult());
                            String text = res.optString("text");
                            if (heardName || named(text)) {
                                float[] v = floats(res.optJSONArray("spk"));
                                // her voice (when the voice could be weighed); no voiceprint yet: anyone
                                boolean hers = print == null || (v != null && cosine(v, print) >= limit);
                                heardName = false;
                                if (hers) { wake(text); break; }
                            }
                        } else if (!heardName && named(new JSONObject(r.getPartialResult()).optString("partial"))) {
                            heardName = true;
                        }
                    }
                } catch (Exception ignored) {
                    sleep(1500);
                } finally {
                    if (rec != null) { try { rec.stop(); } catch (Exception ignored) {} rec.release(); }
                    if (r != null) r.close();
                }
            }
        }

        /** her name in her voice: a buzz, the screen on, the app over the lock screen, listening */
        private void wake(String heard) {
            paused = true;
            woke = true;
            try {
                Vibrator vib = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (vib != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) vib.vibrate(VibrationEffect.createOneShot(60, 180));
                    else vib.vibrate(60);
                }
            } catch (Exception ignored) {}
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                //noinspection deprecation (the only way to light the screen for a moment)
                PowerManager.WakeLock wl = pm.newWakeLock(PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP, "lifehub:hey");
                wl.acquire(4000);
            }
            Intent open = new Intent(this, MainActivity.class)
                .putExtra(EXTRA_WAKE, heard)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            // the app over everything when it may be (display over other apps); otherwise through a full-screen notification
            boolean direct = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || Settings.canDrawOverlays(this);
            if (direct) {
                try { startActivity(open); return; } catch (Exception ignored) {}
            }
            PendingIntent pi = PendingIntent.getActivity(this, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification n = new NotificationCompat.Builder(this, CHANNEL_WAKE)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setColor(0xFF7A4FD8)
                .setContentTitle("Маҳлиё гӯш медиҳад")
                .setContentText("Бигӯед, чӣ лозим аст")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setFullScreenIntent(pi, true)
                .setContentIntent(pi)
                .setAutoCancel(true)
                .setTimeoutAfter(15000)
                .build();
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(ID + 1, n);
        }

        private static void sleep(long ms) { try { Thread.sleep(ms); } catch (InterruptedException ignored) {} }

        static void send(Context c, String action) {
            Intent i = new Intent(c, Service.class).setAction(action);
            try { c.startService(i); } catch (Exception ignored) {}
        }
    }

    // ---------------------------------------------------------------- the models' download

    /**
     * The models downloaded in the background (a foreground service, so leaving the app does not stop it), with
     * the progress in the notification panel; at the end a notification says it is ready (or that it failed).
     * The texts come from the app, in her language.
     */
    public static class Download extends android.app.Service {
        static final String CHANNEL = "hey_mahliyo_models";
        static final int ID = 7703;
        static volatile boolean busy = false;
        static volatile int percent = 0;
        interface Told { void progress(String part, int percent); void done(boolean ok); }
        static volatile Told told;

        @Override public IBinder onBind(Intent intent) { return null; }

        @Override
        public int onStartCommand(Intent intent, int flags, int startId) {
            if (intent == null || busy) return START_NOT_STICKY;
            String[] langs = intent.getStringArrayExtra("langs");
            String title = intent.getStringExtra("title");
            String doneText = intent.getStringExtra("done");
            String failText = intent.getStringExtra("failed");
            channel();
            busy = true;
            percent = 0;
            Notification first = bar(title, 0);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) startForeground(ID, first, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            else startForeground(ID, first);
            new Thread(() -> {
                boolean ok = false;
                try {
                    java.util.List<String[]> parts = new java.util.ArrayList<>();
                    if (!has(this, "spk")) parts.add(new String[] { "spk", SPK_URL, String.valueOf(SPK_SIZE) });
                    java.util.LinkedHashSet<String> want = new java.util.LinkedHashSet<>();
                    want.add("tg");
                    if (langs != null) java.util.Collections.addAll(want, langs);
                    for (String l : want) { String[] m = modelOf(l); if (m != null && !has(this, l)) parts.add(m); }
                    long total = 0;
                    for (String[] m : parts) total += Long.parseLong(m[2]);
                    final long all = Math.max(1, total);
                    final long[] before = { 0 };
                    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                    for (String[] m : parts) {
                        fetch(this, m[1], m[0], (part, done, size) -> {
                            int p = (int) Math.min(99, (before[0] + done) * 100 / all);
                            if (p == percent) return;
                            percent = p;
                            if (nm != null) nm.notify(ID, bar(title, p));
                            Told t = told;
                            if (t != null) t.progress(part, p);
                        });
                        before[0] += Long.parseLong(m[2]);
                    }
                    ok = true;
                } catch (Exception ignored) {
                    // the parts already whole stay; the next download goes on from the next part
                } finally {
                    busy = false;
                    percent = ok ? 100 : 0;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE);
                    else stopForeground(true);
                    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                    if (nm != null) nm.notify(ID + 1, new NotificationCompat.Builder(this, CHANNEL)
                        .setSmallIcon(R.drawable.ic_stat_notify).setColor(0xFF7A4FD8)
                        .setContentTitle(title).setContentText(ok ? doneText : failText).setAutoCancel(true)
                        .setContentIntent(PendingIntent.getActivity(this, 2, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE))
                        .build());
                    Told t = told;
                    if (t != null) t.done(ok);
                    stopSelf();
                }
            }, "hey-mahliyo-download").start();
            return START_NOT_STICKY;
        }

        private Notification bar(String title, int p) {
            return new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setColor(0xFF7A4FD8)
                .setContentTitle(title)
                .setContentText(p + "%")
                .setProgress(100, p, p == 0)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(PendingIntent.getActivity(this, 2, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE))
                .build();
        }

        void channel() { channelOf(this); }
        static void channelOf(Context c) {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || nm == null || nm.getNotificationChannel(CHANNEL) != null) return;
            NotificationChannel ch = new NotificationChannel(CHANNEL, "«Эй Маҳлиё» — моделҳо ва омӯзиш", NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
    }

    // ---------------------------------------------------------------- the plugin

    @CapacitorPlugin(name = "HeyMahliyo", permissions = {
        @Permission(alias = "mic", strings = { Manifest.permission.RECORD_AUDIO }),
        // "call Malika": her contacts read on the phone, and the call made
        @Permission(alias = "calls", strings = { Manifest.permission.READ_CONTACTS, Manifest.permission.CALL_PHONE })
    })
    public static class HeyPlugin extends Plugin {
        static HeyPlugin instance;
        private volatile boolean listening = false;
        private volatile boolean stopListening = false;

        @Override
        public void load() { instance = this; }

        /** opened by her name while the app was running: the web layer is told at once */
        void tellWake() {
            woke = false;
            notifyListeners("wake", new JSObject());
        }

        /** { models, enrolled, enabled, running, mic, overlay } */
        @PluginMethod
        public void state(PluginCall call) {
            Context c = getContext();
            JSObject r = new JSObject();
            r.put("models", ready(c));
            r.put("enrolled", voiceprint(c) != null);
            r.put("enabled", prefs(c).getBoolean("enabled", false));
            r.put("running", Service.running);
            r.put("mic", getPermissionState("mic") == PermissionState.GRANTED);
            r.put("overlay", Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || Settings.canDrawOverlays(c));
            r.put("langs", installed(c));
            r.put("downloading", Download.busy);
            r.put("percent", Download.percent);
            r.put("headset", headset(c));
            call.resolve(r);
        }

        @PluginMethod
        public void askMic(PluginCall call) {
            if (getPermissionState("mic") == PermissionState.GRANTED) { state(call); return; }
            requestPermissionForAlias("mic", call, "micAnswered");
        }
        @PermissionCallback
        private void micAnswered(PluginCall call) { state(call); }

        /** "display over other apps": lets her name open the app at once, also when the phone is unlocked */
        @PluginMethod
        public void askOverlay(PluginCall call) {
            Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, android.net.Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try { getContext().startActivity(i); } catch (Exception ignored) {}
            call.resolve();
        }

        private PluginCall preparing;

        /**
         * The models downloaded in the background (the speaker model, Tajik, and the languages she chose: `langs`),
         * shown in the notification panel; "progress" events { part, percent }; resolves when all are there. A
         * download already going on is joined.
         */
        @PluginMethod
        public void prepare(PluginCall call) {
            Context c = getContext();
            if (preparing != null && preparing != call) { preparing.setKeepAlive(false); bridge.releaseCall(preparing); }
            call.setKeepAlive(true);
            preparing = call;
            Download.told = new Download.Told() {
                @Override public void progress(String part, int percent) {
                    JSObject e = new JSObject();
                    e.put("part", part); e.put("percent", percent); e.put("done", percent); e.put("total", 100);
                    notifyListeners("progress", e);
                }
                @Override public void done(boolean ok) {
                    PluginCall p = preparing;
                    preparing = null;
                    notifyListeners("prepared", new JSObject().put("ok", ok));
                    if (p == null) return;
                    if (ok) { JSObject r = new JSObject(); r.put("models", true); r.put("langs", installed(c)); p.resolve(r); }
                    else p.reject("download_failed");
                    p.setKeepAlive(false);
                }
            };
            if (Download.busy) return;
            JSArray langs = call.getArray("langs", new JSArray());
            String[] want = new String[langs.length()];
            for (int i = 0; i < langs.length(); i++) want[i] = langs.optString(i);
            Intent i = new Intent(c, Download.class)
                .putExtra("langs", want)
                .putExtra("title", call.getString("title", "«Эй Маҳлиё»"))
                .putExtra("done", call.getString("done", "Тайёр"))
                .putExtra("failed", call.getString("failed", "Боргирӣ қатъ шуд"));
            try {
                ContextCompat.startForegroundService(c, i);
            } catch (Exception e) {
                preparing = null;
                call.setKeepAlive(false);
                call.reject("download_failed", e);
            }
        }

        /** a downloaded language taken away (Tajik stays: her name is heard by it) */
        @PluginMethod
        public void removeLang(PluginCall call) {
            String lang = call.getString("lang", "");
            if (lang == null || "tg".equals(lang) || modelOf(lang) == null) { call.reject("kept"); return; }
            synchronized (HeyMahliyo.class) {
                Model m = models.remove(lang);
                if (m != null) m.close();
            }
            deleteAll(dir(getContext(), lang));
            state(call);
        }

        /**
         * Listens once (the app's own question, or an enrolment phrase): "partial" events with the words so far;
         * resolves { text, spk } when she stops speaking, after `seconds` at most, or when stopped.
         */
        @PluginMethod
        public void listen(PluginCall call) {
            Context c = getContext();
            if (!ready(c)) { call.reject("no_models"); return; }
            if (getPermissionState("mic") != PermissionState.GRANTED) { call.reject("no_mic"); return; }
            if (listening) { call.reject("busy"); return; }
            int seconds = Math.max(2, Math.min(30, call.getInt("seconds", 10)));
            boolean whole = call.getBoolean("whole", false);
            String lang = call.getString("lang", "tg");
            // the recording too (for the server's AI, which hears all seven languages well), at most 20 seconds
            boolean keepAudio = call.getBoolean("audio", false);
            listening = true;
            stopListening = false;
            if (Service.running) Service.send(c, Service.ACTION_PAUSE);
            new Thread(() -> {
                AudioRecord rec = null;
                Recognizer r = null;
                String text = "";
                JSONArray spkVec = null;
                try {
                    r = new Recognizer(model(c, lang), RATE, spk(c));
                    rec = recorder();
                    rec.startRecording();
                    short[] buf = new short[RATE / 10];
                    java.io.ByteArrayOutputStream pcm = keepAudio ? new java.io.ByteArrayOutputStream() : null;
                    byte[] bytes = new byte[buf.length * 2];
                    long until = System.currentTimeMillis() + seconds * 1000L;
                    StringBuilder all = new StringBuilder();
                    while (!stopListening && System.currentTimeMillis() < until) {
                        int n = rec.read(buf, 0, buf.length);
                        if (n <= 0) continue;
                        if (pcm != null && pcm.size() < RATE * 2 * 20) {
                            for (int k = 0; k < n; k++) { bytes[2 * k] = (byte) buf[k]; bytes[2 * k + 1] = (byte) (buf[k] >> 8); }
                            pcm.write(bytes, 0, n * 2);
                        }
                        if (r.acceptWaveForm(buf, n)) {
                            JSONObject res = new JSONObject(r.getResult());
                            String t = res.optString("text");
                            if (res.optJSONArray("spk") != null) spkVec = res.optJSONArray("spk");
                            if (!t.isEmpty()) {
                                all.append(all.length() > 0 ? " " : "").append(t);
                                // one phrase is enough unless the whole time is asked for (an enrolment phrase)
                                if (!whole) break;
                            }
                        } else {
                            JSObject e = new JSObject();
                            String partial = new JSONObject(r.getPartialResult()).optString("partial");
                            e.put("text", (all.length() > 0 ? all + " " : "") + partial);
                            notifyListeners("partial", e);
                        }
                    }
                    JSONObject last = new JSONObject(r.getFinalResult());
                    if (!last.optString("text").isEmpty()) all.append(all.length() > 0 ? " " : "").append(last.optString("text"));
                    if (last.optJSONArray("spk") != null) spkVec = last.optJSONArray("spk");
                    text = all.toString();
                    JSObject out = new JSObject();
                    out.put("text", text);
                    out.put("spk", spkVec != null ? new JSArray(spkVec.toString()) : null);
                    if (pcm != null && !text.isEmpty()) out.put("wav", android.util.Base64.encodeToString(wav(pcm.toByteArray()), android.util.Base64.NO_WRAP));
                    call.resolve(out);
                } catch (Exception e) {
                    call.reject("listen_failed", e);
                } finally {
                    if (rec != null) { try { rec.stop(); } catch (Exception ignored) {} rec.release(); }
                    if (r != null) r.close();
                    listening = false;
                }
            }, "hey-mahliyo-listen").start();
        }

        @PluginMethod
        public void stopListening(PluginCall call) { stopListening = true; call.resolve(); }

        /** her voiceprint from the enrolment's prints (averaged), and how alike a voice must be to it */
        @PluginMethod
        public void saveVoice(PluginCall call) {
            try {
                JSONArray prints = call.getArray("prints");
                if (prints == null || prints.length() < 2) { call.reject("too_few"); return; }
                int dim = prints.getJSONArray(0).length();
                float[] avg = new float[dim];
                float[][] all = new float[prints.length()][];
                for (int i = 0; i < prints.length(); i++) {
                    all[i] = floats(prints.getJSONArray(i));
                    double norm = 0;
                    for (float x : all[i]) norm += x * x;
                    norm = Math.sqrt(norm);
                    for (int k = 0; k < dim; k++) avg[k] += (float) (all[i][k] / Math.max(norm, 1e-6));
                }
                // how alike her own phrases are to their mean: the bar is a little below the least of them
                double least = 1;
                for (float[] v : all) least = Math.min(least, cosine(v, avg));
                float bar = (float) Math.max(0.35, Math.min(0.75, least - 0.12));
                JSONArray keep = new JSONArray();
                for (float x : avg) keep.put(x);
                prefs(getContext()).edit().putString("print", keep.toString()).putFloat("threshold", bar).apply();
                // "her voice is learnt", in the notification panel too (the text from the app, in her language)
                String note = call.getString("note");
                if (note != null) {
                    Context c = getContext();
                    Download.channelOf(c);
                    NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
                    if (nm != null) nm.notify(Download.ID + 2, new NotificationCompat.Builder(c, Download.CHANNEL)
                        .setSmallIcon(R.drawable.ic_stat_notify).setColor(0xFF7A4FD8).setContentTitle("«Эй Маҳлиё»").setContentText(note)
                        .setAutoCancel(true).setTimeoutAfter(60_000).build());
                }
                JSObject r = new JSObject();
                r.put("threshold", bar);
                r.put("least", least);
                call.resolve(r);
            } catch (Exception e) {
                call.reject("bad_prints", e);
            }
        }

        @PluginMethod
        public void forgetVoice(PluginCall call) {
            prefs(getContext()).edit().remove("print").remove("threshold").apply();
            call.resolve();
        }

        /** turned on: the service listens (and again each time the app opens, while it is on) */
        @PluginMethod
        public void start(PluginCall call) {
            Context c = getContext();
            if (!ready(c) || getPermissionState("mic") != PermissionState.GRANTED) { call.reject("not_ready"); return; }
            prefs(c).edit().putBoolean("enabled", true).apply();
            Service.paused = false;
            try {
                ContextCompat.startForegroundService(c, new Intent(c, Service.class));
                call.resolve();
            } catch (Exception e) {
                call.reject("start_failed", e);
            }
        }

        @PluginMethod
        public void stop(PluginCall call) {
            Context c = getContext();
            prefs(c).edit().putBoolean("enabled", false).apply();
            c.stopService(new Intent(c, Service.class));
            Service.running = false;
            call.resolve();
        }

        /** the app's own listening is over: the service listens for her name again */
        @PluginMethod
        public void resume(PluginCall call) {
            if (Service.running) Service.send(getContext(), Service.ACTION_RESUME);
            call.resolve();
        }

        // ------------------------------------------------ her voice answers, the phone's own tools

        private android.speech.tts.TextToSpeech tts;
        private boolean ttsReady = false;

        /** Mahliyo says it aloud (the phone's own voice in the language closest to hers); resolves when done */
        @PluginMethod
        public void speak(PluginCall call) {
            String text = call.getString("text", "");
            String lang = call.getString("lang", "ru");
            if (text == null || text.trim().isEmpty()) { call.resolve(); return; }
            Runnable say = () -> {
                java.util.Locale want = "en".equals(lang) ? java.util.Locale.ENGLISH : "tr".equals(lang) ? new java.util.Locale("tr")
                    : "fa".equals(lang) || "prs".equals(lang) ? new java.util.Locale("fa") : "uz".equals(lang) ? new java.util.Locale("uz") : new java.util.Locale(lang);
                int ok = tts.setLanguage(want);
                // no voice of her own language (Tajik mostly): Russian reads Tajik Cyrillic closest
                if (ok == android.speech.tts.TextToSpeech.LANG_MISSING_DATA || ok == android.speech.tts.TextToSpeech.LANG_NOT_SUPPORTED) tts.setLanguage(new java.util.Locale("ru"));
                tts.setSpeechRate(1.02f);
                tts.setPitch(1.08f);
                // with headphones on, her voice is in them only (the assistant's sound goes where media goes);
                // "speaker" chosen: the phone's speaker, as on a phone call
                boolean loud = call.getBoolean("speaker", false) && headset(getContext());
                android.media.AudioManager am = (android.media.AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
                if (loud && am != null) {
                    am.setMode(android.media.AudioManager.MODE_IN_COMMUNICATION);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        for (android.media.AudioDeviceInfo d : am.getAvailableCommunicationDevices())
                            if (d.getType() == android.media.AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) { am.setCommunicationDevice(d); break; }
                    } else am.setSpeakerphoneOn(true);
                }
                tts.setAudioAttributes(new android.media.AudioAttributes.Builder()
                    .setUsage(loud ? android.media.AudioAttributes.USAGE_VOICE_COMMUNICATION : android.media.AudioAttributes.USAGE_ASSISTANT)
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SPEECH).build());
                Runnable back = () -> {
                    if (!loud || am == null) return;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) am.clearCommunicationDevice(); else am.setSpeakerphoneOn(false);
                    am.setMode(android.media.AudioManager.MODE_NORMAL);
                };
                String id = "say-" + System.currentTimeMillis();
                tts.setOnUtteranceProgressListener(new android.speech.tts.UtteranceProgressListener() {
                    @Override public void onStart(String u) {}
                    @Override public void onDone(String u) { if (id.equals(u)) { back.run(); call.resolve(); } }
                    @Override public void onError(String u) { if (id.equals(u)) { back.run(); call.resolve(); } }
                });
                tts.speak(text.length() > 3900 ? text.substring(0, 3900) : text, android.speech.tts.TextToSpeech.QUEUE_FLUSH, null, id);
            };
            if (tts != null && ttsReady) { say.run(); return; }
            tts = new android.speech.tts.TextToSpeech(getContext(), (status) -> {
                ttsReady = status == android.speech.tts.TextToSpeech.SUCCESS;
                if (ttsReady) say.run(); else call.reject("no_voice");
            });
        }

        @PluginMethod
        public void stopSpeaking(PluginCall call) { if (tts != null) tts.stop(); call.resolve(); }

        /** a timer in the phone's clock (it rings even when the app is closed) */
        @PluginMethod
        public void setTimer(PluginCall call) {
            int seconds = call.getInt("seconds", 60);
            Intent i = new Intent(android.provider.AlarmClock.ACTION_SET_TIMER)
                .putExtra(android.provider.AlarmClock.EXTRA_LENGTH, Math.max(1, Math.min(86400, seconds)))
                .putExtra(android.provider.AlarmClock.EXTRA_MESSAGE, call.getString("label", "Маҳлиё"))
                .putExtra(android.provider.AlarmClock.EXTRA_SKIP_UI, true)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try { getContext().startActivity(i); call.resolve(); } catch (Exception e) { call.reject("no_clock", e); }
        }

        @PluginMethod
        public void askCalls(PluginCall call) {
            if (getPermissionState("calls") == PermissionState.GRANTED) { callsAnswered(call); return; }
            requestPermissionForAlias("calls", call, "callsAnswered");
        }
        @PermissionCallback
        private void callsAnswered(PluginCall call) {
            JSObject r = new JSObject();
            r.put("granted", getPermissionState("calls") == PermissionState.GRANTED);
            call.resolve(r);
        }

        /** all her contacts with a number (the app finds the one that sounds like the name she said) */
        @PluginMethod
        public void contacts(PluginCall call) {
            if (getPermissionState("calls") != PermissionState.GRANTED) { call.reject("no_permission"); return; }
            JSArray out = new JSArray();
            android.net.Uri uri = android.provider.ContactsContract.CommonDataKinds.Phone.CONTENT_URI;
            String[] cols = { android.provider.ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, android.provider.ContactsContract.CommonDataKinds.Phone.NUMBER };
            try (android.database.Cursor cur = getContext().getContentResolver().query(uri, cols, null, null, null)) {
                java.util.HashSet<String> seen = new java.util.HashSet<>();
                while (cur != null && cur.moveToNext() && out.length() < 5000) {
                    String name = cur.getString(0), number = cur.getString(1);
                    if (name == null || number == null || !seen.add(name + number.replaceAll("\\D", ""))) continue;
                    JSObject c = new JSObject();
                    c.put("name", name); c.put("number", number);
                    out.put(c);
                }
            } catch (Exception e) { call.reject("contacts_failed", e); return; }
            JSObject r = new JSObject();
            r.put("contacts", out);
            call.resolve(r);
        }

        /** the call made (the phone's own call screen) */
        @PluginMethod
        public void callNumber(PluginCall call) {
            String number = call.getString("number", "");
            if (getPermissionState("calls") != PermissionState.GRANTED || number == null || number.isEmpty()) { call.reject("no_permission"); return; }
            Intent i = new Intent(Intent.ACTION_CALL, android.net.Uri.parse("tel:" + number)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try { getContext().startActivity(i); call.resolve(); } catch (Exception e) { call.reject("call_failed", e); }
        }

        /** the phone's "default digital assistant" setting, where LifeHub can be chosen */
        @PluginMethod
        public void assistantSettings(PluginCall call) {
            String[] tries = { "android.settings.VOICE_INPUT_SETTINGS", Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS, Settings.ACTION_SETTINGS };
            for (String a : tries) {
                try { getContext().startActivity(new Intent(a).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); break; } catch (Exception ignored) {}
            }
            call.resolve();
        }

        @Override
        protected void handleOnDestroy() {
            if (tts != null) { tts.shutdown(); tts = null; }
            super.handleOnDestroy();
        }

        /** whether the app was just opened by her name (once) */
        @PluginMethod
        public void takeWake(PluginCall call) {
            JSObject r = new JSObject();
            r.put("woke", woke);
            woke = false;
            call.resolve(r);
        }

        /** the app came to the front while it is on: the service runs again (Android may have stopped it) */
        @Override
        protected void handleOnResume() {
            super.handleOnResume();
            Context c = getContext();
            if (prefs(c).getBoolean("enabled", false) && !Service.running && ready(c) && mic(c)) {
                try { ContextCompat.startForegroundService(c, new Intent(c, Service.class)); } catch (Exception ignored) {}
            }
        }
    }
}
