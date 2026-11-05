"use client";

import { useState, useEffect } from "react";
import styles from "./ListaCCZ.module.css";
import { obterHistoricoCompleto } from "./actions";
import { gerarHistoricoCompletoPdf } from "./historicoAnimalPdf";

export default function FichaCompletaAnimal({ animalId, onFechar }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = async () => {
    setCarregando(true);
    setErro("");
    const res = await obterHistoricoCompleto(animalId);
    if (res.success) {
      setDados(res.data);
    } else {
      setErro(res.error || "Erro ao carregar histórico.");
    }
    setCarregando(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronização inicial/carregamento de dados; comportamento intencional
    carregar();
  }, [animalId]);

  const formatarData = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR");
  };

  const formatarEndereco = (end) => {
    if (!end) return "-";
    const partes = [];
    if (end.logradouro) partes.push(end.logradouro);
    if (end.numero) partes.push(end.numero);
    if (end.complemento) partes.push(end.complemento);
    if (end.bairro) partes.push(end.bairro);
    if (end.cidade && end.uf) partes.push(`${end.cidade}/${end.uf}`);
    if (end.cep) partes.push(`CEP: ${end.cep}`);
    return partes.length > 0 ? partes.join(", ") : "-";
  };

  const baixarPDF = () => {
    if (!dados) return;
    gerarHistoricoCompletoPdf(dados);
  };

  if (carregando) {
    return (
      <div className={styles.modalOverlay} onClick={onFechar}>
        <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
          <p style={{ textAlign: "center", padding: "2rem" }}>Carregando histórico...</p>
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className={styles.modalOverlay} onClick={onFechar}>
        <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>Erro</h2>
            <button className={styles.btnFechar} onClick={onFechar}>
              ✕
            </button>
          </div>
          <div className={styles.alertErro}>{erro}</div>
        </div>
      </div>
    );
  }

  if (!dados) return null;

  const { animal, tutor, procedimentos, denuncias, esporotricose } = dados;

  // Montar linha do tempo unificada
  const timeline = [];

  // Adicionar cadastro
  if (animal.dataCadastro) {
    timeline.push({
      data: animal.dataCadastro,
      tipo: "cadastro",
      titulo: "Cadastro inicial",
      descricao: `Animal cadastrado no sistema`,
    });
  }

  // Adicionar procedimentos (vacinações, castrações, etc.)
  procedimentos.forEach((p) => {
    const tipoFormatado = p.tipo.toLowerCase();
    let icone = "🏥";
    let tipo = "procedimento";
    
    if (tipoFormatado.includes("vacin") || tipoFormatado.includes("antirrábica")) {
      icone = "💉";
      tipo = "vacinacao";
    } else if (tipoFormatado.includes("castraç") || tipoFormatado.includes("esteriliz")) {
      icone = "✂️";
      tipo = "castracao";
    } else if (tipoFormatado.includes("recolh")) {
      icone = "🚐";
      tipo = "recolhimento";
    }
    
    timeline.push({
      data: p.dataProcedimento,
      tipo: tipo,
      icone: icone,
      titulo: `${p.tipo}${p.status ? ` - ${p.status}` : ""}`,
      descricao: p.descricao || p.medicacaoPrescrita || "-",
    });
  });

  // Adicionar denúncias
  denuncias.forEach((d) => {
    timeline.push({
      data: d.dataDenuncia,
      tipo: "denuncia",
      titulo: `Denúncia: Cão agressivo`,
      descricao: `Local: ${d.localizacao} | Risco: ${d.causouRisco}`,
    });
  });

  // Adicionar esporotricose (visita inicial)
  esporotricose.forEach((e) => {
    // Montar descrição detalhada da visita inicial
    const descInicial = [];
    
    if (e.numeroProtocolo) descInicial.push(`Protocolo: ${e.numeroProtocolo}`);
    if (e.fiscalResponsavel) descInicial.push(`Fiscal: ${e.fiscalResponsavel}`);
    if (e.apresentaLesoes) {
      descInicial.push(`Apresenta lesões: ${e.apresentaLesoes}`);
      if (e.apresentaLesoes === "Sim" && e.descricaoLesoes) {
        descInicial.push(`Descrição: ${e.descricaoLesoes}`);
      }
    }
    if (e.emTratamentoVeterinario) {
      descInicial.push(`Em tratamento veterinário: ${e.emTratamentoVeterinario}`);
      if (e.emTratamentoVeterinario === "Sim" && e.descricaoTratamentoVet) {
        descInicial.push(`Tratamento: ${e.descricaoTratamentoVet}`);
      }
    }
    if (e.conclusaoTecnica) descInicial.push(`Conclusão: ${e.conclusaoTecnica}`);
    
    timeline.push({
      data: e.dataVisita,
      tipo: "esporotricose",
      titulo: "Esporotricose - Visita inicial",
      descricao: descInicial.length > 0 ? descInicial.join(" | ") : "Visita inicial registrada",
    });

    // Adicionar visitas de acompanhamento
    e.visitas.forEach((v) => {
      const desc = [];
      
      if (v.temRelatorio && v.relatorio) {
        // Montar descrição detalhada do relatório
        if (v.relatorio.evolucaoQuadro) desc.push(`Evolução: ${v.relatorio.evolucaoQuadro}`);
        if (v.relatorio.apresentaLesoes === "Sim" && v.relatorio.descricaoLesoes) {
          desc.push(`Lesões: ${v.relatorio.descricaoLesoes}`);
        }
        if (v.relatorio.medicamentosAtuais) desc.push(`Medicamentos: ${v.relatorio.medicamentosAtuais}`);
        if (v.relatorio.adesaoTratamento) desc.push(`Adesão: ${v.relatorio.adesaoTratamento}`);
      }
      
      timeline.push({
        data: v.data,
        tipo: v.temRelatorio ? "visita_relatorio" : "visita",
        titulo: "Esporotricose - Acompanhamento",
        descricao: desc.length > 0 ? desc.join(" | ") : (v.observacao || `Visita agendada para ${formatarData(v.data)}`),
        relatorio: v.temRelatorio ? v.relatorio : null, // Guardar relatório completo
      });
    });
  });

  // Ordenar por data (mais recente primeiro)
  timeline.sort((a, b) => new Date(b.data) - new Date(a.data));

  // Ícones e cores por tipo
  const tipoConfig = {
    cadastro: { icone: "📝", cor: "#64748b" },
    vacinacao: { icone: "💉", cor: "#10b981" },
    castracao: { icone: "✂️", cor: "#8b5cf6" },
    recolhimento: { icone: "🚐", cor: "#f59e0b" },
    procedimento: { icone: "🏥", cor: "#3b82f6" },
    denuncia: { icone: "⚠️", cor: "#f59e0b" },
    esporotricose: { icone: "🦠", cor: "#f59e0b" },
    visita: { icone: "📅", cor: "#8b5cf6" },
    visita_relatorio: { icone: "📋", cor: "#8b5cf6" },
  };

  return (
    <div className={styles.modalOverlay} onClick={onFechar}>
      <div
        className={`${styles.modalBox} ${styles.modalLarge}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            Ficha completa - {animal.nome || "Animal"} (ID: {animal.id})
          </h2>
          <button className={styles.btnFechar} onClick={onFechar}>
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* CABEÇALHO DO RELATÓRIO */}
          <div className={styles.relatorioHeader}>
            <h2 className={styles.relatorioTitulo}>FICHA COMPLETA DO ANIMAL E HISTÓRICO</h2>
            <p className={styles.relatorioSubtitulo}>Período: Histórico completo</p>
          </div>

          {/* DADOS DO ANIMAL */}
          <div className={styles.prontuarioSecao}>
            <h3 className={styles.prontuarioTitulo}>Dados do Animal</h3>
            
            {animal.fotoUrl && (
              <div className={styles.fotoAnimalProntuario}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={animal.fotoUrl} alt={animal.nome} />
              </div>
            )}

            <div className={styles.prontuarioGrid}>
              <div className={styles.prontuarioCampo}>
                <label>ID</label>
                <div className={styles.prontuarioValor}>{animal.id}</div>
              </div>
              <div className={styles.prontuarioCampo}>
                <label>Nome</label>
                <div className={styles.prontuarioValor}>{animal.nome || "-"}</div>
              </div>
              <div className={styles.prontuarioCampo}>
                <label>Espécie</label>
                <div className={styles.prontuarioValor}>{animal.especie || "-"}</div>
              </div>
              <div className={styles.prontuarioCampo}>
                <label>Sexo</label>
                <div className={styles.prontuarioValor}>{animal.sexo}</div>
              </div>
              <div className={styles.prontuarioCampo}>
                <label>Porte</label>
                <div className={styles.prontuarioValor}>{animal.porte || "-"}</div>
              </div>
              <div className={styles.prontuarioCampo}>
                <label>Idade</label>
                <div className={styles.prontuarioValor}>{animal.idade || "-"}</div>
              </div>
              <div className={styles.prontuarioCampo}>
                <label>Data de cadastro</label>
                <div className={styles.prontuarioValor}>{formatarData(animal.dataCadastro)}</div>
              </div>
              <div className={styles.prontuarioCampo}>
                <label>Castrado</label>
                <div className={styles.prontuarioValor}>{animal.castrado}</div>
              </div>
            </div>

            {/* Segunda seção: Dados Clínicos */}
            <div className={styles.prontuarioGrid}>
              <div className={styles.prontuarioCampo}>
                <label>Doença crônica</label>
                <div className={styles.prontuarioValor}>{animal.doencaCronica}</div>
              </div>
              <div className={styles.prontuarioCampo}>
                <label>Apetite normal</label>
                <div className={styles.prontuarioValor}>{animal.apetiteNormal}</div>
              </div>
              <div className={styles.prontuarioCampo}>
                <label>Vômito / Diarreia</label>
                <div className={styles.prontuarioValor}>{animal.sintomasVomitoDiarreia}</div>
              </div>
            </div>

            {animal.qualDoenca && (
              <div className={styles.prontuarioGrid} style={{ marginTop: "0.75rem" }}>
                <div className={styles.prontuarioCampo} style={{ gridColumn: "1 / -1" }}>
                  <label>Qual doença</label>
                  <div className={styles.prontuarioValor}>{animal.qualDoenca}</div>
                </div>
              </div>
            )}

            {/* Terceira seção: Tratamento */}
            <div className={styles.prontuarioGrid} style={{ marginTop: "0.75rem" }}>
              <div className={styles.prontuarioCampo}>
                <label>Em tratamento</label>
                <div className={styles.prontuarioValor}>{animal.emTratamento}</div>
              </div>
            </div>

            {animal.qualTratamento && (
              <div className={styles.prontuarioGrid} style={{ marginTop: "0.75rem" }}>
                <div className={styles.prontuarioCampo} style={{ gridColumn: "1 / -1" }}>
                  <label>Tratamento</label>
                  <div className={styles.prontuarioValor}>{animal.qualTratamento}</div>
                </div>
              </div>
            )}

            {/* Quarta seção: Observações */}
            {animal.observacoes && (
              <div className={styles.prontuarioGrid} style={{ marginTop: "0.75rem" }}>
                <div className={styles.prontuarioCampo} style={{ gridColumn: "1 / -1" }}>
                  <label>Observações</label>
                  <div className={styles.prontuarioValor}>{animal.observacoes}</div>
                </div>
              </div>
            )}
          </div>

          {/* DADOS DO TUTOR */}
          {tutor && (
            <div className={styles.prontuarioSecao}>
              <h3 className={styles.prontuarioTitulo}>Tutor Responsável</h3>
              <div className={styles.prontuarioGrid}>
                <div className={styles.prontuarioCampo}>
                  <label>CPF</label>
                  <div className={styles.prontuarioValor}>{tutor.cpf}</div>
                </div>
                <div className={styles.prontuarioCampo} style={{ gridColumn: "span 2" }}>
                  <label>Nome completo</label>
                  <div className={styles.prontuarioValor}>{tutor.nome}</div>
                </div>
                <div className={styles.prontuarioCampo}>
                  <label>Telefone / WhatsApp</label>
                  <div className={styles.prontuarioValor}>{tutor.telefone || "-"}</div>
                </div>
                <div className={styles.prontuarioCampo}>
                  <label>CNS</label>
                  <div className={styles.prontuarioValor}>{tutor.cns || "-"}</div>
                </div>
                {tutor.endereco && (
                  <div className={styles.prontuarioCampo} style={{ gridColumn: "1 / -1" }}>
                    <label>Endereço</label>
                    <div className={styles.prontuarioValor}>{formatarEndereco(tutor.endereco)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* HISTÓRICO DE ATENDIMENTOS */}
          <div className={styles.prontuarioSecao}>
            <h3 className={styles.prontuarioTitulo}>Histórico de Atendimentos</h3>
            {timeline.length === 0 ? (
              <p className={styles.vazioText}>Nenhum atendimento registrado.</p>
            ) : (
              <div className={styles.historicoTabela}>
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Tipo</th>
                      <th>Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeline.map((item, idx) => (
                      <tr key={idx}>
                        <td className={styles.dataCol}>{formatarData(item.data)}</td>
                        <td className={styles.tipoCol}>{item.titulo}</td>
                        <td className={styles.descCol}>
                          {item.descricao}
                          {item.relatorio && (
                            <div className={styles.relatorioBox}>
                              <strong>📋 Relatório de Acompanhamento Esporotricose</strong>
                              {item.relatorio.profissionalResponsavel && (
                                <div className={styles.relatorioProf}>
                                  <strong>Responsável:</strong> {item.relatorio.profissionalResponsavel}
                                </div>
                              )}
                              <div className={styles.relatorioDetalhesGrid}>
                                {item.relatorio.apresentaLesoes && (
                                  <div><strong>Apresenta lesões:</strong> {item.relatorio.apresentaLesoes}</div>
                                )}
                                {item.relatorio.apresentaLesoes === "Sim" && item.relatorio.descricaoLesoes && (
                                  <div><strong>Descrição das lesões:</strong> {item.relatorio.descricaoLesoes}</div>
                                )}
                                {item.relatorio.evolucaoQuadro && (
                                  <div><strong>Evolução do quadro:</strong> {item.relatorio.evolucaoQuadro}</div>
                                )}
                                {item.relatorio.emTratamento && (
                                  <div><strong>Em tratamento:</strong> {item.relatorio.emTratamento}</div>
                                )}
                                {item.relatorio.emTratamento === "Sim" && item.relatorio.medicamentosAtuais && (
                                  <div><strong>Medicamentos atuais:</strong> {item.relatorio.medicamentosAtuais}</div>
                                )}
                                {item.relatorio.emTratamento === "Sim" && item.relatorio.adesaoTratamento && (
                                  <div><strong>Adesão ao tratamento:</strong> {item.relatorio.adesaoTratamento}</div>
                                )}
                                {item.relatorio.isolamentoAdequado && (
                                  <div><strong>Isolamento adequado:</strong> {item.relatorio.isolamentoAdequado}</div>
                                )}
                                {item.relatorio.usoEpiAdequado && (
                                  <div><strong>Uso de EPI adequado:</strong> {item.relatorio.usoEpiAdequado}</div>
                                )}
                                {item.relatorio.higienizacaoAdequada && (
                                  <div><strong>Higienização adequada:</strong> {item.relatorio.higienizacaoAdequada}</div>
                                )}
                                {item.relatorio.orientacoesRepassadas && (
                                  <div><strong>Orientações repassadas:</strong> {item.relatorio.orientacoesRepassadas}</div>
                                )}
                                {(item.relatorio.encVeterinario || item.relatorio.encNotificacao || item.relatorio.encOutros) && (
                                  <div>
                                    <strong>Encaminhamentos:</strong>
                                    {item.relatorio.encVeterinario && " Veterinário"}
                                    {item.relatorio.encNotificacao && " | Notificação"}
                                    {item.relatorio.encOutros && " | Outros"}
                                    {item.relatorio.descricaoEncaminhamentos && ` - ${item.relatorio.descricaoEncaminhamentos}`}
                                  </div>
                                )}
                                {item.relatorio.necessidadeNovaVisita === "Sim" && item.relatorio.dataProximaVisita && (
                                  <div><strong>Próxima visita agendada:</strong> {formatarData(item.relatorio.dataProximaVisita)}</div>
                                )}
                                {item.relatorio.observacoesGerais && (
                                  <div><strong>Observações gerais:</strong> {item.relatorio.observacoesGerais}</div>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnGhost} onClick={onFechar}>
            Fechar
          </button>
          <button
            className={styles.btnPrimary}
            onClick={baixarPDF}
          >
            Baixar Relatório PDF
          </button>
        </div>
      </div>
    </div>
  );
}
