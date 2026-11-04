"use client";

import GerenciarUsuarios from "@/components/GerenciarUsuarios/GerenciarUsuarios";

// Aba "Usuários" da Regulação: reaproveita a MESMA tela/CRUD do Gerenciamento
// (espelha o padrão de ProcedimentosTab, wrapper fino sobre o componente).
export default function UsuariosTab() {
  return <GerenciarUsuarios />;
}
