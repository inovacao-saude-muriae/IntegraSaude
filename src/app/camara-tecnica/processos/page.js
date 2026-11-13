import {
  carregarContextoAcesso,
  usuarioTemPermissao,
  MODULOS,
} from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";
import ProcessosJudiciaisPage from "./ProcessosJudiciaisPage";

// Página de Processos Judiciais.
//
// O layout do módulo já exige o vínculo com PROCESSOS. Aqui a página calcula as
// flags de AÇÃO a partir do catálogo (`processo_judicial:visualizar/criar/editar/
// excluir`) e as entrega prontas ao componente — Client Components não importam
// `lib/permissions`. Cada ação é revalidada no backend por `requirePermissao`.
export default async function ProcessosPage() {
  const ctx = await carregarContextoAcesso();

  const podeVer =
    ctx &&
    (await usuarioTemPermissao(ctx.user, MODULOS.PROCESSOS, "processo_judicial", "visualizar"));
  if (!podeVer) return <AcessoNegadoModulo modulo="Processos Judiciais" />;

  const [podeCriar, podeEditar, podeExcluir] = await Promise.all([
    usuarioTemPermissao(ctx.user, MODULOS.PROCESSOS, "processo_judicial", "criar"),
    usuarioTemPermissao(ctx.user, MODULOS.PROCESSOS, "processo_judicial", "editar"),
    usuarioTemPermissao(ctx.user, MODULOS.PROCESSOS, "processo_judicial", "excluir"),
  ]);

  return (
    <ProcessosJudiciaisPage
      podeCriar={podeCriar}
      podeEditar={podeEditar}
      podeExcluir={podeExcluir}
    />
  );
}
