import { requireGestor } from "@/lib/auth";
import RelatorioAcessos from "@/components/admin/RelatorioAcessos";

export default async function AcessosPage() {
  await requireGestor();

  return <RelatorioAcessos />;
}
