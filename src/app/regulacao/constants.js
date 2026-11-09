import { isCpfProvisorio, ROTULO_CPF_PROVISORIO } from "@/lib/cpf";

// Opções de status da comunicação com o paciente.
// Usadas tanto no select de gravação (Lista de Espera) quanto no filtro,
// garantindo que o valor gravado seja exatamente o valor filtrável.
export const STATUS_COMUNICACAO = [
  "Avisado",
  "Não quer",
  "Recusa",
  "Realizado",
  "Faleceu",
  "Mudou End.",
  "Liberado em outra APAC",
  "Outros",
  "Sem info",
];

// Opções de status do pedido de regulação.
export const STATUS_PEDIDO = [
  "Aguardando",
  "Liberado",
  "Cancelado",
  "Devolvido",
];

// Formata um CPF (11 dígitos) em 000.000.000-00; retorna o valor original se não bater.
// CPF provisório (T + 10 dígitos) é exibido como "CPF não informado".
export function formatarCpf(cpf) {
  if (isCpfProvisorio(cpf)) return ROTULO_CPF_PROVISORIO;
  const d = String(cpf || "").replace(/\D/g, "");
  if (d.length !== 11) return cpf || "";
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

// Documento a exibir na busca de paciente:
// mostra o CPF (formatado) se existir; caso contrário, o CNS; senão "—".
// Com CPF provisório mostra o CNS (se houver) ou "CPF não informado".
export function documentoPaciente({ cpf, cns } = {}) {
  const cnsProvisorio = String(cns || "").replace(/\D/g, "");
  if (isCpfProvisorio(cpf)) {
    return cnsProvisorio ? `CNS ${cnsProvisorio}` : ROTULO_CPF_PROVISORIO;
  }
  const cpfLimpo = String(cpf || "").replace(/\D/g, "");
  if (cpfLimpo) return formatarCpf(cpfLimpo);
  const cnsLimpo = String(cns || "").replace(/\D/g, "");
  if (cnsLimpo) return `CNS ${cnsLimpo}`;
  return "—";
}

// Locais de realização do exame.
export const LOCAIS_REALIZACAO = ["HSP", "FCV"];

// Regra automática de local pelo nome do tipo de exame:
// cintilografia -> FCV; tomografia/ressonância -> HSP; senão vazio.
export function localPorTipoExame(nomeTipoExame) {
  const n = String(nomeTipoExame || "").toLowerCase();
  if (n.includes("cintilografia")) return "FCV";
  if (n.includes("tomografia") || n.includes("ressonancia") || n.includes("ressonância")) {
    return "HSP";
  }
  return "";
}
