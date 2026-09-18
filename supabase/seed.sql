-- ===========================================================================
-- Semilla del entorno LOCAL
--
-- Se aplica sola al hacer `supabase db reset`, después de las migraciones.
-- Deja la base lista para entrar: tu cuenta de administrador, asignada a
-- "Wong - Aldabas" y con el horario de permanencia de 9:00 a 22:00.
--
-- ESTO ES SOLO PARA LOCAL. En producción las cuentas se crean desde /admin,
-- que usa `auth.admin.createUser` con la service role key (§12).
--
-- Cómo entrar una vez arrancado:
--   1. Abre la app y escribe tu correo en la pantalla de acceso.
--   2. El código NO llega a tu correo de verdad: el Supabase local captura los
--      envíos. Ábrelos en  http://127.0.0.1:54324  (Inbucket) y ahí verás el
--      código de 6 dígitos.
-- ===========================================================================

do $$
declare
  admin_id uuid := gen_random_uuid();
  admin_email text := 'msmgxe@gmail.com';
  tienda_id uuid;
begin
  -- La tienda y su tarifa ya vienen de la migración; solo se busca el id.
  select id into tienda_id from tiendas where nombre = 'Wong - Aldabas';

  -- Si el usuario ya existe (reset repetido), se reutiliza.
  select id into admin_id from auth.users where email = admin_email;

  if admin_id is null then
    admin_id := gen_random_uuid();

    insert into auth.users (
      id, instance_id, aud, role, email,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) values (
      admin_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', admin_email,
      -- Confirmado de entrada: sin esto el acceso por código lo rechaza.
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb
    );

    -- GoTrue necesita una identidad asociada para el proveedor de correo.
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      admin_id,
      json_build_object('sub', admin_id::text, 'email', admin_email)::jsonb,
      'email',
      admin_id::text,
      now(), now(), now()
    );
  end if;

  insert into perfiles (id, email, nombre, rol, activo, tienda_id, hora_entrada, hora_salida)
  values (admin_id, admin_email, 'Marco', 'admin', true, tienda_id, '09:00', '22:00')
  on conflict (id) do update
    set rol = 'admin',
        tienda_id = excluded.tienda_id,
        hora_entrada = excluded.hora_entrada,
        hora_salida = excluded.hora_salida;

  raise notice 'Listo. Entra con % y busca el código en http://127.0.0.1:54324', admin_email;
end;
$$;
