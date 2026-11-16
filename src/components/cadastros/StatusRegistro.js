"use client";

// Etiqueta de situação usada nas tabelas dos cadastros.

export default function StatusRegistro({ ativo }) {
  return (
    <span className={ativo ? "cadStatusAtivo" : "cadStatusInativo"}>
      {ativo ? "Ativo" : "Inativo"}
    </span>
  );
}
