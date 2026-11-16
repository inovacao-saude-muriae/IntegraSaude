"use client";

import GerenciarUsuarios from '@/components/GerenciarUsuarios/GerenciarUsuarios';

// Área única de gerenciamento: a lista de contas já traz os módulos e o botão
// "Acessos" de cada usuário. Não há mais aba separada de acessos por módulo —
// a configuração é a 2ª etapa do cadastro e o painel da ação individual.
export default function AdminUsuariosPage() {
  return <GerenciarUsuarios />;
}
