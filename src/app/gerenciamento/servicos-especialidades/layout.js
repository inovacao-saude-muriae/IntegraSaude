import {
  usuarioTemAcessoModulo,
  usuarioTemPermissao,
  MODULOS,
} from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";
import { contextoDeLayoutOuLogin } from "@/lib/guardaLayout";

// Serviços e Especialidades, exibido no Gerenciamento: exige vínculo com a Junta.
// As escritas continuam exigindo permissão do módulo (servicosActions.js).
// `podeInativar` é a permissão NOMINAL JUNTA/servicos:inativar — o botão só
// aparece para quem a tem; o backend valida de novo em cada ação.
export default async function ServicosEspecialidadesLayout({ children }) {
  const ctx = await contextoDeLayoutOuLogin();
  const permitido = ctx && (await usuarioTemAcessoModulo(ctx.user, MODULOS.JUNTA));

  if (!permitido) {
    return <AcessoNegadoModulo modulo="Serviços e Especialidades" />;
  }

  return children;
}
