import {
  carregarContextoAcesso,
  usuarioTemPermissao,
  MODULOS,
} from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";
import CatalogoProcessosPage from "./CatalogoProcessosPage";

// Catálogo próprio da área Processos (Câmara Técnica).
//
// O layout do módulo já exige vínculo com PROCESSOS. Aqui calculamos as flags
// de ação por funcionalidade do catálogo centralizado e as entregamos prontas
// ao componente — cada operação é revalidada no backend por requirePermissao.
// Usuário da Junta Reguladora não ganha acesso por isso: o vínculo exigido é
// com PROCESSOS.
export default async function EspecialidadesProcedimentosPage() {
  const ctx = await carregarContextoAcesso();

  const podeVer =
    ctx &&
    (await usuarioTemPermissao(
      ctx.user,
      MODULOS.PROCESSOS,
      "catalogo_especialidades",
      "visualizar",
    ));
  if (!podeVer) return <AcessoNegadoModulo modulo="Especialidades e Procedimentos" />;

  const [
    podeCriarEspecialidade,
    podeEditarEspecialidade,
    podeInativarEspecialidade,
    podeCriarProcedimento,
    podeEditarProcedimento,
    podeInativarProcedimento,
    podeVincular,
  ] = await Promise.all([
    usuarioTemPermissao(ctx.user, MODULOS.PROCESSOS, "catalogo_especialidades", "criar"),
    usuarioTemPermissao(ctx.user, MODULOS.PROCESSOS, "catalogo_especialidades", "editar"),
    usuarioTemPermissao(ctx.user, MODULOS.PROCESSOS, "catalogo_especialidades", "inativar"),
    usuarioTemPermissao(ctx.user, MODULOS.PROCESSOS, "catalogo_procedimentos", "criar"),
    usuarioTemPermissao(ctx.user, MODULOS.PROCESSOS, "catalogo_procedimentos", "editar"),
    usuarioTemPermissao(ctx.user, MODULOS.PROCESSOS, "catalogo_procedimentos", "inativar"),
    usuarioTemPermissao(ctx.user, MODULOS.PROCESSOS, "catalogo_procedimentos", "vincular"),
  ]);

  return (
    <CatalogoProcessosPage
      podeCriarEspecialidade={podeCriarEspecialidade}
      podeEditarEspecialidade={podeEditarEspecialidade}
      podeInativarEspecialidade={podeInativarEspecialidade}
      podeCriarProcedimento={podeCriarProcedimento}
      podeEditarProcedimento={podeEditarProcedimento}
      podeInativarProcedimento={podeInativarProcedimento}
      podeVincular={podeVincular}
    />
  );
}
