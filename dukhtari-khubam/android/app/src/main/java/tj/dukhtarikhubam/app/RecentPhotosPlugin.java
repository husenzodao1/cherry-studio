package tj.dukhtarikhubam.app;

import android.Manifest;
import android.content.ContentUris;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageDecoder;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Size;

import com.getcapacitor.JSArray;
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

/**
 * The phone's newest photos for Mahliyo's attach sheet: asks for the gallery (Android 13+: the photos;
 * Android 14+ may give only the ones the learner picks), then gives small thumbnails, and a chosen photo
 * as a JPEG at most 2048 px on its long side.
 */
@CapacitorPlugin(
    name = "RecentPhotos",
    permissions = {
        @Permission(alias = "photos13", strings = { Manifest.permission.READ_MEDIA_IMAGES }),
        @Permission(alias = "photosOld", strings = { Manifest.permission.READ_EXTERNAL_STORAGE })
    }
)
public class RecentPhotosPlugin extends Plugin {
    private String alias() {
        return Build.VERSION.SDK_INT >= 33 ? "photos13" : "photosOld";
    }

    /** whether some photos can be read (Android 14's "selected photos only" counts) */
    private boolean allowed() {
        if (getPermissionState(alias()) == PermissionState.GRANTED) return true;
        return Build.VERSION.SDK_INT >= 34
            && getContext().checkSelfPermission("android.permission.READ_MEDIA_VISUAL_USER_SELECTED") == android.content.pm.PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod
    public void recent(PluginCall call) {
        if (allowed()) {
            list(call);
            return;
        }
        requestPermissionForAlias(alias(), call, "afterAsk");
    }

    @PermissionCallback
    private void afterAsk(PluginCall call) {
        if (allowed()) list(call);
        else {
            JSObject r = new JSObject();
            r.put("denied", true);
            r.put("photos", new JSArray());
            call.resolve(r);
        }
    }

    private void list(PluginCall call) {
        int limit = Math.max(1, Math.min(call.getInt("limit", 30), 120));
        int side = Math.max(96, Math.min(call.getInt("thumb", 256), 512));
        getBridge().execute(() -> {
            JSArray photos = new JSArray();
            Uri base = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
            String[] cols = { MediaStore.Images.Media._ID, MediaStore.Images.Media.DISPLAY_NAME };
            try (Cursor c = getContext().getContentResolver().query(base, cols, null, null, MediaStore.Images.Media.DATE_ADDED + " DESC")) {
                while (c != null && c.moveToNext() && photos.length() < limit) {
                    Uri uri = ContentUris.withAppendedId(base, c.getLong(0));
                    String thumb = thumbnail(uri, side);
                    if (thumb == null) continue;
                    JSObject p = new JSObject();
                    p.put("id", uri.toString());
                    p.put("name", c.getString(1));
                    p.put("thumb", "data:image/jpeg;base64," + thumb);
                    photos.put(p);
                }
            } catch (Exception e) {
                // nothing readable: an empty list
            }
            JSObject r = new JSObject();
            r.put("photos", photos);
            call.resolve(r);
        });
    }

    private String thumbnail(Uri uri, int side) {
        try {
            Bitmap b;
            if (Build.VERSION.SDK_INT >= 29) b = getContext().getContentResolver().loadThumbnail(uri, new Size(side, side), null);
            else b = MediaStore.Images.Thumbnails.getThumbnail(getContext().getContentResolver(), ContentUris.parseId(uri), MediaStore.Images.Thumbnails.MINI_KIND, null);
            if (b == null) return null;
            return jpeg(b, 70);
        } catch (Exception e) {
            return null;
        }
    }

    /** A chosen photo as a JPEG, at most 2048 px on its long side. */
    @PluginMethod
    public void read(PluginCall call) {
        String id = call.getString("id");
        if (id == null || !id.startsWith("content://")) {
            call.reject("no photo");
            return;
        }
        getBridge().execute(() -> {
            try {
                Uri uri = Uri.parse(id);
                Bitmap b;
                if (Build.VERSION.SDK_INT >= 28) {
                    b = ImageDecoder.decodeBitmap(ImageDecoder.createSource(getContext().getContentResolver(), uri), (decoder, info, src) -> {
                        Size s = info.getSize();
                        int max = Math.max(s.getWidth(), s.getHeight());
                        if (max > 2048) decoder.setTargetSize(s.getWidth() * 2048 / max, s.getHeight() * 2048 / max);
                        decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);
                    });
                } else {
                    try (InputStream in = getContext().getContentResolver().openInputStream(uri)) {
                        b = BitmapFactory.decodeStream(in);
                    }
                    int max = Math.max(b.getWidth(), b.getHeight());
                    if (max > 2048) b = Bitmap.createScaledBitmap(b, b.getWidth() * 2048 / max, b.getHeight() * 2048 / max, true);
                }
                JSObject r = new JSObject();
                r.put("data", jpeg(b, 88));
                r.put("mime", "image/jpeg");
                call.resolve(r);
            } catch (Exception e) {
                call.reject("not readable");
            }
        });
    }

    private static String jpeg(Bitmap b, int quality) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        b.compress(Bitmap.CompressFormat.JPEG, quality, out);
        return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
    }
}
