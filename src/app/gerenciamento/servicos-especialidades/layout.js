import {
  usuarioTemAcessoModulo,
  MODULOS,
} from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";
import { contextoDeLayoutOuLogin } from "@/lib/guardaLayout";

// Serviços e Especialidades, agora exibido no Gerenciamento: GESTOR ∨ JUNTA.
// As escritas continuam exigindo admin do módulo (servicosActions.js).
export default async function ServicosEspecialidadesLayout({ children }) {
  const ctx = await contextoDeLayoutOuLogin();
  const permitido =
    ctx &&
    (await usuarioTemAcessoModulo(ctx.user, MODULOS.JUNTA));

  if (!permitido) {
    return <AcessoNegadoModulo modulo="Serviços e Especialidades" />;
  }

  return children;
}
