import {
  carregarContextoAcesso,
  usuarioTemAcessoModulo,
  usuarioEhAdminModulo,
  usuarioEhGestor,
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

  // Nesta etapa as duas flags coincidem (admin ∨ gestor); nomeadas em separado
  // para a Etapa 2 poder divergi-las sem refatorar o provider (design §6.2).
  const adminOuGestor =
    (await usuarioEhAdminModulo(ctx.user, MODULOS.REGULACAO)) ||
    (await usuarioEhGestor(ctx.user));

  // Aba "Pacientes" dentro da Regulação replica EXATAMENTE a regra do cadastro
  // de pessoas do Gerenciamento: GESTOR ∨ REGULACAO/ADMIN ∨ JUNTA/ADMIN
  // (ver gerenciamento/pessoas/layout.js e requireAcessoPessoas em lib/auth.js).
  const podeGerenciarPessoas =
    (await usuarioEhGestor(ctx.user)) ||
    (await usuarioEhAdminModulo(ctx.user, MODULOS.REGULACAO)) ||
    (await usuarioEhAdminModulo(ctx.user, MODULOS.JUNTA));

  // Aba "Auditoria de Alterações": SOMENTE GESTOR (não vale admin do módulo).
  const podeVerAuditoria = await usuarioEhGestor(ctx.user);

  return (
    <RegulacaoPermProvider
      podeEditarFinanceiro={adminOuGestor}
      podeGerenciarCatalogo={adminOuGestor}
      podeGerenciarPessoas={podeGerenciarPessoas}
      podeVerAuditoria={podeVerAuditoria}
    >
      {children}
    </RegulacaoPermProvider>
  );
}
