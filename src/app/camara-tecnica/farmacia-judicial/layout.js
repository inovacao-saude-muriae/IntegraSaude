import {
  carregarContextoAcesso,
  usuarioTemAcessoModulo,
  usuarioEhGestor,
  usuarioEhAdminModulo,
  MODULOS,
} from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";
import { FarmaciaJudicialPermProvider } from "./PermissoesFarmaciaJudicialContext";

// Gate server-side do módulo Farmácia Judicial (fail-closed).
export default async function FarmaciaJudicialLayout({ children }) {
  const ctx = await carregarContextoAcesso();
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
    (await usuarioEhGestor(ctx.user)) ||
    (await usuarioEhAdminModulo(ctx.user, MODULOS.REGULACAO)) ||
    (await usuarioEhAdminModulo(ctx.user, MODULOS.JUNTA));

  return (
    <FarmaciaJudicialPermProvider podeGerenciarPessoas={podeGerenciarPessoas}>
      {children}
    </FarmaciaJudicialPermProvider>
  );
}
