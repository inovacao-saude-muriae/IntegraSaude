import {
  carregarContextoAcesso,
  usuarioTemPermissao,
  MODULOS,
} from "@/lib/permissions";
import CadastroPessoas from "@/components/CadastroPessoas/CadastroPessoas";

// Tela de Cadastro de Pessoas do Gerenciamento: reaproveita a MESMA tela/CRUD
// compartilhada (também usada pela aba "Pacientes" da Regulação).
//
// A exclusão definitiva do cadastro central exige permissão PRÓPRIA
// (`pessoas:excluir` da Gestão Geral) — não é concedida a administradores de
// módulo. A tela só mostra o botão para quem tem; o backend revalida.
export default async function PessoasPage() {
  const ctx = await carregarContextoAcesso();
  const [podeExcluir, podeInativar, podeReativar] = ctx
    ? await Promise.all([
        usuarioTemPermissao(ctx.user, MODULOS.GESTAO, "pessoas", "excluir"),
        usuarioTemPermissao(ctx.user, MODULOS.GESTAO, "pessoas", "inativar"),
        usuarioTemPermissao(ctx.user, MODULOS.GESTAO, "pessoas", "reativar"),
      ])
    : [false, false, false];

  return (
    <CadastroPessoas
      podeExcluir={podeExcluir}
      podeInativar={podeInativar}
      podeReativar={podeReativar}
    />
  );
}
