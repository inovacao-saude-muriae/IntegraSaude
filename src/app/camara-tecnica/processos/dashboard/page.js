import { carregarContextoAcesso, usuarioTemAcessoModulo, MODULOS } from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";
import DashboardProcessos from "./DashboardProcessos";

// Dashboard de Processos Judiciais — Câmara Técnica › Processos › Dashboard.
// A barreira de módulo é feita aqui (server) e cada consulta agregada refaz a
// checagem de permissão no backend (`requirePermissao(PROCESSOS,
// "processo_judicial", "visualizar")`).
export default async function DashboardProcessosPage() {
  const ctx = await carregarContextoAcesso();
  const permitido = ctx && (await usuarioTemAcessoModulo(ctx.user, MODULOS.PROCESSOS));
  if (!permitido) return <AcessoNegadoModulo modulo="Processos Judiciais" />;

  return <DashboardProcessos />;
}
