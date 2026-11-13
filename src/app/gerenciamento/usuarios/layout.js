import {
  usuarioTemPermissao,
  MODULOS,
} from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";
import { contextoDeLayoutOuLogin } from "@/lib/guardaLayout";

// Gerenciar Usuários: permissão `usuarios:visualizar` do módulo GESTAO.
// Antes era "ser GESTOR"; agora é privilégio explícito, concedido e retirado
// pela própria tela de acessos.
export default async function GerenciarUsuariosLayout({ children }) {
  const ctx = await contextoDeLayoutOuLogin();
  const permitido =
    ctx && (await usuarioTemPermissao(ctx.user, MODULOS.GESTAO, "usuarios", "visualizar"));

  if (!permitido) {
    return <AcessoNegadoModulo modulo="Gerenciar Usuários" />;
  }

  return children;
}
