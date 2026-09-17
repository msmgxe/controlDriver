import { TablaUsuarios } from "@/components/TablaUsuarios";
import { Cifras } from "@/components/ui";
import { COSTO_POR_IMAGEN_SOLES, listarUsuarios } from "@/lib/db/usuarios";

export const dynamic = "force-dynamic";

export default async function PaginaAdmin() {
  const usuarios = await listarUsuarios();

  const activos = usuarios.filter((u) => u.activo).length;
  const cargasMes = usuarios.reduce((s, u) => s + u.cargasDelMes, 0);
  const imagenesMes = usuarios.reduce((s, u) => s + u.imagenesDelMes, 0);
  const costoMes = imagenesMes * COSTO_POR_IMAGEN_SOLES;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[30px] leading-tight">Usuarios</h2>
        <p className="mt-1 max-w-[60ch] text-sm text-tinta-2">
          Cuentas, uso y costo de API. Aquí no aparecen las jornadas ni los montos de nadie: §12
          promete a los drivers que sus ingresos son privados, y las políticas de la base de datos
          lo hacen cumplir.
        </p>
      </div>

      <Cifras
        datos={[
          { etiqueta: "Drivers activos", valor: String(activos), pie: `de ${usuarios.length}` },
          { etiqueta: "Cargas este mes", valor: String(cargasMes) },
          { etiqueta: "Imágenes leídas", valor: String(imagenesMes) },
          { etiqueta: "Costo de API", valor: costoMes.toFixed(2), pie: "S/" },
        ]}
      />

      <TablaUsuarios usuarios={usuarios} costoPorImagen={COSTO_POR_IMAGEN_SOLES} />

      <section className="tarjeta">
        <span className="rotulo">Sobre el cambio de claves</span>
        <p className="mt-2 max-w-[70ch] text-sm text-tinta-2">
          Con el acceso por correo y código <b>no hay contraseñas que cambiar</b>. Si un driver no
          puede entrar, casi siempre es porque perdió el acceso a su buzón: la solución es
          corregirle el correo desde esta misma tabla. Desactivar una cuenta bloquea el acceso pero
          conserva todo su historial.
        </p>
      </section>
    </div>
  );
}
