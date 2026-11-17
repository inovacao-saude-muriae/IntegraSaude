"use client";

// Etiqueta de situação usada nas tabelas dos cadastros.
//
// Diferencia três estados:
//   Ativo                          → disponível (ele e a categoria dele ativos)
//   Inativo                        → inativado individualmente
//   Indisponível (serviço inativo) → a categoria superior está inativa
//
// `paiInativo` e `nomePai` vêm de fora porque só a tela sabe qual é a
// categoria superior de cada cadastro (Tipo de Exame, Serviço, Especialidade).
export default function StatusRegistro({ ativo, paiInativo = false, nomePai = "categoria" }) {
  const individualAtivo = ativo !== false;

  if (!individualAtivo) {
    return <span className="cadStatusInativo">Inativo</span>;
  }
  if (paiInativo) {
    return (
      <span className="cadStatusIndisponivel" title={`${nomePai} inativa`}>
        Indisponível
      </span>
    );
  }
  return <span className="cadStatusAtivo">Ativo</span>;
}
