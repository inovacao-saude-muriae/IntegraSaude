import {
  usuarioTemAcessoModulo,
  usuarioTemPermissao,
  usuarioEhAdminModulo,
  MODULOS,
} from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";
import { FarmaciaJudicialPermProvider } from "./PermissoesFarmaciaJudicialContext";
import { contextoDeLayoutOuLogin } from "@/lib/guardaLayout";

// Gate server-side do módulo Farmácia Judicial (fail-closed).
export default async function FarmaciaJudicialLayout({ children }) {
  const ctx = await contextoDeLayoutOuLogin();
  const permitido =
    ctx && (await usuarioTemAcessoModulo(ctx.user, MODULOS.FARMACIA));

  if (!permitido) {
    return <AcessoNegadoModulo modulo="Farmácia Judicial" />;
  }

  // Aba "Pacientes" dentro da Farmácia Judicial replica EXATAMENTE a regra do
  // cadastro de pessoas do Gerenciamento/Regulação: GESTOR ∨ REGULACAO/ADMIN ∨
  // JUNTA/ADMIN (mesma expressão de requireAcessoPessoas em lib/auth.js e de
  // regulacao/layout.js). NÃO inclui FARMACIA: as actions de pessoa exigem
  // requireAcessoPessoas, que não cobre FARMACIA — gatear por FARMACIA
  // afrouxaria a visibilidade.
  const podeGerenciarPessoas =
    (await usuarioTemPermissao(ctx.user, MODULOS.GESTAO, "pessoas", "editar")) ||
    (await usuarioEhAdminModulo(ctx.user, MODULOS.REGULACAO)) ||
    (await usuarioEhAdminModulo(ctx.user, MODULOS.JUNTA));

  // Exclusão de processo: só administrador do módulo (requireAdminModulo).
  const podeExcluirProcesso = await usuarioEhAdminModulo(ctx.user, MODULOS.FARMACIA);

  // Edição do processo segue a permissão nominal do catálogo (FARMACIA >
  // Pacientes > editar), como o botão "Editar" da aba Pacientes. O backend
  // revalida com a mesma permissão.
  const podeEditarProcesso = await usuarioTemPermissao(
    ctx.user,
    MODULOS.FARMACIA,
    "pacientes",
    "editar",
  );

  return (
    <FarmaciaJudicialPermProvider
      podeGerenciarPessoas={podeGerenciarPessoas}
      podeExcluirProcesso={podeExcluirProcesso}
      podeEditarProcesso={podeEditarProcesso}
    >
      {children}
    </FarmaciaJudicialPermProvider>
  );
}
