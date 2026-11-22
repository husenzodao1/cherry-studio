package tj.dukhtarikhubam.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Saves a PNG straight into the phone's gallery (Pictures/Гулдухтар), without the share sheet.
 * Android 10 and newer need no permission for this; older phones ask once for storage access.
 */
@CapacitorPlugin(
    name = "GallerySaver",
    permissions = { @Permission(alias = "storage", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }) }
)
public class GallerySaverPlugin extends Plugin {
    private static final String ALBUM = "Гулдухтар";

    @PluginMethod
    public void savePng(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "storageGranted");
            return;
        }
        write(call);
    }

    @PermissionCallback
    private void storageGranted(PluginCall call) {
        if (getPermissionState("storage") != PermissionState.GRANTED) {
            call.reject("permission_denied");
            return;
        }
        write(call);
    }

    private void write(PluginCall call) {
        String data = call.getString("data");
        String name = call.getString("fileName", "dukhtari-khubam.png");
        if (data == null || data.isEmpty()) {
            call.reject("no_data");
            return;
        }
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            Uri uri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, name);
                values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/" + ALBUM);
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
                uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new IllegalStateException("insert_failed");
                try (OutputStream out = resolver.openOutputStream(uri)) {
                    if (out == null) throw new IllegalStateException("open_failed");
                    out.write(bytes);
                }
                values.clear();
                values.put(MediaStore.Images.Media.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
            } else {
                File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), ALBUM);
                if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("mkdir_failed");
                File file = new File(dir, name);
                try (FileOutputStream out = new FileOutputStream(file)) {
                    out.write(bytes);
                }
                MediaScannerConnection.scanFile(getContext(), new String[] { file.getAbsolutePath() }, new String[] { "image/png" }, null);
                uri = Uri.fromFile(file);
            }
            JSObject ret = new JSObject();
            ret.put("uri", uri.toString());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("save_failed", e);
        }
    }
}
