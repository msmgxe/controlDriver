/**
 * En qué situación está la licencia, y qué se puede hacer en cada una.
 *
 * Cuatro estados, y ninguno es un caso especial: todos son estados de primera
 * clase con su comportamiento definido.
 *
 *   · **activa**    todo normal.
 *   · **gracia**    venció hace poco. Sigue funcionando entero, con aviso.
 *                   Existe porque alguien puede pasar una semana sin señal, y
 *                   dejarlo tirado a mitad de ruta por eso sería injusto.
 *   · **vencida**   pasó la gracia. Queda en **solo lectura**: puede ver y
 *                   exportar todo lo suyo, pero no cargar jornadas nuevas.
 *   · **sin_licencia**  nunca se activó.
 *
 * Por qué solo lectura y no bloqueo total: dentro hay meses de su trabajo.
 * Quitarle el acceso a sus propios datos por deber una cuota es agresivo, y a
 * la larga cuesta clientes. No poder registrar el día de hoy presiona
 * exactamente igual, y deja la puerta abierta a que vuelva.
 */
import type { Certificado } from "./token";

export type EstadoLicencia =
  | "activa"
  | "gracia"
  | "vencida"
  | "sin_licencia"
  /** El certificado es válido, pero de otro teléfono. */
  | "otro_dispositivo"
  /** Recién instalada, sin certificado: la prueba gratis de dos semanas. */
  | "prueba";

/**
 * Días de prueba desde la primera vez que se abre la app.
 *
 * Son dos semanas gratis, automáticas: quien la instala la usa entera desde el
 * primer minuto, sin esperar a que nadie le active nada. Alcanza para que un
 * compañero vea sus estadísticas de una semana completa y decida si le sirve,
 * sin regalar tanto como para que nunca llegue a pagar. Pasada la prueba, pide
 * su licencia (§ LICENCIAS.md). Reinstalar la reinicia, pero también borra todo
 * lo que tenía cargado, así que no sale a cuenta.
 */
const DIAS_DE_PRUEBA = 14;

export interface SituacionLicencia {
  estado: EstadoLicencia;
  /** Qué puede hacer: cargar jornadas nuevas o solo mirar. */
  puedeEscribir: boolean;
  /** Días que faltan para vencer. Negativo si ya venció. */
  diasRestantes: number;
  vigenteHasta: string | null;
  nombre: string;
  /** Los que concede el certificado, que no tienen por qué ser siempre 7. */
  diasDeGracia: number;
  /** Cuándo conviene empezar a avisar sin resultar pesado. */
  debeAvisar: boolean;
}

const DIA_EN_MS = 24 * 60 * 60 * 1000;

/** Días de antelación con que se empieza a avisar de la renovación. */
const DIAS_DE_AVISO = 5;

function aFecha(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  return Date.UTC(a, m - 1, d);
}

/** Diferencia en días entre dos fechas `YYYY-MM-DD`. */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aFecha(hasta) - aFecha(desde)) / DIA_EN_MS);
}

/**
 * Evalúa la licencia a día de hoy.
 *
 * `hoy` se pasa como argumento en vez de leerlo del reloj aquí dentro. Eso
 * permite dos cosas: probarlo sin tocar el reloj del sistema, y —más
 * importante— que quien llama use la fecha *corregida* de `fechaDeConfianza`,
 * que ya tiene en cuenta si alguien movió el reloj del celular hacia atrás.
 */
export function evaluarLicencia(
  certificado: Certificado | null,
  hoy: string,
  dispositivo?: string,
  pruebaDesde?: string | null,
): SituacionLicencia {
  /* Un certificado copiado de otro teléfono lleva firma buena —es auténtico—
     pero no es de aquí. Se distingue de "sin licencia" para poder decirle a la
     persona qué pasa: si no, quien lo recibió de buena fe de un compañero no
     entendería nada. */
  if (certificado && certificado.dispositivo && dispositivo &&
      certificado.dispositivo !== dispositivo) {
    return {
      estado: "otro_dispositivo",
      puedeEscribir: false,
      diasRestantes: 0,
      vigenteHasta: certificado.vigenteHasta,
      nombre: certificado.nombre,
      diasDeGracia: 0,
      debeAvisar: true,
    };
  }

  if (!certificado && pruebaDesde) {
    // El día que se instala cuenta como el primero: 14 días son hoy y 13 más.
    const quedan = DIAS_DE_PRUEBA - 1 - diasEntre(pruebaDesde, hoy);
    if (quedan >= 0) {
      return {
        estado: "prueba",
        puedeEscribir: true,
        diasRestantes: quedan,
        vigenteHasta: null,
        nombre: "",
        diasDeGracia: 0,
        debeAvisar: quedan <= DIAS_DE_AVISO,
      };
    }
  }

  if (!certificado) {
    return {
      estado: "sin_licencia",
      puedeEscribir: false,
      diasRestantes: 0,
      vigenteHasta: null,
      nombre: "",
      diasDeGracia: 0,
      debeAvisar: true,
    };
  }

  const diasRestantes = diasEntre(hoy, certificado.vigenteHasta);
  const dentroDeGracia = diasRestantes >= -certificado.diasDeGracia;

  const estado: EstadoLicencia =
    diasRestantes >= 0 ? "activa" : dentroDeGracia ? "gracia" : "vencida";

  return {
    estado,
    // En gracia se sigue pudiendo trabajar: es justo lo que la gracia significa.
    puedeEscribir: estado === "activa" || estado === "gracia",
    diasRestantes,
    vigenteHasta: certificado.vigenteHasta,
    nombre: certificado.nombre,
    diasDeGracia: certificado.diasDeGracia,
    debeAvisar: diasRestantes <= DIAS_DE_AVISO,
  };
}

/* ---------------------------------------------------------------------------
 * El reloj
 * ------------------------------------------------------------------------- */

/**
 * La fecha en la que se puede confiar.
 *
 * Atrasar el reloj del celular es la forma obvia de estirar una licencia
 * vencida, y no requiere ningún conocimiento técnico: son tres toques en
 * Ajustes. La defensa es simple y eficaz: se recuerda la fecha más alta que se
 * ha visto nunca, y si el reloj marca menos que eso, se ignora.
 *
 * El usuario honesto no lo nota jamás —su reloj solo avanza—. El que lo
 * atrasa consigue que la app se quede exactamente donde estaba, que es lo que
 * se busca; ni siquiera hace falta acusarlo de nada.
 *
 * No protege contra *adelantar* el reloj, pero adelantarlo no da licencia: la
 * caduca antes.
 */
export function fechaDeConfianza(
  delSistema: string,
  masAltaVista: string | null,
): string {
  if (!masAltaVista) return delSistema;
  return delSistema >= masAltaVista ? delSistema : masAltaVista;
}

/**
 * Texto para la persona, no para el registro.
 *
 * "Te quedan 3 días" se entiende; "vigenteHasta: 2026-10-31, estado: gracia"
 * no se lo dice a nadie que esté repartiendo.
 */
export function mensajeDeLicencia(situacion: SituacionLicencia): string {
  const { estado, diasRestantes } = situacion;

  if (estado === "prueba") {
    if (diasRestantes === 0) return "Hoy es el último día de tu prueba.";
    return `Te quedan ${diasRestantes} días de prueba gratis.`;
  }

  if (estado === "sin_licencia") {
    return "Tu prueba terminó. Puedes ver y exportar tus datos; para cargar días nuevos, activa tu licencia en Ajustes.";
  }

  if (estado === "otro_dispositivo") {
    return "Esta licencia pertenece a otro teléfono. Pide la tuya al administrador.";
  }

  if (estado === "vencida") {
    return "Tu mes venció. Puedes ver y exportar tus datos, pero no cargar jornadas nuevas.";
  }

  if (estado === "gracia") {
    const quedan = situacion.diasRestantes + situacion.diasDeGracia;
    return quedan <= 1
      ? "Tu mes venció. Hoy es el último día antes de que se bloquee la carga."
      : `Tu mes venció. Te quedan ${quedan} días para renovar.`;
  }

  if (diasRestantes === 0) return "Tu mes vence hoy.";
  if (diasRestantes === 1) return "Tu mes vence mañana.";
  return `Tu mes vence en ${diasRestantes} días.`;
}
