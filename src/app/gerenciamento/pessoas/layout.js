import {
  usuarioTemPermissao,
  usuarioTemAcessoModulo,
  MODULOS,
} from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";
import { contextoDeLayoutOuLogin } from "@/lib/guardaLayout";

// Cadastro de Pessoas (Paciente): GESTOR ∨ REGULACAO ∨ JUNTA ∨ FARMACIA ∨ PROCESSOS.
// Passou a ser um item do Gerenciamento visível a todos os módulos que usam o
// cadastro único (EMPI). O CCZ não entra: ele usa o item "Tutor".
export default async function PessoasLayout({ children }) {
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
    (await usuarioTemPermissao(ctx.user, MODULOS.PROCESSOS, "pessoas", "visualizar"));

  if (!permitido) {
    return <AcessoNegadoModulo modulo="Cadastro de Pessoas" />;
  }

  return children;
}
