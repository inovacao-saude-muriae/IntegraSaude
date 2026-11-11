import {
  carregarContextoAcesso,
  usuarioEhGestor,
} from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";

// Relatórios Gerais: EXCLUSIVO do GESTOR (junto com Gerenciar Usuários).
// Antes aceitava "admin de qualquer módulo"; a regra passou a ser só Gestor.
export default async function RelatoriosLayout({ children }) {
  const ctx = await carregarContextoAcesso();
  const permitido = ctx && (await usuarioEhGestor(ctx.user));

  if (!permitido) {
    return <AcessoNegadoModulo modulo="Relatórios" />;
  }

  return children;
}
