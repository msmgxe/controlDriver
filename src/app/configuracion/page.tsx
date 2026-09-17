import { Alerta, Check } from "@/components/iconos";
import { revisarConfiguracionCompleta } from "@/lib/configuracion";

export const metadata = { title: "Falta configurar" };
export const dynamic = "force-dynamic";

/**
 * Pantalla de "falta configurar el entorno".
 *
 * Existe para que un despliegue sin credenciales sea algo que se puede abrir y
 * entender —y que se puede instalar en el celular para probar la PWA— en vez de
 * un 500 sin explicación.
 */
export default function PaginaConfiguracion() {
  const { faltan } = revisarConfiguracionCompleta();

  const variables = [
    {
      nombre: "NEXT_PUBLIC_SUPABASE_URL",
      para: "La URL del proyecto. Project Settings → API.",
      bloquea: true,
    },
    {
      nombre: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      para: "La clave pública. Es la única que puede llegar al navegador.",
      bloquea: true,
    },
    {
      nombre: "SUPABASE_SERVICE_ROLE_KEY",
      para: "Solo servidor. Para dar de alta drivers desde /admin.",
      bloquea: false,
    },
    {
      nombre: "ANTHROPIC_API_KEY",
      para: "Solo servidor. Para leer las capturas.",
      bloquea: false,
    },
  ];

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="flex w-full max-w-lg flex-col gap-5">
        <div className="flex flex-col gap-1">
          <strong className="font-display text-[44px] leading-none font-extrabold tracking-tight">
            RutaLog
          </strong>
          <span className="text-sm text-tinta-2">Falta configurar el entorno.</span>
        </div>

        <div className="flex gap-3 rounded-btn bg-aviso-suave px-4 py-3 text-sm text-aviso">
          <Alerta className="mt-0.5 size-[18px] shrink-0" />
          <p>
            La aplicación está desplegada, pero todavía no sabe a qué base de datos hablar. Añade
            las variables que faltan y vuelve a desplegar.
          </p>
        </div>

        <ul className="flex flex-col gap-2">
          {variables.map((v) => {
            const falta = faltan.includes(v.nombre);
            return (
              <li
                key={v.nombre}
                className="flex items-start gap-3 rounded-card border border-linea bg-sup px-4 py-3"
              >
                <span className="mt-0.5 shrink-0">
                  {falta ? (
                    <Alerta className={`size-4 ${v.bloquea ? "text-mal" : "text-aviso"}`} />
                  ) : (
                    <Check className="size-4 text-bien" />
                  )}
                </span>
                <span className="flex min-w-0 flex-col">
                  <code className="codigo break-all">{v.nombre}</code>
                  <span className="text-xs text-tinta-3">{v.para}</span>
                  {falta && !v.bloquea && (
                    <span className="mt-1 text-xs text-tinta-2">
                      Sin esta se puede entrar y consultar, pero no {v.nombre.includes("ANTHROPIC") ? "cargar capturas" : "gestionar cuentas"}.
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="text-xs text-tinta-3">
          Los pasos completos —crear el proyecto, aplicar <span className="codigo">supabase/schema.sql</span> y
          configurar el acceso por código— están en el README del repositorio.
        </p>
      </div>
    </div>
  );
}
