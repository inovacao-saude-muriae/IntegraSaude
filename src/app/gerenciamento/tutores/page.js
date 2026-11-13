import {
  carregarContextoAcesso,
  usuarioTemPermissao,
  MODULOS,
} from "@/lib/permissions";
import TutoresGerenciamento from "./TutoresGerenciamento";

// Gerenciamento → Tutores.
//
// A autorização de ENTRADA fica no layout (módulo/permissão). Aqui só se decide
// o que a tela mostra: a ação destrutiva aparece apenas para quem tem
// `ccz_tutores:excluir` — e a server action revalida no backend.
export default async function TutoresPage() {
  const ctx = await carregarContextoAcesso();
  // Excluir o VÍNCULO de tutor é do CCZ (ccz_tutores:excluir).
  const podeExcluirTutor =
    ctx && (await usuarioTemPermissao(ctx.user, MODULOS.CCZ, "tutores", "excluir"));
  // Excluir a PESSOA é outra operação, com permissão própria da Gestão Geral.
  const podeExcluirPessoa =
    ctx && (await usuarioTemPermissao(ctx.user, MODULOS.GESTAO, "pessoas", "excluir"));

  return (
    <TutoresGerenciamento
      podeExcluir={podeExcluirTutor}
      podeExcluirPessoa={podeExcluirPessoa}
    />
  );
}
