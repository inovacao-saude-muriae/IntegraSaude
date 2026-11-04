"use client";

import CadastroPessoas from "@/components/CadastroPessoas/CadastroPessoas";

// Tela de Cadastro de Pessoas do Gerenciamento: reaproveita a MESMA tela/CRUD
// compartilhada (também usada pela aba "Pacientes" da Regulação), espelhando o
// padrão do GerenciarUsuarios (wrapper fino sobre o componente de src/components).
export default function PessoasPage() {
  return <CadastroPessoas />;
}
