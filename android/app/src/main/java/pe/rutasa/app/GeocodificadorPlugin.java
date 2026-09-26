package pe.rutasa.app;

import android.location.Address;
import android.location.Geocoder;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Buscar una dirección: del texto de una comanda a un punto del mapa.
 *
 * Usa el `Geocoder` del propio Android, que no necesita ninguna clave ni
 * cuenta: le pregunta al servicio de mapas del teléfono. Eso sí, **necesita
 * internet**, y la dirección viaja hasta ese servicio: es lo único que sale del
 * teléfono en todo el flujo de las comandas, y Ajustes lo dice.
 *
 * La búsqueda se acota a unos kilómetros alrededor de la tienda
 * (`cercaLat`/`cercaLng`/`radioKm`), porque «Jr. Los Molles 167» existe en más
 * de una ciudad y sin esa caja el buscador puede elegir cualquiera.
 *
 * Se hace fuera del hilo principal: el buscador de Android tarda, y la pantalla
 * no debe congelarse mientras contesta.
 */
@CapacitorPlugin(name = "Geocodificador")
public class GeocodificadorPlugin extends Plugin {

    private ExecutorService hilo;

    @Override
    public void load() {
        hilo = Executors.newSingleThreadExecutor();
    }

    @Override
    protected void handleOnDestroy() {
        if (hilo != null) hilo.shutdown();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void buscar(final PluginCall call) {
        final String texto = call.getString("texto");
        if (texto == null || texto.trim().isEmpty()) {
            call.reject("Falta la dirección.");
            return;
        }
        if (!Geocoder.isPresent()) {
            call.reject("Este teléfono no tiene el buscador de direcciones de Android.");
            return;
        }

        final Double cercaLat = call.getDouble("cercaLat");
        final Double cercaLng = call.getDouble("cercaLng");
        final double radioKm = call.getDouble("radioKm", 40.0);
        final int max = Math.max(1, Math.min(6, call.getInt("max", 3)));

        hilo.execute(() -> {
            try {
                Geocoder geocoder = new Geocoder(getContext(), new Locale("es", "PE"));
                List<Address> encontradas;
                if (cercaLat != null && cercaLng != null) {
                    // Un grado de latitud son ~111 km; el de longitud se acorta con el coseno.
                    double dLat = radioKm / 111.0;
                    double dLng = radioKm / (111.0 * Math.max(0.2, Math.cos(Math.toRadians(cercaLat))));
                    encontradas = geocoder.getFromLocationName(
                        texto.trim(), max,
                        cercaLat - dLat, cercaLng - dLng,
                        cercaLat + dLat, cercaLng + dLng
                    );
                } else {
                    encontradas = geocoder.getFromLocationName(texto.trim(), max);
                }

                JSArray resultados = new JSArray();
                if (encontradas != null) {
                    for (Address a : encontradas) {
                        if (!a.hasLatitude() || !a.hasLongitude()) continue;
                        JSObject o = new JSObject();
                        o.put("lat", a.getLatitude());
                        o.put("lng", a.getLongitude());
                        String linea = a.getMaxAddressLineIndex() >= 0 ? a.getAddressLine(0) : null;
                        if (linea == null || linea.isEmpty()) {
                            linea = a.getThoroughfare() != null ? a.getThoroughfare() : texto.trim();
                        }
                        o.put("etiqueta", linea);
                        resultados.put(o);
                    }
                }
                JSObject respuesta = new JSObject();
                respuesta.put("resultados", resultados);
                call.resolve(respuesta);
            } catch (IOException e) {
                call.reject("No se pudo buscar la dirección. ¿Hay internet?", e);
            } catch (IllegalArgumentException e) {
                call.reject("La dirección no es válida.", e);
            }
        });
    }
}
