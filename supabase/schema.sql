-- ===========================================================================
-- RutaLog — esquema de base de datos
-- Implementa §5 (modelo de datos), §7 (Row Level Security) y §13 (reglas de pago)
-- de ESPECIFICACION_APP_RUTAS.md
--
-- Se aplica sobre un proyecto Supabase nuevo:
--   supabase db push          (con la CLI enlazada al proyecto)
--   o pegándolo en el SQL Editor del panel de Supabase.
--
-- Antes de aplicarlo, en el panel de Supabase → Authentication:
--
--   1. Providers → Email: desactivar "Enable sign ups".
--      Las cuentas las crea solo el administrador (§12).
--   2. Providers → Email: activar "Email OTP" y desactivar "Confirm email"
--      (las cuentas se crean ya confirmadas desde el Server Action de alta).
--   3. Email Templates → Magic Link: reemplazar el enlace por {{ .Token }}.
--      Por defecto Supabase manda un enlace mágico; con {{ .Token }} manda el
--      código de 6 dígitos, que es lo que pide la app.
--   4. Providers → Email: OTP expiry en 600 segundos (10 minutos).
-- ===========================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tiendas. Cada una tiene sus propias reglas de pago y las registra el
-- administrador. Un driver trabaja para una tienda; la jornada guarda cuál era
-- para que un cambio de tienda no reescriba el historial.
-- ---------------------------------------------------------------------------
create table if not exists tiendas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  activa     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Perfiles: una fila por usuario de auth. El rol vive aquí y solo se lee en
-- servidor; nunca se confía en un rol enviado por el cliente (§7).
-- ---------------------------------------------------------------------------
create table if not exists perfiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          text not null unique,          -- con el que recibe su código de acceso
  nombre         text not null,
  rol            text not null default 'driver' check (rol in ('admin', 'driver')),
  activo         boolean not null default true,
  vigente_hasta  date,                          -- control de suscripción (§12)
  tienda_id      uuid references tiendas (id),
  hora_entrada   time,                          -- horario habitual de permanencia
  hora_salida    time,
  created_at     timestamptz not null default now()
);

comment on column perfiles.hora_entrada is
  'Horario habitual de permanencia en tienda. Cada jornada lo hereda y se puede corregir el día que se entre tarde o se salga antes. No sale de las capturas: esas traen horarios de ruta, no de permanencia.';

comment on column perfiles.email is
  'El acceso es por correo + código de 6 dígitos, no por usuario y contraseña. Tiene que ser un buzón real al que el driver llegue: el email sintético usuario@rutalog.app que planteaba §12 ya no sirve, porque nadie podría leer el código. Se guarda aquí, además de en auth.users, para que el admin pueda listar cuentas sin service role.';
comment on column perfiles.vigente_hasta is
  'Al vencer, el driver puede ver y exportar su historial pero no cargar días nuevos.';

-- ---------------------------------------------------------------------------
-- Jornadas: un día de trabajo de un driver. La clave del negocio es la FECHA DE
-- LA JORNADA (la del encabezado de la captura), no la fecha de carga (§13).
-- ---------------------------------------------------------------------------
create table if not exists jornadas (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  fecha               date not null,
  rutas_declaradas    int,                           -- contador "Rutas N" de la captura
  ordenes_declaradas  int,                           -- contador "Órdenes N" de la captura
  entregado           int not null default 0,
  parcial             int not null default 0,
  no_entregado        int not null default 0,
  validacion_ok       boolean not null default false,
  tienda_id           uuid references tiendas (id),
  hora_entrada        time,                          -- permanencia de ese día (§13 bis)
  hora_salida         time,
  notas               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, fecha)
);

-- ---------------------------------------------------------------------------
-- Rutas: las horas existen solo a este nivel, no por pedido (§2).
-- ---------------------------------------------------------------------------
create table if not exists rutas (
  id           uuid primary key default gen_random_uuid(),
  jornada_id   uuid not null references jornadas (id) on delete cascade,
  numero       int not null,
  estado       text not null,                        -- texto libre: pueden aparecer estados nuevos (§17.4)
  hora_inicio  time,
  hora_fin     time,
  duracion_min int generated always as
                 ((extract(epoch from (hora_fin - hora_inicio)) / 60)::int) stored,
  unique (jornada_id, numero)
);

-- ---------------------------------------------------------------------------
-- Órdenes (pedidos). El pago es por pedido según su tramo de distancia (§13).
-- ---------------------------------------------------------------------------
create table if not exists ordenes (
  id          uuid primary key default gen_random_uuid(),
  jornada_id  uuid not null references jornadas (id) on delete cascade,
  ruta_id     uuid references rutas (id) on delete set null,
  codigo      text not null,
  estado      text not null,                         -- texto libre, igual que rutas.estado
  posicion    int not null,                          -- orden de aparición en la app de reparto
  tramo       smallint not null default 1 check (tramo between 1 and 6),
  km          numeric(6, 1),                         -- opcional; si se ingresa, el tramo se deriva solo
  monto       numeric(10, 2),                        -- se congela al cerrar la semana
  unique (jornada_id, codigo)
);

comment on column ordenes.tramo is
  'Tramos 1 a 5 de la tabla de §13. El 6 es el caso abierto "más de 12 km": la tabla no lo cubre, se marca a mano y exige monto manual hasta que se confirme la tarifa (§17.2).';
comment on column ordenes.estado is
  'Se guarda solo para estadísticas. NO afecta el monto: todos los pedidos se pagan, entregados o no, porque el recorrido se hizo igual (§13).';

-- ---------------------------------------------------------------------------
-- Reglas de pago: tarifas versionadas. Nunca se editan, se agrega una nueva,
-- para que un cambio de tarifa no altere semanas ya liquidadas (§13).
-- ---------------------------------------------------------------------------
create table if not exists reglas_pago (
  id             uuid primary key default gen_random_uuid(),
  tienda_id      uuid not null references tiendas (id) on delete cascade,
  vigente_desde  date not null,
  parametros     jsonb not null,
  created_at     timestamptz not null default now(),
  unique (tienda_id, vigente_desde)
);

comment on column reglas_pago.parametros is
  'Tramos de distancia y, si la tienda la paga, la garantía por permanencia. La garantía es un PISO, no un extra: al cerrar el día se paga el mayor de los dos, lo que sumaron los pedidos o lo que suma la permanencia.';

-- ---------------------------------------------------------------------------
-- Liquidaciones: una por driver y semana (lunes a domingo, America/Lima).
-- ---------------------------------------------------------------------------
create table if not exists liquidaciones (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  semana_inicio     date not null,                   -- lunes
  semana_fin        date not null,                   -- domingo
  fecha_pago        date not null,                   -- viernes siguiente al corte = semana_fin + 5
  regla_id          uuid references reglas_pago (id),
  total_rutas       int,
  total_ordenes     int,
  ordenes_por_tramo jsonb,                           -- {"1": 78, "2": 6, ...}
  monto_calculado   numeric(10, 2),
  detalle           jsonb,                           -- desglose por día y por ruta
  estado            text not null default 'abierta'
                      check (estado in ('abierta', 'cerrada', 'pagada')),
  monto_recibido    numeric(10, 2),                  -- lo que realmente le pagaron
  unique (user_id, semana_inicio)
);

-- ---------------------------------------------------------------------------
-- Cargas: auditoría de cada subida. Sirve además para medir el costo real de
-- API por driver y fijar el precio con margen (§12).
-- ---------------------------------------------------------------------------
create table if not exists cargas (
  id              uuid primary key default gen_random_uuid(),
  jornada_id      uuid references jornadas (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  imagenes        text[],                            -- rutas en Storage; vacío si no se conservan
  respuesta_cruda jsonb,
  modelo          text,
  tokens_entrada  int,
  tokens_salida   int,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Índices (§5)
-- ---------------------------------------------------------------------------
create index if not exists idx_jornadas_user_fecha  on jornadas (user_id, fecha desc);
create index if not exists idx_rutas_jornada        on rutas (jornada_id);
create index if not exists idx_ordenes_jornada      on ordenes (jornada_id);
create index if not exists idx_ordenes_codigo       on ordenes (codigo);
create index if not exists idx_liquidaciones_user   on liquidaciones (user_id, semana_inicio desc);
create index if not exists idx_cargas_user          on cargas (user_id, created_at desc);
create index if not exists idx_reglas_tienda        on reglas_pago (tienda_id, vigente_desde desc);

-- ---------------------------------------------------------------------------
-- updated_at automático en jornadas
-- ---------------------------------------------------------------------------
create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_jornadas_updated_at on jornadas;
create trigger trg_jornadas_updated_at
  before update on jornadas
  for each row execute function public.tocar_updated_at();

-- ===========================================================================
-- Row Level Security (§7)
--
-- Un driver nunca puede leer ni escribir datos de otro, ni siquiera llamando a
-- la API directamente. Las tablas hijas se filtran a través de jornada_id.
-- ===========================================================================

-- Helper security definer para evitar recursión al consultar perfiles desde
-- una política de la propia tabla perfiles.
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from perfiles
    where id = auth.uid() and rol = 'admin' and activo
  );
$$;

revoke execute on function public.es_admin() from public;
grant execute on function public.es_admin() to authenticated;

alter table tiendas       enable row level security;
alter table perfiles      enable row level security;
alter table jornadas      enable row level security;
alter table rutas         enable row level security;
alter table ordenes       enable row level security;
alter table reglas_pago   enable row level security;
alter table liquidaciones enable row level security;
alter table cargas        enable row level security;

-- --- perfiles -------------------------------------------------------------
-- El admin ve la lista de cuentas (§12) pero NO las jornadas ni los montos de
-- los demás: la privacidad entre compañeros es un argumento de venta (§12).
drop policy if exists perfiles_select on perfiles;
create policy perfiles_select on perfiles
  for select to authenticated
  using (id = auth.uid() or public.es_admin());

-- El driver solo puede tocar su propia fila. El cambio de rol, activo y
-- vigente_hasta pasa por un Server Action con service role (§12), nunca por aquí.
drop policy if exists perfiles_update_propio on perfiles;
create policy perfiles_update_propio on perfiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and rol = (select p.rol from perfiles p where p.id = auth.uid())
    and activo = (select p.activo from perfiles p where p.id = auth.uid())
    and vigente_hasta is not distinct from (select p.vigente_hasta from perfiles p where p.id = auth.uid())
  );

-- --- jornadas -------------------------------------------------------------
drop policy if exists jornadas_propias on jornadas;
create policy jornadas_propias on jornadas
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- --- rutas y ordenes: se filtran por la jornada dueña ----------------------
drop policy if exists rutas_de_jornadas_propias on rutas;
create policy rutas_de_jornadas_propias on rutas
  for all to authenticated
  using (exists (select 1 from jornadas j where j.id = rutas.jornada_id and j.user_id = auth.uid()))
  with check (exists (select 1 from jornadas j where j.id = rutas.jornada_id and j.user_id = auth.uid()));

drop policy if exists ordenes_de_jornadas_propias on ordenes;
create policy ordenes_de_jornadas_propias on ordenes
  for all to authenticated
  using (exists (select 1 from jornadas j where j.id = ordenes.jornada_id and j.user_id = auth.uid()))
  with check (exists (select 1 from jornadas j where j.id = ordenes.jornada_id and j.user_id = auth.uid()));

-- --- tiendas: las lee todo el mundo, las registra solo el admin (§12) ------
drop policy if exists tiendas_lectura on tiendas;
create policy tiendas_lectura on tiendas
  for select to authenticated
  using (true);

drop policy if exists tiendas_escritura_admin on tiendas;
create policy tiendas_escritura_admin on tiendas
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

-- --- reglas de pago: las lee todo el mundo, las escribe solo el admin ------
-- Las tarifas son las mismas para todos los drivers de una misma tienda,
-- pero cada tienda tiene las suyas (§13).
drop policy if exists reglas_lectura on reglas_pago;
create policy reglas_lectura on reglas_pago
  for select to authenticated
  using (true);

drop policy if exists reglas_escritura_admin on reglas_pago;
create policy reglas_escritura_admin on reglas_pago
  for insert to authenticated
  with check (public.es_admin());

-- --- liquidaciones --------------------------------------------------------
drop policy if exists liquidaciones_propias on liquidaciones;
create policy liquidaciones_propias on liquidaciones
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- --- cargas ---------------------------------------------------------------
drop policy if exists cargas_propias on cargas;
create policy cargas_propias on cargas
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ===========================================================================
-- Vista de resumen diario (§5). security_invoker para que la RLS de las tablas
-- de abajo se aplique al usuario que consulta, no al dueño de la vista.
-- ===========================================================================
-- Rutas y órdenes se agregan en CTEs separadas a propósito: unirlas en un solo
-- GROUP BY multiplicaría los minutos en ruta por la cantidad de pedidos.
create or replace view v_resumen_diario
with (security_invoker = on) as
with por_ruta as (
  select j.id as jornada_id,
         count(r.id)              as rutas,
         sum(r.duracion_min)      as minutos_en_ruta,
         min(r.hora_inicio)       as primera_salida,
         max(r.hora_fin)          as ultimo_regreso
  from jornadas j
  left join rutas r on r.jornada_id = j.id
  group by j.id
),
por_orden as (
  select j.id as jornada_id,
         count(o.id)                                as pedidos,
         coalesce(sum(o.monto), 0)                  as monto,
         count(o.id) filter (where o.tramo > 1)     as pedidos_fuera_tramo_1
  from jornadas j
  left join ordenes o on o.jornada_id = j.id
  group by j.id
)
select
  j.user_id,
  j.fecha,
  coalesce(pr.rutas, 0)                as rutas,
  coalesce(po.pedidos, 0)              as pedidos,
  coalesce(pr.minutos_en_ruta, 0)      as minutos_en_ruta,
  pr.primera_salida,
  pr.ultimo_regreso,
  coalesce(po.monto, 0)                as monto,
  coalesce(po.pedidos_fuera_tramo_1, 0) as pedidos_fuera_tramo_1,
  j.hora_entrada,
  j.hora_salida,
  j.entregado,
  j.parcial,
  j.no_entregado,
  j.validacion_ok
from jornadas j
left join por_ruta  pr on pr.jornada_id = j.id
left join por_orden po on po.jornada_id = j.id;

-- ===========================================================================
-- Tarifa inicial (§13). Versionada: para cambiarla se INSERTA una fila nueva
-- con otro vigente_desde, nunca se edita esta.
-- ===========================================================================
insert into tiendas (nombre) values ('Wong - Aldabas')
on conflict (nombre) do nothing;

-- La garantía por permanencia es un PISO, no un extra: al cerrar el día se paga
-- el mayor de los dos. Con 10 soles por hora y un turno de 9:00 a 22:00 son
-- 13 h → 130 soles de piso. Las horas se cuentan completas, hacia abajo.
insert into reglas_pago (tienda_id, vigente_desde, parametros)
select t.id, '2026-01-01', '{
    "moneda": "PEN",
    "base": "por_pedido",
    "tramos": [
      { "id": 1, "desde": 0,  "hasta": 3,  "monto": 10.00 },
      { "id": 2, "desde": 3,  "hasta": 8,  "monto": 11.50 },
      { "id": 3, "desde": 8,  "hasta": 10, "monto": 13.00 },
      { "id": 4, "desde": 10, "hasta": 11, "monto": 14.50 },
      { "id": 5, "desde": 11, "hasta": 12, "monto": 16.00 }
    ],
    "garantiaPermanencia": {
      "activa": true,
      "solesPorHora": 10.00,
      "comparacion": "diaria",
      "redondeoHoras": "abajo"
    }
  }'::jsonb
from tiendas t where t.nombre = 'Wong - Aldabas'
on conflict (tienda_id, vigente_desde) do nothing;
