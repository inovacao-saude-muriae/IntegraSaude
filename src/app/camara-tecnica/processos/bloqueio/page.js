import {
  carregarContextoAcesso,
  usuarioTemPermissao,
  MODULOS,
} from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";
import BloqueioJudicial from "./BloqueioJudicial";

// Realizar Bloqueio — Câmara Técnica › Processos Judiciais › Procedimentos
// Cirúrgicos › Realizar Bloqueio.
//
// O layout do módulo já exige vínculo com PROCESSOS. Aqui calculamos as flags
// de ação (`processo_judicial:visualizar/criar`); a operação é revalidada no
// backend por `criarBloqueio`.
export default async function BloqueioProcessosPage() {
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
    <BloqueioJudicial
      podeCriar={podeCriar}
      podeEditar={podeEditar}
      podeExcluir={podeExcluir}
    />
  );
}
