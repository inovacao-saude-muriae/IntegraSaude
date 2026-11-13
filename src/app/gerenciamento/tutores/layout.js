import {
  usuarioTemPermissao,
  usuarioTemAcessoModulo,
  MODULOS,
} from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";
import { contextoDeLayoutOuLogin } from "@/lib/guardaLayout";

// Cadastro de Pessoas (Tutor): GESTOR ∨ REGULACAO ∨ JUNTA ∨ FARMACIA ∨
// PROCESSOS ∨ CCZ.
// É a MESMA tabela/tela de Paciente (cadastro único/EMPI); aqui só muda o rótulo,
// porque o público do CCZ reconhece "Tutor". O CCZ entra pela funcionalidade
// `tutores` do próprio módulo (ccz_tutores:visualizar) — sem precisar de vínculo
// com Gestão Geral.
export default async function TutoresLayout({ children }) {
  const ctx = await contextoDeLayoutOuLogin();
  const permitido =
    ctx &&
    // Cadastro único (EMPI): a porta é a PERMISSÃO `pessoas:visualizar` do
    // módulo escolhido — inclusive Gestão Geral, que agora tem essa
    // funcionalidade no catálogo em vez de entrar por "ser gestor".
    (await usuarioTemPermissao(ctx.user, MODULOS.GESTAO, "pessoas", "visualizar")) ||
    (await usuarioTemPermissao(ctx.user, MODULOS.REGULACAO, "pessoas", "visualizar")) ||
    (await usuarioTemPermissao(ctx.user, MODULOS.JUNTA, "pessoas", "visualizar")) ||
    (await usuarioTemPermissao(ctx.user, MODULOS.FARMACIA, "pessoas", "visualizar")) ||
    (await usuarioTemPermissao(ctx.user, MODULOS.PROCESSOS, "pessoas", "visualizar")) ||
    // CCZ: o tutor é dado do CCZ. Entra pela permissão do próprio módulo,
    // nunca por "estar no Gerenciamento".
    (await usuarioTemPermissao(ctx.user, MODULOS.CCZ, "tutores", "visualizar")) ||
    (await usuarioTemPermissao(ctx.user, MODULOS.CCZ, "animais", "visualizar"));

  if (!permitido) {
    return <AcessoNegadoModulo modulo="Tutor" />;
  }

  return children;
}
