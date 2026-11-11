import {
  carregarContextoAcesso,
  usuarioEhGestor,
  usuarioTemAcessoModulo,
  MODULOS,
} from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";

// Animais do CCZ, agora exibidos no Gerenciamento: GESTOR ∨ CCZ.
export default async function AnimaisLayout({ children }) {
  const ctx = await carregarContextoAcesso();
  const permitido =
    ctx &&
    ((await usuarioEhGestor(ctx.user)) ||
      (await usuarioTemAcessoModulo(ctx.user, MODULOS.CCZ)));

  if (!permitido) {
    return <AcessoNegadoModulo modulo="Animais" />;
  }

  return children;
}
