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

  // Gerenciar Usuários dentro da Regulação replica EXATAMENTE a regra do
  // Gerenciamento: só GESTOR (ver gerenciamento/usuarios/layout.js).
  const podeGerenciarUsuarios = await usuarioEhGestor(ctx.user);

  return (
    <RegulacaoPermProvider
      podeEditarFinanceiro={adminOuGestor}
      podeGerenciarCatalogo={adminOuGestor}
      podeGerenciarUsuarios={podeGerenciarUsuarios}
    >
      {children}
    </RegulacaoPermProvider>
  );
}
