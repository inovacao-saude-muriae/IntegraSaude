// ═══════════════════════════════════════════════════════════════════════════
// TERMO DE PROCEDIMENTO VETERINÁRIO (CCZ)
// Usa o MODELO ÚNICO dos termos (termoCcz.js), o mesmo de Gerenciamento >
// Termos. Havendo tutor, nome e endereço são preenchidos; sem tutor, a linha
// de preenchimento permanece em branco.
// ═══════════════════════════════════════════════════════════════════════════

import { gerarTermoPdf } from "./termoCcz";
import { nomeArquivo } from "./documentoCcz";

export function gerarTermoProcedimentoPdf(procedimento) {
  const p = procedimento || {};
  const animal = p.animal || {};
  return gerarTermoPdf("procedimento", {
    animal: {
      id: animal.id || p.animalId,
      nome: animal.nome || p.animalNome,
      especie: animal.especie || p.animalEspecie,
    },
    tutor: p.tutor?.nome ? p.tutor : null,
    registro: { tipo: p.tipo },
    data: p.dataProcedimento,
    arquivo: nomeArquivo("termo-procedimento", p.id, p.animalId),
  });
}
