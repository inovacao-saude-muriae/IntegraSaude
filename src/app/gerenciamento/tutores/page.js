"use client";

import CadastroPessoas from "@/components/CadastroPessoas/CadastroPessoas";

// Tela "Tutor" do Gerenciamento: MESMA tela e MESMA tabela do cadastro de pessoas
// (cadastro único / EMPI). Só o rótulo muda, porque o público do CCZ reconhece
// "Tutor" e não "Paciente".
export default function TutoresPage() {
  return <CadastroPessoas />;
}
