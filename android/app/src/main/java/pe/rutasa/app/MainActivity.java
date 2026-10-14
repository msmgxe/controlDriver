package pe.rutasa.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Un plugin propio se registra antes de que arranque el puente.
        registerPlugin(LectorTextoPlugin.class);
        registerPlugin(GeocodificadorPlugin.class);
        registerPlugin(ArchivosPlugin.class);
        super.onCreate(savedInstanceState);

        /* Android 15 (y 14 con targetSdk 35) fuerza la app a pantalla completa, bajo la
           barra de estado y la de navegación. Se le deja a la app solo el espacio libre:
           el contenido se rellena con el alto de las barras del sistema, y del teclado
           cuando está abierto. */
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        View contenido = findViewById(android.R.id.content);
        getWindow().getDecorView().setBackgroundColor(Color.parseColor("#E6EEF8"));
        new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(true);
        ViewCompat.setOnApplyWindowInsetsListener(contenido, (v, insets) -> {
            Insets barras = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets teclado = insets.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(barras.left, barras.top, barras.right, Math.max(barras.bottom, teclado.bottom));
            return WindowInsetsCompat.CONSUMED;
        });
    }
}
