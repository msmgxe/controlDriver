# Cómo cobrar y activar licencias

Mientras no exista el panel web, esto se hace desde la terminal de tu Mac, en
la carpeta del proyecto. Es un solo comando por compañero y por pago.

## El recorrido completo

1. **Tu compañero instala la app.** Tiene 30 días de prueba con todo, sin que
   hagas nada.
2. **Te paga por Yape** y te manda el **código de su teléfono**: lo copia en
   *Ajustes → Tu licencia → Copiar* y te lo pega por WhatsApp.
3. **Emites su licencia:**

   ```
   npm run licencia -- emitir <código> "Juan Pérez" 1
   ```

   El último número son los meses pagados. Si todavía le quedaban días, el mes
   nuevo **se suma** a lo que tenía: no pierde nada por pagar antes.

4. **Le reenvías el mensaje** que sale en pantalla. Él lo pega en
   *Ajustes → Tu licencia* y toca **Activar**.

## Ver quién está al día

```
npm run licencia -- lista
```

Sale cada compañero con la fecha hasta la que tiene pagado, ordenados por la
que vence antes.

## Lo que no puede pasar

La carpeta **`~/.rutas-a`** de tu Mac guarda dos cosas que no tienen
repuesto:

| Archivo | Para qué | Si se pierde |
|---|---|---|
| `licencia-privada.jwk` | Firmar licencias | No podrás renovar ninguna. |
| `rutas-a.keystore` y `firma.properties` | Firmar la app | Nadie podrá actualizar sin desinstalar, y desinstalar borra sus datos. |
| `licencias.csv` | El registro de pagos | Pierdes quién pagó hasta cuándo. |

**Copia la carpeta entera a tu Google Drive** hoy, y cada vez que emitas
licencias. Y no la compartas con nadie: con `licencia-privada.jwk`,
cualquiera puede fabricarse licencias gratis.

Para ver la carpeta en el Finder: *Ir → Ir a la carpeta…* (`⇧⌘G`) y escribe
`~/.rutas-a`.

## Qué ve tu compañero

- **Prueba:** «Te quedan N días de prueba gratis». Todo funciona.
- **Últimos 5 días** (de prueba o de su mes): un aviso suave arriba que lleva a
  renovar. No bloquea nada.
- **Vencida:** 7 días de gracia en los que sigue funcionando, y después
  **solo lectura**: ve y exporta todo lo suyo, pero no carga días nuevos. No
  pierde nada; al activar, sigue donde estaba.

Una licencia solo sirve en el teléfono cuyo código se usó. Si un compañero le
pasa la suya a otro, en el otro no activa.
