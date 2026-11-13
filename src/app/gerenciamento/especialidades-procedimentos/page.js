import Link from "next/link";
import {
  carregarContextoAcesso,
  usuarioTemPermissao,
  MODULOS,
} from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";
import CatalogoProcessosPage from "@/app/camara-tecnica/processos/especialidades/CatalogoProcessosPage";

// Gerenciamento → Especialidades e Procedimentos.
//
// A LOCALIZAÇÃO no menu Gerenciamento é só de apresentação: os dados e as
// permissões continuam sendo do módulo PROCESSOS (Câmara Técnica). Quem não
// tem vínculo/permissão no catálogo de Processos não entra aqui — ter
// Gerenciamento não concede nada.
export default async function EspecialidadesProcedimentosGerenciamentoPage() {
  const ctx = await carregarContextoAcesso();

  const podeVer =
    ctx &&
    ((await usuarioTemPermissao(
      ctx.user,
      MODULOS.PROCESSOS,
      "catalogo_especialidades",
      "visualizar",
    )) ||
      (await usuarioTemPermissao(
        ctx.user,
        MODULOS.PROCESSOS,
        "catalogo_procedimentos",
        "visualizar",
      )));
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
    <>
      <div
        style={{
          padding: "0.75rem 1.5rem 0",
          fontSize: "0.8rem",
          color: "#64748b",
        }}
      >
        <Link href="/admin/gerenciamento" style={{ color: "#1d4ed8", fontWeight: 600 }}>
          Gerenciamento
        </Link>{" "}
        › Especialidades e Procedimentos — cadastro da área Processos (Câmara Técnica).
      </div>
      <CatalogoProcessosPage
        podeCriarEspecialidade={podeCriarEspecialidade}
        podeEditarEspecialidade={podeEditarEspecialidade}
        podeInativarEspecialidade={podeInativarEspecialidade}
        podeCriarProcedimento={podeCriarProcedimento}
        podeEditarProcedimento={podeEditarProcedimento}
        podeInativarProcedimento={podeInativarProcedimento}
        podeVincular={podeVincular}
      />
    </>
  );
}
