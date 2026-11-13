import {
  carregarContextoAcesso,
  usuarioEhAdminModulo,
  MODULOS,
} from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";

// Médicos: GESTOR ∨ REGULACAO/ADMIN (design §4.4).
export default async function MedicosLayout({ children }) {
  const ctx = await carregarContextoAcesso();
  const permitido =
    ctx &&
    (await usuarioEhAdminModulo(ctx.user, MODULOS.REGULACAO));

  if (!permitido) {
    return <AcessoNegadoModulo modulo="Médicos" />;
  }

  return children;
}
