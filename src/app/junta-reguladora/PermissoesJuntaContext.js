"use client";

import { createContext, useContext } from "react";

// Permissões da Junta calculadas no servidor (layout.js) e injetadas como props
// serializáveis. subServicosPermitidos é a lista de códigos de subTab liberados
// (ex.: ["CAEE"]). podeGerenciarPessoas gateia a aba "Pacientes" (tela geral de
// pessoas). Client Components NÃO importam a DAL — recebem só estes dados.
// podeInativarServicos gateia o botão Inativar/Reativar de Serviços e
// Especialidades (permissão nominal JUNTA/servicos:inativar).
// Fail-closed: sem provider, nada é liberado (design §15).
const PermissoesJuntaContext = createContext({
  subServicosPermitidos: [],
  ehAdminJunta: false,
  podeGerenciarPessoas: false,
  podeInativarServicos: false,
});

export function JuntaPermProvider({
  subServicosPermitidos = [],
  ehAdminJunta = false,
  podeGerenciarPessoas = false,
  podeInativarServicos = false,
  children,
}) {
  return (
    <PermissoesJuntaContext.Provider
      value={{
        subServicosPermitidos,
        ehAdminJunta,
        podeGerenciarPessoas,
        podeInativarServicos,
      }}
    >
      {children}
    </PermissoesJuntaContext.Provider>
  );
}

export function usePermissoesJunta() {
  return useContext(PermissoesJuntaContext);
}
