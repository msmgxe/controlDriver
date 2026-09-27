package pe.rutasa.app;

import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Lo que hace falta para que un archivo generado en el teléfono —el PDF de
 * estadísticas, el Excel del historial— **se pueda ver y guardar**.
 *
 * El navegador de dentro de la app (WebView) no descarga archivos: un enlace con
 * `download` no hace nada, y el «compartir» de la web no admite archivos. Así
 * que el PDF se generaba y no salía por ningún lado. Este plugin cubre los dos
 * caminos que faltaban:
 *
 *   · `abrir`: lo abre con la app que tenga el teléfono para ese tipo de
 *     archivo —el visor de PDF, una hoja de cálculo—;
 *   · `guardarEnDescargas`: lo deja en la carpeta Descargas (`Control Driver`),
 *     donde se ve desde el gestor de archivos.
 *
 * El archivo ya está escrito en la caché de la app (con el plugin de
 * `Filesystem`); aquí solo se recibe su nombre, nunca una ruta, para que no se
 * pueda apuntar a nada fuera de esa carpeta.
 */
@CapacitorPlugin(name = "Archivos")
public class ArchivosPlugin extends Plugin {

    /** El archivo de la caché con ese nombre, o null si el nombre no es solo un nombre. */
    private File enCache(String nombre) {
        if (nombre == null || nombre.isEmpty() || nombre.contains("/") || nombre.contains("\\") || nombre.contains("..")) {
            return null;
        }
        File f = new File(getContext().getCacheDir(), nombre);
        return f.isFile() ? f : null;
    }

    @PluginMethod
    public void abrir(PluginCall call) {
        File archivo = enCache(call.getString("nombre"));
        if (archivo == null) {
            call.reject("No se encontró el archivo. Vuelve a generarlo.");
            return;
        }
        String tipo = call.getString("tipo", "application/octet-stream");

        try {
            Uri uri = FileProvider.getUriForFile(
                getContext(), getContext().getPackageName() + ".fileprovider", archivo);
            Intent intento = new Intent(Intent.ACTION_VIEW);
            intento.setDataAndType(uri, tipo);
            intento.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intento);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("Este teléfono no tiene ninguna app para abrir este archivo. Usa «Guardar» o «Compartir».");
        } catch (Exception e) {
            call.reject("No se pudo abrir el archivo: " + e.getMessage());
        }
    }

    @PluginMethod
    public void guardarEnDescargas(PluginCall call) {
        File archivo = enCache(call.getString("nombre"));
        if (archivo == null) {
            call.reject("No se encontró el archivo. Vuelve a generarlo.");
            return;
        }
        // Antes de Android 10 guardar en Descargas pide un permiso que la app no
        // tiene; «Compartir» sirve para lo mismo.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.reject("En este Android usa «Compartir» para guardar el archivo.");
            return;
        }
        String tipo = call.getString("tipo", "application/octet-stream");

        ContentResolver resolver = getContext().getContentResolver();
        ContentValues valores = new ContentValues();
        valores.put(MediaStore.MediaColumns.DISPLAY_NAME, archivo.getName());
        valores.put(MediaStore.MediaColumns.MIME_TYPE, tipo);
        valores.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Control Driver");
        valores.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri destino = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, valores);
        if (destino == null) {
            call.reject("No se pudo crear el archivo en Descargas.");
            return;
        }

        try (InputStream entrada = new FileInputStream(archivo);
             OutputStream salida = resolver.openOutputStream(destino)) {
            if (salida == null) throw new IllegalStateException("sin salida");
            byte[] bloque = new byte[16 * 1024];
            int leidos;
            while ((leidos = entrada.read(bloque)) != -1) salida.write(bloque, 0, leidos);
        } catch (Exception e) {
            resolver.delete(destino, null, null);
            call.reject("No se pudo guardar el archivo: " + e.getMessage());
            return;
        }

        ContentValues listo = new ContentValues();
        listo.put(MediaStore.MediaColumns.IS_PENDING, 0);
        resolver.update(destino, listo, null, null);

        JSObject respuesta = new JSObject();
        respuesta.put("carpeta", "Descargas/Control Driver");
        respuesta.put("nombre", archivo.getName());
        call.resolve(respuesta);
    }
}
