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
 * Every day looks different (also with the app closed: the widgets redraw every hour): a soft colour of
 * seven, and on the Mahliyo widget one of her seven faces and what she says to you today — praise when
 * today's lesson is done, a nudge when not yet, and in the evening a gentle "keep your streak".
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
    private static final int[] FACES = { R.drawable.widget_m0, R.drawable.widget_m1, R.drawable.widget_m2, R.drawable.widget_m3, R.drawable.widget_m4, R.drawable.widget_m5, R.drawable.widget_m6 };

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
        v.setTextViewText(R.id.w_streak, String.valueOf(streak));
        if (layout == R.layout.widget_streak) {
            v.setTextViewText(R.id.w_streak_label, streakText);
            v.setOnClickPendingIntent(R.id.w_root, open(ctx, "/profile", 1));
        } else if (layout == R.layout.widget_progress) {
            v.setTextViewText(R.id.w_brand, d.optString("brand", "Духтари хубам"));
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
            // has she learnt today? (the app's last day of learning, on this phone's calendar)
            String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Calendar.getInstance().getTime());
            boolean done = today.equals(d.optString("lastDay", ""));
            boolean evening = Calendar.getInstance().get(Calendar.HOUR_OF_DAY) >= 18;
            JSONObject say = d.optJSONObject("say");
            JSONArray lines = say == null ? null : say.optJSONArray(done ? "done" : evening && streak > 0 ? "late" : "todo");
            v.setImageViewResource(R.id.w_face, FACES[day % 7]);
            v.setTextViewText(R.id.w_say, ofDay(lines, day, "Салом! Имрӯз чӣ меомӯзем?"));
            v.setTextViewText(R.id.w_streak, String.valueOf(streak));
            v.setTextViewText(R.id.w_go, d.optString("goText", "Оғоз"));
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

    abstract static class Base extends AppWidgetProvider {
        abstract int layout();

        @Override
        public void onUpdate(Context ctx, AppWidgetManager m, int[] ids) {
            m.updateAppWidget(ids, build(ctx, layout()));
        }
    }

    public static class StreakWidget extends Base { int layout() { return R.layout.widget_streak; } }
    public static class ProgressWidget extends Base { int layout() { return R.layout.widget_progress; } }
    public static class WordsWidget extends Base { int layout() { return R.layout.widget_words; } }
    public static class WeekWidget extends Base { int layout() { return R.layout.widget_week; } }
    public static class MahliyoWidget extends Base { int layout() { return R.layout.widget_mahliyo; } }
}
