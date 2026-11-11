"use client";

import AnimaisLista from "@/app/ccz/AnimaisLista";

// Tela "Animais" do Gerenciamento: reaproveita a lista do CCZ.
// A edição/cadastro do animal continua nas telas de Zoonoses/Denúncias/Agenda do
// CCZ (é lá que o animal é criado no fluxo de trabalho); aqui o foco é consultar.
export default function AnimaisPage() {
  return <AnimaisLista />;
}
