-- ===========================================================================
-- Datos de prueba del entorno LOCAL
--
-- Rellena cuatro semanas de jornadas para que todas las pantallas tengan algo
-- que enseñar sin necesidad de subir capturas de verdad —que cuestan clave de
-- Anthropic y dinero por llamada.
--
-- Está pensado para poder ver, sin buscar, los casos que importan:
--
--   · 16/09  el caso de ejemplo de §16: 7 rutas, 14 pedidos, S/ 141.50
--   · 24/08, 09/09, 17/09  días flojos donde **gana la permanencia**
--   · 11/09  media jornada: se entra tarde y el piso baja
--   · domingos y un lunes sin cargar, para ver los huecos
--   · pedidos en tramo 2 y 3, y algún estado que no es "Entregado"
--
-- Se aplica solo con `supabase db reset`, nunca con `db push`. En producción
-- esta tabla nace vacía, como debe.
-- ===========================================================================

do $$
declare
  admin_id uuid;
  jid      uuid;
  rid      uuid;
  dia      record;
  i        int;
  r        int;
  reloj    int;      -- minutos desde medianoche
  dur      int;
  base     int;
  ajuste   int;
  tramo    int;
  estado   text;
  codigo   bigint := 12236800;
  n_ruta   int;
begin
  select id into admin_id from perfiles where email = 'msmgxe@gmail.com';
  if admin_id is null then
    raise notice 'No hay usuario admin: se salta la carga de datos de prueba.';
    return;
  end if;

  -- fecha, pedidos, rutas, minutos en ruta, cuántos de tramo 2, cuántos de
  -- tramo 3, hora de entrada, hora de salida
  for dia in
    select * from (values
      ('2026-08-24'::date, 11, 6, 149, 0, 0, '09:00'::time, '22:00'::time),
      ('2026-08-25', 14, 7, 181, 1, 0, '09:00', '22:00'),
      ('2026-08-26', 12, 6, 158, 0, 0, '09:00', '22:00'),
      ('2026-08-27', 16, 8, 199, 2, 0, '09:00', '22:00'),
      ('2026-08-28', 18, 9, 224, 1, 0, '09:00', '22:00'),
      ('2026-08-29', 20, 9, 241, 2, 1, '09:00', '22:00'),
      -- 30/08 domingo: no se trabaja
      ('2026-08-31', 12, 6, 155, 0, 0, '09:00', '22:00'),
      ('2026-09-01', 15, 7, 190, 1, 0, '09:00', '22:00'),
      ('2026-09-02', 13, 7, 172, 0, 0, '09:00', '22:00'),
      ('2026-09-03', 14, 7, 183, 1, 0, '09:00', '22:00'),
      ('2026-09-04', 18, 8, 221, 2, 0, '09:00', '22:00'),
      ('2026-09-05', 21, 10, 248, 2, 1, '09:00', '22:00'),
      -- 06/09 domingo
      ('2026-09-07', 12, 6, 151, 0, 0, '09:00', '22:00'),
      ('2026-09-08', 16, 8, 196, 1, 0, '09:00', '22:00'),
      ('2026-09-09',  9, 5, 121, 0, 0, '09:00', '22:00'),   -- gana la permanencia
      ('2026-09-10', 13, 7, 168, 0, 0, '09:00', '22:00'),
      ('2026-09-11', 11, 6, 140, 1, 0, '14:00', '22:00'),   -- media jornada
      ('2026-09-12', 19, 9, 232, 1, 1, '09:00', '22:00'),
      -- 13/09 domingo
      ('2026-09-14', 12, 6, 154, 0, 0, '09:00', '22:00'),
      ('2026-09-15', 16, 8, 197, 2, 0, '09:00', '22:00'),
      ('2026-09-16', 14, 7, 182, 1, 0, '09:00', '22:00'),   -- el caso de §16
      ('2026-09-17', 10, 5, 133, 0, 0, '09:00', '22:00')    -- gana la permanencia
      -- 18/09 es hoy: se deja vacío para ver el botón de cargar
    ) as t(fecha, pedidos, rutas, minutos, t2, t3, entrada, salida)
  loop
    insert into jornadas (
      user_id, fecha, rutas_declaradas, ordenes_declaradas,
      validacion_ok, tienda_id, hora_entrada, hora_salida
    )
    select admin_id, dia.fecha, dia.rutas, dia.pedidos, true, p.tienda_id, dia.entrada, dia.salida
    from perfiles p where p.id = admin_id
    returning id into jid;

    /* --- rutas ---
       Se reparten los minutos entre las rutas y se deja hueco entre una y otra,
       que es como sale en las capturas de verdad. El ajuste va a la última para
       que la suma cuadre exactamente con el total del día. */
    base := dia.minutos / dia.rutas;
    reloj := extract(hour from dia.entrada)::int * 60 + 30;  -- media hora tras fichar
    ajuste := dia.minutos - (base * dia.rutas);

    for r in 1..dia.rutas loop
      dur := base + case when r = dia.rutas then ajuste else 0 end;
      if dur < 9 then dur := 9; end if;

      insert into rutas (jornada_id, numero, estado, hora_inicio, hora_fin)
      values (
        jid, r, 'Finalizado',
        make_time((reloj / 60) % 24, reloj % 60, 0),
        make_time(((reloj + dur) / 60) % 24, (reloj + dur) % 60, 0)
      );
      reloj := reloj + dur + 18 + ((r * 11) % 26);
    end loop;

    /* --- pedidos ---
       Todos nacen en tramo 1, que es el caso normal; los de tramo 2 y 3 se
       reparten por el día, como las excepciones que son. */
    for i in 1..dia.pedidos loop
      codigo := codigo + 41 + (codigo % 17);
      n_ruta := ((i - 1) % dia.rutas) + 1;

      tramo := 1;
      if dia.t2 > 0 and i % greatest(dia.pedidos / greatest(dia.t2, 1), 1) = 2 and
         i <= dia.t2 * greatest(dia.pedidos / greatest(dia.t2, 1), 1) then
        tramo := 2;
      end if;
      if dia.t3 > 0 and i = dia.pedidos - 1 then
        tramo := 3;
      end if;

      -- Algún pedido que no se entregó, para que se vea que igual se paga.
      estado := case
        when dia.fecha = '2026-09-05' and i = 7  then 'Entrega parcial'
        when dia.fecha = '2026-08-28' and i = 12 then 'No entregado'
        when dia.fecha = '2026-09-12' and i = 4  then 'Entrega parcial'
        else 'Entregado'
      end;

      select id into rid from rutas where jornada_id = jid and numero = n_ruta;

      insert into ordenes (jornada_id, ruta_id, codigo, estado, posicion, tramo, monto)
      values (
        jid, rid, 'v' || codigo || 'wofp-01', estado, i, tramo,
        case tramo when 1 then 10.00 when 2 then 11.50 when 3 then 13.00 else 10.00 end
      );
    end loop;

    -- Los contadores de estado que muestran las capturas.
    update jornadas j set
      entregado    = (select count(*) from ordenes o where o.jornada_id = j.id and o.estado = 'Entregado'),
      parcial      = (select count(*) from ordenes o where o.jornada_id = j.id and o.estado = 'Entrega parcial'),
      no_entregado = (select count(*) from ordenes o where o.jornada_id = j.id and o.estado = 'No entregado')
    where j.id = jid;
  end loop;

  raise notice 'Datos de prueba cargados: % jornadas.',
    (select count(*) from jornadas where user_id = admin_id);
end;
$$;
