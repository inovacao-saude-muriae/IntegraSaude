"use client";

import CadastroPessoas from "@/components/CadastroPessoas/CadastroPessoas";
import { salvarTutor } from "@/app/ccz/actions";

// Gerenciamento → Tutores.
//
// A tela é a MESMA do Cadastro de Pacientes (fonte única: tabela `pessoa`).
// Não há tabela adicional "Tutores cadastrados": a busca, o formulário, os
// containers e a listagem são exatamente os de Pacientes, com os campos
// complementares do vínculo CCZ (ccz_tutores) e a preservação dos animais.
export default function TutoresGerenciamento({
  podeExcluir = false,
  podeExcluirPessoa = false,
  podeInativarPessoa = false,
  podeReativarPessoa = false,
  podeEditarPessoa = false,
}) {
  // MESMO container, componente e estilos de Gerenciamento > Pacientes:
  // nenhum wrapper, max-width, padding ou texto adicional aqui. A tela é a
  // mesma (fonte única `pessoa`); muda apenas o vínculo de tutor do CCZ.
  return (
    <CadastroPessoas
      variante="tutor"
      salvarTutor={salvarTutor}
      podeExcluir={podeExcluirPessoa}
      podeInativar={podeInativarPessoa}
      podeReativar={podeReativarPessoa}
      podeEditarSituacao={podeEditarPessoa}
    />
  );
}
