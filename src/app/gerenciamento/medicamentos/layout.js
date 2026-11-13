import {
  usuarioTemAcessoModulo,
  MODULOS,
} from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";
import { contextoDeLayoutOuLogin } from "@/lib/guardaLayout";

// Medicamentos (catálogo da Farmácia Judicial), agora exibido no Gerenciamento:
// GESTOR ∨ FARMACIA. As escritas continuam exigindo admin da Farmácia.
export default async function MedicamentosLayout({ children }) {
  const ctx = await contextoDeLayoutOuLogin();
  const permitido =
    ctx &&
    (await usuarioTemAcessoModulo(ctx.user, MODULOS.FARMACIA));

  if (!permitido) {
    return <AcessoNegadoModulo modulo="Medicamentos" />;
  }

  return children;
}
