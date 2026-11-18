"use client";

// Campo SOMENTE LEITURA com a situação cadastral da pessoa central.
//
// Fonte única: `pessoa.situacao` (tabela `pessoa`). Este componente NÃO grava
// nada e não existe coluna de situação nas tabelas dos módulos — a alteração
// continua acontecendo exclusivamente no Cadastro de Pessoas.
//
// A etiqueta reutiliza as mesmas classes do Cadastro de Pessoas
// (`.cadStatusAtivo` verde, `.cadStatusInativo` cinza, `.cadStatusFalecido`
// vermelho), de `src/components/cadastros/padraoCadastro.css`.
import {
  classeSituacaoPessoa,
  normalizarSituacaoPessoa,
  rotuloSituacaoPessoa,
} from "@/lib/situacaoPessoa";

export default function SituacaoPessoa({ situacao, className = "" }) {
  const valor = normalizarSituacaoPessoa(situacao);
  return (
    <div className={className}>
      <label>Situação Cadastral</label>
      <div
        key={valor}
        className="situacaoPessoaCampo"
        role="status"
        aria-label={`Situação cadastral: ${rotuloSituacaoPessoa(valor)}`}
        title="A situação cadastral é alterada apenas no Cadastro de Pessoas."
      >
        <span className={classeSituacaoPessoa(valor)}>{rotuloSituacaoPessoa(valor)}</span>
      </div>
    </div>
  );
}
