"use client";

import { createContext, useContext } from "react";

// Flag de permissão da Farmácia Judicial calculada no servidor (layout.js) e
// injetada aqui como prop serializável. Client Components NÃO importam a DAL
// (permissions.js) — recebem só o boolean.
// Fail-closed: sem provider, a flag é false (espelha PermissoesRegulacaoContext).
const PermissoesFarmaciaJudicialContext = createContext({
  podeGerenciarPessoas: false,
});

export function FarmaciaJudicialPermProvider({
  podeGerenciarPessoas = false,
  children,
}) {
  return (
    <PermissoesFarmaciaJudicialContext.Provider value={{ podeGerenciarPessoas }}>
      {children}
    </PermissoesFarmaciaJudicialContext.Provider>
  );
}

export function usePermissoesFarmaciaJudicial() {
  return useContext(PermissoesFarmaciaJudicialContext);
}
