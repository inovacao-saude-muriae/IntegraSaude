"use client";

import { createContext, useContext } from "react";

// Permissões da Junta calculadas no servidor (layout.js) e injetadas como props
// serializáveis. subServicosPermitidos é a lista de NOMES dos serviços liberados
// (vinda do cadastro junta_servicos, ex.: ["CAEE"]); servicosPermitidos traz
// [{id, nome}] — o id é o que o vínculo de acesso guarda. podeGerenciarPessoas gateia a aba "Pacientes" (tela geral de
// pessoas). Client Components NÃO importam a DAL — recebem só estes dados.
// podeInativarServicos gateia o botão Inativar/Reativar de Serviços e
// Especialidades (permissão nominal JUNTA/servicos:inativar).
// Fail-closed: sem provider, nada é liberado (design §15).
const PermissoesJuntaContext = createContext({
  subServicosPermitidos: [],
  servicosPermitidos: [],
  ehAdminJunta: false,
  podeGerenciarPessoas: false,
  podeInativarServicos: false,
});

export function JuntaPermProvider({
  subServicosPermitidos = [],
  servicosPermitidos = [],
  ehAdminJunta = false,
  podeGerenciarPessoas = false,
  podeInativarServicos = false,
  children,
}) {
  return (
    <PermissoesJuntaContext.Provider
      value={{
        subServicosPermitidos,
        servicosPermitidos,
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
