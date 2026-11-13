import {
  usuarioTemAcessoModulo,
  MODULOS,
} from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";
import { contextoDeLayoutOuLogin } from "@/lib/guardaLayout";

// Animais do CCZ, agora exibidos no Gerenciamento: GESTOR ∨ CCZ.
export default async function AnimaisLayout({ children }) {
  const ctx = await contextoDeLayoutOuLogin();
  const permitido =
    ctx &&
    (await usuarioTemAcessoModulo(ctx.user, MODULOS.CCZ));

  if (!permitido) {
    return <AcessoNegadoModulo modulo="Animais" />;
  }

  return children;
}
