import { requirePermissaoGestao } from "@/lib/auth";
import RelatorioAcessos from "@/components/admin/RelatorioAcessos";

export default async function AcessosPage() {
  await requirePermissaoGestao("acessos", "visualizar");

  return <RelatorioAcessos />;
}
