"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { hoyEnLima } from "@/lib/fechas";
import {
  anotarFecha,
  certificadoGuardado,
  fechaMasAltaVista,
  identificadorDelDispositivo,
  inicioDePrueba,
} from "@/lib/licencia/almacen";
import { evaluarLicencia, fechaDeConfianza, type SituacionLicencia } from "@/lib/licencia/estado";
import { CLAVE_PUBLICA } from "@/lib/licencia/clave-publica";
import { importarClavePublica, verificarCertificado } from "@/lib/licencia/token";

/**
 * Estado de la licencia, disponible en toda la aplicación.
 *
 * Se resuelve una vez al arrancar y no se vuelve a mirar: comprobarlo en cada
 * pantalla sería trabajo repetido para un dato que cambia una vez al mes.
 */
const Contexto = createContext<SituacionLicencia | null>(null);

/** Mientras no haya servidor de licencias, la app corre en demostración. */
const DEMOSTRACION: SituacionLicencia = {
  estado: "activa",
  puedeEscribir: true,
  diasRestantes: 30,
  vigenteHasta: null,
  nombre: "",
  diasDeGracia: 7,
  debeAvisar: false,
};

export function ProveedorLicencia({ children }: { children: React.ReactNode }) {
  const [situacion, setSituacion] = useState<SituacionLicencia | null>(null);

  useEffect(() => {
    let vigente = true;

    (async () => {
      const resultado = await resolverLicencia();
      if (vigente) setSituacion(resultado);
    })().catch(() => {
      // Si algo falla al leer la licencia se deja pasar en vez de bloquear:
      // un fallo nuestro no puede dejar sin trabajar a quien sí ha pagado.
      if (vigente) setSituacion(DEMOSTRACION);
    });

    return () => {
      vigente = false;
    };
  }, []);

  return <Contexto.Provider value={situacion}>{children}</Contexto.Provider>;
}

async function resolverLicencia(): Promise<SituacionLicencia> {
  // Sin clave pública no hay nada que verificar: solo pasa en una compilación
  // hecha antes de crear las claves.
  if (!CLAVE_PUBLICA) return DEMOSTRACION;

  const [texto, dispositivo, masAlta] = await Promise.all([
    certificadoGuardado(),
    identificadorDelDispositivo(),
    fechaMasAltaVista(),
  ]);

  const hoy = fechaDeConfianza(hoyEnLima(), masAlta);
  await anotarFecha(hoy);
  const pruebaDesde = await inicioDePrueba(hoy);

  if (!texto) return evaluarLicencia(null, hoy, dispositivo, pruebaDesde);

  const clave = await importarClavePublica(CLAVE_PUBLICA);
  const certificado = await verificarCertificado(texto, clave);
  return evaluarLicencia(certificado, hoy, dispositivo, pruebaDesde);
}

/**
 * La situación de la licencia.
 *
 * Devuelve null mientras se resuelve. Quien lo use debe tratar ese caso como
 * "todavía no sé", no como "no tiene licencia": bloquear durante el medio
 * segundo que tarda sería un parpadeo feo y alarmante.
 */
export function useLicencia(): SituacionLicencia | null {
  return useContext(Contexto);
}

/** ¿Puede cargar jornadas nuevas? Mientras se resuelve, se asume que sí. */
export function usePuedeEscribir(): boolean {
  const situacion = useContext(Contexto);
  return situacion === null ? true : situacion.puedeEscribir;
}
