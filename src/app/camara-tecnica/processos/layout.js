import {
  usuarioTemAcessoModulo,
  MODULOS,
} from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";
import { contextoDeLayoutOuLogin } from "@/lib/guardaLayout";

// Gate server-side do módulo Processos (fail-closed).
export default async function ProcessosLayout({ children }) {
  const ctx = await contextoDeLayoutOuLogin();
  const permitido =
    ctx && (await usuarioTemAcessoModulo(ctx.user, MODULOS.PROCESSOS));

  if (!permitido) {
    return <AcessoNegadoModulo modulo="Processos" />;
  }

  return children;
}
