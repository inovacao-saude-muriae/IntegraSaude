import {
  carregarContextoAcesso,
  usuarioEhGestor,
  usuarioTemAcessoModulo,
  MODULOS,
} from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";

// Serviços e Especialidades, agora exibido no Gerenciamento: GESTOR ∨ JUNTA.
// As escritas continuam exigindo admin do módulo (servicosActions.js).
export default async function ServicosEspecialidadesLayout({ children }) {
  const ctx = await carregarContextoAcesso();
  const permitido =
    ctx &&
    ((await usuarioEhGestor(ctx.user)) ||
      (await usuarioTemAcessoModulo(ctx.user, MODULOS.JUNTA)));

  if (!permitido) {
    return <AcessoNegadoModulo modulo="Serviços e Especialidades" />;
  }

  return children;
}
