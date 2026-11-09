"use client";

import { useState, useEffect } from "react";
import stylesModal from "./AgendaCCZ.module.css";
import styles from "./ListaCCZ.module.css";
import { mascararTelefone } from "@/lib/telefone";
import { useConfirm, useNotify } from "@/components/ConfirmDialog";

const maskCpf = (v) =>
  (v || "")
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

const maskCep = (v) =>
  (v || "").replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d{1,3})$/, "$1-$2");

const formatarData = (dataISO) => {
  if (!dataISO) return "-";
  const d = new Date(dataISO);
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
};

export default function FichaTutor({ cpf, onFechar, onEditar, onExcluir }) {
  const confirm = useConfirm();
  const notify = useNotify();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const carregar = async () => {
      setCarregando(true);
      setErro("");
      try {
        const res = await fetch(`/api/ccz/tutores/${cpf}`);
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error("Erro na API:", errorText);
          throw new Error(`Erro ${res.status}: ${errorText}`);
        }
        
        const data = await res.json();
        setDados(data);
      } catch (error) {
        console.error("Erro ao carregar ficha:", error);
        setErro(error.message || "Erro ao carregar ficha");
      } finally {
        setCarregando(false);
      }
    };
    carregar();
  }, [cpf]);

  if (carregando) {
    return (
      <div className={stylesModal.modalOverlay} onClick={onFechar}>
        <div className={stylesModal.modal} onClick={(e) => e.stopPropagation()}>
          <div className={stylesModal.modalHeader}>
            <h3 className={stylesModal.modalTitle}>Carregando ficha...</h3>
            <button type="button" className={stylesModal.modalClose} onClick={onFechar}>
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (erro || !dados) {
    return (
      <div className={stylesModal.modalOverlay} onClick={onFechar}>
        <div className={stylesModal.modal} onClick={(e) => e.stopPropagation()}>
          <div className={stylesModal.modalHeader}>
            <h3 className={stylesModal.modalTitle}>Erro ao carregar</h3>
            <button type="button" className={stylesModal.modalClose} onClick={onFechar}>
              ✕
            </button>
          </div>
          <div className={stylesModal.modalBody}>
            <p>{erro || "Não foi possível carregar a ficha do tutor."}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={stylesModal.modalOverlay} onClick={onFechar}>
      <div
        className={stylesModal.modal}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "900px", maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className={stylesModal.modalHeader}>
          <div>
            <h3 className={stylesModal.modalTitle}>Ficha do Tutor</h3>
            <p className={stylesModal.modalSubtitle}>
              {dados.nomeCompleto}
            </p>
          </div>
          <button type="button" className={stylesModal.modalClose} onClick={onFechar}>
            ✕
          </button>
        </div>

        <div className={stylesModal.modalBody}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            
            {/* Dados Pessoais */}
            <section>
              <h4 style={{ 
                fontSize: "0.75rem", 
                fontWeight: "700", 
                color: "#64748b", 
                textTransform: "uppercase", 
                letterSpacing: "0.05em",
                marginBottom: "1rem"
              }}>
                Dados Pessoais
              </h4>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    Nome completo
                  </label>
                  <div style={{ 
                    padding: "0.5rem 0.75rem", 
                    backgroundColor: "#f8fafc", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#1e293b"
                  }}>
                    {dados.nomeCompleto || "-"}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    Nome da mãe
                  </label>
                  <div style={{ 
                    padding: "0.5rem 0.75rem", 
                    backgroundColor: "#f8fafc", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#1e293b"
                  }}>
                    {dados.nomeMae || "-"}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    Data de nascimento
                  </label>
                  <div style={{ 
                    padding: "0.5rem 0.75rem", 
                    backgroundColor: "#f8fafc", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#1e293b"
                  }}>
                    {formatarData(dados.dataNascimento)}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    Sexo
                  </label>
                  <div style={{ 
                    padding: "0.5rem 0.75rem", 
                    backgroundColor: "#f8fafc", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#1e293b"
                  }}>
                    {dados.sexo || "-"}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    Telefone / WhatsApp
                  </label>
                  <div style={{ 
                    padding: "0.5rem 0.75rem", 
                    backgroundColor: "#f8fafc", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#1e293b"
                  }}>
                    {dados.telefone ? mascararTelefone(dados.telefone) : "-"}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    Telefone Secundário
                  </label>
                  <div style={{ 
                    padding: "0.5rem 0.75rem", 
                    backgroundColor: "#f8fafc", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#1e293b"
                  }}>
                    {dados.telefoneSecundario ? mascararTelefone(dados.telefoneSecundario) : "-"}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    CPF
                  </label>
                  <div style={{ 
                    padding: "0.5rem 0.75rem", 
                    backgroundColor: "#f8fafc", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#1e293b"
                  }}>
                    {maskCpf(dados.cpf)}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    CNS (Cartão SUS)
                  </label>
                  <div style={{ 
                    padding: "0.5rem 0.75rem", 
                    backgroundColor: "#f8fafc", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#1e293b"
                  }}>
                    {dados.cns || "-"}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    RG
                  </label>
                  <div style={{ 
                    padding: "0.5rem 0.75rem", 
                    backgroundColor: "#f8fafc", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#1e293b"
                  }}>
                    {dados.rg || "-"}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    Profissão
                  </label>
                  <div style={{ 
                    padding: "0.5rem 0.75rem", 
                    backgroundColor: "#f8fafc", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#1e293b"
                  }}>
                    {dados.profissao || "-"}
                  </div>
                </div>
              </div>
            </section>

            {/* Endereço */}
            <section>
              <h4 style={{ 
                fontSize: "0.75rem", 
                fontWeight: "700", 
                color: "#64748b", 
                textTransform: "uppercase", 
                letterSpacing: "0.05em",
                marginBottom: "1rem"
              }}>
                Endereço
              </h4>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    CEP
                  </label>
                  <div style={{ 
                    padding: "0.5rem 0.75rem", 
                    backgroundColor: "#f8fafc", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#1e293b"
                  }}>
                    {maskCep(dados.cep)}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    Bairro
                  </label>
                  <div style={{ 
                    padding: "0.5rem 0.75rem", 
                    backgroundColor: "#f8fafc", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#1e293b"
                  }}>
                    {dados.bairro || "-"}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    Logradouro / Rua
                  </label>
                  <div style={{ 
                    padding: "0.5rem 0.75rem", 
                    backgroundColor: "#f8fafc", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#1e293b"
                  }}>
                    {dados.logradouro || "-"}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    Número
                  </label>
                  <div style={{ 
                    padding: "0.5rem 0.75rem", 
                    backgroundColor: "#f8fafc", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#1e293b"
                  }}>
                    {dados.numero || "-"}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    Complemento
                  </label>
                  <div style={{ 
                    padding: "0.5rem 0.75rem", 
                    backgroundColor: "#f8fafc", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#1e293b"
                  }}>
                    {dados.complemento || "-"}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    Cidade
                  </label>
                  <div style={{ 
                    padding: "0.5rem 0.75rem", 
                    backgroundColor: "#f8fafc", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#1e293b"
                  }}>
                    {dados.cidade || "-"}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    UF
                  </label>
                  <div style={{ 
                    padding: "0.5rem 0.75rem", 
                    backgroundColor: "#f8fafc", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#1e293b"
                  }}>
                    {dados.uf || "-"}
                  </div>
                </div>
                
                {dados.pontoReferencia && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                      Ponto de Referência
                    </label>
                    <div style={{ 
                      padding: "0.5rem 0.75rem", 
                      backgroundColor: "#f8fafc", 
                      border: "1px solid #e2e8f0", 
                      borderRadius: "6px",
                      fontSize: "0.875rem",
                      color: "#1e293b"
                    }}>
                      {dados.pontoReferencia}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Animais Vinculados */}
            <section className={styles.fichaSecao}>
              <h4 className={styles.fichaTitle}>Animais Vinculados</h4>
              {dados.animais && dados.animais.length > 0 ? (
                <div style={{ overflowX: "auto" }}>
                  <table className={styles.table} style={{ marginTop: "0.5rem" }}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Nome</th>
                        <th>Espécie</th>
                        <th>Sexo</th>
                        <th>Porte</th>
                        <th>Idade</th>
                        <th>Castrado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dados.animais.map((a) => (
                        <tr key={a.id}>
                          <td>{a.id}</td>
                          <td className={styles.boldName}>{a.nome}</td>
                          <td>{a.especie}</td>
                          <td>{a.sexo}</td>
                          <td>{a.porte}</td>
                          <td>{a.idade}</td>
                          <td>{a.castrado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: "#64748b", fontStyle: "italic" }}>Nenhum animal vinculado</p>
              )}
            </section>

            {/* Observações */}
            {dados.observacoes && (
              <section className={styles.fichaSecao}>
                <h4 className={styles.fichaTitle}>Observações</h4>
                <div style={{ 
                  padding: "0.75rem", 
                  backgroundColor: "#f8fafc", 
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  whiteSpace: "pre-wrap"
                }}>
                  {dados.observacoes}
                </div>
              </section>
            )}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button 
            className={styles.btnGhost}
            onClick={async () => {
              if (dados.animais && dados.animais.length > 0) {
                await notify({
                  tipo: "erro",
                  message: `Não é possível excluir este tutor pois existem ${dados.animais.length} animal(is) vinculado(s)`,
                });
                return;
              }
              const ok = await confirm({
                title: "Excluir tutor",
                message: `Deseja excluir o tutor ${dados.nomeCompleto}? Esta ação não pode ser desfeita.`,
                confirmText: "Excluir",
              });
              if (!ok) return;
              onExcluir?.(dados.cpf);
              onFechar();
            }}
            style={{ 
              color: "#dc2626",
              borderColor: "#fca5a5"
            }}
          >
            Excluir
          </button>
          <button 
            className={styles.btnPrimary}
            onClick={() => {
              onEditar?.(dados.cpf);
              onFechar();
            }}
          >
            Editar
          </button>
        </div>
      </div>
    </div>
  );
}
