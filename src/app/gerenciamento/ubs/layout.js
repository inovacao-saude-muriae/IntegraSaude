import {
  usuarioEhAdminModulo,
  MODULOS,
} from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";
import { contextoDeLayoutOuLogin } from "@/lib/guardaLayout";

// UBS: GESTOR ∨ REGULACAO/ADMIN (design §4.4).
export default async function UbsLayout({ children }) {
  const ctx = await contextoDeLayoutOuLogin();
  const permitido =
    ctx &&
    (await usuarioEhAdminModulo(ctx.user, MODULOS.REGULACAO));

  if (!permitido) {
    return <AcessoNegadoModulo modulo="UBS" />;
  }

  return children;
}
