"use client";

import CadastroPessoas from "@/components/CadastroPessoas/CadastroPessoas";

// Aba "Pacientes" da Regulação: reaproveita a MESMA tela/CRUD de pessoas do
// Gerenciamento (espelha o padrão de ProcedimentosTab, wrapper fino sobre o
// componente compartilhado). As server actions são as mesmas e já fazem o
// enforcement de permissão (requireAcessoPessoas).
export default function PacientesTab() {
  return <CadastroPessoas />;
}
