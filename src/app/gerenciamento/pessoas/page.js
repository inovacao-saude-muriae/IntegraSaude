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
  const podeExcluir =
    ctx && (await usuarioTemPermissao(ctx.user, MODULOS.GESTAO, "pessoas", "excluir"));

  return <CadastroPessoas podeExcluir={podeExcluir} />;
}
