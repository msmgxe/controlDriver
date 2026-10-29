/** Lo que devuelven las server actions del panel (aparte: un archivo "use server" solo exporta funciones). */
export interface Resultado {
  codigo: string;
  hasta: string;
  /** El certificado suelto. */
  certificado: string;
  /** El texto completo, listo para pegar en WhatsApp. */
  mensaje: string;
}

export interface Estado {
  error: string | null;
  /** Aviso de éxito sin certificado (contacto guardado, pago anulado…). */
  aviso?: string | null;
  resultado?: Resultado | null;
}

export const ESTADO_VACIO: Estado = { error: null, aviso: null, resultado: null };
