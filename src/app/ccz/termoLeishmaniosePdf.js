// Termo de Responsabilidade da Leishmaniose (Protocolo de Monitoramento
// Zoonoses). Documento INDEPENDENTE da Ficha de Fiscalização: usa o mesmo
// template único dos termos do CCZ (termoCcz.js), com os dados históricos da
// fiscalização selecionada.
import { gerarTermoPdf } from "./termoCcz";

export async function gerarTermoLeishmaniose(registro) {
  const tutor = registro?.tutorNome
    ? {
        nome: registro.tutorNome,
        cpf: registro.tutorCpf || "",
        telefone: registro.tutorTelefone || "",
        endereco: registro.tutorEndereco || "",
      }
    : null;

  return gerarTermoPdf("leishmaniose", {
    tutor,
    animal: { id: registro?.animalId, nome: registro?.animalNome || "" },
    data: registro?.dataFiscalizacao,
    arquivo: `termo-responsabilidade-leishmaniose-${registro?.animalId || "ficha"}.pdf`,
  });
}
