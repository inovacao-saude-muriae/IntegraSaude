import {
  carregarContextoAcesso,
  usuarioTemPermissao,
  usuarioTemAcessoModulo,
  MODULOS,
} from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";

// Cadastro de Pessoas (Tutor): GESTOR ∨ REGULACAO ∨ JUNTA ∨ FARMACIA ∨ PROCESSOS.
// É a MESMA tabela/tela de Paciente (cadastro único/EMPI); aqui só muda o rótulo,
// porque o público do CCZ reconhece "Tutor".
export default async function TutoresLayout({ children }) {
  const ctx = await carregarContextoAcesso();
  const permitido =
    ctx &&
    // Cadastro único (EMPI): a porta é a PERMISSÃO `pessoas:visualizar` do
    // módulo escolhido — inclusive Gestão Geral, que agora tem essa
    // funcionalidade no catálogo em vez de entrar por "ser gestor".
    (await usuarioTemPermissao(ctx.user, MODULOS.GESTAO, "pessoas", "visualizar")) ||
    (await usuarioTemPermissao(ctx.user, MODULOS.REGULACAO, "pessoas", "visualizar")) ||
    (await usuarioTemPermissao(ctx.user, MODULOS.JUNTA, "pessoas", "visualizar")) ||
    (await usuarioTemPermissao(ctx.user, MODULOS.FARMACIA, "pessoas", "visualizar")) ||
    (await usuarioTemPermissao(ctx.user, MODULOS.PROCESSOS, "pessoas", "visualizar"));

  if (!permitido) {
    return <AcessoNegadoModulo modulo="Tutor" />;
  }

  return children;
}
