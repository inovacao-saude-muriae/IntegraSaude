"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { documentoPaciente } from "@/app/regulacao/constants";
import { mascararTelefone } from "@/lib/telefone";
import AuditoriaUsuario from "@/components/admin/AuditoriaUsuario";
import styles from "./RelatoriosGerais.module.css";
import abasStyles from "./RelatoriosAbas.module.css";

// Ordem fixa dos módulos para agrupar a timeline e as tabelas do PDF.
const ORDEM_MODULOS = [
  "Regulação",
  "Farmácia Judicial",
  "Junta Reguladora",
  "CCZ",
];

// Formata uma data (string ISO ou Date) em pt-BR, tolerando null.
const formatarData = (valor) => {
  if (!valor) return "—";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleDateString("pt-BR");
};

// Exibe o status do paciente da Farmácia Judicial de forma legível.
// O backend já normaliza para ATIVO/INATIVO/ÓBITO.
const formatarStatusFarmacia = (status) => {
  const st = String(status || "").toUpperCase();
  if (st === "ATIVO") return "Ativo";
  if (st === "INATIVO") return "Inativo";
  if (st === "ÓBITO" || st === "OBITO" || st === "FALECIDO")
    return "Óbito (Falecido)";
  if (!st) return "—";
  return st.charAt(0) + st.slice(1).toLowerCase();
};

// Página com abas: a aba de auditoria só aparece para GESTOR. Para os demais
// perfis, renderiza apenas o relatório do paciente (comportamento original).
export default function RelatoriosGeraisPage() {
  const [ehGestor, setEhGestor] = useState(false);
  const [aba, setAba] = useState("paciente");

  useEffect(() => {
    let cancelado = false;
    fetch("/api/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((dados) => {
        if (!cancelado && dados?.user?.role === "GESTOR") setEhGestor(true);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, []);

  if (!ehGestor) return <RelatorioPacienteView />;

  return (
    <>
      <div className={abasStyles.abas} role="tablist" aria-label="Relatórios gerais">
        <button
          type="button"
          role="tab"
          aria-selected={aba === "paciente"}
          className={aba === "paciente" ? abasStyles.abaAtiva : abasStyles.aba}
          onClick={() => setAba("paciente")}
        >
          Relatório do paciente
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={aba === "auditoria"}
          className={aba === "auditoria" ? abasStyles.abaAtiva : abasStyles.aba}
          onClick={() => setAba("auditoria")}
        >
          Auditoria de usuário
        </button>
      </div>
      {aba === "paciente" ? (
        <RelatorioPacienteView />
      ) : (
        <div className={abasStyles.painelAuditoria}>
          <AuditoriaUsuario />
        </div>
      )}
    </>
  );
}

function RelatorioPacienteView() {
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  // Busca select-like (dropdown em tabela).
  const [termo, setTermo] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selecionado, setSelecionado] = useState(null);
  const buscaRef = useRef(null);

  useEffect(() => {
    async function carregarRelatorio() {
      try {
        const resposta = await fetch("/api/gerenciamento/relatorios", {
          cache: "no-store",
        });
        const dados = await resposta.json();
        if (!resposta.ok)
          throw new Error(
            dados.error || "Não foi possível carregar o relatório.",
          );
        setUsuarios(dados.usuarios || []);
      } catch (error) {
        setErro(error.message);
      } finally {
        setCarregando(false);
      }
    }
    carregarRelatorio();
  }, []);

  // Fecha o dropdown ao clicar fora.
  useEffect(() => {
    function handleClickOutside(evento) {
      if (buscaRef.current && !buscaRef.current.contains(evento.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtra por nome ou CPF (comparando dígitos limpos para o CPF).
  const sugestoes = useMemo(() => {
    const texto = termo.toLowerCase().trim();
    const digitos = termo.replace(/\D/g, "");
    if (!texto) return usuarios;
    return usuarios.filter((usuario) => {
      const nome = String(usuario.nomeCompleto || usuario.nome || "")
        .toLowerCase()
        .includes(texto);
      const cpf =
        digitos.length > 0 &&
        String(usuario.cpf || "")
          .replace(/\D/g, "")
          .includes(digitos);
      return nome || cpf;
    });
  }, [termo, usuarios]);

  const selecionarUsuario = (usuario) => {
    setSelecionado(usuario);
    setTermo(usuario.nomeCompleto || usuario.nome || "");
    setShowDropdown(false);
  };

  function gerarPDF() {
    if (!selecionado) return;

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const resumo = selecionado.resumo || {};
    const atividades = selecionado.atividades || [];

    const dataEmissao = `${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString(
      "pt-BR",
      { hour: "2-digit", minute: "2-digit" },
    )}`;

    // Cabeçalho institucional azul.
    doc.setFillColor(2, 132, 199);
    doc.rect(0, 0, 210, 18, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("INTEGRASAÚDE - RELATÓRIO UNIFICADO DO PACIENTE", 14, 12);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Emissão: ${dataEmissao}`, 196, 12, { align: "right" });

    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("RELATÓRIO COMPLETO DO PACIENTE", 14, 28);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Paciente: ${selecionado.nomeCompleto || selecionado.nome || "—"}`,
      14,
      33.5,
    );

    // ── Ficha de dados pessoais (campos em caixa) ──
    const margemX = 14;
    const larguraUtil = 182;
    let fichaY = 40;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text("Dados Pessoais", margemX, fichaY);
    fichaY += 4;

    const alturaCaixa = 8;
    const gapRotulo = 4;
    const campoCaixa = (rotulo, valor, x, y, largura) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text(String(rotulo), x + 0.5, y + 2.6);

      const caixaY = y + gapRotulo;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, caixaY, largura, alturaCaixa, 1.6, 1.6, "FD");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      const texto = valor == null || valor === "" ? "—" : String(valor);
      const linhasTxt = doc.splitTextToSize(texto, largura - 5);
      doc.text(linhasTxt[0], x + 3, caixaY + alturaCaixa / 2 + 1.5);
    };

    const gap = 5;
    const col2 = (larguraUtil - gap) / 2;
    const x2 = [margemX, margemX + col2 + gap];
    const alturaLinha = gapRotulo + alturaCaixa + 4;
    let yGrid = fichaY + 1;

    campoCaixa(
      "Nome completo",
      selecionado.nomeCompleto || selecionado.nome,
      x2[0],
      yGrid,
      col2,
    );
    campoCaixa("CPF", documentoPaciente({ cpf: selecionado.cpf }), x2[1], yGrid, col2);
    yGrid += alturaLinha;

    campoCaixa(
      "Data de nascimento",
      selecionado.dataNascimento
        ? new Date(selecionado.dataNascimento).toLocaleDateString("pt-BR")
        : null,
      x2[0],
      yGrid,
      col2,
    );
    campoCaixa(
      "Telefone",
      mascararTelefone(selecionado.telefone) || null,
      x2[1],
      yGrid,
      col2,
    );
    yGrid += alturaLinha;

    let currentY = yGrid + 4;

    // ── Resumo por módulo (sem título) ──
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);

    const linhasResumo = [];
    const reg = resumo.regulacao;
    if (reg) {
      const qtdAguardando = reg.aguardando?.length || 0;
      const qtdLiberados = reg.liberados?.length || 0;
      linhasResumo.push(
        `Regulação: ${qtdAguardando} aguardando · ${qtdLiberados} agendado(s)/liberado(s)`,
      );
    }
    if (resumo.farmacia) {
      linhasResumo.push(
        `Farmácia Judicial: Processo ${resumo.farmacia.numeroProcesso || "—"} · ${resumo.farmacia.medicamentos?.length || 0} medicamento(s) vinculado(s) · status ${formatarStatusFarmacia(resumo.farmacia.status)}`,
      );
    }
    if (resumo.junta) {
      const totalServicos = resumo.junta.servicos?.length || 0;
      const ativos =
        resumo.junta.servicos?.filter((s) => s.ativo).length || 0;
      linhasResumo.push(
        `Junta Reguladora: ${totalServicos} serviço(s) · ${ativos} ativo(s)`,
      );
    }
    if (resumo.ccz) {
      linhasResumo.push(
        `CCZ: ${resumo.ccz.animais?.length || 0} animal(is) · ${resumo.ccz.procedimentos || 0} procedimento(s)`,
      );
    }

    if (linhasResumo.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.text("Nenhum registro nos módulos.", margemX, currentY);
      currentY += 6;
    } else {
      linhasResumo.forEach((linha) => {
        const linhasTxt = doc.splitTextToSize(linha, larguraUtil);
        doc.text(linhasTxt, margemX, currentY);
        currentY += linhasTxt.length * 4.6 + 1.5;
      });
    }
    currentY += 3;

    // ── Helpers de layout para as tabelas do PDF ──
    // Limite inferior seguro (rodapé fica em y=290). Deixa folga para não colar no rodapé.
    const LIMITE_Y = 268;
    const garantirEspaco = (altura = 20) => {
      if (currentY + altura > LIMITE_Y) {
        doc.addPage();
        currentY = 20;
      }
    };

    const estiloTabela = {
      theme: "plain",
      styles: { fontSize: 8, cellPadding: 2.3, textColor: [30, 41, 59] },
      // Cabeçalho sem fundo azul: só texto cinza (linha separadora desenhada abaixo).
      headStyles: {
        fillColor: false,
        textColor: [100, 116, 139],
        fontStyle: "bold",
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      // margin.bottom garante que a tabela quebre antes do rodapé (y=290),
      // repetindo o cabeçalho na página seguinte em vez de colar no fim.
      margin: { left: margemX, right: margemX, bottom: 26 },
      // Linha fina sob o cabeçalho, no estilo do prontuário.
      didDrawCell: (data) => {
        if (data.section === "head") {
          const { x, y, width, height } = data.cell;
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.3);
          doc.line(x, y + height, x + width, y + height);
        }
      },
    };

    const tituloModulo = (texto) => {
      // Reserva espaço p/ título + separador + cabeçalho + ~2 linhas, para o
      // título não ficar órfão no fim da página.
      garantirEspaco(42);
      currentY += 4; // respiro antes do título do módulo
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(37, 99, 235);
      doc.text(texto, margemX, currentY);
      currentY += 3;
      // Linha separadora fina abaixo do título do módulo.
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margemX, currentY, margemX + larguraUtil, currentY);
      currentY += 5;
    };

    const subtitulo = (texto) => {
      // Reserva p/ subtítulo + cabeçalho da tabela + ~2 linhas.
      garantirEspaco(30);
      currentY += 2; // respiro antes do subtítulo
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(String(texto).toUpperCase(), margemX, currentY);
      currentY += 3;
    };

    const linhaTexto = (texto) => {
      garantirEspaco(10);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      const linhasTxt = doc.splitTextToSize(texto, larguraUtil);
      doc.text(linhasTxt, margemX, currentY);
      currentY += linhasTxt.length * 4.6 + 2;
    };

    const renderTabela = (head, body, columnStyles) => {
      autoTable(doc, {
        startY: currentY + 1,
        head: [head],
        body,
        ...estiloTabela,
        columnStyles,
      });
      currentY = doc.lastAutoTable.finalY + 8;
    };

    // ── Tabelas dedicadas por módulo ──
    ORDEM_MODULOS.forEach((modulo) => {
      if (modulo === "Regulação") {
        const reg = resumo.regulacao;
        const aguardando = reg?.aguardando || [];
        const liberados = reg?.liberados || [];
        if (aguardando.length === 0 && liberados.length === 0) return;

        tituloModulo("Regulação de Exames");

        if (aguardando.length > 0) {
          subtitulo("Aguardando");
          renderTabela(
            ["Exame", "Data de solicitação"],
            aguardando.map((item) => [
              item.exame || "—",
              formatarData(item.data),
            ]),
            { 0: { cellWidth: "auto" }, 1: { cellWidth: 40 } },
          );
        }

        if (liberados.length > 0) {
          subtitulo("Agendados/Liberados");
          renderTabela(
            ["Exame", "Data de liberação"],
            liberados.map((item) => [
              item.exame || "—",
              formatarData(item.data),
            ]),
            { 0: { cellWidth: "auto" }, 1: { cellWidth: 40 } },
          );
        }
        return;
      }

      if (modulo === "Farmácia Judicial") {
        const farmacia = resumo.farmacia;
        if (!farmacia) return;

        tituloModulo("Farmácia Judicial");
        linhaTexto(`Número do processo: ${farmacia.numeroProcesso || "—"}`);
        linhaTexto(
          `Status do paciente: ${formatarStatusFarmacia(farmacia.status)}`,
        );

        const medicamentos = farmacia.medicamentos || [];
        subtitulo("Medicamentos vinculados");
        if (medicamentos.length === 0) {
          linhaTexto("—");
        } else {
          renderTabela(
            ["Medicamento", "Dosagem", "Qtd/mês", "Situação"],
            medicamentos.map((item) => [
              item.nome || "—",
              item.dosagem || "—",
              item.qtdPrescritaMensal ?? "—",
              item.ativo ? "Ativo" : "Inativo",
            ]),
            {
              0: { cellWidth: "auto" },
              1: { cellWidth: 32 },
              2: { cellWidth: 22 },
              3: { cellWidth: 24 },
            },
          );
        }
        return;
      }

      if (modulo === "Junta Reguladora") {
        const junta = resumo.junta;
        const servicos = junta?.servicos || [];
        if (!junta) return;

        tituloModulo("Junta Reguladora");
        subtitulo("Serviços vinculados");
        if (servicos.length === 0) {
          linhaTexto("—");
        } else {
          renderTabela(
            ["Serviço", "Situação", "Data de vínculo"],
            servicos.map((item) => [
              item.nome || "—",
              item.ativo ? "Ativo" : "Inativo",
              formatarData(item.dataVinculo),
            ]),
            {
              0: { cellWidth: "auto" },
              1: { cellWidth: 28 },
              2: { cellWidth: 36 },
            },
          );
        }
        return;
      }

      // CCZ (e demais módulos): tabela genérica a partir das atividades.
      const doModulo = atividades.filter((a) => a.modulo === modulo);
      if (doModulo.length === 0) return;

      tituloModulo(modulo === "CCZ" ? "CCZ - Zoonoses" : modulo);
      renderTabela(
        ["Data", "Tipo", "Descrição", "Status"],
        doModulo.map((a) => [
          formatarData(a.data),
          a.tipo || "—",
          a.descricao || "—",
          a.status || "—",
        ]),
        {
          0: { cellWidth: 24 },
          1: { cellWidth: 38 },
          2: { cellWidth: "auto" },
          3: { cellWidth: 28 },
        },
      );
    });

    // Rodapé em todas as páginas.
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Página ${i} de ${totalPages} - Documento Gerado pelo Sistema IntegraSaúde`,
        105,
        290,
        { align: "center" },
      );
    }

    const nomeLimpo = (
      selecionado.nomeCompleto ||
      selecionado.nome ||
      "Paciente"
    ).replace(/[^a-zA-Z0-9]/g, "_");
    doc.save(`Relatorio_Paciente_${nomeLimpo}.pdf`);
  }

  if (carregando) {
    return (
      <main className={styles.container}>
        <p className={styles.feedback}>Carregando relatório geral...</p>
      </main>
    );
  }

  if (erro) {
    return (
      <main className={styles.container}>
        <div className={styles.error}>{erro}</div>
      </main>
    );
  }

  const resumo = selecionado?.resumo || {};

  // Agrupa as atividades (já ordenadas por data desc) por módulo, respeitando ORDEM_MODULOS.
  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>GERENCIAMENTO</p>
          <h1>Relatório Unificado do Paciente</h1>
          <p className={styles.subtitle}>
            Busque uma pessoa e consulte tudo que ela registrou em todos os
            módulos do sistema.
          </p>
        </div>
      </header>

      <div className={styles.cardWrapper}>
      <section className={styles.buscaWrapper}>
        <label className={styles.buscaLabel}>
          Buscar paciente (Nome ou CPF)
        </label>
        <div className={styles.searchSelectWrapper} ref={buscaRef}>
          <input
            type="text"
            className={styles.selectLikeInput}
            placeholder="Selecionar ou digitar nome/CPF..."
            value={termo}
            onChange={(evento) => {
              setTermo(evento.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
          />
          <span
            className={styles.arrowIcon}
            onClick={() => setShowDropdown((valor) => !valor)}
          >
            {showDropdown ? "▲" : "▼"}
          </span>

          {showDropdown && (
            <div className={styles.tableDropdownMenu}>
              <div className={styles.tableContainerScroll}>
                <table className={styles.patientTableDropdown}>
                  <thead>
                    <tr>
                      <th>CPF</th>
                      <th>Usuário</th>
                      <th>Data nasc.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sugestoes.length > 0 ? (
                      sugestoes.map((usuario, index) => (
                        <tr
                          key={usuario.cpf ? `${usuario.cpf}-${index}` : index}
                          onMouseDown={(evento) => {
                            evento.preventDefault();
                            selecionarUsuario(usuario);
                          }}
                          className={
                            selecionado?.cpf === usuario.cpf
                              ? styles.selectedRow
                              : ""
                          }
                        >
                          <td>{documentoPaciente({ cpf: usuario.cpf })}</td>
                          <td className={styles.boldName}>
                            {usuario.nomeCompleto || usuario.nome}
                          </td>
                          <td>{formatarData(usuario.dataNascimento)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3" className={styles.noDataTd}>
                          Nenhum paciente encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      {!selecionado ? (
        <section className={styles.emptyReport}>
          <h2>Nenhum paciente selecionado</h2>
          <p>Busque um paciente para ver o relatório completo.</p>
        </section>
      ) : (
        <>
          <div className={styles.reportHeaderBar}>
            <div>
              <h2>{selecionado.nomeCompleto || selecionado.nome}</h2>
              <p className={styles.patientMeta}>
                Relatório consolidado dos módulos vinculados ao CPF.
              </p>
            </div>
            <button
              type="button"
              className={styles.exportBtn}
              onClick={gerarPDF}
            >
              Exportar PDF
            </button>
          </div>

          <section className={styles.fichaCard}>
            <div className={styles.fichaCampo}>
              <label>Nome</label>
              <span>{selecionado.nomeCompleto || selecionado.nome || "—"}</span>
            </div>
            <div className={styles.fichaCampo}>
              <label>CPF</label>
              <span>{documentoPaciente({ cpf: selecionado.cpf })}</span>
            </div>
            <div className={styles.fichaCampo}>
              <label>Data de nascimento</label>
              <span>{formatarData(selecionado.dataNascimento)}</span>
            </div>
            <div className={styles.fichaCampo}>
              <label>Telefone</label>
              <span>{mascararTelefone(selecionado.telefone) || "—"}</span>
            </div>
          </section>

          <div className={styles.stats}>
            <div>
              <strong>{selecionado.totalAtividades || 0}</strong>
              <span>atividades registradas</span>
            </div>
            <div>
              <strong>{selecionado.modulos?.length || 0}</strong>
              <span>sistemas relacionados</span>
            </div>
          </div>

          <div className={styles.systemSummary}>
            <h3>Resumo por sistema</h3>
            <div className={styles.systemCards}>
              <div className={styles.systemCard}>
                <strong>Regulação</strong>
                <span>
                  {(resumo.regulacao?.aguardando?.length || 0) +
                    (resumo.regulacao?.liberados?.length || 0)}{" "}
                  exame(s)
                </span>
                <small>
                  {resumo.regulacao?.aguardando?.length || 0} aguardando ·{" "}
                  {resumo.regulacao?.liberados?.length || 0} agendados/liberados
                </small>
              </div>
              <div className={styles.systemCard}>
                <strong>Farmácia Judicial</strong>
                <span>
                  {resumo.farmacia?.medicamentos?.length || 0} medicamento(s)
                  vinculado(s)
                </span>
                <small>
                  {resumo.farmacia
                    ? `Processo ${resumo.farmacia.numeroProcesso || "—"} · ${formatarStatusFarmacia(resumo.farmacia.status)}`
                    : "Sem cadastro judicial"}
                </small>
              </div>
              <div className={styles.systemCard}>
                <strong>Junta Reguladora</strong>
                <span>
                  {resumo.junta?.servicos?.length || 0} serviço(s) vinculado(s)
                </span>
                <small>
                  {resumo.junta
                    ? `${resumo.junta.servicos?.filter((s) => s.ativo).length || 0} ativo(s)`
                    : "Sem cadastro na Junta"}
                </small>
              </div>
              <div className={styles.systemCard}>
                <strong>CCZ</strong>
                <span>
                  {resumo.ccz?.animais?.length || 0} animal(is) vinculado(s)
                </span>
                <small>
                  {resumo.ccz
                    ? `${resumo.ccz.procedimentos} procedimento(s)`
                    : "Sem registros no CCZ"}
                </small>
              </div>
            </div>
          </div>

          {/* DETALHAMENTO POR MÓDULO (tabelas) */}
          <div className={styles.modulosDetalhe}>
            <h3>Detalhamento por módulo</h3>

            {/* REGULAÇÃO */}
            {((resumo.regulacao?.aguardando?.length || 0) > 0 ||
              (resumo.regulacao?.liberados?.length || 0) > 0) && (
              <div className={styles.moduloBloco}>
                <h4 className={styles.moduloTitulo}>Regulação de Exames</h4>

                {resumo.regulacao?.aguardando?.length > 0 && (
                  <>
                    <p className={styles.moduloSub}>Aguardando</p>
                    <div className={styles.tabelaWrapper}>
                      <table className={styles.tabela}>
                        <thead>
                          <tr>
                            <th>Exame</th>
                            <th>Data de solicitação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resumo.regulacao.aguardando.map((item, i) => (
                            <tr key={`ag-${i}`}>
                              <td>{item.exame || "—"}</td>
                              <td>{formatarData(item.data)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {resumo.regulacao?.liberados?.length > 0 && (
                  <>
                    <p className={styles.moduloSub}>Agendados / Liberados</p>
                    <div className={styles.tabelaWrapper}>
                      <table className={styles.tabela}>
                        <thead>
                          <tr>
                            <th>Exame</th>
                            <th>Data de liberação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resumo.regulacao.liberados.map((item, i) => (
                            <tr key={`lib-${i}`}>
                              <td>{item.exame || "—"}</td>
                              <td>{formatarData(item.data)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* FARMÁCIA JUDICIAL */}
            {resumo.farmacia && (
              <div className={styles.moduloBloco}>
                <h4 className={styles.moduloTitulo}>Farmácia Judicial</h4>
                <p className={styles.moduloInfoLinha}>
                  <strong>Número do processo:</strong>{" "}
                  {resumo.farmacia.numeroProcesso || "—"}
                </p>
                <p className={styles.moduloInfoLinha}>
                  <strong>Status do paciente:</strong>{" "}
                  {formatarStatusFarmacia(resumo.farmacia.status)}
                </p>
                <p className={styles.moduloSub}>Medicamentos vinculados</p>
                {(resumo.farmacia.medicamentos?.length || 0) === 0 ? (
                  <p className={styles.empty}>Nenhum medicamento vinculado.</p>
                ) : (
                  <div className={styles.tabelaWrapper}>
                    <table className={styles.tabela}>
                      <thead>
                        <tr>
                          <th>Medicamento</th>
                          <th>Dosagem</th>
                          <th>Qtd/mês</th>
                          <th>Situação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resumo.farmacia.medicamentos.map((item, i) => (
                          <tr key={`med-${i}`}>
                            <td>{item.nome || "—"}</td>
                            <td>{item.dosagem || "—"}</td>
                            <td>{item.qtdPrescritaMensal ?? "—"}</td>
                            <td>{item.ativo ? "Ativo" : "Inativo"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* JUNTA REGULADORA */}
            {resumo.junta && (
              <div className={styles.moduloBloco}>
                <h4 className={styles.moduloTitulo}>Junta Reguladora</h4>
                <p className={styles.moduloSub}>Serviços vinculados</p>
                {(resumo.junta.servicos?.length || 0) === 0 ? (
                  <p className={styles.empty}>Nenhum serviço vinculado.</p>
                ) : (
                  <div className={styles.tabelaWrapper}>
                    <table className={styles.tabela}>
                      <thead>
                        <tr>
                          <th>Serviço</th>
                          <th>Situação</th>
                          <th>Data de vínculo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resumo.junta.servicos.map((item, i) => (
                          <tr key={`serv-${i}`}>
                            <td>{item.nome || "—"}</td>
                            <td>{item.ativo ? "Ativo" : "Inativo"}</td>
                            <td>{formatarData(item.dataVinculo)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* CCZ (tabela genérica a partir das atividades) */}
            {(() => {
              const cczItens = (selecionado.atividades || []).filter(
                (a) => a.modulo === "CCZ",
              );
              if (cczItens.length === 0) return null;
              return (
                <div className={styles.moduloBloco}>
                  <h4 className={styles.moduloTitulo}>CCZ - Zoonoses</h4>
                  <div className={styles.tabelaWrapper}>
                    <table className={styles.tabela}>
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Tipo</th>
                          <th>Descrição</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cczItens.map((a) => (
                          <tr key={a.id}>
                            <td>{formatarData(a.data)}</td>
                            <td>{a.tipo || "—"}</td>
                            <td>{a.descricao || "—"}</td>
                            <td>{a.status || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {!resumo.regulacao &&
              !resumo.farmacia &&
              !resumo.junta &&
              (selecionado.atividades || []).filter((a) => a.modulo === "CCZ")
                .length === 0 && (
                <p className={styles.empty}>
                  Nenhum registro nos módulos para este paciente.
                </p>
              )}
          </div>
        </>
      )}
      </div>
    </main>
  );
}
