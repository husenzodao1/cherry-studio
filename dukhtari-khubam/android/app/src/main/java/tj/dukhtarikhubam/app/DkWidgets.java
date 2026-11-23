package tj.dukhtarikhubam.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

/**
 * Home-screen widgets. The app writes a small summary (WidgetsPlugin → SharedPreferences "dk_widgets")
 * whenever progress or the words of the day change; each widget draws itself from it. A tap opens the
 * app on the matching screen (custom-scheme link handled by the web layer).
 * Every day looks different (also with the app closed: the widgets redraw every hour, Mahliyo's every half
 * hour): a soft colour of seven, and on the Mahliyo widget one of her ten scenes (mahliyoScene) — her
 * emotion, its own background and a few short words.
 */
public final class DkWidgets {
    static final String PREFS = "dk_widgets";
    private static final int[] DAYS = { R.id.w_d0, R.id.w_d1, R.id.w_d2, R.id.w_d3, R.id.w_d4, R.id.w_d5, R.id.w_d6 };
    private static final int[] LABELS = { R.id.w_l0, R.id.w_l1, R.id.w_l2, R.id.w_l3, R.id.w_l4, R.id.w_l5, R.id.w_l6 };

    private DkWidgets() {}

    static JSONObject data(Context ctx) {
        try {
            return new JSONObject(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("data", "{}"));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    static PendingIntent open(Context ctx, String path, int code) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(ctx.getPackageName() + "://open" + path), ctx, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static final int[] LIGHT = { R.drawable.widget_bg_d0, R.drawable.widget_bg_d1, R.drawable.widget_bg_d2, R.drawable.widget_bg_d3, R.drawable.widget_bg_d4, R.drawable.widget_bg_d5, R.drawable.widget_bg_d6 };
    private static final int[] DEEP = { R.drawable.widget_acc_d0, R.drawable.widget_acc_d1, R.drawable.widget_acc_d2, R.drawable.widget_acc_d3, R.drawable.widget_acc_d4, R.drawable.widget_acc_d5, R.drawable.widget_acc_d6 };

    /**
     * Mahliyo's ten scenes (docs/mahliyo-widget.md): her picture(s), the background, and whether it is deep
     * (light words on it). The words come from the app ("scenes"), several to each, one a day.
     */
    static final class Scene {
        final String id; final int[] faces; final int bg; final boolean deep;
        /** boys' mode: the boy's pictures, and its own background where the girls' one is pink or lilac (0: the same) */
        int[] boyFaces; int boyBg;
        Scene(String id, int[] faces, int bg, boolean deep) { this.id = id; this.faces = faces; this.bg = bg; this.deep = deep; }
        Scene boy(int bg, int... faces) { this.boyBg = bg; this.boyFaces = faces; return this; }
    }
    static final Scene MORNING = new Scene("morning", new int[] { R.drawable.widget_e01 }, R.drawable.widget_s_morning, false).boy(0, R.drawable.widget_b01);
    static final Scene WIN = new Scene("win", new int[] { R.drawable.widget_e02 }, R.drawable.widget_s_win, false).boy(0, R.drawable.widget_b02, R.drawable.widget_b12);
    static final Scene FIRE = new Scene("fire", new int[] { R.drawable.widget_e03 }, R.drawable.widget_s_fire, true).boy(0, R.drawable.widget_b03);
    static final Scene WAIT = new Scene("wait", new int[] { R.drawable.widget_e04 }, R.drawable.widget_s_wait, false).boy(R.drawable.widget_s_wait_b, R.drawable.widget_b04, R.drawable.widget_b11);
    static final Scene WORRY = new Scene("worry", new int[] { R.drawable.widget_e05 }, R.drawable.widget_s_worry, true).boy(0, R.drawable.widget_b05);
    static final Scene LAST = new Scene("last", new int[] { R.drawable.widget_e06, R.drawable.widget_e07 }, R.drawable.widget_s_last, true).boy(0, R.drawable.widget_b06);
    static final Scene SAD = new Scene("sad", new int[] { R.drawable.widget_e08 }, R.drawable.widget_s_sad, false).boy(0, R.drawable.widget_b07);
    static final Scene SLEEP = new Scene("sleep", new int[] { R.drawable.widget_e09 }, R.drawable.widget_s_sleep, true).boy(0, R.drawable.widget_b08);
    static final Scene PARTY = new Scene("party", new int[] { R.drawable.widget_e10, R.drawable.widget_e11 }, R.drawable.widget_s_party, true).boy(R.drawable.widget_s_party_b, R.drawable.widget_b09);
    static final Scene COLD = new Scene("cold", new int[] { R.drawable.widget_e12 }, R.drawable.widget_s_cold, false).boy(0, R.drawable.widget_b10);
    private static final int[] MILESTONES = { 3, 7, 14, 30, 50, 100, 150, 200, 365, 500, 1000 };

    /** days between two "yyyy-MM-dd" days on this phone's calendar (a large number when one is missing) */
    static int daysBetween(String from, String to) {
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            return (int) Math.round((f.parse(to).getTime() - f.parse(from).getTime()) / 86_400_000.0);
        } catch (Exception e) {
            return 9999;
        }
    }

    /**
     * Which scene: a record day; today's lesson done (with a streak of 3+, the flame); the night; three days
     * without the app (cold); the streak lost; then by the hour while today's lesson waits — the last
     * chance after 21:00, worry after 18:00, waiting after noon, and the morning.
     * `streak` is the app's count when it last wrote; a day missed since then has put it out.
     */
    static Scene mahliyoScene(int streak, String lastDay, String opened, String today, int hour) {
        boolean done = today.equals(lastDay);
        int gap = daysBetween(lastDay, today);
        int live = gap <= 1 ? streak : 0;
        if (done) {
            for (int m : MILESTONES) if (live == m) return PARTY;
            return live >= 3 ? FIRE : WIN;
        }
        if (hour < 6) return SLEEP;
        if (daysBetween(opened, today) >= 3) return COLD;
        if (live == 0 && !lastDay.isEmpty() && gap < 9999) return hour >= 21 ? LAST : SAD;
        if (hour >= 21) return live > 0 ? LAST : WAIT;
        if (hour >= 18) return live > 0 ? WORRY : WAIT;
        if (hour >= 12) return WAIT;
        return MORNING;
    }

    /** today's number (days since 1970 on the phone's clock): what changes each day */
    static int dayNo() {
        Calendar c = Calendar.getInstance();
        long local = c.getTimeInMillis() + c.get(Calendar.ZONE_OFFSET) + c.get(Calendar.DST_OFFSET);
        return (int) (local / 86_400_000L);
    }

    /** one of a list, the day's own */
    static String ofDay(JSONArray list, int day, String fallback) {
        if (list == null || list.length() == 0) return fallback;
        return list.optString(Math.floorMod(day, list.length()), fallback);
    }

    static RemoteViews build(Context ctx, int layout) {
        JSONObject d = data(ctx);
        RemoteViews v = new RemoteViews(ctx.getPackageName(), layout);
        int day = dayNo();
        v.setInt(R.id.w_root, "setBackgroundResource", layout == R.layout.widget_words ? DEEP[day % 7] : LIGHT[day % 7]);
        int streak = d.optInt("streak", 0);
        String streakText = d.optString("streakText", "рӯзи пайдарпай");
        // (the Mahliyo widget writes its streak in its own line)
        if (layout != R.layout.widget_mahliyo) v.setTextViewText(R.id.w_streak, String.valueOf(streak));
        if (layout == R.layout.widget_streak) {
            v.setTextViewText(R.id.w_streak_label, streakText);
            v.setOnClickPendingIntent(R.id.w_root, open(ctx, "/profile", 1));
        } else if (layout == R.layout.widget_progress) {
            v.setTextViewText(R.id.w_brand, d.optString("brand", "Гулдухтар"));
            v.setTextViewText(R.id.w_done, String.valueOf(d.optInt("done", 0)));
            v.setTextViewText(R.id.w_done_label, d.optString("doneText", "дарс хонда шуд"));
            v.setProgressBar(R.id.w_bar, 100, Math.max(0, Math.min(100, d.optInt("percent", 0))), false);
            v.setTextViewText(R.id.w_next, d.optString("nextText", "Идома"));
            v.setOnClickPendingIntent(R.id.w_root, open(ctx, "/", 2));
            v.setOnClickPendingIntent(R.id.w_next, open(ctx, d.optString("nextPath", "/schools"), 3));
        } else if (layout == R.layout.widget_words) {
            v.setTextViewText(R.id.w_label, d.optString("wordsLabel", "СУХАНҲОИ РӮЗ"));
            v.setTextViewText(R.id.w_streak, "🔥 " + streak);
            v.setTextViewText(R.id.w_quote, d.optString("quote", "Зебоӣ дар дониш аст."));
            v.setTextViewText(R.id.w_author, d.optString("author", ""));
            v.setOnClickPendingIntent(R.id.w_root, open(ctx, "/", 4));
        } else if (layout == R.layout.widget_mahliyo) {
            // her scene for this moment (the phone's calendar and clock)
            String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Calendar.getInstance().getTime());
            String lastDay = d.optString("lastDay", "");
            Scene sc = mahliyoScene(streak, lastDay, d.optString("opened", today), today, Calendar.getInstance().get(Calendar.HOUR_OF_DAY));
            int live = daysBetween(lastDay, today) <= 1 ? streak : 0;
            JSONObject scenes = d.optJSONObject("scenes");
            // her words change every half hour (the widget is redrawn then), not once a day
            Calendar now = Calendar.getInstance();
            int slot = day * 48 + now.get(Calendar.HOUR_OF_DAY) * 2 + now.get(Calendar.MINUTE) / 30;
            String said = ofDay(scenes == null ? null : scenes.optJSONArray(sc.id), slot, "Салом!|Имрӯз чӣ меомӯзем?").replace("{n}", String.valueOf(live));
            int bar = said.indexOf('|');
            int ink = sc.deep ? 0xFFFFFFFF : 0xFF2A1D4A;
            // boys' mode: the boy's pictures (and a blue background where the girls' one is pink or lilac)
            boolean boy = "boy".equals(d.optString("gender", "girl"));
            int[] faces = boy && sc.boyFaces != null ? sc.boyFaces : sc.faces;
            v.setInt(R.id.w_root, "setBackgroundResource", boy && sc.boyBg != 0 ? sc.boyBg : sc.bg);
            v.setImageViewResource(R.id.w_face, faces[Math.floorMod(day, faces.length)]);
            // the streak: its flame and the days, in a capsule that suits the scene
            v.setTextViewText(R.id.w_kicker, live + "  " + d.optString("streakText", "").toLowerCase(Locale.ROOT));
            v.setTextColor(R.id.w_kicker, sc.deep ? 0xFFFFFFFF : 0xFF2A1D4A);
            v.setInt(R.id.w_streak_box, "setBackgroundResource", sc.deep ? R.drawable.widget_streak_dark : R.drawable.widget_streak_light);
            v.setTextViewText(R.id.w_title, bar < 0 ? said : said.substring(0, bar).trim());
            v.setTextColor(R.id.w_title, ink);
            v.setTextViewText(R.id.w_sub, bar < 0 ? "" : said.substring(bar + 1).trim());
            v.setTextColor(R.id.w_sub, (ink & 0x00FFFFFF) | 0xD9000000);
            v.setTextViewText(R.id.w_go, d.optString("goText", "Оғоз") + "  ➜");
            v.setInt(R.id.w_go, "setBackgroundResource", sc.deep ? R.drawable.widget_go_dark : boy ? R.drawable.widget_go_light_b : R.drawable.widget_go_light);
            v.setTextColor(R.id.w_go, sc.deep ? 0xFF2A1D4A : 0xFFFFFFFF);
            v.setOnClickPendingIntent(R.id.w_root, open(ctx, "/mahliyo", 6));
            v.setOnClickPendingIntent(R.id.w_go, open(ctx, d.optString("nextPath", "/schools"), 7));
        } else if (layout == R.layout.widget_week) {
            JSONArray week = d.optJSONArray("week");
            JSONArray labels = d.optJSONArray("weekLabels");
            int today = d.optInt("todayIndex", 6);
            for (int i = 0; i < 7; i++) {
                boolean on = week != null && week.optBoolean(i, false);
                v.setInt(DAYS[i], "setBackgroundResource", on ? R.drawable.widget_dot_on : i == today ? R.drawable.widget_dot_today : R.drawable.widget_dot_off);
                if (labels != null) v.setTextViewText(LABELS[i], labels.optString(i, ""));
            }
            v.setOnClickPendingIntent(R.id.w_root, open(ctx, "/garden", 5));
        }
        return v;
    }

    /** Redraws every placed widget of every kind. */
    static void updateAll(Context ctx) {
        AppWidgetManager m = AppWidgetManager.getInstance(ctx);
        update(ctx, m, StreakWidget.class, R.layout.widget_streak);
        update(ctx, m, ProgressWidget.class, R.layout.widget_progress);
        update(ctx, m, WordsWidget.class, R.layout.widget_words);
        update(ctx, m, WeekWidget.class, R.layout.widget_week);
        update(ctx, m, MahliyoWidget.class, R.layout.widget_mahliyo);
    }

    private static void update(Context ctx, AppWidgetManager m, Class<?> cls, int layout) {
        int[] ids = m.getAppWidgetIds(new ComponentName(ctx, cls));
        if (ids.length > 0) m.updateAppWidget(ids, build(ctx, layout));
    }

    /** the app's own half-hourly tick: Android's update period alone is not kept on many phones */
    static final String TICK = "tj.dukhtarikhubam.app.WIDGET_TICK";

    /** Redraws every widget every half hour from the next half hour on (inexact: no special permission). */
    static void schedule(Context ctx) {
        android.app.AlarmManager am = (android.app.AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Intent i = new Intent(ctx, MahliyoWidget.class).setAction(TICK);
        android.app.PendingIntent pi = android.app.PendingIntent.getBroadcast(ctx, 41, i,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
        Calendar c = Calendar.getInstance();
        c.set(Calendar.SECOND, 5);
        c.set(Calendar.MILLISECOND, 0);
        c.set(Calendar.MINUTE, c.get(Calendar.MINUTE) < 30 ? 30 : 0);
        if (c.get(Calendar.MINUTE) == 0) c.add(Calendar.HOUR_OF_DAY, 1);
        am.setInexactRepeating(android.app.AlarmManager.RTC, c.getTimeInMillis(), android.app.AlarmManager.INTERVAL_HALF_HOUR, pi);
    }

    abstract static class Base extends AppWidgetProvider {
        abstract int layout();

        @Override
        public void onUpdate(Context ctx, AppWidgetManager m, int[] ids) {
            m.updateAppWidget(ids, build(ctx, layout()));
            schedule(ctx);
        }

        @Override
        public void onReceive(Context ctx, Intent intent) {
            if (TICK.equals(intent.getAction())) { updateAll(ctx); return; }
            super.onReceive(ctx, intent);
        }
    }

    public static class StreakWidget extends Base { int layout() { return R.layout.widget_streak; } }
    public static class ProgressWidget extends Base { int layout() { return R.layout.widget_progress; } }
    public static class WordsWidget extends Base { int layout() { return R.layout.widget_words; } }
    public static class WeekWidget extends Base { int layout() { return R.layout.widget_week; } }
    public static class MahliyoWidget extends Base { int layout() { return R.layout.widget_mahliyo; } }
}
