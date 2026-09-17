"use client";

import { useState, useTransition } from "react";

import {
  cambiarActivo,
  cambiarCorreo,
  cambiarHorario,
  cambiarTienda,
  cambiarVigencia,
  crearDriver,
  crearTienda,
} from "@/app/admin/acciones";
import { Alerta, Check, Equis } from "@/components/iconos";
import { formatearFecha, hoyEnLima } from "@/lib/fechas";
import type { TiendaAdmin, UsuarioAdmin } from "@/lib/db/usuarios";

/**
 * Tabla de cuentas y sus acciones (§12).
 *
 * Lo que se puede hacer desde aquí, dicho en los términos correctos: no hay
 * contraseñas que restablecer. El acceso es por correo y código, así que la
 * recuperación consiste en corregir el correo.
 */
export function TablaUsuarios({
  usuarios,
  tiendas,
  costoPorImagen,
}: {
  usuarios: UsuarioAdmin[];
  tiendas: TiendaAdmin[];
  costoPorImagen: number;
}) {
  const hoy = hoyEnLima();
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ tono: "bien" | "mal"; texto: string } | null>(null);
  const [alta, setAlta] = useState(false);
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [vigencia, setVigencia] = useState("");
  const [tienda, setTienda] = useState(false);
  const [nombreTienda, setNombreTienda] = useState("");

  function ejecutar(
    accion: () => Promise<{ ok: true; mensaje: string } | { ok: false; error: string }>,
  ) {
    setAviso(null);
    iniciar(async () => {
      const r = await accion();
      setAviso(r.ok ? { tono: "bien", texto: r.mensaje } : { tono: "mal", texto: r.error });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {aviso && (
        <div
          role="status"
          className={`flex gap-3 rounded-btn px-4 py-3 text-sm ${
            aviso.tono === "bien" ? "bg-bien-suave text-bien" : "bg-mal-suave text-mal"
          }`}
        >
          {aviso.tono === "bien" ? (
            <Check className="mt-0.5 size-[18px] shrink-0" />
          ) : (
            <Alerta className="mt-0.5 size-[18px] shrink-0" />
          )}
          <p>{aviso.texto}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="boton-sec" onClick={() => setAlta((v) => !v)}>
          {alta ? "Cancelar" : "Nuevo driver"}
        </button>
        <button type="button" className="boton-sec" onClick={() => setTienda((v) => !v)}>
          {tienda ? "Cancelar" : "Nueva tienda"}
        </button>
        <span className="text-xs text-tinta-3">
          {tiendas.length} tienda{tiendas.length === 1 ? "" : "s"} registrada
          {tiendas.length === 1 ? "" : "s"}
        </span>
      </div>

      {tienda && (
        <form
          className="tarjeta flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            ejecutar(async () => {
              const r = await crearTienda(nombreTienda);
              if (r.ok) {
                setNombreTienda("");
                setTienda(false);
              }
              return r;
            });
          }}
        >
          <div className="flex min-w-52 flex-1 flex-col gap-1.5">
            <label htmlFor="nueva-tienda" className="text-sm font-semibold">
              Nombre de la tienda
            </label>
            <input
              id="nueva-tienda"
              value={nombreTienda}
              onChange={(e) => setNombreTienda(e.target.value)}
              placeholder="Wong - Aldabas"
              required
              className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
            />
          </div>
          <button type="submit" className="boton-sec" disabled={pendiente}>
            {pendiente ? "Creando…" : "Registrar tienda"}
          </button>
          <p className="w-full text-xs text-tinta-3">
            Cada tienda tiene sus propias reglas de pago —tramos y, si la paga, la garantía por
            permanencia—. Se cargan luego en <span className="codigo">reglas_pago</span>.
          </p>
        </form>
      )}

      {alta && (
        <form
          className="tarjeta flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            ejecutar(async () => {
              const r = await crearDriver({
                nombre,
                email: correo,
                vigenteHasta: vigencia === "" ? null : vigencia,
              });
              if (r.ok) {
                setNombre("");
                setCorreo("");
                setVigencia("");
                setAlta(false);
              }
              return r;
            });
          }}
        >
          <div className="flex min-w-40 flex-1 flex-col gap-1.5">
            <label htmlFor="nuevo-nombre" className="text-sm font-semibold">
              Nombre
            </label>
            <input
              id="nuevo-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
            />
          </div>
          <div className="flex min-w-52 flex-1 flex-col gap-1.5">
            <label htmlFor="nuevo-correo" className="text-sm font-semibold">
              Correo
            </label>
            <input
              id="nuevo-correo"
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
              className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nueva-vigencia" className="text-sm font-semibold">
              Vigente hasta
            </label>
            <input
              id="nueva-vigencia"
              type="date"
              value={vigencia}
              onChange={(e) => setVigencia(e.target.value)}
              className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
            />
          </div>
          <button type="submit" className="boton-sec" disabled={pendiente}>
            {pendiente ? "Creando…" : "Crear cuenta"}
          </button>
          <p className="w-full text-xs text-tinta-3">
            Tiene que ser un buzón real: ahí le llega su código de acceso. No se genera ninguna
            contraseña.
          </p>
        </form>
      )}

      <div className="overflow-x-auto rounded-card border border-linea bg-sup">
        <table className="tabla min-w-[1180px]">
          <thead>
            <tr>
              <th>Driver</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Tienda</th>
              <th>Permanencia</th>
              <th>Última carga</th>
              <th className="num">Cargas del mes</th>
              <th className="num">Costo API</th>
              <th>Vigencia</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => {
              const vencida = u.vigenteHasta !== null && u.vigenteHasta < hoy;
              return (
                <tr key={u.id}>
                  <td>
                    <b>{u.nombre}</b>
                  </td>
                  <td>
                    <span className="codigo">{u.email}</span>
                  </td>
                  <td>
                    {u.rol === "admin" ? (
                      <span className="inline-flex items-center rounded-chip bg-acento-suave px-2 py-0.5 text-[10px] font-bold tracking-wide text-acento-tinta uppercase">
                        admin
                      </span>
                    ) : (
                      "driver"
                    )}
                  </td>
                  <td>
                    {u.activo ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-bien">
                        <Check className="size-[13px]" />
                        activa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-mal">
                        <Equis className="size-[13px]" />
                        desactivada
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    {u.tiendaNombre ?? <span className="text-tinta-3">sin asignar</span>}
                  </td>
                  <td className="whitespace-nowrap">
                    {u.horaEntrada && u.horaSalida ? (
                      <span className="codigo">
                        {u.horaEntrada}–{u.horaSalida}
                      </span>
                    ) : (
                      <span className="text-tinta-3">sin horario</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    {u.ultimaCarga ? formatearFecha(u.ultimaCarga.slice(0, 10)) : "—"}
                  </td>
                  <td className="num">{u.cargasDelMes}</td>
                  <td className="num">{(u.imagenesDelMes * costoPorImagen).toFixed(2)}</td>
                  <td className="whitespace-nowrap">
                    {u.vigenteHasta ? formatearFecha(u.vigenteHasta) : "sin límite"}
                    {vencida && (
                      <span className="ml-1.5 inline-flex items-center rounded-chip bg-mal-suave px-2 py-0.5 text-[10px] font-bold tracking-wide text-mal uppercase">
                        vencida
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="min-h-8 rounded-chip border border-linea-fuerte px-3 text-xs font-semibold whitespace-nowrap hover:bg-sup-2"
                        disabled={pendiente}
                        onClick={() => {
                          const nuevo = prompt(`Nuevo correo para ${u.nombre}:`, u.email);
                          if (nuevo && nuevo !== u.email) {
                            ejecutar(() => cambiarCorreo(u.id, nuevo));
                          }
                        }}
                      >
                        Correo
                      </button>
                      <button
                        type="button"
                        className="min-h-8 rounded-chip border border-linea-fuerte px-3 text-xs font-semibold whitespace-nowrap hover:bg-sup-2"
                        disabled={pendiente}
                        onClick={() => {
                          const nueva = prompt(
                            `Vigente hasta (AAAA-MM-DD), vacío para sin límite:`,
                            u.vigenteHasta ?? "",
                          );
                          if (nueva !== null) {
                            ejecutar(() => cambiarVigencia(u.id, nueva === "" ? null : nueva));
                          }
                        }}
                      >
                        Vigencia
                      </button>
                      <button
                        type="button"
                        className="min-h-8 rounded-chip border border-linea-fuerte px-3 text-xs font-semibold whitespace-nowrap hover:bg-sup-2"
                        disabled={pendiente}
                        onClick={() => {
                          const opciones = tiendas
                            .map((t, i) => `${i + 1}. ${t.nombre}`)
                            .join("\n");
                          const elegida = prompt(
                            `Tienda de ${u.nombre}. Escribe el número, o 0 para quitarla:\n${opciones}`,
                            "",
                          );
                          if (elegida === null) return;
                          const n = Number(elegida);
                          if (n === 0) {
                            ejecutar(() => cambiarTienda(u.id, null));
                          } else if (n >= 1 && n <= tiendas.length) {
                            ejecutar(() => cambiarTienda(u.id, tiendas[n - 1].id));
                          }
                        }}
                      >
                        Tienda
                      </button>
                      <button
                        type="button"
                        className="min-h-8 rounded-chip border border-linea-fuerte px-3 text-xs font-semibold whitespace-nowrap hover:bg-sup-2"
                        disabled={pendiente}
                        onClick={() => {
                          const entrada = prompt(
                            `Hora de entrada de ${u.nombre} (HH:MM), vacío para quitar el horario:`,
                            u.horaEntrada ?? "09:00",
                          );
                          if (entrada === null) return;
                          if (entrada === "") {
                            ejecutar(() => cambiarHorario(u.id, null, null));
                            return;
                          }
                          const salida = prompt(
                            `Hora de salida de ${u.nombre} (HH:MM):`,
                            u.horaSalida ?? "22:00",
                          );
                          if (salida === null) return;
                          ejecutar(() => cambiarHorario(u.id, entrada, salida));
                        }}
                      >
                        Horario
                      </button>
                      <button
                        type="button"
                        className="min-h-8 rounded-chip border border-mal/40 px-3 text-xs font-semibold whitespace-nowrap text-mal hover:bg-sup-2"
                        disabled={pendiente}
                        onClick={() => ejecutar(() => cambiarActivo(u.id, !u.activo))}
                      >
                        {u.activo ? "Desactivar" : "Reactivar"}
                      </button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
