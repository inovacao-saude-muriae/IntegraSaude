import { usuarioTemAcessoModulo, MODULOS } from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";
import { contextoDeLayoutOuLogin } from "@/lib/guardaLayout";

// Gate server-side do módulo CCZ / Zoonoses (fail-closed).
export default async function CczLayout({ children }) {
  // Sem sessão válida o helper manda para o login (não é "acesso negado").
  const ctx = await contextoDeLayoutOuLogin();
  const permitido = await usuarioTemAcessoModulo(ctx.user, MODULOS.CCZ);

  if (!permitido) {
    return <AcessoNegadoModulo modulo="CCZ" />;
  }

  return children;
}
