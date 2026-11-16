import {
  usuarioTemAcessoModulo,
  usuarioTemAcessoServicoJunta,
  usuarioEhAdminModulo,
  usuarioTemPermissao,
  MODULOS,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";
import { JuntaPermProvider } from "./PermissoesJuntaContext";
import { contextoDeLayoutOuLogin } from "@/lib/guardaLayout";

// Gate server-side do módulo Junta Reguladora (fail-closed). Além da entrada no
// módulo, calcula os sub-serviços liberados (recorte por sub-serviço, §2.6) e
// injeta via JuntaPermProvider para a página bloquear as abas não permitidas.
export default async function JuntaReguladoraLayout({ children }) {
  const ctx = await contextoDeLayoutOuLogin();
  const permitido =
    ctx && (await usuarioTemAcessoModulo(ctx.user, MODULOS.JUNTA));

  if (!permitido) {
    return <AcessoNegadoModulo modulo="Junta Reguladora" />;
  }

  // Recorte por serviço: a lista vem do CADASTRO (junta_servicos), não de um
  // mapa fixo. Cada serviço é identificado pelo id — renomear não muda nada e
  // um serviço recém-cadastrado entra automaticamente na verificação.
  const servicosCadastrados = await prisma.servico.findMany({
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
  const subServicosPermitidos = [];
  const servicosPermitidos = [];
  for (const s of servicosCadastrados) {
    if (await usuarioTemAcessoServicoJunta(ctx.user, String(s.id))) {
      subServicosPermitidos.push(s.nome);
      servicosPermitidos.push({ id: s.id, nome: s.nome });
    }
  }

  const ehAdminJunta = await usuarioEhAdminModulo(ctx.user, MODULOS.JUNTA);

  // Inativar/reativar serviços e especialidades é permissão NOMINAL
  // (JUNTA/servicos:inativar), não herdada por quem só cadastra ou edita.
  const podeInativarServicos = await usuarioTemPermissao(
    ctx.user,
    MODULOS.JUNTA,
    "servicos",
    "inativar",
  );

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
      servicosPermitidos={servicosPermitidos}
      ehAdminJunta={ehAdminJunta}
      podeGerenciarPessoas={podeGerenciarPessoas}
      podeInativarServicos={podeInativarServicos}
    >
      {children}
    </JuntaPermProvider>
  );
}
