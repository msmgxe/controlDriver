/**
 * Esquema de la base local del celular.
 *
 * Es el reflejo del de Postgres (`supabase/migrations/`), con cuatro
 * diferencias deliberadas:
 *
 *   1. **Sin RLS.** En Postgres las políticas son la frontera de seguridad
 *      porque la base la comparten todos los repartidores. Aquí la base vive
 *      dentro del almacenamiento privado de la aplicación, en un solo celular
 *      y con un solo dueño: el sistema operativo ya hace de frontera. Quien
 *      protege el día a día es el PIN (`src/lib/bloqueo.ts`).
 *
 *   2. **El dinero se guarda en céntimos enteros.** Postgres tiene
 *      `numeric(10,2)`, que es exacto; SQLite no —su `REAL` es coma flotante,
 *      y sumar 10.00 + 11.50 miles de veces acaba en 141.49999999. Como la
 *      aplicación ya trabaja en céntimos por dentro (§ reglas de pago), aquí
 *      se guardan tal cual y la conversión ocurre solo al sincronizar.
 *
 *   3. **`duracion_min` no es columna generada.** SQLite las soporta, pero no
 *      sobre expresiones de fecha; se calcula en la vista.
 *
 *   4. **Dos columnas de más en cada tabla que se sincroniza**: `actualizado_en`
 *      y `sincronizado`. Son la cola de pendientes de la Fase B: todo lo que se
 *      escribe aquí nace con `sincronizado = 0` y el servidor todavía no lo ha
 *      visto. Sin esto no habría forma de saber qué falta subir tras dos días
 *      sin señal.
 */

/** Versión del esquema. Subirla dispara las migraciones de `migrar()`. */
export const VERSION_ESQUEMA = 6;

export const NOMBRE_BASE = "rutas-a";

/**
 * Sentencias de creación, en orden.
 *
 * Van todas con `if not exists` para que arrancar dos veces no rompa nada.
 */
export const ESQUEMA: string[] = [
  `pragma foreign_keys = on;`,

  /* Pares clave/valor de la propia aplicación: el identificador de este
     teléfono, el certificado de licencia, la fecha más alta vista. Van en la
     base y no en el almacenamiento del navegador porque ahí sobreviven a
     "borrar datos de navegación", que en el certificado sería una llamada de
     soporte y en el identificador dejaría al usuario fuera de su licencia. */
  `create table if not exists ajustes (
     clave text primary key,
     valor text not null
   );`,

  `create table if not exists tiendas (
     id             text primary key,
     nombre         text not null unique,
     activa         integer not null default 1,
     /* El punto de partida de los repartos: de aquí se mide la distancia a cada
        cliente para calcular el tramo. Se elige en Ajustes. */
     lat            real,
     lng            real,
     direccion      text,
     /* Cómo mide esta tienda la distancia de sus tramos: 'recta' (en línea
        recta) o 'calles' (la ruta que genera Waze o Maps). Cada tienda mide a
        su manera, por eso vive aquí y no en un ajuste general. */
     metodo_distancia text not null default 'recta',
     /* Cuando se mide por calles y no hay señal para pedir la ruta, se estima
        multiplicando la línea recta por este número. */
     factor_calles  real not null default 1.3,
     creado_en      text not null,
     actualizado_en text not null,
     sincronizado   integer not null default 0
   );`,

  /* El "perfil" en el celular es uno solo: el dueño del teléfono. Se guarda
     igual que en Postgres para que sincronizar sea copiar, no traducir. */
  `create table if not exists perfil (
     id             text primary key,
     email          text,
     nombre         text not null,
     tienda_id      text references tiendas (id),
     vehiculo       text not null default 'auto',
     hora_entrada   text,
     hora_salida    text,
     actualizado_en text not null,
     sincronizado   integer not null default 0
   );`,

  `create table if not exists jornadas (
     id                 text primary key,
     fecha              text not null unique,
     rutas_declaradas   integer,
     ordenes_declaradas integer,
     entregado          integer not null default 0,
     parcial            integer not null default 0,
     no_entregado       integer not null default 0,
     validacion_ok      integer not null default 0,
     tienda_id          text references tiendas (id),
     vehiculo           text not null default 'auto',
     hora_entrada       text,
     hora_salida        text,
     notas              text,
     creado_en          text not null,
     actualizado_en     text not null,
     sincronizado       integer not null default 0
   );`,

  `create table if not exists rutas (
     id          text primary key,
     jornada_id  text not null references jornadas (id) on delete cascade,
     numero      integer not null,
     estado      text not null,
     hora_inicio text,
     hora_fin    text,
     /* Sin esto, volver a cargar el mismo día duplicaría las rutas en vez de
        actualizarlas: es la clave sobre la que se apoya el "on conflict". */
     unique (jornada_id, numero)
   );`,

  `create table if not exists ordenes (
     id             text primary key,
     jornada_id     text not null references jornadas (id) on delete cascade,
     ruta_id        text references rutas (id) on delete set null,
     codigo         text not null,
     estado         text not null,
     posicion       integer not null,
     tramo          integer not null default 1 check (tramo between 1 and 6),
     km             real,
     monto_centimos integer,
     /* Añadido a mano, no leído de una captura. Se marca para que se vea de
        dónde salió cada cifra cuando haya que justificar un pago. */
     manual         integer not null default 0,
     /* Lo que se sabe del cliente, si se leyó de su comanda o se escribió. Todo
        es opcional: son datos de una tercera persona y solo se guardan los que
        la persona elige guardar (ver Ajustes). */
     cliente_nombre   text,
     cliente_telefono text,
     direccion        text,
     lat              real,
     lng              real,
     /* De dónde salió km: 'recta', 'ruta' (pedida a un servicio de rutas),
        'estimado' (línea recta por el factor de calles) o 'manual'. */
     km_fuente        text,
     /* El tramo lo puso el cálculo por distancia, no la persona. Si la persona
        lo cambia a mano, vuelve a 0 y el cálculo ya no lo pisa. */
     tramo_auto       integer not null default 0,
     /* La misma razón que en rutas, y además lo que permite el modo
        "combinar": un pedido ya registrado se actualiza, no se repite. */
     unique (jornada_id, codigo)
   );`,

  `create table if not exists reglas_pago (
     id             text primary key,
     tienda_id      text not null references tiendas (id) on delete cascade,
     vehiculo       text not null default 'auto',
     vigente_desde  text not null,
     parametros     text not null,
     actualizado_en text not null,
     sincronizado   integer not null default 0
   );`,

  `create table if not exists liquidaciones (
     id                 text primary key,
     semana_inicio      text not null unique,
     semana_fin         text not null,
     fecha_pago         text not null,
     regla_id           text references reglas_pago (id),
     total_rutas        integer,
     total_ordenes      integer,
     ordenes_por_tramo  text,
     monto_centimos     integer,
     detalle            text,
     estado             text not null default 'abierta'
                          check (estado in ('abierta', 'cerrada', 'pagada')),
     recibido_centimos  integer,
     actualizado_en     text not null,
     sincronizado       integer not null default 0
   );`,

  /* Las imágenes NO se guardan (§7): se leen, se extraen los datos y se
     descartan. Aquí solo queda el rastro de cuánto se gastó en el modelo. */
  /* Las capturas que respaldan cada día.
  
     La especificación decía descartarlas (§7) y era buena idea mientras
     viajaban a un servidor ajeno. Aquí no salen del teléfono, y sirven para
     algo que ninguna otra cosa cubre: si la tienda discute un pago, la captura
     original es la prueba. Se guardan en el almacenamiento privado de la
     aplicación —ninguna otra app las ve, ni salen en la galería— y se pueden
     borrar una a una o por día. */
  `create table if not exists pruebas (
     id         text primary key,
     fecha      text not null,
     /* Opcional: una prueba puede respaldar el día entero —las capturas de la
        carga— o un pedido concreto, cuando se añade a mano con su foto. */
     orden_id   text references ordenes (id) on delete cascade,
     archivo    text not null,
     /* Huella de los bytes: dos capturas idénticas —la misma subida dos
        veces— tienen la misma. */
     huella     text,
     /* Lo que se leyó en ella —códigos y horarios—, para no guardar una
        captura que no aporta nada que no esté ya en otra del mismo día. */
     contenido  text,
     bytes      integer not null default 0,
     creado_en  text not null
   );`,

  `create index if not exists idx_pruebas_fecha on pruebas (fecha desc);`,

  `create table if not exists cargas (
     id             text primary key,
     jornada_id     text references jornadas (id) on delete cascade,
     modelo         text,
     tokens_entrada integer,
     tokens_salida  integer,
     creado_en      text not null
   );`,

  /* Los días en que **no se trabajó**, dichos por el repartidor.

     Sin esto no había forma de distinguir «no trabajé el lunes» de «me falta
     subir el lunes»: los dos eran un hueco, y la app insistía en que faltaba
     un día por subir cada vez que se abría Pagos. Un día de descanso no lleva
     pedidos ni rutas, solo la fecha; si más tarde se carga una jornada de ese
     día, el descanso se quita solo. */
  `create table if not exists dias_descanso (
     fecha     text primary key,
     creado_en text not null
   );`,

  `create index if not exists idx_jornadas_fecha    on jornadas (fecha desc);`,
  `create unique index if not exists uq_rutas_numero   on rutas (jornada_id, numero);`,
  `create unique index if not exists uq_ordenes_codigo on ordenes (jornada_id, codigo);`,
  `create index if not exists idx_rutas_jornada     on rutas (jornada_id);`,
  `create index if not exists idx_ordenes_jornada   on ordenes (jornada_id);`,
  `create index if not exists idx_ordenes_codigo    on ordenes (codigo);`,
  `create index if not exists idx_reglas_tienda     on reglas_pago (tienda_id, vehiculo, vigente_desde desc);`,

  /* Equivalente de `v_resumen_diario`.

     Las dos sumas van en subconsultas y no en un join doble a propósito: unir
     rutas y órdenes en la misma consulta multiplica las filas (12 pedidos × 6
     rutas = 72) e infla todos los totales. Es un error fácil de cometer y
     difícil de ver, porque el resultado parece plausible. */
  `create view if not exists v_resumen_diario as
     select
       j.fecha                                          as fecha,
       j.validacion_ok                                  as validacion_ok,
       j.entregado                                      as entregado,
       j.parcial                                        as parcial,
       j.no_entregado                                   as no_entregado,
       j.hora_entrada                                   as hora_entrada,
       j.hora_salida                                    as hora_salida,
       j.vehiculo                                       as vehiculo,
       coalesce(r.rutas, 0)                             as rutas,
       coalesce(r.minutos_en_ruta, 0)                   as minutos_en_ruta,
       r.primera_salida                                 as primera_salida,
       r.ultimo_regreso                                 as ultimo_regreso,
       coalesce(o.pedidos, 0)                           as pedidos,
       coalesce(o.monto_centimos, 0)                    as monto_centimos,
       coalesce(o.pedidos_fuera_tramo_1, 0)             as pedidos_fuera_tramo_1
     from jornadas j
     left join (
       select jornada_id,
              count(*)             as rutas,
              min(hora_inicio)     as primera_salida,
              max(hora_fin)        as ultimo_regreso,
              sum(
                case when hora_inicio is null or hora_fin is null then 0
                     else (strftime('%s', '2000-01-01 ' || hora_fin)
                         - strftime('%s', '2000-01-01 ' || hora_inicio)) / 60
                end
              )                    as minutos_en_ruta
       from rutas group by jornada_id
     ) r on r.jornada_id = j.id
     left join (
       select jornada_id,
              count(*)                                   as pedidos,
              sum(coalesce(monto_centimos, 0))           as monto_centimos,
              sum(case when tramo <> 1 then 1 else 0 end) as pedidos_fuera_tramo_1
       from ordenes group by jornada_id
     ) o on o.jornada_id = j.id;`,
];

/**
 * Columnas añadidas a tablas que ya existían.
 *
 * `create table if not exists` no toca una tabla que ya está creada: si una
 * versión nueva le añade una columna, el teléfono que tenía la versión
 * anterior **no la recibe**, y la primera consulta que la nombre revienta. Es
 * un fallo que no se ve al probar —en un teléfono recién instalado todo está—
 * y que aparece justo en el de quien ya usaba la app, con sus datos dentro.
 *
 * Cada vez que se añada una columna a una tabla existente, va también aquí.
 * `migrar` la añade solo si falta, así que es seguro ejecutarlo siempre.
 */
export const COLUMNAS_ANADIDAS: ReadonlyArray<[tabla: string, columna: string, definicion: string]> = [
  ["perfil", "vehiculo", "text not null default 'auto'"],
  ["jornadas", "vehiculo", "text not null default 'auto'"],
  ["reglas_pago", "vehiculo", "text not null default 'auto'"],
  ["ordenes", "manual", "integer not null default 0"],
  ["pruebas", "orden_id", "text"],
  ["pruebas", "huella", "text"],
  ["pruebas", "contenido", "text"],
  ["tiendas", "lat", "real"],
  ["tiendas", "lng", "real"],
  ["tiendas", "direccion", "text"],
  ["tiendas", "metodo_distancia", "text not null default 'recta'"],
  ["tiendas", "factor_calles", "real not null default 1.3"],
  ["ordenes", "cliente_nombre", "text"],
  ["ordenes", "cliente_telefono", "text"],
  ["ordenes", "direccion", "text"],
  ["ordenes", "lat", "real"],
  ["ordenes", "lng", "real"],
  ["ordenes", "km_fuente", "text"],
  ["ordenes", "tramo_auto", "integer not null default 0"],
];

/** Lo mínimo que necesita `migrar` de una base, sea cual sea el motor. */
export interface BaseMigrable {
  consultar<T>(sql: string): Promise<T[]>;
  ejecutar(sql: string): Promise<unknown>;
}

/**
 * Añade las columnas que falten. Idempotente: se ejecuta en cada arranque.
 *
 * **Nunca lanza.** Esto corre al abrir la base, y en la v9 un fallo aquí dejaba
 * la aplicación entera en la pantalla de «no se pudo abrir la base de datos»:
 * por una columna, el repartidor se quedaba sin acceso a meses de datos. Si un
 * paso falla, se salta y se sigue; lo peor que puede pasar es que una función
 * nueva no ande, nunca que no se pueda entrar.
 *
 * Si `pragma table_info` no se puede leer —hay motores que no lo dejan pasar
 * por la vía de consultas—, se intenta añadir la columna igualmente: SQLite
 * rechaza añadir una que ya existe, y ese rechazo se ignora.
 */
export async function migrar(base: BaseMigrable): Promise<string[]> {
  const anadidas: string[] = [];

  for (const [tabla, columna, definicion] of COLUMNAS_ANADIDAS) {
    try {
      let columnas: Array<{ name: string }> | null = null;
      try {
        columnas = await base.consultar<{ name: string }>(`pragma table_info(${tabla})`);
      } catch {
        columnas = null;
      }

      if (columnas !== null) {
        if (columnas.length === 0) continue; // la tabla no existe: la crea el esquema
        if (columnas.some((c) => c.name === columna)) continue;
      }

      await base.ejecutar(`alter table ${tabla} add column ${columna} ${definicion}`);
      anadidas.push(`${tabla}.${columna}`);
    } catch {
      /* "duplicate column name" si ya estaba, o cualquier otro fallo: en los
         dos casos se sigue con la siguiente. */
    }
  }
  return anadidas;
}
