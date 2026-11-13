import {
  carregarContextoAcesso,
  usuarioTemPermissao,
  MODULOS,
} from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";

// Relatórios Gerais: EXCLUSIVO do GESTOR (junto com Gerenciar Usuários).
// Antes aceitava "admin de qualquer módulo"; depois passou a exigir "ser Gestor".
// Agora exige a PERMISSÃO `relatorios:visualizar` do módulo GESTAO — privilégio
// explícito, não implícito.
export default async function RelatoriosLayout({ children }) {
  const ctx = await carregarContextoAcesso();
  const permitido =
    ctx &&
    (await usuarioTemPermissao(ctx.user, MODULOS.GESTAO, "relatorios", "visualizar"));

  if (!permitido) {
    return <AcessoNegadoModulo modulo="Relatórios" />;
  }

  return children;
}
