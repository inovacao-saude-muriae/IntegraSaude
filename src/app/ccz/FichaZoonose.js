"use client";

import { useState, useEffect } from "react";
import Image from 'next/image';
import stylesModal from "./AgendaCCZ.module.css";
import styles from "./ListaCCZ.module.css";
import stylesTermo from "./TermoProcedimento.module.css";
import { gerarTermoZoonose } from "./zoonosesPdf";

const formatarData = (ymd) => (ymd ? ymd.split("-").reverse().join("/") : "-");

export default function FichaZoonose({ zoonoseId, onFechar, onEditar, onExcluir }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mostrandoTermo, setMostrandoTermo] = useState(false);

  useEffect(() => {
    const carregar = async () => {
      setCarregando(true);
      setErro("");
      try {
        console.log("Buscando zoonose ID:", zoonoseId);
        const res = await fetch(`/api/ccz/zoonoses/${zoonoseId}`);
        console.log("Response status:", res.status);
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error("Erro na API:", errorText);
          throw new Error(`Erro ${res.status}: ${errorText}`);
        }
        
        const data = await res.json();
        console.log("Dados recebidos:", data);
        setDados(data);
      } catch (error) {
        console.error("Erro ao carregar ficha:", error);
        setErro(error.message || "Erro ao carregar ficha");
      } finally {
        setCarregando(false);
      }
    };
    carregar();
  }, [zoonoseId]);

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
            <p>{erro || "Não foi possível carregar a ficha de zoonose."}</p>
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
                <h2>TERMO DE NOTIFICAÇÃO DE ZOONOSE</h2>
              </div>
            </div>

            <div className={stylesTermo.linha}></div>

            {/* TEXTO EXPLICATIVO */}
            <div className={stylesTermo.secao}>
              <div className={stylesTermo.textoExplicativo}>
                <p>
                  Eu, <strong>{dados.tutor?.nome || 'Sem tutor'}</strong>
                  {dados.tutor?.endereco && (
                    <>, residente no endereço <strong>{dados.tutor.endereco}</strong></>
                  )}, 
                  responsável pelo animal <strong>{dados.animal?.nome || '______________________'}</strong>, 
                  declaro que fui devidamente informado(a) pela equipe técnica do Centro de Controle de Zoonoses sobre a notificação de{' '}
                  <strong>{dados.doenca || '____________________________'}</strong>, 
                  classificada como grau de risco <strong>{dados.grauRisco || '____________'}</strong>.
                </p>
                <p>Fui orientado(a) quanto aos seguintes pontos:</p>
                <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                  <li>A doença notificada requer acompanhamento veterinário e medidas de controle específicas;</li>
                  <li>É fundamental seguir rigorosamente as orientações da equipe técnica do CCZ;</li>
                  <li>O não cumprimento das medidas recomendadas pode agravar o quadro e representar risco à saúde pública;</li>
                  <li>Devo comunicar imediatamente qualquer alteração no estado de saúde do animal;</li>
                  <li>É necessário manter o ambiente higienizado e adotar as medidas preventivas indicadas.</li>
                </ul>
                <p>
                  Comprometo-me a seguir todas as orientações fornecidas pela equipe do CCZ e a colaborar 
                  com o monitoramento necessário para o controle da zoonose notificada.
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
                gerarTermoZoonose(dadosComTutor);
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

  const obterCorGrauRisco = (grau) => {
    const cores = {
      Baixo: "#10b981",
      Moderado: "#f59e0b",
      Alto: "#f97316",
      Crítico: "#ef4444",
    };
    return cores[grau] || "#6b7280";
  };

  return (
    <div className={stylesModal.modalOverlay} onClick={onFechar}>
      <div
        className={stylesModal.modal}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "900px", maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className={stylesModal.modalHeader}>
          <div>
            <h3 className={stylesModal.modalTitle}>Ficha de Zoonose</h3>
            <p className={stylesModal.modalSubtitle}>
              Animal: {dados.animal?.nome || "Sem nome"} ({dados.animalId})
            </p>
          </div>
          <button type="button" className={stylesModal.modalClose} onClick={onFechar}>
            ✕
          </button>
        </div>

        <div className={stylesModal.modalBody}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            
            {/* Dados do Animal */}
            <section className={styles.fichaSecao}>
              <h4 className={styles.fichaTitle}>Dados do Animal</h4>
              
              <div className={styles.fichaGrid}>
                <div><strong>Nome:</strong> {dados.animal?.nome || "-"}</div>
                <div><strong>ID:</strong> {dados.animal?.id || "-"}</div>
                <div><strong>Espécie:</strong> {dados.animal?.especie || "-"}</div>
              </div>
            </section>

            {/* Informações da Zoonose */}
            <section className={styles.fichaSecao}>
              <h4 className={styles.fichaTitle}>Informações da Zoonose</h4>
              <div className={styles.fichaGrid}>
                <div><strong>Nome da Doença:</strong> {dados.doenca || "-"}</div>
                <div><strong>Data de Identificação:</strong> {formatarData(dados.dataIdentificacao)}</div>
                <div>
                  <strong>Grau de Risco:</strong>
                  <span
                    style={{
                      marginLeft: "0.5rem",
                      backgroundColor: obterCorGrauRisco(dados.grauRisco),
                      color: "white",
                      padding: "0.25rem 0.65rem",
                      borderRadius: "999px",
                      fontSize: "0.75rem",
                      fontWeight: "600",
                      textTransform: "uppercase",
                    }}
                  >
                    {dados.grauRisco}
                  </span>
                </div>
                <div>
                  <strong>Risco de Vida:</strong>
                  <span
                    style={{
                      marginLeft: "0.5rem",
                      backgroundColor: dados.riscoVida === "Sim" ? "#ef4444" : "#10b981",
                      color: "white",
                      padding: "0.25rem 0.65rem",
                      borderRadius: "999px",
                      fontSize: "0.75rem",
                      fontWeight: "600",
                    }}
                  >
                    {dados.riscoVida === "Sim" ? "⚠️ Sim" : "✓ Não"}
                  </span>
                </div>
              </div>
              
              {dados.formasContaminacao && (
                <div style={{ marginTop: "1rem" }}>
                  <strong>Formas de Contaminação:</strong>
                  <div style={{ 
                    marginTop: "0.5rem", 
                    padding: "0.75rem", 
                    backgroundColor: "#f8fafc", 
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0"
                  }}>
                    {dados.formasContaminacao}
                  </div>
                </div>
              )}
            </section>

            {/* Monitoramento */}
            <section className={styles.fichaSecao}>
              <h4 className={styles.fichaTitle}>Monitoramento</h4>
              <div className={styles.fichaGrid}>
                <div><strong>Solicitação de Acompanhamento:</strong> {dados.periodoMonitoramento || "Não"}</div>
                {dados.periodoMonitoramento === "Sim" && dados.dataAgendamento && (
                  <div><strong>Data Agendada:</strong> {formatarData(dados.dataAgendamento)}</div>
                )}
                <div><strong>Responsável pelo Monitoramento:</strong> {dados.responsavelMonitoramento || "-"}</div>
              </div>
            </section>

            {/* Observações */}
            {dados.observacao && (
              <section className={styles.fichaSecao}>
                <h4 className={styles.fichaTitle}>Observações</h4>
                <div style={{ 
                  padding: "0.75rem", 
                  backgroundColor: "#f8fafc", 
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  whiteSpace: "pre-wrap"
                }}>
                  {dados.observacao}
                </div>
              </section>
            )}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button 
            className={styles.btnGhost}
            onClick={() => {
              if (window.confirm("Tem certeza que deseja excluir esta notificação de zoonose?")) {
                onExcluir?.(dados.id);
                onFechar();
              }
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
              className={styles.btnFicha}
              onClick={() => setMostrandoTermo(true)}
            >
              Gerar Termo
            </button>
            <button 
              className={styles.btnPrimary}
              onClick={() => {
                onEditar?.(dados.id);
                onFechar();
              }}
            >
              Editar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
