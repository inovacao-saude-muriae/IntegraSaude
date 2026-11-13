import {
  carregarContextoAcesso,
  usuarioTemAcessoModulo,
  usuarioEhAdminModulo,
  usuarioTemPermissao,
  MODULOS,
} from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";
import { RegulacaoPermProvider } from "./PermissoesRegulacaoContext";

// Gate server-side do módulo Regulação. Sem vínculo (ou contexto nulo por
// corrida) → bloqueia NO CONTEÚDO, preservando Header/Sidebar (fail-closed).
export default async function RegulacaoLayout({ children }) {
  const ctx = await carregarContextoAcesso();
  const permitido =
    ctx && (await usuarioTemAcessoModulo(ctx.user, MODULOS.REGULACAO));

  if (!permitido) {
    return <AcessoNegadoModulo modulo="Regulação" />;
  }

  // Flags vindas das PERMISSÕES EFETIVAS (não do nível do vínculo): a mesma
  // permissão que as server actions exigem, para a tela nunca mostrar um botão
  // que o backend vai recusar.
  const podeEditarFinanceiro = await usuarioTemPermissao(
    ctx.user, MODULOS.REGULACAO, "financeiro", "editar",
  );
  const podeGerenciarCatalogo =
    (await usuarioTemPermissao(ctx.user, MODULOS.REGULACAO, "procedimentos", "editar")) ||
    (await usuarioTemPermissao(ctx.user, MODULOS.REGULACAO, "medicos", "editar")) ||
    (await usuarioTemPermissao(ctx.user, MODULOS.REGULACAO, "ubs", "editar"));
  // Pode excluir de verdade um pedido (exceção). Sem isso, a interface oferece
  // CANCELAR — que é o padrão da Regulação.
  const podeExcluirPedido = await usuarioTemPermissao(
    ctx.user, MODULOS.REGULACAO, "novo_pedido", "excluir",
  );

  // Aba "Pacientes" dentro da Regulação replica EXATAMENTE a regra do cadastro
  // de pessoas do Gerenciamento: GESTOR ∨ REGULACAO/ADMIN ∨ JUNTA/ADMIN
  // (ver gerenciamento/pessoas/layout.js e requireAcessoPessoas em lib/auth.js).
  const podeGerenciarPessoas =
    (await usuarioTemPermissao(ctx.user, MODULOS.GESTAO, "pessoas", "editar")) ||
    (await usuarioEhAdminModulo(ctx.user, MODULOS.REGULACAO)) ||
    (await usuarioEhAdminModulo(ctx.user, MODULOS.JUNTA));

  // Aba "Auditoria de Alterações": GESTOR ∨ REGULACAO/ADMIN (regra revisada:
  // o admin da Regulação passou a ver a auditoria; antes era só Gestor).
  const podeVerAuditoria =
    (await usuarioTemPermissao(ctx.user, MODULOS.GESTAO, "auditoria", "visualizar")) ||
    (await usuarioEhAdminModulo(ctx.user, MODULOS.REGULACAO));

  return (
    <RegulacaoPermProvider
      podeEditarFinanceiro={podeEditarFinanceiro}
      podeGerenciarCatalogo={podeGerenciarCatalogo}
      podeGerenciarPessoas={podeGerenciarPessoas}
      podeVerAuditoria={podeVerAuditoria}
      podeExcluirPedido={podeExcluirPedido}
    >
      {children}
    </RegulacaoPermProvider>
  );
}
