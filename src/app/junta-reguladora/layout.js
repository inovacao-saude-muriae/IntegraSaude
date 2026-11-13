import {
  carregarContextoAcesso,
  usuarioTemAcessoModulo,
  usuarioTemAcessoServicoJunta,
  usuarioEhAdminModulo,
  usuarioTemPermissao,
  SUBTAB_PARA_SERVICO_JUNTA,
  MODULOS,
} from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";
import { JuntaPermProvider } from "./PermissoesJuntaContext";

// Gate server-side do módulo Junta Reguladora (fail-closed). Além da entrada no
// módulo, calcula os sub-serviços liberados (recorte por sub-serviço, §2.6) e
// injeta via JuntaPermProvider para a página bloquear as abas não permitidas.
export default async function JuntaReguladoraLayout({ children }) {
  const ctx = await carregarContextoAcesso();
  const permitido =
    ctx && (await usuarioTemAcessoModulo(ctx.user, MODULOS.JUNTA));

  if (!permitido) {
    return <AcessoNegadoModulo modulo="Junta Reguladora" />;
  }

  const subServicosPermitidos = [];
  for (const [subTab, enumServ] of Object.entries(SUBTAB_PARA_SERVICO_JUNTA)) {
    if (await usuarioTemAcessoServicoJunta(ctx.user, enumServ)) {
      subServicosPermitidos.push(subTab);
    }
  }

  const ehAdminJunta = await usuarioEhAdminModulo(ctx.user, MODULOS.JUNTA);

  // Aba "Pacientes" dentro da Junta replica EXATAMENTE a regra do cadastro de
  // pessoas do Gerenciamento/Regulação/Farmácia: GESTOR ∨ REGULACAO/ADMIN ∨
  // JUNTA/ADMIN (mesma expressão de requireAcessoPessoas em lib/auth.js e dos
  // outros layouts). NÃO afrouxa: as actions de pessoa exigem
  // requireAcessoPessoas.
  const podeGerenciarPessoas =
    (await usuarioTemPermissao(ctx.user, MODULOS.GESTAO, "pessoas", "editar")) ||
    (await usuarioEhAdminModulo(ctx.user, MODULOS.REGULACAO)) ||
    ehAdminJunta;

  return (
    <JuntaPermProvider
      subServicosPermitidos={subServicosPermitidos}
      ehAdminJunta={ehAdminJunta}
      podeGerenciarPessoas={podeGerenciarPessoas}
    >
      {children}
    </JuntaPermProvider>
  );
}
