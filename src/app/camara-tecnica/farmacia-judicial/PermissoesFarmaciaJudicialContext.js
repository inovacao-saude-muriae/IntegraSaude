"use client";

import { createContext, useContext } from "react";

// Flag de permissão da Farmácia Judicial calculada no servidor (layout.js) e
// injetada aqui como prop serializável. Client Components NÃO importam a DAL
// (permissions.js) — recebem só o boolean.
// Fail-closed: sem provider, a flag é false (espelha PermissoesRegulacaoContext).
const PermissoesFarmaciaJudicialContext = createContext({
  podeGerenciarPessoas: false,
  // Exclusão de processo judicial da Farmácia: ação administrativa do módulo
  // (mesma regra de requireAdminModulo). Backend revalida sempre.
  podeExcluirProcesso: false,
});

export function FarmaciaJudicialPermProvider({
  podeGerenciarPessoas = false,
  podeExcluirProcesso = false,
  children,
}) {
  return (
    <PermissoesFarmaciaJudicialContext.Provider
      value={{ podeGerenciarPessoas, podeExcluirProcesso }}
    >
      {children}
    </PermissoesFarmaciaJudicialContext.Provider>
  );
}

export function usePermissoesFarmaciaJudicial() {
  return useContext(PermissoesFarmaciaJudicialContext);
}
