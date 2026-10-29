import type { ReactNode } from "react";

export function Campo({ id, etiqueta, children }: { id: string; etiqueta: string; children: ReactNode }) {
  return (
    <div className="lic-campo">
      <label htmlFor={id}>{etiqueta}</label>
      {children}
    </div>
  );
}

/** Meses, monto y método: lo que se pide en cada pago, sea licencia nueva o renovación. */
export function CamposDePago({ prefijo, mesesInicial = "1" }: { prefijo: string; mesesInicial?: string }) {
  return (
    <>
      <Campo id={`${prefijo}-meses`} etiqueta="Meses pagados">
        <select id={`${prefijo}-meses`} name="meses" defaultValue={mesesInicial}>
          {["1", "2", "3", "6", "12"].map((m) => (
            <option key={m} value={m}>
              {m} {m === "1" ? "mes" : "meses"}
            </option>
          ))}
        </select>
      </Campo>
      <Campo id={`${prefijo}-monto`} etiqueta="Monto (S/)">
        <input id={`${prefijo}-monto`} name="monto" inputMode="decimal" placeholder="15" autoComplete="off" />
      </Campo>
      <Campo id={`${prefijo}-metodo`} etiqueta="Método">
        <input id={`${prefijo}-metodo`} name="metodo" list={`${prefijo}-metodos`} maxLength={20} placeholder="Yape" autoComplete="off" />
        <datalist id={`${prefijo}-metodos`}>
          <option value="Yape" />
          <option value="Plin" />
          <option value="Efectivo" />
        </datalist>
      </Campo>
    </>
  );
}
