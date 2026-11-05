"use client";

import { useState, useEffect } from "react";
import Image from 'next/image';
import stylesModal from "./AgendaCCZ.module.css";
import styles from "./ListaCCZ.module.css";
import stylesTermo from "./TermoProcedimento.module.css";
import { obterEsporotricose, excluirEsporotricose, encerrarEsporotricose, reabrirEsporotricose, registrarIncineracaoEsporotricose } from "./actions";
import { gerarTermoEsporotricose } from "./esporotricosePdf";
import { useConfirm, useNotify } from "@/components/ConfirmDialog";

const formatarData = (ymd) => (ymd ? ymd.split("-").reverse().join("/") : "-");
const formatarDataHora = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR")}`;
};

export default function FichaEsporotricose({ esporotricoseId, onFechar, onEditar, onBaixarFicha }) {
  const confirm = useConfirm();
  const notify = useNotify();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [mostrandoTermo, setMostrandoTermo] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const [salvandoIncineracao, setSalvandoIncineracao] = useState(false);

  useEffect(() => {
    const carregar = async () => {
      setCarregando(true);
      const res = await obterEsporotricose(esporotricoseId);
      if (res.success) {
        setDados(res.data);
      }
      setCarregando(false);
    };
    carregar();
  }, [esporotricoseId]);

  const handleEncerrar = async () => {
    const ok = await confirm({
      title: "Encerrar caso de esporotricose",
      message: "Deseja encerrar este caso? Ele será marcado como encerrado.",
      confirmText: "Encerrar",
    });
    if (!ok) return;

    setEncerrando(true);
    const res = await encerrarEsporotricose(esporotricoseId);
    setEncerrando(false);

    if (res.success) {
      await notify({ tipo: "sucesso", message: "Caso encerrado com sucesso!" });
      // Recarrega os dados para refletir o novo estado na ficha.
      const atualizado = await obterEsporotricose(esporotricoseId);
      if (atualizado.success) setDados(atualizado.data);
    } else {
      await notify({ tipo: "erro", message: res.error || "Erro ao encerrar o caso." });
    }
  };

  const handleReabrir = async () => {
    const ok = await confirm({
      title: "Reabrir caso de esporotricose",
      message: "Deseja reabrir este caso? Ele voltará para Em andamento.",
      confirmText: "Reabrir",
    });
    if (!ok) return;

    setEncerrando(true);
    const res = await reabrirEsporotricose(esporotricoseId);
    setEncerrando(false);

    if (res.success) {
      await notify({ tipo: "sucesso", message: "Caso reaberto com sucesso!" });
      // Recarrega os dados para refletir o novo estado na ficha.
      const atualizado = await obterEsporotricose(esporotricoseId);
      if (atualizado.success) setDados(atualizado.data);
    } else {
      await notify({ tipo: "erro", message: res.error || "Erro ao reabrir o caso." });
    }
  };

  // Atualização inline do estado de incineração (independente do encerramento).
  // Segue o padrão das edições inline da ficha: persiste direto e notifica,
  // sem diálogo de confirmação.
  const handleIncineracao = async (valor) => {
    setSalvandoIncineracao(true);
    const res = await registrarIncineracaoEsporotricose(esporotricoseId, valor);
    setSalvandoIncineracao(false);

    if (res.success) {
      await notify({ tipo: "sucesso", message: "Informação de incineração atualizada!" });
      const atualizado = await obterEsporotricose(esporotricoseId);
      if (atualizado.success) setDados(atualizado.data);
    } else {
      await notify({ tipo: "erro", message: res.error || "Erro ao atualizar a incineração." });
    }
  };

  const handleExcluir = async () => {
    const ok = await confirm({
      title: "Excluir registro de esporotricose",
      message: "Tem certeza que deseja excluir este registro de esporotricose? Esta ação não pode ser desfeita.",
      confirmText: "Excluir",
    });
    if (!ok) return;

    setExcluindo(true);
    const res = await excluirEsporotricose(esporotricoseId);
    setExcluindo(false);

    if (res.success) {
      await notify({ tipo: "sucesso", message: "Registro excluído com sucesso!" });
      onFechar();
      // Recarrega a página para atualizar a lista
      window.location.reload();
    } else {
      await notify({ tipo: "erro", message: res.error || "Erro ao excluir o registro." });
    }
  };

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

  if (!dados) {
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
            <p>Não foi possível carregar a ficha de esporotricose.</p>
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
                <h2>TERMO DE VISTORIA / ESPOROTRICOSE</h2>
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
                  declaro que fui devidamente informado(a) pela equipe técnica do Centro de Controle de Zoonoses 
                  sobre a esporotricose felina, seus riscos à saúde pública e animal, e as medidas de controle necessárias.
                </p>
                <p>Fui orientado(a) quanto aos seguintes pontos:</p>
                <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                  <li>A esporotricose é uma doença causada por fungo, transmissível ao ser humano;</li>
                  <li>O animal diagnosticado deve ser tratado conforme orientação veterinária;</li>
                  <li>É necessário manter o animal em ambiente adequado, evitando o contato com outros animais e pessoas vulneráveis;</li>
                  <li>Os cuidados de higiene e manejo são fundamentais para prevenir a disseminação da doença;</li>
                  <li>O acompanhamento veterinário deve ser mantido até a alta clínica.</li>
                </ul>
                <p>
                  Comprometo-me a seguir todas as orientações fornecidas pela equipe do CCZ e a comunicar 
                  qualquer alteração no estado de saúde do animal.
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
                gerarTermoEsporotricose(dadosComTutor);
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

  // Mostra a ficha completa
  return (
    <div className={stylesModal.modalOverlay} onClick={onFechar}>
      <div
        className={stylesModal.modal}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "1000px", maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className={stylesModal.modalHeader}>
          <div>
            <h3 className={stylesModal.modalTitle}>
              Ficha Completa · Esporotricose{" "}
              <span className={dados.encerrado ? styles.badgeDanger : styles.badgeSuccess} style={{ marginLeft: "0.5rem", verticalAlign: "middle" }}>
                {dados.encerrado ? "Encerrado" : "Em andamento"}
              </span>
            </h3>
            <p className={stylesModal.modalSubtitle}>
              Protocolo: {dados.numeroProtocolo || "Sem protocolo"} | 
              Animal: {dados.animal?.nome || "Sem nome"} ({dados.animalId})
              {dados.encerrado && dados.dataEncerramento && (
                <>
                  {" · Encerrado em "}
                  {formatarDataHora(dados.dataEncerramento)}
                  {dados.encerradoPor ? ` por ${dados.encerradoPor}` : ""}
                </>
              )}
            </p>
          </div>
          <button type="button" className={stylesModal.modalClose} onClick={onFechar}>
            ✕
          </button>
        </div>

        <div className={stylesModal.modalBody}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            
            {/* Dados do Animal */}
            <section>
              <h4 style={{ 
                fontSize: "0.75rem", 
                fontWeight: "700", 
                color: "#64748b", 
                textTransform: "uppercase", 
                letterSpacing: "0.05em",
                marginBottom: "1rem"
              }}>
                Dados do Animal
              </h4>
              
              {/* Foto do animal */}
              {dados.animal?.fotoUrl && (
                <div style={{ marginBottom: "1rem" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={dados.animal.fotoUrl}
                    alt={dados.animal.nome || "Animal"}
                    style={{
                      width: "100px",
                      height: "100px",
                      borderRadius: "8px",
                      objectFit: "cover",
                      border: "1px solid #cbd5e1",
                    }}
                  />
                </div>
              )}
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    Nome
                  </label>
                  <div style={{ 
                    padding: "0.5rem 0.75rem", 
                    backgroundColor: "#f8fafc", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#1e293b"
                  }}>
                    {dados.animal?.nome || "-"}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    ID
                  </label>
                  <div style={{ 
                    padding: "0.5rem 0.75rem", 
                    backgroundColor: "#f8fafc", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#1e293b"
                  }}>
                    {dados.animal?.id || dados.animalId || "-"}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    Espécie
                  </label>
                  <div style={{ 
                    padding: "0.5rem 0.75rem", 
                    backgroundColor: "#f8fafc", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#1e293b"
                  }}>
                    {dados.animal?.especie || "-"}
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
                    {dados.animal?.sexo || "-"}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    Porte
                  </label>
                  <div style={{ 
                    padding: "0.5rem 0.75rem", 
                    backgroundColor: "#f8fafc", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#1e293b"
                  }}>
                    {dados.animal?.porte || "-"}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                    Idade
                  </label>
                  <div style={{ 
                    padding: "0.5rem 0.75rem", 
                    backgroundColor: "#f8fafc", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#1e293b"
                  }}>
                    {dados.animal?.idade || "-"}
                  </div>
                </div>
              </div>
            </section>

            {/* Dados do Tutor */}
            {dados.temTutor && dados.tutor && (
              <section>
                <h4 style={{ 
                  fontSize: "0.75rem", 
                  fontWeight: "700", 
                  color: "#64748b", 
                  textTransform: "uppercase", 
                  letterSpacing: "0.05em",
                  marginBottom: "1rem"
                }}>
                  Tutor
                </h4>
                
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                      Nome
                    </label>
                    <div style={{ 
                      padding: "0.5rem 0.75rem", 
                      backgroundColor: "#f8fafc", 
                      border: "1px solid #e2e8f0", 
                      borderRadius: "6px",
                      fontSize: "0.875rem",
                      color: "#1e293b"
                    }}>
                      {dados.tutor.nome || "-"}
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
                      {dados.tutor.cpf || "-"}
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#475569", marginBottom: "0.25rem" }}>
                      Telefone
                    </label>
                    <div style={{ 
                      padding: "0.5rem 0.75rem", 
                      backgroundColor: "#f8fafc", 
                      border: "1px solid #e2e8f0", 
                      borderRadius: "6px",
                      fontSize: "0.875rem",
                      color: "#1e293b"
                    }}>
                      {dados.tutor.telefone || "-"}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Dados da Visita Inicial */}
            <section className={styles.fichaSecao}>
              <h4 className={styles.fichaTitle}>Visita Inicial</h4>
              <div className={styles.fichaGrid}>
                <div><strong>Data:</strong> {formatarData(dados.dataVisita)}</div>
                <div><strong>Protocolo:</strong> {dados.numeroProtocolo || "-"}</div>
                <div><strong>Fiscal:</strong> {dados.fiscalResponsavel || "-"}</div>
                <div><strong>Apresenta lesões:</strong> {dados.apresentaLesoes}</div>
              </div>
              
              {dados.descricaoLesoes && (
                <div style={{marginTop: "0.75rem"}}>
                  <strong>Descrição das lesões:</strong>
                  <p style={{margin: "0.25rem 0 0", color: "#64748b"}}>{dados.descricaoLesoes}</p>
                </div>
              )}

              {dados.emTratamentoVeterinario === "Sim" && (
                <div style={{marginTop: "0.75rem"}}>
                  <strong>Tratamento veterinário:</strong>
                  <p style={{margin: "0.25rem 0 0", color: "#64748b"}}>{dados.descricaoTratamentoVet || "Em tratamento"}</p>
                </div>
              )}
            </section>

            {/* Tratamento */}
            <section className={styles.fichaSecao}>
              <h4 className={styles.fichaTitle}>Tratamento</h4>
              <div className={styles.fichaGrid}>
                <div><strong>Medicamentos:</strong> {dados.medicamentosPrescritos || "-"}</div>
                <div><strong>Interrupção:</strong> {dados.interrupcaoTratamento}</div>
                <div><strong>Retorno veterinário:</strong> {dados.retornoVeterinario}</div>
              </div>
            </section>

            {/* Manejo Domiciliar (se tem tutor) */}
            {dados.temTutor && (
              <section className={styles.fichaSecao}>
                <h4 className={styles.fichaTitle}>Manejo Domiciliar</h4>
                <div className={styles.fichaGrid}>
                  <div><strong>Isolamento:</strong> {dados.isolamentoDomiciliar}</div>
                  <div><strong>Acesso à rua:</strong> {dados.acessoRua}</div>
                  <div><strong>Uso de EPI:</strong> {dados.usoEpi}</div>
                  <div><strong>Higienização:</strong> {dados.higienizacaoAmbiente || "-"}</div>
                </div>
                
                {dados.outrosAnimaisResidencia === "Sim" && (
                  <div style={{marginTop: "0.75rem"}}>
                    <strong>Outros animais na residência:</strong>
                    <p style={{margin: "0.25rem 0 0", color: "#64748b"}}>{dados.outrosAnimaisDescricao || "Sim"}</p>
                  </div>
                )}

                {dados.pessoasComLesoes === "Sim" && (
                  <div style={{marginTop: "0.75rem"}}>
                    <strong>Pessoas com lesões:</strong>
                    <p style={{margin: "0.25rem 0 0", color: "#dc2626"}}>{dados.pessoasLesoesDescricao || "Sim"}</p>
                  </div>
                )}
              </section>
            )}

            {/* Conclusão Técnica */}
            {dados.conclusaoTecnica && (
              <section className={styles.fichaSecao}>
                <h4 className={styles.fichaTitle}>Conclusão Técnica</h4>
                <p style={{margin: "0", color: "#64748b"}}>{dados.conclusaoTecnica}</p>
              </section>
            )}

            {/* Encaminhamentos */}
            <section className={styles.fichaSecao}>
              <h4 className={styles.fichaTitle}>Encaminhamentos</h4>
              <div style={{display: "flex", flexDirection: "column", gap: "0.5rem"}}>
                <div>
                  {dados.encAcompanhamentoCcz ? "☑" : "☐"} Acompanhamento periódico pelo CCZ
                </div>
                <div>
                  {dados.encNotificacaoTutor ? "☑" : "☐"} Notificação ao tutor
                </div>
                <div>
                  {dados.encMinisterioPublico ? "☑" : "☐"} Encaminhamento ao Ministério Público
                </div>
                <div>
                  {dados.encOutrasMedidas ? "☑" : "☐"} Outras medidas
                </div>
              </div>
              {dados.outrasMedidasDescricao && (
                <p style={{margin: "0.75rem 0 0", color: "#64748b"}}>{dados.outrasMedidasDescricao}</p>
              )}
            </section>

            {/* Incineração do animal (independente do encerramento) */}
            <section className={styles.fichaSecao}>
              <h4 className={styles.fichaTitle}>Incineração do Animal</h4>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "#475569" }}>
                  Animal foi incinerado?
                </label>
                <select
                  value={dados.incinerado || ""}
                  onChange={(e) => handleIncineracao(e.target.value)}
                  disabled={salvandoIncineracao}
                  style={{
                    padding: "0.5rem 0.75rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#1e293b",
                    backgroundColor: "#fff",
                    minWidth: "180px",
                  }}
                >
                  <option value="">Não informado</option>
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                </select>
                {salvandoIncineracao && (
                  <span style={{ fontSize: "0.875rem", color: "#64748b" }}>Salvando...</span>
                )}
                {dados.incinerado === "Sim" && dados.dataIncineracao && (
                  <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
                    Incinerado em {formatarDataHora(dados.dataIncineracao)}
                  </span>
                )}
              </div>
            </section>

            {/* Visitas de Acompanhamento */}
            {dados.visitas && dados.visitas.length > 0 && (
              <section className={styles.fichaSecao}>
                <h4 className={styles.fichaTitle}>Visitas de Acompanhamento ({dados.visitas.length})</h4>
                <div style={{display: "flex", flexDirection: "column", gap: "1rem"}}>
                  {dados.visitas.map((visita, idx) => (
                    <div key={idx} className={styles.visitaCard}>
                      <div style={{display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem"}}>
                        <div>
                          <strong style={{color: "#2563eb"}}>Visita {idx + 1}</strong>
                          <div style={{fontSize: "0.875rem", color: "#64748b", marginTop: "0.25rem"}}>
                            Data: {formatarData(visita.data)}
                          </div>
                        </div>
                        {visita.relatorio && (
                          <span className={styles.badgeSuccess}>Com relatório</span>
                        )}
                      </div>

                      {visita.observacao && (
                        <div style={{marginTop: "0.5rem"}}>
                          <strong style={{fontSize: "0.875rem"}}>Observação:</strong>
                          <p style={{margin: "0.25rem 0 0", fontSize: "0.875rem", color: "#64748b"}}>
                            {visita.observacao}
                          </p>
                        </div>
                      )}

                      {/* Dados do Relatório */}
                      {visita.relatorio && (
                        <div className={styles.relatorioBox}>
                          <div style={{fontWeight: "600", marginBottom: "0.5rem", color: "#0f766e"}}>
                            Relatório de Acompanhamento
                          </div>
                          
                          <div style={{display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem", fontSize: "0.875rem"}}>
                            <div>
                              <strong style={{display: "inline", marginBottom: 0}}>Profissional:</strong> {visita.relatorio.profissionalResponsavel}
                            </div>
                            <div>
                              <strong style={{display: "inline", marginBottom: 0}}>Data do relatório:</strong> {formatarDataHora(visita.relatorio.dataRelatorio)}
                            </div>
                            <div>
                              <strong style={{display: "inline", marginBottom: 0}}>Lesões:</strong> {visita.relatorio.apresentaLesoes}
                            </div>
                            <div>
                              <strong style={{display: "inline", marginBottom: 0}}>Evolução:</strong> 
                              <span className={
                                visita.relatorio.evolucaoQuadro === "Melhora" ? styles.badgeSuccess :
                                visita.relatorio.evolucaoQuadro === "Piora" ? styles.badgeDanger :
                                visita.relatorio.evolucaoQuadro === "Crítico" ? styles.badgeDanger :
                                styles.badgeWarning
                              } style={{marginLeft: "0.5rem"}}>
                                {visita.relatorio.evolucaoQuadro}
                              </span>
                            </div>
                            <div>
                              <strong style={{display: "inline", marginBottom: 0}}>Tratamento:</strong> {visita.relatorio.emTratamento}
                            </div>
                            <div>
                              <strong style={{display: "inline", marginBottom: 0}}>Adesão:</strong> 
                              <span className={
                                visita.relatorio.adesaoTratamento === "Boa" ? styles.badgeSuccess :
                                visita.relatorio.adesaoTratamento === "Regular" ? styles.badgeWarning :
                                styles.badgeDanger
                              } style={{marginLeft: "0.5rem"}}>
                                {visita.relatorio.adesaoTratamento}
                              </span>
                            </div>
                          </div>

                          {visita.relatorio.descricaoLesoes && (
                            <div style={{marginTop: "0.75rem", fontSize: "0.875rem"}}>
                              <strong style={{display: "inline", fontSize: "0.875rem", marginBottom: 0}}>Descrição das lesões:</strong>{" "}
                              <span style={{fontSize: "0.875rem", color: "#64748b"}}>
                                {visita.relatorio.descricaoLesoes}
                              </span>
                            </div>
                          )}

                          {visita.relatorio.medicamentosAtuais && (
                            <div style={{marginTop: "0.75rem", fontSize: "0.875rem"}}>
                              <strong style={{display: "inline", fontSize: "0.875rem", marginBottom: 0}}>Medicamentos atuais:</strong>{" "}
                              <span style={{fontSize: "0.875rem", color: "#64748b"}}>
                                {visita.relatorio.medicamentosAtuais}
                              </span>
                            </div>
                          )}

                          <div style={{marginTop: "0.75rem", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem", fontSize: "0.875rem"}}>
                            <div>
                              <strong style={{display: "inline", marginBottom: 0}}>Isolamento:</strong> {visita.relatorio.isolamentoAdequado}
                            </div>
                            <div>
                              <strong style={{display: "inline", marginBottom: 0}}>EPI:</strong> {visita.relatorio.usoEpiAdequado}
                            </div>
                            <div>
                              <strong style={{display: "inline", marginBottom: 0}}>Higienização:</strong> {visita.relatorio.higienizacaoAdequada}
                            </div>
                          </div>

                          {visita.relatorio.observacoesGerais && (
                            <div style={{marginTop: "0.75rem", fontSize: "0.875rem"}}>
                              <strong style={{display: "inline", fontSize: "0.875rem", marginBottom: 0}}>Observações gerais:</strong>{" "}
                              <span style={{fontSize: "0.875rem", color: "#64748b"}}>
                                {visita.relatorio.observacoesGerais}
                              </span>
                            </div>
                          )}

                          {(visita.relatorio.encVeterinario || visita.relatorio.encNotificacao || visita.relatorio.encOutros) && (
                            <div style={{marginTop: "0.75rem", padding: "0.75rem", backgroundColor: "#fef3c7", borderRadius: "6px"}}>
                              <strong style={{fontSize: "0.875rem", color: "#92400e"}}>Encaminhamentos:</strong>
                              <div style={{marginTop: "0.5rem", fontSize: "0.875rem"}}>
                                {visita.relatorio.encVeterinario && <div>• Veterinário</div>}
                                {visita.relatorio.encNotificacao && <div>• Nova notificação</div>}
                                {visita.relatorio.encOutros && <div>• Outros</div>}
                              </div>
                              {visita.relatorio.descricaoEncaminhamentos && (
                                <p style={{margin: "0.5rem 0 0", fontSize: "0.875rem", color: "#78350f"}}>
                                  {visita.relatorio.descricaoEncaminhamentos}
                                </p>
                              )}
                            </div>
                          )}

                          {visita.relatorio.necessidadeNovaVisita === "Sim" && visita.relatorio.dataProximaVisita && (
                            <div style={{marginTop: "0.75rem", padding: "0.75rem", backgroundColor: "#dbeafe", borderRadius: "6px", fontSize: "0.875rem"}}>
                              <strong style={{display: "inline", fontSize: "0.875rem", color: "#1e40af", marginBottom: 0}}>Próxima visita sugerida:</strong>{" "}
                              <span style={{fontSize: "0.875rem", color: "#1e3a8a"}}>
                                {formatarData(visita.relatorio.dataProximaVisita)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>
        </div>

        <div className={styles.modalFooter}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              type="button"
              className={styles.btnGhost}
              onClick={() => {
                onBaixarFicha?.(dados.id);
              }}
            >
              Baixar Ficha
            </button>
            <button 
              type="button"
              className={styles.btnGhost}
              onClick={handleExcluir}
              disabled={excluindo}
              style={{ color: '#dc2626' }}
            >
              {excluindo ? "Excluindo..." : "Excluir"}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {!dados.encerrado ? (
              <button
                type="button"
                className={styles.btnFicha}
                onClick={handleEncerrar}
                disabled={encerrando}
              >
                {encerrando ? "Encerrando..." : "Encerrar caso"}
              </button>
            ) : (
              <button
                type="button"
                className={styles.btnFicha}
                onClick={handleReabrir}
                disabled={encerrando}
              >
                {encerrando ? "Reabrindo..." : "Reabrir caso"}
              </button>
            )}
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
