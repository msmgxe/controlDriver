-- ===========================================================================
-- Verificación de Row Level Security (§15)
--
-- Comprueba lo que §7 promete y §12 vende: **un driver no puede ver ni tocar
-- nada de otro**. Es la garantía más importante de la aplicación y la que peor
-- se detecta a ojo, porque una política mal escrita no da error: simplemente
-- devuelve datos que no debería.
--
-- Cómo correrlo: pégalo entero en el SQL Editor de Supabase. Se ejecuta dentro
-- de una transacción que **hace ROLLBACK al final**, así que no deja nada.
--
-- Si algo falla, el script se detiene con un mensaje que dice qué política está
-- mal. Si llega al final, imprime el resumen.
-- ===========================================================================

begin;

do $$
declare
  ana_id   uuid := '11111111-1111-1111-1111-111111111111';
  beto_id  uuid := '22222222-2222-2222-2222-222222222222';
  tienda   uuid;
  jornada_ana  uuid;
  jornada_beto uuid;
  ruta_ana uuid;
  visto    int;
  fallos   int := 0;
begin
  -- ---------------------------------------------------------------------
  -- Montaje. Se hace como superusuario, que es como entra el SQL Editor.
  -- ---------------------------------------------------------------------
  insert into auth.users (id, email, instance_id, aud, role)
  values (ana_id,  'ana.prueba@rutalog.test',  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
         (beto_id, 'beto.prueba@rutalog.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
  on conflict (id) do nothing;

  insert into tiendas (nombre) values ('Tienda de prueba')
  on conflict (nombre) do nothing;
  select id into tienda from tiendas where nombre = 'Tienda de prueba';

  insert into perfiles (id, email, nombre, rol, tienda_id, hora_entrada, hora_salida)
  values (ana_id,  'ana.prueba@rutalog.test',  'Ana',  'driver', tienda, '09:00', '22:00'),
         (beto_id, 'beto.prueba@rutalog.test', 'Beto', 'driver', tienda, '09:00', '22:00');

  insert into jornadas (user_id, fecha, ordenes_declaradas)
  values (ana_id, '2026-09-16', 2) returning id into jornada_ana;

  insert into jornadas (user_id, fecha, ordenes_declaradas)
  values (beto_id, '2026-09-16', 2) returning id into jornada_beto;

  insert into rutas (jornada_id, numero, estado, hora_inicio, hora_fin)
  values (jornada_ana, 1, 'Finalizado', '10:03', '10:27') returning id into ruta_ana;

  insert into ordenes (jornada_id, ruta_id, codigo, estado, posicion, tramo, monto)
  values (jornada_ana, ruta_ana, 'vANA00001wofp-01', 'Entregado', 1, 1, 10.00);

  insert into ordenes (jornada_id, codigo, estado, posicion, tramo, monto)
  values (jornada_beto, 'vBETO0001wofp-01', 'Entregado', 1, 1, 10.00);

  -- ---------------------------------------------------------------------
  -- A partir de aquí se actúa COMO ANA, igual que lo haría el navegador.
  -- ---------------------------------------------------------------------
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', ana_id, 'role', 'authenticated')::text, true);

  -- 1. Jornadas: Ana ve la suya y solo la suya.
  select count(*) into visto from jornadas;
  if visto <> 1 then
    raise warning 'FALLO · jornadas: Ana ve % filas, debería ver 1', visto;
    fallos := fallos + 1;
  else
    raise notice 'OK · jornadas: Ana solo ve la suya';
  end if;

  -- 2. Órdenes: las tablas hijas se filtran por la jornada dueña.
  select count(*) into visto from ordenes;
  if visto <> 1 then
    raise warning 'FALLO · ordenes: Ana ve % filas, debería ver 1', visto;
    fallos := fallos + 1;
  else
    raise notice 'OK · ordenes: Ana no ve los pedidos de Beto';
  end if;

  -- 3. Rutas: igual.
  select count(*) into visto from rutas;
  if visto <> 1 then
    raise warning 'FALLO · rutas: Ana ve % filas, debería ver 1', visto;
    fallos := fallos + 1;
  else
    raise notice 'OK · rutas: Ana no ve las rutas de Beto';
  end if;

  -- 4. Buscar por código ajeno no devuelve nada. Es el caso que más duele:
  --    si la tienda le pregunta a Ana por un pedido de Beto, no debe salir.
  select count(*) into visto from ordenes where codigo = 'vBETO0001wofp-01';
  if visto <> 0 then
    raise warning 'FALLO · Ana encuentra un pedido de Beto buscándolo por código';
    fallos := fallos + 1;
  else
    raise notice 'OK · buscar el código de Beto no devuelve nada';
  end if;

  -- 5. Perfiles: un driver no ve la ficha de otro (§12, privacidad).
  select count(*) into visto from perfiles;
  if visto <> 1 then
    raise warning 'FALLO · perfiles: Ana ve % fichas, debería ver 1 (la suya)', visto;
    fallos := fallos + 1;
  else
    raise notice 'OK · perfiles: Ana solo ve su ficha';
  end if;

  -- 6. Escritura: no puede modificar una jornada de Beto.
  update jornadas set notas = 'intrusión' where id = jornada_beto;
  get diagnostics visto = row_count;
  if visto <> 0 then
    raise warning 'FALLO · Ana pudo modificar % jornada(s) de Beto', visto;
    fallos := fallos + 1;
  else
    raise notice 'OK · Ana no puede modificar la jornada de Beto';
  end if;

  -- 7. Borrado: tampoco puede borrarla.
  delete from ordenes where jornada_id = jornada_beto;
  get diagnostics visto = row_count;
  if visto <> 0 then
    raise warning 'FALLO · Ana pudo borrar % pedido(s) de Beto', visto;
    fallos := fallos + 1;
  else
    raise notice 'OK · Ana no puede borrar los pedidos de Beto';
  end if;

  -- 8. Suplantación: no puede crear una jornada a nombre de Beto.
  begin
    insert into jornadas (user_id, fecha) values (beto_id, '2026-09-18');
    raise warning 'FALLO · Ana pudo crear una jornada a nombre de Beto';
    fallos := fallos + 1;
  exception when insufficient_privilege or check_violation then
    raise notice 'OK · Ana no puede crear jornadas a nombre de Beto';
  end;

  -- 9. Acciones de admin: un driver no puede tocar las tarifas.
  begin
    insert into reglas_pago (tienda_id, vigente_desde, parametros)
    values (tienda, '2030-01-01', '{"moneda":"PEN","base":"por_pedido","tramos":[]}'::jsonb);
    raise warning 'FALLO · Ana, que es driver, pudo insertar una regla de pago';
    fallos := fallos + 1;
  exception when insufficient_privilege or check_violation then
    raise notice 'OK · un driver no puede cambiar las tarifas';
  end;

  -- 10. Liquidaciones ajenas.
  begin
    insert into liquidaciones (user_id, semana_inicio, semana_fin, fecha_pago, estado)
    values (beto_id, '2026-09-14', '2026-09-20', '2026-09-25', 'abierta');
    raise warning 'FALLO · Ana pudo crear una liquidación a nombre de Beto';
    fallos := fallos + 1;
  exception when insufficient_privilege or check_violation then
    raise notice 'OK · Ana no puede crear liquidaciones a nombre de Beto';
  end;

  -- ---------------------------------------------------------------------
  -- Resumen
  -- ---------------------------------------------------------------------
  reset role;
  raise notice '---';
  if fallos = 0 then
    raise notice 'TODO CORRECTO · las 10 comprobaciones de RLS pasaron.';
  else
    -- Se corta con error a propósito: una RLS rota no puede pasar en silencio.
    raise exception 'RLS ROTA · % comprobación(es) fallaron. Busca las líneas "FALLO ·" de arriba.', fallos;
  end if;
end;
$$;

rollback;

-- ---------------------------------------------------------------------------
-- Si la inserción en auth.users falla
--
-- Algunas versiones de Supabase ponen restricciones extra en esa tabla. En ese
-- caso, crea a mano dos usuarios de prueba desde Authentication → Users, copia
-- sus UUID sobre `ana_id` y `beto_id` de arriba, y borra el bloque
-- `insert into auth.users`. El resto del script funciona igual.
-- ---------------------------------------------------------------------------
