"use client";

import { createContext, useContext } from "react";

// Flags de permissão da Regulação calculadas no servidor (layout.js) e
// injetadas aqui como props serializáveis. Client Components NÃO importam a
// DAL (permissions.js) — recebem só os booleans.
// Fail-closed: sem provider, todas as flags são false (design §15).
const PermissoesRegulacaoContext = createContext({
  podeEditarFinanceiro: false,
  podeGerenciarCatalogo: false,
  podeGerenciarPessoas: false,
});

export function RegulacaoPermProvider({
  podeEditarFinanceiro = false,
  podeGerenciarCatalogo = false,
  podeGerenciarPessoas = false,
  children,
}) {
  return (
    <PermissoesRegulacaoContext.Provider
      value={{ podeEditarFinanceiro, podeGerenciarCatalogo, podeGerenciarPessoas }}
    >
      {children}
    </PermissoesRegulacaoContext.Provider>
  );
}

export function usePermissoesRegulacao() {
  return useContext(PermissoesRegulacaoContext);
}
