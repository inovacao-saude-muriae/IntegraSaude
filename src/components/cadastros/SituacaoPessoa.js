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
  // Sem pessoa selecionada o campo fica VAZIO (nada de "Ativo" por omissão):
  // a etiqueta só aparece depois que o paciente é escolhido.
  const preenchido = Boolean(situacao);
  const valor = normalizarSituacaoPessoa(situacao);
  return (
    <div className={className}>
      <label>Situação Cadastral</label>
      <div
        key={preenchido ? valor : "vazio"}
        className="situacaoPessoaCampo"
        role="status"
        aria-label={
          preenchido ? `Situação cadastral: ${rotuloSituacaoPessoa(valor)}` : "Situação cadastral"
        }
        title="A situação cadastral é alterada apenas no Cadastro de Pessoas."
      >
        {preenchido ? (
          <span className={classeSituacaoPessoa(valor)}>{rotuloSituacaoPessoa(valor)}</span>
        ) : null}
      </div>
    </div>
  );
}
