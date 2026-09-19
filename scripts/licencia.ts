/**
 * Emitir licencias de Rutas-A desde la terminal.
 *
 *   npm run licencia -- claves
 *       Crea el par de claves. Una sola vez en la vida del negocio.
 *
 *   npm run licencia -- emitir <código del teléfono> "<nombre>" [meses]
 *       Firma un certificado. Por defecto, 1 mes.
 *
 *   npm run licencia -- lista
 *       Quién tiene licencia y hasta cuándo.
 *
 * Mientras no exista el panel web, esto es el panel. Usa exactamente el mismo
 * código de firma que la app verifica —`src/lib/licencia/emitir.ts`, con sus
 * pruebas—, así que no hay dos implementaciones que puedan desalinearse.
 *
 * Lo que guarda, en ~/.rutas-a (fuera del proyecto, nunca en GitHub):
 *
 *   licencia-privada.jwk   la clave que firma. Si se filtra, cualquiera puede
 *                          fabricarse licencias. Si se pierde, no se pueden
 *                          renovar las que hay. GUARDA UNA COPIA.
 *   licencias.csv          el registro: quién, qué teléfono, hasta cuándo.
 */
import { existsSync, readFileSync, writeFileSync, appendFileSync, chmodSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  crearParDeClaves,
  emitirCertificado,
  importarClavePrivada,
  sumarMeses,
} from "../src/lib/licencia/emitir";

const DIR = join(homedir(), ".rutas-a");
const PRIVADA = join(DIR, "licencia-privada.jwk");
const REGISTRO = join(DIR, "licencias.csv");
const PUBLICA_EN_CODIGO = join(process.cwd(), "src/lib/licencia/clave-publica.ts");

function hoyEnLima(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
}

function salir(mensaje: string): never {
  console.error(`\n  ${mensaje}\n`);
  process.exit(1);
}

async function claves() {
  mkdirSync(DIR, { recursive: true, mode: 0o700 });
  if (existsSync(PRIVADA)) {
    salir(
      "Las claves ya existen. No se crean otras: invalidaría todas las licencias emitidas.",
    );
  }
  const { publica, privada } = await crearParDeClaves();
  writeFileSync(PRIVADA, JSON.stringify(privada));
  chmodSync(PRIVADA, 0o600);

  writeFileSync(
    PUBLICA_EN_CODIGO,
    `/**
 * Clave pública de las licencias. La genera \`npm run licencia -- claves\`.
 *
 * Es pública por diseño: sirve para **comprobar** firmas, no para crearlas.
 * Que alguien la lea no le permite fabricarse una licencia. La que firma vive
 * solo en ~/.rutas-a, en la Mac de quien administra.
 */
export const CLAVE_PUBLICA: JsonWebKey | null = ${JSON.stringify(publica)};
`,
  );
  console.log(`
  ✓ Claves creadas.

    Privada (firma):   ${PRIVADA}
    Pública (en la app): src/lib/licencia/clave-publica.ts

  Guarda una copia de la carpeta ~/.rutas-a en un sitio seguro —por ejemplo,
  tu Google Drive—. Si se pierde, no podrás renovar ninguna licencia.
`);
}

interface Linea {
  fecha: string;
  codigo: string;
  nombre: string;
  meses: number;
  hasta: string;
}

function leerRegistro(): Linea[] {
  if (!existsSync(REGISTRO)) return [];
  return readFileSync(REGISTRO, "utf8")
    .trim()
    .split("\n")
    .slice(1)
    .filter(Boolean)
    .map((l) => {
      const [fecha, codigo, nombre, meses, hasta] = l.split(";");
      return { fecha, codigo, nombre, meses: Number(meses), hasta };
    });
}

async function emitir(codigo: string | undefined, nombre: string | undefined, meses: number) {
  if (!codigo || !nombre) {
    salir('Uso: npm run licencia -- emitir <código del teléfono> "<nombre>" [meses]');
  }
  if (!existsSync(PRIVADA)) salir("Primero crea las claves: npm run licencia -- claves");
  if (!/^[0-9a-f-]{36}$/i.test(codigo)) {
    salir("Ese código no parece el de un teléfono. Cópialo de Ajustes → Tu licencia.");
  }
  if (!Number.isInteger(meses) || meses < 1 || meses > 24) salir("Meses: entre 1 y 24.");

  /* Se suma a lo que le quedaba: quien renueva antes de tiempo no pierde días,
     y quien paga tarde no recibe los que estuvo sin pagar. */
  const hoy = hoyEnLima();
  const previa = leerRegistro().filter((l) => l.codigo === codigo).at(-1);
  const hasta = sumarMeses(previa?.hasta ?? null, meses, hoy);

  const clave = await importarClavePrivada(JSON.parse(readFileSync(PRIVADA, "utf8")));
  const certificado = await emitirCertificado(
    {
      usuario: codigo,
      nombre,
      dispositivo: codigo,
      vigenteHasta: hasta,
      emitidoEn: new Date().toISOString(),
      diasDeGracia: 7,
    },
    clave,
  );

  if (!existsSync(REGISTRO)) writeFileSync(REGISTRO, "fecha;codigo;nombre;meses;hasta\n");
  appendFileSync(REGISTRO, `${hoy};${codigo};${nombre.replaceAll(";", ",")};${meses};${hasta}\n`);

  console.log(`
  ✓ Licencia de ${nombre}, válida hasta el ${hasta.split("-").reverse().join("/")}.

  Mándale este mensaje por WhatsApp:
  ──────────────────────────────────────────────────────────────
  Tu licencia de Rutas-A. Ábrela en Ajustes → Tu licencia → Pegar, y toca Activar:

  ${certificado}
  ──────────────────────────────────────────────────────────────
`);
}

function lista() {
  const porCodigo = new Map<string, Linea>();
  for (const l of leerRegistro()) porCodigo.set(l.codigo, l);
  if (porCodigo.size === 0) {
    console.log("\n  Todavía no has emitido ninguna licencia.\n");
    return;
  }
  const hoy = hoyEnLima();
  console.log("");
  for (const l of [...porCodigo.values()].sort((a, b) => a.hasta.localeCompare(b.hasta))) {
    const estado = l.hasta >= hoy ? "al día " : "VENCIDA";
    console.log(`  ${estado}  ${l.hasta}  ${l.nombre.padEnd(24)}  ${l.codigo.slice(0, 8)}…`);
  }
  console.log("");
}

const [orden, ...resto] = process.argv.slice(2);
if (orden === "claves") await claves();
else if (orden === "emitir") await emitir(resto[0], resto[1], Number(resto[2] ?? 1));
else if (orden === "lista") lista();
else salir('Órdenes: claves · emitir <código> "<nombre>" [meses] · lista');
