'use client';

import { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { listarPacientesJunta } from './actions';
import { documentoPaciente } from '@/app/regulacao/constants';
import { mascararTelefone } from '@/lib/telefone';
import { formatarCpfExibicao } from '@/lib/cpf';
import styles from './ProntuarioRelatorio.module.css';
import { rotuloEspecialidade } from './rotuloEspecialidade';
import { usaRelatorioFinal } from './usaRelatorioFinal';

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Extrai 'YYYY-MM' de uma data (string ISO ou Date), sem efeito de fuso.
const competenciaDaData = (d) => {
  if (!d) return '';
  const s = typeof d === 'string' ? d : new Date(d).toISOString();
  return s.split('T')[0].slice(0, 7); // 'YYYY-MM'
};

export default function ProntuarioRelatorio({ prontuarioData, onBuscar }) {
  const [termo, setTermo] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Filtro por intervalo de datas (De / Até). Vazio = sem limite nesse lado.
  const [dataDe, setDataDe] = useState('');
  const [dataAte, setDataAte] = useState('');

  // Menu dropdown de exportação.
  const [exportMenuAberto, setExportMenuAberto] = useState(false);
  const exportMenuRef = useRef(null);
  // Dropdown de busca de paciente (tabela).
  const buscaRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setExportMenuAberto(false);
      }
      if (buscaRef.current && !buscaRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Carrega a lista inicial de pacientes da Junta ao montar.
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const lista = await listarPacientesJunta('');
        if (ativo) setSugestoes(Array.isArray(lista) ? lista : []);
      } catch {
        if (ativo) setSugestoes([]);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  // 🎯 LIMPEZA SILENCIOSA DOS CAMPOS AO DESMONTA/TROCAR DE ABA
  useEffect(() => {
    return () => {
      setTermo('');
      setSugestoes([]);
      setShowDropdown(false);
    };
  }, []);

  const formatCPF = (cpf) => {
    if (!cpf) return '';
    return formatarCpfExibicao(cpf);
  };

  const handleInputChange = async (valor) => {
    setTermo(valor);
    // Só mostra o dropdown ao começar a digitar (>= 2 caracteres).
    if (valor.trim().length < 2) {
      setShowDropdown(false);
      setSugestoes([]);
      return;
    }
    setShowDropdown(true);
    setIsSearching(true);
    try {
      const resultados = await listarPacientesJunta(valor.trim());
      setSugestoes(Array.isArray(resultados) ? resultados : []);
    } catch (error) {
      console.error('Erro ao buscar pacientes da Junta:', error);
      setSugestoes([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectPessoa = (pessoa) => {
    const nomeSelecionado = pessoa.nomeCompleto || pessoa.nome || '';
    
    // Insere o NOME no campo visual do input
    setTermo(nomeSelecionado);
    setShowDropdown(false);

    // Dispara a consulta com o CPF do paciente selecionado
    if (onBuscar) {
      onBuscar(pessoa.cpf || nomeSelecionado);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!termo.trim()) return alert('Digite um Nome ou CPF para pesquisar.');
    setShowDropdown(false);
    if (onBuscar) {
      onBuscar(termo.trim());
    }
  };

  const paciente = prontuarioData?.paciente;
  const servicosAgrupadosRaw = prontuarioData?.servicosAgrupados || [];

  // 'YYYY-MM-DD' de uma data (string ISO ou Date), sem efeito de fuso.
  const diaDaData = (d) => {
    if (!d) return '';
    const s = typeof d === 'string' ? d : new Date(d).toISOString();
    return s.split('T')[0];
  };

  // Filtra os grupos pelo intervalo de datas (De / Até) e recalcula contadores.
  // Se ambos vazios, retorna o histórico completo.
  const filtrarPorIntervalo = (grupos, de, ate) => {
    const semFiltro = !de && !ate;
    return grupos
      .map((g) => {
        const datasFiltradas = (g.datas || []).filter((d) => {
          const dia = diaDaData(d.data); // 'YYYY-MM-DD'
          if (de && dia < de) return false;
          if (ate && dia > ate) return false;
          return true;
        });

        if (!semFiltro && datasFiltradas.length === 0) return null;

        let presencas = 0, faltas = 0, faltasJustificadas = 0;
        for (const d of datasFiltradas) {
          const st = (d.status || '').toUpperCase();
          if (st === 'PRESENCA') presencas++;
          else if (st === 'FALTA') faltas++;
          else if (st === 'FALTA_JUSTIFICADA') faltasJustificadas++;
        }

        return {
          ...g,
          datas: semFiltro ? g.datas : datasFiltradas,
          presencas: semFiltro ? g.presencas : presencas,
          faltas: semFiltro ? g.faltas : faltas,
          faltasJustificadas: semFiltro ? g.faltasJustificadas : faltasJustificadas,
        };
      })
      .filter(Boolean);
  };

  const servicosAgrupados = filtrarPorIntervalo(servicosAgrupadosRaw, dataDe, dataAte);

  const formatarBR = (ymd) => {
    if (!ymd) return '';
    const [y, m, d] = ymd.split('-');
    return `${d}/${m}/${y}`;
  };

  const rotuloCompetencia =
    dataDe && dataAte
      ? `${formatarBR(dataDe)} a ${formatarBR(dataAte)}`
      : dataDe
        ? `A partir de ${formatarBR(dataDe)}`
        : dataAte
          ? `Até ${formatarBR(dataAte)}`
          : 'Histórico completo';

  const gerarPDFDownload = (escopo = 'mes') => {
    if (!paciente) return;

    // escopo: 'mes' = usa o filtro atual; 'completo' = todo o histórico.
    const grupos = escopo === 'completo' ? servicosAgrupadosRaw : servicosAgrupados;
    const rotuloPeriodo = escopo === 'completo' ? 'Histórico completo' : rotuloCompetencia;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const dataEmissao = `${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

    doc.setFillColor(2, 132, 199);
    doc.rect(0, 0, 210, 18, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('INTEGRASAÚDE - JUNTA REGULADORA MULTIDISCIPLINAR', 14, 12);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Emissão: ${dataEmissao}`, 196, 12, { align: 'right' });

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('PRONTUÁRIO UNIFICADO E RELATÓRIO DE FREQUÊNCIAS', 14, 28);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Período: ${rotuloPeriodo}`, 14, 33.5);

    // ── DADOS DO PACIENTE (campos em caixas, estilo formulário) ──
    const margemX = 14;
    const larguraUtil = 182; // 210 - 2*14
    let fichaY = 40;

    // Título da seção
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('Dados do Paciente', margemX, fichaY);
    fichaY += 4;

    // Helper: desenha um campo "input": rótulo azul-escuro acima + caixa
    // arredondada (fundo cinza-claro) com o valor dentro.
    // Retorna a altura total ocupada pelo campo.
    const alturaCaixa = 8; // altura da caixa do valor
    const gapRotulo = 4;   // espaço entre topo e a caixa (para o rótulo)
    const campoCaixa = (rotulo, valor, x, y, largura) => {
      // Rótulo
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text(String(rotulo), x + 0.5, y + 2.6);

      // Caixa
      const caixaY = y + gapRotulo;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, caixaY, largura, alturaCaixa, 1.6, 1.6, 'FD');

      // Valor (truncado para caber na caixa)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      const texto = valor == null || valor === '' ? '—' : String(valor);
      const linhasTxt = doc.splitTextToSize(texto, largura - 5);
      doc.text(linhasTxt[0], x + 3, caixaY + alturaCaixa / 2 + 1.5);

      return gapRotulo + alturaCaixa + 4; // altura total do campo + respiro
    };

    const gap = 5; // espaço horizontal entre colunas
    // Grade de 3 colunas
    const col3 = (larguraUtil - gap * 2) / 3;
    const x3 = [margemX, margemX + col3 + gap, margemX + (col3 + gap) * 2];

    let yGrid = fichaY + 1;
    const alturaLinha = gapRotulo + alturaCaixa + 4;

    // Linha 1: CPF | Nome completo | Sexo
    campoCaixa('CPF', formatCPF(paciente.cpf), x3[0], yGrid, col3);
    campoCaixa('Nome completo', paciente.nome, x3[1], yGrid, col3);
    campoCaixa('Sexo', paciente.sexo, x3[2], yGrid, col3);
    yGrid += alturaLinha;

    // Linha 2: Data de nascimento | Nome da mãe | Telefone / WhatsApp
    campoCaixa(
      'Data de nascimento',
      paciente.data_nascimento ? new Date(paciente.data_nascimento).toLocaleDateString('pt-BR') : null,
      x3[0], yGrid, col3,
    );
    campoCaixa('Nome da mãe', paciente.nomeMae, x3[1], yGrid, col3);
    campoCaixa('Telefone / WhatsApp', mascararTelefone(paciente.telefone), x3[2], yGrid, col3);
    yGrid += alturaLinha;

    // Linha 3 (largura total): Endereço completo
    const enderecoTxt = paciente.logradouro
      ? `${paciente.logradouro}, ${paciente.numero || 'S/N'} - ${paciente.bairro || ''}${
          paciente.cidade ? ` - ${paciente.cidade}` : ''
        }${paciente.uf ? `/${paciente.uf}` : ''}${paciente.cep ? ` - CEP ${paciente.cep}` : ''}`
      : null;
    campoCaixa('Endereço', enderecoTxt, margemX, yGrid, larguraUtil);
    yGrid += alturaLinha;

    // Linha 4 (largura total): Diagnóstico / Deficiência
    campoCaixa('Diagnóstico / Deficiência', paciente.tipo_deficiencia, margemX, yGrid, larguraUtil);
    yGrid += alturaLinha;

    // Linha 5 (largura total): Serviços ativos vinculados
    campoCaixa(
      'Serviços ativos vinculados',
      paciente.servicos_ativos?.length > 0 ? paciente.servicos_ativos.join(', ') : 'Nenhum serviço ativo',
      margemX, yGrid, larguraUtil,
    );
    yGrid += alturaLinha;

    let currentY = yGrid + 4;

    if (grupos.length === 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139);
      doc.text('Nenhum registro de atendimento ou frequência no período selecionado.', 14, currentY);
    } else {
      const bloqX = 14;
      const bloqW = 182;
      const alturaCabecalho = 15; // duas linhas de texto no topo do bloco

      grupos.forEach((grupo) => {
        // Estima o espaço mínimo (cabeçalho + 1 linha de tabela) para evitar
        // quebrar o bloco logo após o cabeçalho.
        if (currentY + alturaCabecalho + 16 > 282) {
          doc.addPage();
          currentY = 20;
        }

        const bloqTopo = currentY;

        // ── Cabeçalho do serviço (2 linhas, sem colisão) ──
        // Linha 1: SERVIÇO + especialidade. Linha 2: resumo de frequência.
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(2, 132, 199);
        doc.text(`${grupo.servico}`, bloqX + 4, bloqTopo + 6);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        const servW = doc.getTextWidth(`${grupo.servico}`);
        doc.text(`•  ${rotuloEspecialidade(grupo.servico)}: ${grupo.especialidade}`, bloqX + 4 + servW + 3, bloqTopo + 6);

        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(
          `Agendamentos: ${grupo.datas.length}    |    Presenças: ${grupo.presencas}    |    Faltas: ${grupo.faltas}    |    Justificadas: ${grupo.faltasJustificadas}`,
          bloqX + 4,
          bloqTopo + 11.5,
        );

        // Linha separadora entre cabeçalho e tabela.
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(bloqX + 4, bloqTopo + alturaCabecalho - 1, bloqX + bloqW - 4, bloqTopo + alturaCabecalho - 1);

        const tabelaY = bloqTopo + alturaCabecalho;

        const tableBody = grupo.datas.map((d) => {
          let statusText = 'Agendado';
          if (d.status === 'PRESENCA') statusText = 'Presença Confirmada';
          else if (d.status === 'FALTA') statusText = 'Falta';
          else if (d.status === 'FALTA_JUSTIFICADA') statusText = 'Falta Justificada';

          return [
            new Date(d.data).toLocaleDateString('pt-BR'),
            d.hora || '-',
            statusText,
            d.observacao || '-',
          ];
        });

        autoTable(doc, {
          startY: tabelaY,
          theme: 'plain',
          margin: { left: bloqX + 4, right: bloqX + 4 },
          tableWidth: bloqW - 8,
          // Cabeçalho sem fundo: só texto em cinza + separador desenhado acima.
          headStyles: {
            fillColor: false,
            textColor: [100, 116, 139],
            fontStyle: 'bold',
            fontSize: 7.5,
            cellPadding: { top: 2, bottom: 2.5, left: 2, right: 2 },
          },
          head: [['Data', 'Hora', 'Frequência / Status', usaRelatorioFinal(grupo.servico, grupo.especialidade) ? 'Relatório Final' : 'Observação']],
          body: tableBody,
          styles: { fontSize: 8, cellPadding: 2.3, textColor: [30, 41, 59] },
          // Zebra sutil nas linhas de corpo (sem bordas de grade).
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: {
            0: { cellWidth: 26, fontStyle: 'bold' },
            1: { cellWidth: 20 },
            2: { cellWidth: 44 },
            3: { cellWidth: 'auto' },
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 2) {
              const val = data.cell.raw;
              if (val === 'Presença Confirmada') {
                data.cell.styles.textColor = [22, 101, 52];
                data.cell.styles.fontStyle = 'bold';
              } else if (val === 'Falta') {
                data.cell.styles.textColor = [153, 27, 27];
                data.cell.styles.fontStyle = 'bold';
              } else if (val === 'Falta Justificada') {
                data.cell.styles.textColor = [146, 64, 14];
                data.cell.styles.fontStyle = 'bold';
              }
            }
          },
        });

        const bloqFim = doc.lastAutoTable.finalY + 3;

        // Contorno arredondado englobando cabeçalho + tabela (bloco único).
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.4);
        doc.roundedRect(bloqX, bloqTopo, bloqW, bloqFim - bloqTopo, 2.5, 2.5, 'S');

        currentY = bloqFim + 8;
      });
    }

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Página ${i} de ${totalPages} - Documento Gerado pelo Sistema IntegraSaúde`,
        105,
        290,
        { align: 'center' }
      );
    }

    const nomeLimpo = (paciente.nome || 'Paciente').replace(/[^a-zA-Z0-9]/g, '_');
    const sufPeriodo =
      escopo === 'completo'
        ? 'Completo'
        : dataDe && dataAte
          ? `${dataDe}_a_${dataAte}`
          : dataDe
            ? `desde_${dataDe}`
            : dataAte
              ? `ate_${dataAte}`
              : 'Periodo';
    doc.save(`Prontuario_${nomeLimpo}_${sufPeriodo}.pdf`);
  };

  return (
    <div className={styles.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
        <h2 className={styles.title} style={{ margin: 0 }}>Prontuário Unificado e Relatório de Serviços</h2>
      </div>

      {/* BUSCA DE PACIENTE DA JUNTA (dropdown em tabela, igual aos outros módulos) */}
      <div className={styles.buscaWrapper}>
        <label className={styles.buscaLabel}>Buscar Paciente da Junta (Nome ou CPF)</label>
        <div className={styles.searchSelectWrapper} ref={buscaRef}>
          <input
            type="text"
            className={styles.selectLikeInput}
            placeholder="Selecionar ou digitar nome/CPF..."
            value={termo}
            onChange={(e) => handleInputChange(e.target.value)}
          />
          <span className={styles.arrowIcon} onClick={() => setShowDropdown((v) => !v)}>
            {showDropdown ? '▲' : '▼'}
          </span>

          {showDropdown && (
            <div className={styles.tableDropdownMenu}>
              <div className={styles.tableContainerScroll}>
                <table className={styles.patientTableDropdown}>
                  <thead>
                    <tr>
                      <th>CPF / CNS</th>
                      <th>Usuário</th>
                      <th>Nome da mãe</th>
                      <th>Data nasc.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sugestoes.length > 0 ? (
                      sugestoes.map((p, index) => (
                        <tr
                          key={p.cpf ? `${p.cpf}-${index}` : index}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectPessoa(p);
                          }}
                          className={paciente?.cpf === p.cpf ? styles.selectedRow : ''}
                        >
                          <td>{documentoPaciente({ cpf: p.cpf, cns: p.cns })}</td>
                          <td className={styles.boldName}>{p.nomeCompleto || p.nome}</td>
                          <td>{p.nomeMae || 'Não informada'}</td>
                          <td>
                            {p.dataNascimento
                              ? p.dataNascimento.split('-').reverse().join('/')
                              : '-'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className={styles.noDataTd}>
                          {isSearching
                            ? 'Consultando...'
                            : 'Nenhum paciente da Junta encontrado.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {paciente ? (
        <div className={styles.prontuarioBox}>
          {/* DADOS GERAIS (campos em caixa, estilo formulário) */}
          <div className={styles.infoCard}>
            <h4>Dados do Paciente</h4>
            <div className={styles.dadosGrid}>
              <div className={styles.campo}>
                <label>Nome completo</label>
                <div className={styles.valorBox}>{paciente.nome || '—'}</div>
              </div>
              <div className={styles.campo}>
                <label>Nome da mãe</label>
                <div className={styles.valorBox}>{paciente.nomeMae || '—'}</div>
              </div>
              <div className={styles.campo}>
                <label>Data de nascimento</label>
                <div className={styles.valorBox}>
                  {paciente.data_nascimento
                    ? new Date(paciente.data_nascimento).toLocaleDateString('pt-BR')
                    : '—'}
                </div>
              </div>
              <div className={styles.campo}>
                <label>Sexo</label>
                <div className={styles.valorBox}>{paciente.sexo || '—'}</div>
              </div>
              <div className={styles.campo}>
                <label>Telefone / WhatsApp</label>
                <div className={styles.valorBox}>{mascararTelefone(paciente.telefone) || '—'}</div>
              </div>
              <div className={styles.campo}>
                <label>CPF</label>
                <div className={styles.valorBox}>{formatCPF(paciente.cpf) || '—'}</div>
              </div>

              <div className={`${styles.campo} ${styles.campoFull}`}>
                <label>Endereço</label>
                <div className={styles.valorBox}>
                  {paciente.logradouro
                    ? `${paciente.logradouro}, ${paciente.numero || 'S/N'} - ${paciente.bairro || ''}${
                        paciente.cidade ? ` - ${paciente.cidade}` : ''
                      }${paciente.uf ? `/${paciente.uf}` : ''}${
                        paciente.cep ? ` - CEP ${paciente.cep}` : ''
                      }`
                    : '—'}
                </div>
              </div>

              <div className={`${styles.campo} ${styles.campoFull}`}>
                <label>Diagnóstico / Deficiência</label>
                <div className={styles.valorBox}>{paciente.tipo_deficiencia || '—'}</div>
              </div>
            </div>
          </div>

          {/* SERVIÇOS VINCULADOS */}
          <div className={styles.infoCard}>
            <h4>Serviços onde o Paciente está Ativo</h4>
            <div className={styles.badgesGroup}>
              {paciente.servicos_ativos && paciente.servicos_ativos.length > 0 ? (
                paciente.servicos_ativos.map((servico) => (
                  <span key={servico} className={styles.activeBadge}>
                    🟢 {servico}
                  </span>
                ))
              ) : (
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Nenhum serviço ativo vinculado.</span>
              )}
            </div>
          </div>

          {/* HISTÓRICO AGRUPADO POR SERVIÇO E ESPECIALIDADE */}
          <div className={styles.historySection}>
            <h4 style={{ marginBottom: '1rem' }}>Relatório Multidisciplinar por Serviço e Especialidade</h4>

            {/* BARRA: FILTRO DE COMPETÊNCIA (mês/ano) + EXPORTAR */}
            <div className={styles.filtroBar}>
              <div className={styles.filtroCampos}>
                <div className={styles.filtroCampo}>
                  <label>De</label>
                  <input
                    type="date"
                    value={dataDe}
                    max={dataAte || undefined}
                    onChange={(e) => setDataDe(e.target.value)}
                  />
                </div>
                <div className={styles.filtroCampo}>
                  <label>Até</label>
                  <input
                    type="date"
                    value={dataAte}
                    min={dataDe || undefined}
                    onChange={(e) => setDataAte(e.target.value)}
                  />
                </div>
                {(dataDe || dataAte) && (
                  <button
                    type="button"
                    className={styles.limparFiltro}
                    onClick={() => {
                      setDataDe('');
                      setDataAte('');
                    }}
                  >
                    Limpar
                  </button>
                )}
                <span className={styles.filtroInfo}>
                  Exibindo: <strong>{rotuloCompetencia}</strong>
                </span>
              </div>

              <div className={styles.exportWrapper} ref={exportMenuRef}>
                <button
                  type="button"
                  className={styles.exportBtn}
                  onClick={() => setExportMenuAberto((v) => !v)}
                >
                  Exportar PDF <span className={styles.exportCaret}>▾</span>
                </button>
                {exportMenuAberto && (
                  <div className={styles.exportMenu}>
                    <button
                      type="button"
                      onClick={() => {
                        setExportMenuAberto(false);
                        gerarPDFDownload('mes');
                      }}
                    >
                      Período selecionado
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExportMenuAberto(false);
                        gerarPDFDownload('completo');
                      }}
                    >
                      Relatório completo
                    </button>
                  </div>
                )}
              </div>
            </div>

            {servicosAgrupados.length === 0 ? (
              <p className={styles.emptyMsg}>Nenhum registro de atendimento ou frequência gravado até o momento.</p>
            ) : (
              servicosAgrupados.map((grupo, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '1.25rem',
                    marginBottom: '1.5rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '2px solid #cbd5e1',
                      paddingBottom: '0.75rem',
                      marginBottom: '1rem',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div>
                      <span
                        style={{
                          backgroundColor: '#0284c7',
                          color: '#fff',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontWeight: 'bold',
                          fontSize: '0.85rem',
                          marginRight: '8px',
                        }}
                      >
                        SERVIÇO: {grupo.servico}
                      </span>
                      <strong style={{ fontSize: '1.05rem', color: '#1e293b' }}>
                        {rotuloEspecialidade(grupo.servico)}: {grupo.especialidade}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 'bold', flexWrap: 'wrap' }}>
                      <span style={{ color: '#1e3a5f', background: '#e0f2fe', padding: '2px 8px', borderRadius: '4px' }}>
                        🗓️ {grupo.datas.length} Agendamento(s) no mês
                      </span>
                      <span style={{ color: '#166534', background: '#dcfce7', padding: '2px 8px', borderRadius: '4px' }}>
                        ✅ {grupo.presencas} Presença(s)
                      </span>
                      <span style={{ color: '#991b1b', background: '#fee2e2', padding: '2px 8px', borderRadius: '4px' }}>
                        ❌ {grupo.faltas} Falta(s)
                      </span>
                      {grupo.faltasJustificadas > 0 && (
                        <span style={{ color: '#92400e', background: '#fef3c7', padding: '2px 8px', borderRadius: '4px' }}>
                          ⚠️ {grupo.faltasJustificadas} Justificada(s)
                        </span>
                      )}
                    </div>
                  </div>

                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ width: '18%' }}>Data</th>
                        <th style={{ width: '12%' }}>Hora</th>
                        <th style={{ width: '30%' }}>Frequência / Status</th>
                        <th style={{ width: '40%' }}>
                          {usaRelatorioFinal(grupo.servico, grupo.especialidade) ? 'Relatório Final' : 'Observação'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupo.datas.map((d) => (
                        <tr key={d.id}>
                          <td>
                            <strong>{new Date(d.data).toLocaleDateString('pt-BR')}</strong>
                          </td>
                          <td>{d.hora || '-'}</td>
                          <td>
                            <span
                              style={{
                                padding: '4px 10px',
                                borderRadius: '4px',
                                fontWeight: 'bold',
                                fontSize: '0.85rem',
                                display: 'inline-block',
                                backgroundColor:
                                  d.status === 'PRESENCA' ? '#dcfce7' :
                                  d.status === 'FALTA' ? '#fee2e2' :
                                  d.status === 'FALTA_JUSTIFICADA' ? '#fef3c7' : '#e2e8f0',
                                color:
                                  d.status === 'PRESENCA' ? '#166534' :
                                  d.status === 'FALTA' ? '#991b1b' :
                                  d.status === 'FALTA_JUSTIFICADA' ? '#92400e' : '#475569',
                              }}
                            >
                              {d.status === 'PRESENCA' && '✅ Presença Confirmada'}
                              {d.status === 'FALTA' && '❌ Falta'}
                              {d.status === 'FALTA_JUSTIFICADA' && '⚠️ Falta Justificada'}
                              {!d.status && '🗓️ Agendado'}
                            </span>
                          </td>
                          <td>{d.observacao || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className={styles.placeholderBox}>
          Digite o nome ou CPF no campo acima para pesquisar o histórico do paciente no banco de dados.
        </div>
      )}
    </div>
  );
}