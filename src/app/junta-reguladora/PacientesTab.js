"use client";

import CadastroPessoas from "@/components/CadastroPessoas/CadastroPessoas";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";
import { usePermissoesJunta } from "./PermissoesJuntaContext";

// Aba "Pacientes" da Junta Reguladora: reaproveita a MESMA tela/CRUD de pessoas
// do Gerenciamento/Regulação/Farmácia (wrapper fino sobre o componente
// compartilhado). As server actions são as mesmas e já fazem o enforcement de
// permissão (requireAcessoPessoas). Gate de conteúdo concentrado aqui: só quem
// pode gerenciar pessoas (GESTOR ∨ REGULACAO/ADMIN ∨ JUNTA/ADMIN) vê a tela.
// IMPORTANTE: esta é a tela GERAL de pessoas (model Pessoa) — NÃO se confunde
// com o cadastro de paciente da Junta (aba "Novo Pedido"/CadastroPacienteJunta,
// model PacienteJunta).
export default function PacientesTab() {
  const { podeGerenciarPessoas } = usePermissoesJunta();

  if (!podeGerenciarPessoas) {
    return <AcessoNegadoModulo modulo="Cadastro de Pessoas" />;
  }

  return <CadastroPessoas />;
}
