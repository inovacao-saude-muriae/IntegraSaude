"use client";

import CadastroPessoas from "@/components/CadastroPessoas/CadastroPessoas";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";
import { usePermissoesFarmaciaJudicial } from "./PermissoesFarmaciaJudicialContext";

// Aba "Pacientes" da Farmácia Judicial: reaproveita a MESMA tela/CRUD de
// pessoas do Gerenciamento/Regulação (wrapper fino sobre o componente
// compartilhado). As server actions são as mesmas e já fazem o enforcement de
// permissão (requireAcessoPessoas). Gate de conteúdo concentrado aqui: só quem
// pode gerenciar pessoas (GESTOR ∨ REGULACAO/ADMIN ∨ JUNTA/ADMIN) vê a tela.
export default function PacientesTab() {
  const { podeGerenciarPessoas } = usePermissoesFarmaciaJudicial();

  if (!podeGerenciarPessoas) {
    return <AcessoNegadoModulo modulo="Cadastro de Pessoas" />;
  }

  return <CadastroPessoas />;
}
