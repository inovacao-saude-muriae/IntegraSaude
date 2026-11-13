import {
  carregarContextoAcesso,
  usuarioTemAcessoModulo,
  MODULOS,
} from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";

// Termos do CCZ, agora exibidos no Gerenciamento: GESTOR ∨ CCZ.
export default async function TermosLayout({ children }) {
  const ctx = await carregarContextoAcesso();
  const permitido =
    ctx &&
    (await usuarioTemAcessoModulo(ctx.user, MODULOS.CCZ));

  if (!permitido) {
    return <AcessoNegadoModulo modulo="Termos" />;
  }

  return children;
}
