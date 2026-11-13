import { redirect } from "next/navigation";
import { carregarContextoAcesso } from "@/lib/permissions";

/**
 * Contexto para os layouts que protegem módulos.
 *
 * Sem sessão válida não existe "acesso negado" a exibir: a sessão expirou ou
 * foi revogada (logout, senha alterada em outro lugar), então o destino é o
 * login. O layout é a última barreira — o proxy já cobre a navegação, mas
 * confiar só nele deixaria uma tela renderizada com dados públicos caso o
 * proxy fosse contornado.
 *
 * Retorna o contexto quando a sessão é válida.
 */
export async function contextoDeLayoutOuLogin() {
  const ctx = await carregarContextoAcesso();
  if (!ctx) redirect("/login");
  return ctx;
}
