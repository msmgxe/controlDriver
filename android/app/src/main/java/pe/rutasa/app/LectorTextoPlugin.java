package pe.rutasa.app;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Rect;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * El lector de texto de las capturas.
 *
 * Hace lo mismo que el plugin de OCR que ya venía con la app —pasar la imagen
 * por el reconocedor de texto de Google— pero devuelve dos cosas que aquél no:
 *
 *   · **Dónde está cada línea** (x, y, ancho, alto, en píxeles). Sin eso el
 *     intérprete tenía que adivinar, por el orden de las líneas, a qué pedido
 *     pertenecía cada «Ruta 4» y cada «Entregado», y el orden cambia con el
 *     teléfono. Con las coordenadas se sabe.
 *   · **Cuánto tardó**, para que se vea en el diagnóstico de Ajustes y no haya
 *     que adivinar tampoco dónde se va el tiempo.
 *
 * Y es más rápido por tres razones que no dependen de la imagen:
 *
 *   · el reconocedor se **crea una vez** y se reutiliza. El otro plugin creaba
 *     uno nuevo en cada captura, sin cerrarlo nunca: cargar el modelo cada vez,
 *     y una fuga de memoria por cada foto;
 *   · la imagen se **decodifica fuera del hilo principal**, así que la pantalla
 *     no se congela mientras se lee;
 *   · hay **dos reconocedores**, y las capturas de una carga se leen de dos en
 *     dos.
 */
@CapacitorPlugin(name = "LectorTexto")
public class LectorTextoPlugin extends Plugin {

    private static final int RECONOCEDORES = 2;

    private TextRecognizer[] reconocedores;
    private ExecutorService hilo;
    private final AtomicInteger turno = new AtomicInteger();

    @Override
    public void load() {
        reconocedores = new TextRecognizer[RECONOCEDORES];
        for (int i = 0; i < RECONOCEDORES; i++) {
            reconocedores[i] = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        }
        // Un hilo por reconocedor: decodificar la imagen siguiente mientras la
        // anterior se lee es justo lo que hace ganar tiempo.
        hilo = Executors.newFixedThreadPool(RECONOCEDORES);
    }

    @Override
    protected void handleOnDestroy() {
        if (reconocedores != null) {
            for (TextRecognizer r : reconocedores) {
                if (r != null) r.close();
            }
        }
        if (hilo != null) hilo.shutdown();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void leer(final PluginCall call) {
        final String imagen = call.getString("image");
        if (imagen == null || imagen.isEmpty()) {
            call.reject("Falta la imagen.");
            return;
        }

        final TextRecognizer reconocedor =
            reconocedores[Math.floorMod(turno.getAndIncrement(), RECONOCEDORES)];

        hilo.execute(() -> {
            final long inicio = System.currentTimeMillis();
            final Bitmap bitmap;
            try {
                String base64 = imagen;
                int coma = base64.indexOf(',');
                if (base64.startsWith("data:") && coma >= 0) base64 = base64.substring(coma + 1);
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            } catch (Exception | OutOfMemoryError e) {
                call.reject("No se pudo abrir la imagen.", e instanceof Exception ? (Exception) e : null);
                return;
            }
            if (bitmap == null) {
                call.reject("La imagen no es válida.");
                return;
            }

            final int ancho = bitmap.getWidth();
            final int alto = bitmap.getHeight();

            reconocedor
                .process(InputImage.fromBitmap(bitmap, 0))
                .addOnSuccessListener(hilo, (Text texto) -> {
                    try {
                        JSArray lineas = new JSArray();
                        for (Text.TextBlock bloque : texto.getTextBlocks()) {
                            for (Text.Line linea : bloque.getLines()) {
                                JSObject o = new JSObject();
                                o.put("texto", linea.getText());
                                o.put("confianza", linea.getConfidence());
                                Rect caja = linea.getBoundingBox();
                                // Sin caja no hay dónde: ancho y alto en cero, y el
                                // intérprete sabe que ahí no hay nada que medir.
                                o.put("x", caja != null ? caja.left : 0);
                                o.put("y", caja != null ? caja.top : 0);
                                o.put("w", caja != null ? caja.width() : 0);
                                o.put("h", caja != null ? caja.height() : 0);
                                lineas.put(o);
                            }
                        }
                        JSObject respuesta = new JSObject();
                        respuesta.put("ancho", ancho);
                        respuesta.put("alto", alto);
                        respuesta.put("ms", System.currentTimeMillis() - inicio);
                        respuesta.put("lineas", lineas);
                        call.resolve(respuesta);
                    } finally {
                        bitmap.recycle();
                    }
                })
                .addOnFailureListener(hilo, (Exception e) -> {
                    bitmap.recycle();
                    call.reject("El lector de texto falló.", e);
                });
        });
    }
}
