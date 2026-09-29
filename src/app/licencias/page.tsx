import { listarLicencias } from "@/lib/licencia/repositorio";
import { haySesion, panelConfigurado } from "@/lib/licencia/sesion";
import { tursoConfigurado } from "@/lib/licencia/turso";

import { FormularioEmitir } from "./FormularioEmitir";
import { FormularioEntrada } from "./FormularioEntrada";
import { TablaLicencias } from "./TablaLicencias";

export const dynamic = "force-dynamic";

function Aviso({ texto }: { texto: React.ReactNode }) {
  return (
    <div className="tarjeta mx-auto mt-16 max-w-md text-center text-sm text-tinta-2">{texto}</div>
  );
}

export default async function PaginaLicencias() {
  if (!panelConfigurado()) {
    return (
      <Aviso
        texto={
          <>
            Falta poner <span className="codigo">LICENCIAS_PASSWORD</span> en las variables de
            entorno del servidor. Mientras tanto, sigue usando{" "}
            <span className="codigo">npm run licencia</span> por la terminal.
          </>
        }
      />
    );
  }

  if (!(await haySesion())) return <FormularioEntrada />;

  if (!tursoConfigurado()) {
    return (
      <Aviso
        texto={
          <>
            Falta conectar Turso (<span className="codigo">TURSO_DATABASE_URL</span> y{" "}
            <span className="codigo">TURSO_AUTH_TOKEN</span>). Mientras tanto, sigue usando{" "}
            <span className="codigo">npm run licencia -- lista</span> por la terminal.
          </>
        }
      />
    );
  }

  const filas = await listarLicencias();
  return (
    <div className="flex flex-col gap-6">
      <FormularioEmitir />
      <TablaLicencias filas={filas} />
    </div>
  );
}
