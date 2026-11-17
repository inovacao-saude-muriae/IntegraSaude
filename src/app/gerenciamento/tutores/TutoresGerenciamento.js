"use client";

import Link from "next/link";
import CadastroPessoas from "@/components/CadastroPessoas/CadastroPessoas";
import { salvarTutor } from "@/app/ccz/actions";
import styles from "./Tutores.module.css";

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
  return (
    <div className={styles.container}>
      <CadastroPessoas
        variante="tutor"
        salvarTutor={salvarTutor}
        podeExcluir={podeExcluirPessoa}
        podeInativar={podeInativarPessoa}
        podeReativar={podeReativarPessoa}
        podeEditarSituacao={podeEditarPessoa}
      />

      <p className={styles.nota}>
        Os animais vinculados a cada tutor continuam no módulo CCZ.{" "}
        <Link href="/ccz?tab=ANIMAIS" className={styles.link}>
          Abrir Animais do CCZ
        </Link>
        {podeExcluir ? (
          <>
            {" "}
            — excluir o <strong>vínculo</strong> de tutor é feito na aba Tutores do CCZ,
            nunca no cadastro da pessoa.
          </>
        ) : null}
      </p>
    </div>
  );
}
