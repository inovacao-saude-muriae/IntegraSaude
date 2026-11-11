import {
  carregarContextoAcesso,
  usuarioEhGestor,
  usuarioTemAcessoModulo,
  MODULOS,
} from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";

// Cadastro de Pessoas (Paciente): GESTOR ∨ REGULACAO ∨ JUNTA ∨ FARMACIA ∨ PROCESSOS.
// Passou a ser um item do Gerenciamento visível a todos os módulos que usam o
// cadastro único (EMPI). O CCZ não entra: ele usa o item "Tutor".
export default async function PessoasLayout({ children }) {
  const ctx = await carregarContextoAcesso();
  const permitido =
    ctx &&
    ((await usuarioEhGestor(ctx.user)) ||
      (await usuarioTemAcessoModulo(ctx.user, MODULOS.REGULACAO)) ||
      (await usuarioTemAcessoModulo(ctx.user, MODULOS.JUNTA)) ||
      (await usuarioTemAcessoModulo(ctx.user, MODULOS.FARMACIA)) ||
      (await usuarioTemAcessoModulo(ctx.user, MODULOS.PROCESSOS)));

  if (!permitido) {
    return <AcessoNegadoModulo modulo="Cadastro de Pessoas" />;
  }

  return children;
}
