import { redirect } from "next/navigation";

// Gerenciamento → Animais: o cadastro e a consulta de animais são a mesma tela
// do CCZ (/ccz?tab=ANIMAIS), com as abas "Consultar Animais" e "Novo Animal".
// Esta rota é mantida como atalho para não quebrar links já existentes.
export default function AnimaisPage() {
  redirect("/ccz?tab=ANIMAIS");
}
