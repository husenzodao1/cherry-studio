package tj.dukhtarikhubam.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * Opens a file Mahliyo made (saved in the app's cache) in another app of the phone: the phone asks which
 * one ("Open with…": a PDF reader, Word, PowerPoint, a code editor…).
 */
@CapacitorPlugin(name = "FileOpener")
public class FileOpenerPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        String path = call.getString("path");
        String mime = call.getString("mime", "*/*");
        String title = call.getString("title", "");
        if (path == null) {
            call.reject("no file");
            return;
        }
        try {
            File file = new File(Uri.parse(path).getPath());
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent view = new Intent(Intent.ACTION_VIEW);
            view.setDataAndType(uri, mime);
            view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(view, title);
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(chooser);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("no app", "NO_APP");
        } catch (Exception e) {
            call.reject("not opened");
        }
    }
}
