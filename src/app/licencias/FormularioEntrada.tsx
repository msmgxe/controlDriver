"use client";

import { useActionState } from "react";

import { entrar } from "./acciones";

export function FormularioEntrada() {
  const [estado, accion, pendiente] = useActionState(entrar, { error: null });

  return (
    <form action={accion} className="tarjeta mx-auto mt-16 flex max-w-sm flex-col gap-3">
      <h2 className="text-lg font-semibold">Entrar al panel</h2>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="clave" className="text-sm font-semibold">
          Contraseña
        </label>
        <input
          id="clave"
          name="clave"
          type="password"
          autoFocus
          required
          className="min-h-11 rounded-btn border border-linea-fuerte bg-sup px-3 text-base"
        />
      </div>
      {estado.error && <p className="text-sm text-mal">{estado.error}</p>}
      <button type="submit" className="boton-principal" disabled={pendiente}>
        {pendiente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
