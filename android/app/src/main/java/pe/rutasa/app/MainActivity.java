package pe.rutasa.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Un plugin propio se registra antes de que arranque el puente.
        registerPlugin(LectorTextoPlugin.class);
        registerPlugin(GeocodificadorPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
