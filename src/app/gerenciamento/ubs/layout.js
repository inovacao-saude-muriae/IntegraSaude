import {
  carregarContextoAcesso,
  usuarioEhAdminModulo,
  MODULOS,
} from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";

// UBS: GESTOR ∨ REGULACAO/ADMIN (design §4.4).
export default async function UbsLayout({ children }) {
  const ctx = await carregarContextoAcesso();
  const permitido =
    ctx &&
    (await usuarioEhAdminModulo(ctx.user, MODULOS.REGULACAO));

  if (!permitido) {
    return <AcessoNegadoModulo modulo="UBS" />;
  }

  return children;
}
