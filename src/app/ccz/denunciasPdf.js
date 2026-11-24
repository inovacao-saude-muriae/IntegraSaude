// ═══════════════════════════════════════════════════════════════════════════
// TERMO DE COMPROMISSO E RESPONSABILIDADE — DENÚNCIA (CCZ)
// Usa o MODELO ÚNICO dos termos (termoCcz.js), o mesmo de Gerenciamento >
// Termos. Havendo tutor, nome e endereço são preenchidos; sem tutor, a linha
// de preenchimento permanece em branco.
// ═══════════════════════════════════════════════════════════════════════════

import { gerarTermoPdf } from "./termoCcz";
import { nomeArquivo } from "./documentoCcz";

export function gerarTermoDenuncia(data) {
  const d = data || {};
  const animal = d.animal || {};
  return gerarTermoPdf("denuncia", {
    animal: {
      id: animal.id || d.animalId,
      nome: animal.nome || d.animalNome,
      especie: animal.especie,
    },
    tutor: d.tutor?.nome ? d.tutor : null,
    data: d.dataDenuncia,
    arquivo: nomeArquivo("termo-denuncia", d.id),
  });
}
