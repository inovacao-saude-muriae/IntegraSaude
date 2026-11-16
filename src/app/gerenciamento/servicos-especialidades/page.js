import ServicosEspecialidadesTab from "@/app/junta-reguladora/ServicosEspecialidadesTab";
import { contextoDeLayoutOuLogin } from "@/lib/guardaLayout";
import { usuarioTemPermissao, MODULOS } from "@/lib/permissions";

// Tela "Serviços e Especialidades" do Gerenciamento: reaproveita a aba da Junta.
// O gate de entrada fica no layout; aqui só calculamos a permissão nominal de
// inativar, para o botão não aparecer para quem não pode.
export default async function ServicosEspecialidadesPage() {
  const ctx = await contextoDeLayoutOuLogin();
  const podeInativar = ctx
    ? await usuarioTemPermissao(ctx.user, MODULOS.JUNTA, "servicos", "inativar")
    : false;

  return <ServicosEspecialidadesTab podeInativar={podeInativar} />;
}
