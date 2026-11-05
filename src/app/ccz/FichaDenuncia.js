"use client";

import { useState, useEffect } from "react";
import Image from 'next/image';
import stylesModal from "./AgendaCCZ.module.css";
import styles from "./ListaCCZ.module.css";
import stylesTermo from "./TermoProcedimento.module.css";
import { gerarTermoDenuncia } from "./denunciasPdf";
import { useConfirm, useNotify } from "@/components/ConfirmDialog";

const formatarData = (ymd) => (ymd ? ymd.split("-").reverse().join("/") : "-");

export default function FichaDenuncia({ denunciaId, onFechar, onEditar, onExcluir }) {
  const confirm = useConfirm();
  const notify = useNotify();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({});
  const [mostrandoTermo, setMostrandoTermo] = useState(false);

  useEffect(() => {
    const carregar = async () => {
      setCarregando(true);
      setErro("");
      try {
        const res = await fetch(`/api/ccz/denuncias/${denunciaId}`);
        if (!res.ok) {
          throw new Error("Erro ao carregar denúncia");
        }
        const data = await res.json();
        setDados(data);
        setForm(data);
      } catch (error) {
        console.error("Erro ao carregar denúncia:", error);
        setErro(error.message || "Erro ao carregar denúncia");
      } finally {
        setCarregando(false);
      }
    };
    carregar();
  }, [denunciaId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSalvar = async () => {
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch(`/api/ccz/denuncias/${denunciaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        throw new Error("Erro ao salvar denúncia");
      }

      const dataAtualizada = await res.json();
      setDados(dataAtualizada);
      setForm(dataAtualizada);
      setEditando(false);
      await notify({ tipo: "sucesso", message: "Denúncia atualizada com sucesso!" });
    } catch (error) {
      console.error("Erro ao salvar:", error);
      setErro(error.message || "Erro ao salvar denúncia");
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className={stylesModal.modalOverlay} onClick={onFechar}>
        <div className={stylesModal.modal} onClick={(e) => e.stopPropagation()}>
          <div className={stylesModal.modalHeader}>
            <h3 className={stylesModal.modalTitle}>Carregando denúncia...</h3>
            <button type="button" className={stylesModal.modalClose} onClick={onFechar}>
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (erro && !dados) {
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
            <p style={{ color: "#dc2626" }}>{erro}</p>
          </div>
        </div>
      </div>
    );
  }

  // Se estiver mostrando o termo
  if (mostrandoTermo) {
    return (
      <div className={stylesModal.modalOverlay} onClick={onFechar}>
        <div 
          className={stylesModal.modal}
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: "900px", maxHeight: "90vh", overflowY: "auto" }}
        >
          {/* CONTEÚDO DO TERMO */}
          <div className={stylesTermo.termo}>
            {/* CABEÇALHO */}
            <div className={stylesTermo.cabecalho}>
              <div className={stylesTermo.logoBox}>
                <Image
                  src="/img/logo/logo-ccz.png"
                  alt="Logo CCZ"
                  width={80}
                  height={80}
                  className={stylesTermo.logoImage}
                />
              </div>
              <div className={stylesTermo.tituloBox}>
                <h1>CENTRO DE CONTROLE DE ZOONOSES</h1>
                <h2>TERMO DE COMPROMISSO E RESPONSABILIDADE</h2>
              </div>
            </div>

            <div className={stylesTermo.linha}></div>

            {/* TEXTO EXPLICATIVO */}
            <div className={stylesTermo.secao}>
              <div className={stylesTermo.textoExplicativo}>
                <p>
                  Eu, <strong>{dados.tutor?.nome || 'Sem tutor'}</strong>
                  {(dados.tutor?.endereco || dados.endereco) && (
                    <>, residente no endereço <strong>{dados.tutor?.endereco || dados.endereco}</strong></>
                  )}, 
                  responsável pelo animal <strong>{dados.animal?.nome || '______________________'}</strong>, 
                  declaro que fui notificado(a) pela equipe do Centro de Controle de Zoonoses sobre denúncia de 
                  comportamento agressivo do animal sob minha responsabilidade.
                </p>
                <p>Fui orientado(a) e comprometo-me com os seguintes pontos:</p>
                <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                  <li>Manter o animal devidamente contido e sob vigilância, evitando sua circulação livre em vias públicas;</li>
                  <li>Utilizar focinheira e guia apropriadas durante passeios em locais públicos, conforme legislação vigente;</li>
                  <li>Garantir que o animal permaneça em local seguro dentro da propriedade, com cercamento adequado;</li>
                  <li>Não permitir que o animal tenha acesso direto a pessoas que transitam pela via pública;</li>
                  <li>Providenciar atendimento veterinário caso seja identificado comportamento agressivo persistente;</li>
                  <li>Comunicar ao CCZ qualquer incidente envolvendo o animal.</li>
                </ul>
                <p>
                  Estou ciente de que o não cumprimento destas medidas pode resultar em apreensão do animal, 
                  aplicação de multa e outras sanções previstas na legislação municipal e estadual de proteção 
                  e controle de animais.
                </p>
                <p>
                  Declaro estar ciente de minhas responsabilidades como tutor e comprometo-me a adotar todas 
                  as medidas necessárias para garantir a segurança pública.
                </p>
              </div>
            </div>

            <div className={stylesTermo.linha}></div>

            {/* LOCAL E DATA */}
            <div className={stylesTermo.secao}>
              <p className={stylesTermo.localData}>
                Muriaé, {new Date().toLocaleDateString('pt-BR')}
              </p>
            </div>

            {/* ASSINATURAS */}
            <div className={stylesTermo.assinaturas}>
              <div className={stylesTermo.assinatura}>
                <div className={stylesTermo.linhaAssinatura}></div>
                <p>Assinatura do Responsável pelo Animal</p>
              </div>

              <div className={stylesTermo.assinatura}>
                <div className={stylesTermo.linhaAssinatura}></div>
                <p>Veterinário Responsável</p>
              </div>
            </div>

            {/* RODAPÉ */}
            <div className={stylesTermo.rodape}>
              <p>Centro de Controle de Zoonoses - CCZ</p>
            </div>
          </div>

          {/* BOTÕES DE AÇÃO NO RODAPÉ */}
          <div className={stylesTermo.rodapeModal}>
            <button 
              onClick={() => setMostrandoTermo(false)} 
              className={stylesTermo.btnFecharRodape}
            >
              Fechar
            </button>
            <button 
              onClick={() => {
                // Adicionar nome do tutor e dados se existir
                const dadosComTutor = {
                  ...dados,
                  tutorNome: dados.tutor?.nome || '',
                  tutor: dados.tutor || null,
                  animal: dados.animal || null
                };
                gerarTermoDenuncia(dadosComTutor);
                setMostrandoTermo(false);
              }} 
              className={stylesTermo.btnBaixar}
            >
              Baixar PDF
            </button>
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
            <h3 className={stylesModal.modalTitle}>Denúncia de Cão Agressivo</h3>
            <p className={stylesModal.modalSubtitle}>
              ID: {dados.id}
            </p>
          </div>
          <button type="button" className={stylesModal.modalClose} onClick={onFechar}>
            ✕
          </button>
        </div>

        <div className={stylesModal.modalBody}>
          {erro && <div style={{ padding: "0.75rem", backgroundColor: "#fee2e2", color: "#dc2626", borderRadius: "6px", marginBottom: "1rem" }}>{erro}</div>}
          
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            
            {/* Dados Gerais */}
            <section>
              <h4 style={{ 
                fontSize: "0.75rem", 
                fontWeight: "700", 
                color: "#64748b", 
                textTransform: "uppercase", 
                letterSpacing: "0.05em",
                marginBottom: "1rem"
              }}>
                Dados Gerais
              </h4>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    ID
                  </label>
                  {editando ? (
                    <input
                      type="text"
                      value={form.id || ""}
                      disabled
                      style={{ 
                        width: "100%",
                        padding: "0.5rem 0.75rem", 
                        backgroundColor: "#f1f5f9", 
                        border: "1px solid #e2e8f0", 
                        borderRadius: "6px",
                        fontSize: "0.875rem",
                        color: "#94a3b8"
                      }}
                    />
                  ) : (
                    <div style={{ 
                      padding: "0.5rem 0.75rem", 
                      backgroundColor: "#f8fafc", 
                      border: "1px solid #e2e8f0", 
                      borderRadius: "6px",
                      fontSize: "0.875rem",
                      color: "#1e293b"
                    }}>
                      {dados.id}
                    </div>
                  )}
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    Data da Denúncia
                  </label>
                  {editando ? (
                    <input
                      type="date"
                      name="dataDenuncia"
                      value={form.dataDenuncia || ""}
                      onChange={handleChange}
                      style={{ 
                        width: "100%",
                        padding: "0.5rem 0.75rem", 
                        backgroundColor: "#ffffff", 
                        border: "1px solid #cbd5e1", 
                        borderRadius: "6px",
                        fontSize: "0.875rem",
                        color: "#1e293b"
                      }}
                    />
                  ) : (
                    <div style={{ 
                      padding: "0.5rem 0.75rem", 
                      backgroundColor: "#f8fafc", 
                      border: "1px solid #e2e8f0", 
                      borderRadius: "6px",
                      fontSize: "0.875rem",
                      color: "#1e293b"
                    }}>
                      {formatarData(dados.dataDenuncia)}
                    </div>
                  )}
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    Animal Vinculado
                  </label>
                  <div style={{ 
                    padding: "0.5rem 0.75rem", 
                    backgroundColor: "#f8fafc", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#1e293b"
                  }}>
                    {dados.animal?.nome || "Sem animal vinculado"}
                  </div>
                </div>
                
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    Causou Risco
                  </label>
                  {editando ? (
                    <select
                      name="causouRisco"
                      value={form.causouRisco || "Não"}
                      onChange={handleChange}
                      style={{ 
                        width: "100%",
                        padding: "0.5rem 0.75rem", 
                        backgroundColor: "#ffffff", 
                        border: "1px solid #cbd5e1", 
                        borderRadius: "6px",
                        fontSize: "0.875rem",
                        color: "#1e293b"
                      }}
                    >
                      <option value="Sim">Sim</option>
                      <option value="Não">Não</option>
                    </select>
                  ) : (
                    <div style={{ 
                      padding: "0.5rem 0.75rem", 
                      backgroundColor: "#f8fafc", 
                      border: "1px solid #e2e8f0", 
                      borderRadius: "6px",
                      fontSize: "0.875rem",
                      color: "#1e293b"
                    }}>
                      {dados.causouRisco === "Sim" ? "Sim" : "Não"}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Localização */}
            <section>
              <h4 style={{ 
                fontSize: "0.75rem", 
                fontWeight: "700", 
                color: "#64748b", 
                textTransform: "uppercase", 
                letterSpacing: "0.05em",
                marginBottom: "1rem"
              }}>
                Localização
              </h4>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    CEP
                  </label>
                  {editando ? (
                    <input
                      type="text"
                      name="cep"
                      value={form.cep || ""}
                      onChange={handleChange}
                      style={{ 
                        width: "100%",
                        padding: "0.5rem 0.75rem", 
                        backgroundColor: "#ffffff", 
                        border: "1px solid #cbd5e1", 
                        borderRadius: "6px",
                        fontSize: "0.875rem",
                        color: "#1e293b"
                      }}
                    />
                  ) : (
                    <div style={{ 
                      padding: "0.5rem 0.75rem", 
                      backgroundColor: "#f8fafc", 
                      border: "1px solid #e2e8f0", 
                      borderRadius: "6px",
                      fontSize: "0.875rem",
                      color: "#1e293b"
                    }}>
                      {dados.cep || "-"}
                    </div>
                  )}
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    Logradouro
                  </label>
                  {editando ? (
                    <input
                      type="text"
                      name="logradouro"
                      value={form.logradouro || ""}
                      onChange={handleChange}
                      style={{ 
                        width: "100%",
                        padding: "0.5rem 0.75rem", 
                        backgroundColor: "#ffffff", 
                        border: "1px solid #cbd5e1", 
                        borderRadius: "6px",
                        fontSize: "0.875rem",
                        color: "#1e293b"
                      }}
                    />
                  ) : (
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
                  )}
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    Número
                  </label>
                  {editando ? (
                    <input
                      type="text"
                      name="numero"
                      value={form.numero || ""}
                      onChange={handleChange}
                      style={{ 
                        width: "100%",
                        padding: "0.5rem 0.75rem", 
                        backgroundColor: "#ffffff", 
                        border: "1px solid #cbd5e1", 
                        borderRadius: "6px",
                        fontSize: "0.875rem",
                        color: "#1e293b"
                      }}
                    />
                  ) : (
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
                  )}
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    Complemento
                  </label>
                  {editando ? (
                    <input
                      type="text"
                      name="complemento"
                      value={form.complemento || ""}
                      onChange={handleChange}
                      style={{ 
                        width: "100%",
                        padding: "0.5rem 0.75rem", 
                        backgroundColor: "#ffffff", 
                        border: "1px solid #cbd5e1", 
                        borderRadius: "6px",
                        fontSize: "0.875rem",
                        color: "#1e293b"
                      }}
                    />
                  ) : (
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
                  )}
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    Bairro
                  </label>
                  {editando ? (
                    <input
                      type="text"
                      name="bairro"
                      value={form.bairro || ""}
                      onChange={handleChange}
                      style={{ 
                        width: "100%",
                        padding: "0.5rem 0.75rem", 
                        backgroundColor: "#ffffff", 
                        border: "1px solid #cbd5e1", 
                        borderRadius: "6px",
                        fontSize: "0.875rem",
                        color: "#1e293b"
                      }}
                    />
                  ) : (
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
                  )}
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    Cidade
                  </label>
                  {editando ? (
                    <input
                      type="text"
                      name="cidade"
                      value={form.cidade || ""}
                      onChange={handleChange}
                      style={{ 
                        width: "100%",
                        padding: "0.5rem 0.75rem", 
                        backgroundColor: "#ffffff", 
                        border: "1px solid #cbd5e1", 
                        borderRadius: "6px",
                        fontSize: "0.875rem",
                        color: "#1e293b"
                      }}
                    />
                  ) : (
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
                  )}
                </div>
                
                {(editando || dados.pontoReferencia) && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                      Ponto de Referência
                    </label>
                    {editando ? (
                      <textarea
                        name="pontoReferencia"
                        value={form.pontoReferencia || ""}
                        onChange={handleChange}
                        rows={2}
                        style={{ 
                          width: "100%",
                          padding: "0.5rem 0.75rem", 
                          backgroundColor: "#ffffff", 
                          border: "1px solid #cbd5e1", 
                          borderRadius: "6px",
                          fontSize: "0.875rem",
                          color: "#1e293b",
                          fontFamily: "inherit",
                          resize: "vertical"
                        }}
                      />
                    ) : (
                      <div style={{ 
                        padding: "0.5rem 0.75rem", 
                        backgroundColor: "#f8fafc", 
                        border: "1px solid #e2e8f0", 
                        borderRadius: "6px",
                        fontSize: "0.875rem",
                        color: "#1e293b",
                        whiteSpace: "pre-wrap"
                      }}>
                        {dados.pontoReferencia}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Descrição do Cão */}
            <section>
              <h4 style={{ 
                fontSize: "0.75rem", 
                fontWeight: "700", 
                color: "#64748b", 
                textTransform: "uppercase", 
                letterSpacing: "0.05em",
                marginBottom: "1rem"
              }}>
                Descrição do Cão
              </h4>
              
              {editando ? (
                <textarea
                  name="descricaoCao"
                  value={form.descricaoCao || ""}
                  onChange={handleChange}
                  rows={3}
                  style={{ 
                    width: "100%",
                    padding: "0.5rem 0.75rem", 
                    backgroundColor: "#ffffff", 
                    border: "1px solid #cbd5e1", 
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#1e293b",
                    fontFamily: "inherit",
                    resize: "vertical"
                  }}
                />
              ) : (
                <div style={{ 
                  padding: "0.75rem", 
                  backgroundColor: "#f8fafc", 
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  whiteSpace: "pre-wrap",
                  fontSize: "0.875rem",
                  color: "#1e293b"
                }}>
                  {dados.descricaoCao || "-"}
                </div>
              )}
            </section>

            {/* Relato */}
            <section>
              <h4 style={{ 
                fontSize: "0.75rem", 
                fontWeight: "700", 
                color: "#64748b", 
                textTransform: "uppercase", 
                letterSpacing: "0.05em",
                marginBottom: "1rem"
              }}>
                Relato da Denúncia
              </h4>
              
              {editando ? (
                <textarea
                  name="relato"
                  value={form.relato || ""}
                  onChange={handleChange}
                  rows={4}
                  style={{ 
                    width: "100%",
                    padding: "0.5rem 0.75rem", 
                    backgroundColor: "#ffffff", 
                    border: "1px solid #cbd5e1", 
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#1e293b",
                    fontFamily: "inherit",
                    resize: "vertical"
                  }}
                />
              ) : (
                <div style={{ 
                  padding: "0.75rem", 
                  backgroundColor: "#f8fafc", 
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  whiteSpace: "pre-wrap",
                  fontSize: "0.875rem",
                  color: "#1e293b"
                }}>
                  {dados.relato || "-"}
                </div>
              )}
            </section>

          </div>
        </div>

        <div className={styles.modalFooter}>
          {!editando ? (
            <>
              <button 
                type="button"
                className={styles.btnGhost}
                onClick={async () => {
                  const ok = await confirm({
                    title: "Excluir denúncia",
                    message: `Deseja excluir a denúncia ${dados.id}? Esta ação não pode ser desfeita.`,
                    confirmText: "Excluir",
                  });
                  if (!ok) return;
                  onExcluir?.(dados.id);
                  onFechar();
                }}
                style={{ 
                  color: "#dc2626",
                  borderColor: "#fca5a5"
                }}
              >
                Excluir
              </button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  type="button"
                  className={styles.btnFicha}
                  onClick={() => setMostrandoTermo(true)}
                >
                  Gerar Termo
                </button>
                <button 
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => setEditando(true)}
                >
                  Editar
                </button>
              </div>
            </>
          ) : (
            <>
              <button 
                type="button"
                className={styles.btnGhost}
                onClick={() => {
                  setEditando(false);
                  setForm(dados);
                  setErro("");
                }}
                disabled={salvando}
              >
                Cancelar
              </button>
              <button 
                type="button"
                className={styles.btnPrimary}
                onClick={handleSalvar}
                disabled={salvando}
              >
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
