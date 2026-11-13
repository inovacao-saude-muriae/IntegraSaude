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
  const podeExcluir =
    ctx && (await usuarioTemPermissao(ctx.user, MODULOS.CCZ, "tutores", "excluir"));

  return <TutoresGerenciamento podeExcluir={podeExcluir} />;
}
