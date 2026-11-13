import { redirect } from "next/navigation";

// Rota antiga do catálogo (era aberta dentro de Processos Judiciais).
// Preservada por compatibilidade: o catálogo agora vive em
// Gerenciamento → Especialidades e Procedimentos. O redirect NÃO decide
// autorização — a página de destino revalida as permissões de PROCESSOS.
export default function EspecialidadesProcedimentosRedirect() {
  redirect("/gerenciamento/especialidades-procedimentos");
}
