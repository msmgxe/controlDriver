"use client";

import { useState, useTransition } from "react";

import { cambiarActivo, cambiarCorreo, cambiarVigencia, crearDriver } from "@/app/admin/acciones";
import { Alerta, Check, Equis } from "@/components/iconos";
import { formatearFecha, hoyEnLima } from "@/lib/fechas";
import type { UsuarioAdmin } from "@/lib/db/usuarios";

/**
 * Tabla de cuentas y sus acciones (§12).
 *
 * Lo que se puede hacer desde aquí, dicho en los términos correctos: no hay
 * contraseñas que restablecer. El acceso es por correo y código, así que la
 * recuperación consiste en corregir el correo.
 */
export function TablaUsuarios({
  usuarios,
  costoPorImagen,
}: {
  usuarios: UsuarioAdmin[];
  costoPorImagen: number;
}) {
  const hoy = hoyEnLima();
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ tono: "bien" | "mal"; texto: string } | null>(null);
  const [alta, setAlta] = useState(false);
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [vigencia, setVigencia] = useState("");

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
      </div>

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
        <table className="tabla min-w-[980px]">
          <thead>
            <tr>
              <th>Driver</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Estado</th>
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
