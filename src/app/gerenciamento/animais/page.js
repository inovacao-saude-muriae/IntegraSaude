"use client";

import { useRouter } from "next/navigation";
import AnimaisLista from "@/app/ccz/AnimaisLista";

// Tela "Animais" do Gerenciamento: reaproveita a lista do CCZ.
// O cadastro e a edição ficam na tela do CCZ (/ccz?tab=ANIMAIS), que tem as
// abas "Consultar Animais" e "Novo Animal" — a edição de um animal começa
// pela ficha dele na lista.
export default function AnimaisPage() {
  const router = useRouter();

  return (
    <AnimaisLista
      onEditar={(id) => router.push(`/ccz?tab=ANIMAIS&subTab=CADASTRAR&id=${id}`)}
      onNovo={() => router.push("/ccz?tab=ANIMAIS&subTab=CADASTRAR")}
    />
  );
}
