import {
  carregarContextoAcesso,
  usuarioEhGestor,
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
    ((await usuarioEhGestor(ctx.user)) ||
      (await usuarioTemAcessoModulo(ctx.user, MODULOS.REGULACAO)) ||
      (await usuarioTemAcessoModulo(ctx.user, MODULOS.JUNTA)) ||
      (await usuarioTemAcessoModulo(ctx.user, MODULOS.FARMACIA)) ||
      (await usuarioTemAcessoModulo(ctx.user, MODULOS.PROCESSOS)));

  if (!permitido) {
    return <AcessoNegadoModulo modulo="Tutor" />;
  }

  return children;
}
