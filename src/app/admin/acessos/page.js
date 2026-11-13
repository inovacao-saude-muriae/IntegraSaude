import { requirePermissaoGestao } from "@/lib/auth";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";
import RelatorioAcessos from "@/components/admin/RelatorioAcessos";

// Relatório consolidado de acessos: exige `acessos:visualizar` da Gestão Geral.
// Sem a permissão, a tela mostra o aviso de acesso negado em vez de estourar um
// erro de servidor (a guarda continua sendo a barreira: nada é consultado).
export default async function AcessosPage() {
  try {
    await requirePermissaoGestao("acessos", "visualizar");
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) {
      return <AcessoNegadoModulo modulo="Gestão Geral" />;
    }
    throw error;
  }

  return <RelatorioAcessos />;
}
