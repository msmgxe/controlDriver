/**
 * Ajustes de la aplicación que la persona elige, guardados en la tabla
 * clave/valor `ajustes`.
 *
 * Por ahora son los de las comandas: qué se guarda del cliente de cada pedido y
 * cómo se calcula el tramo. Van en la base y no en el almacenamiento del
 * navegador por la misma razón que la licencia: ahí sobreviven a «borrar datos
 * de navegación».
 */
import { consultar, ejecutar } from "./conexion";

/**
 * Qué hacer con lo que se lee de una comanda.
 *
 * Nombre, dirección y teléfono son datos de **otra persona**, el cliente del
 * pedido. Por eso cada uno se puede apagar por separado, y nada se guarda sin
 * que la persona lo vea primero (`confirmarSiempre`). Lo único que la
 * distancia necesita es la dirección; sin ella, el tramo no se calcula solo.
 */
export interface AjustesDeComandas {
  guardarNombre: boolean;
  guardarDireccion: boolean;
  guardarTelefono: boolean;
  /** La foto de la comanda queda como evidencia del pedido. */
  guardarFoto: boolean;
  /** Revisar cada comanda antes de guardarla. Apagado, las que se leen con claridad se guardan juntas. */
  confirmarSiempre: boolean;
  /** Los datos de los clientes viajan en el respaldo. Apagado, el respaldo no lleva ninguno. */
  clientesEnRespaldo: boolean;
  /** Calcular el tramo con la distancia al cliente. Apagado, el tramo se elige a mano. */
  tramoAutomatico: boolean;
}

export const AJUSTES_DE_COMANDAS_POR_DEFECTO: AjustesDeComandas = {
  guardarNombre: true,
  guardarDireccion: true,
  guardarTelefono: true,
  guardarFoto: true,
  confirmarSiempre: true,
  // Privado por defecto: un respaldo se manda por WhatsApp y no tiene por qué
  // llevar los nombres y teléfonos de los clientes.
  clientesEnRespaldo: false,
  tramoAutomatico: true,
};

const CLAVES: Record<keyof AjustesDeComandas, string> = {
  guardarNombre: "comandas.guardar_nombre",
  guardarDireccion: "comandas.guardar_direccion",
  guardarTelefono: "comandas.guardar_telefono",
  guardarFoto: "comandas.guardar_foto",
  confirmarSiempre: "comandas.confirmar_siempre",
  clientesEnRespaldo: "comandas.clientes_en_respaldo",
  tramoAutomatico: "comandas.tramo_automatico",
};

/** Los ajustes de comandas; lo que nunca se tocó vale lo de por defecto. */
export async function leerAjustesDeComandas(): Promise<AjustesDeComandas> {
  const filas = await consultar<{ clave: string; valor: string }>(
    `select clave, valor from ajustes where clave like 'comandas.%'`,
  );
  const guardado = new Map(filas.map((f) => [f.clave, f.valor]));

  const ajustes = { ...AJUSTES_DE_COMANDAS_POR_DEFECTO };
  for (const nombre of Object.keys(CLAVES) as Array<keyof AjustesDeComandas>) {
    const valor = guardado.get(CLAVES[nombre]);
    if (valor === "1") ajustes[nombre] = true;
    else if (valor === "0") ajustes[nombre] = false;
  }
  return ajustes;
}

export async function guardarAjusteDeComandas(
  nombre: keyof AjustesDeComandas,
  valor: boolean,
): Promise<void> {
  await ejecutar(
    `insert into ajustes (clave, valor) values (?, ?)
     on conflict (clave) do update set valor = excluded.valor`,
    [CLAVES[nombre], valor ? "1" : "0"],
  );
}
