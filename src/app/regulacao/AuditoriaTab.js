"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./AuditoriaTab.module.css";

const ROTULOS_ACAO = {
  CRIAR: "Cadastro",
  EDITAR: "Edição",
  EXCLUIR: "Exclusão",
  LIBERAR: "Liberação",
  SALVAR: "Gravação (cota/planejamento)",
  DESATIVAR: "Desativação",
  REATIVAR: "Reativação",
  AJUSTAR: "Ajuste",
  ENCERRAR: "Encerramento",
  REABRIR: "Reabertura",
  DISPENSAR: "Dispensação",
  LOGIN: "Login",
  OUTRO: "Outro",
  ALTERACAO: "Alteração",
};

const ROTULOS_ENTIDADE = {
  PedidoExame: "Pedido de exame",
  Pessoa: "Paciente/Pessoa",
  Medico: "Médico",
  Ubs: "UBS",
  Procedimento: "Procedimento",
  TipoExame: "Tipo de exame",
  CotaFinanceira: "Cota financeira",
  PlanejamentoCidade: "Planejamento por cidade",
};

const rotuloAcao = (v) => ROTULOS_ACAO[v] || v;
const rotuloEntidade = (v) => ROTULOS_ENTIDADE[v] || v;

const formatarDataHora = (valor) => {
  if (!valor) return "—";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatarData = (iso) => {
  if (!iso) return "";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
};

const paraIso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function periodoRapido(tipo) {
  const hoje = new Date();
  const fim = paraIso(hoje);
  if (tipo === "7") {
    const i = new Date(hoje);
    i.setDate(i.getDate() - 6);
    return { de: paraIso(i), ate: fim };
  }
  if (tipo === "30") {
    const i = new Date(hoje);
    i.setDate(i.getDate() - 29);
    return { de: paraIso(i), ate: fim };
  }
  if (tipo === "mes") {
    return { de: paraIso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), ate: fim };
  }
  return { de: `${hoje.getFullYear()}-01-01`, ate: fim };
}

const textoPeriodo = (f) => {
  if (f.de && f.ate) return `${formatarData(f.de)} a ${formatarData(f.ate)}`;
  if (f.de) return `a partir de ${formatarData(f.de)}`;
  if (f.ate) return `até ${formatarData(f.ate)}`;
  return "Todo o período";
};

const filtrosIniciais = () => ({
  ...periodoRapido("30"),
  usuario: "",
  acao: "",
  entidade: "",
  q: "",
});

function montarParams(f, extra = {}) {
  const p = new URLSearchParams();
  for (const k of ["de", "ate", "usuario", "acao", "entidade", "q"]) {
    if (f[k]) p.set(k, f[k]);
  }
  for (const [k, v] of Object.entries(extra)) p.set(k, String(v));
  return p;
}

async function buscar(f, extra) {
  const res = await fetch(`/api/regulacao/auditoria?${montarParams(f, extra)}`, {
    cache: "no-store",
  });
  const corpo = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) throw new Error("Sessão expirada. Entre novamente.");
    if (res.status === 403) throw new Error("Acesso restrito ao Gestor.");
    throw new Error(corpo.error || "Erro ao consultar auditoria.");
  }
  return corpo;
}

const COLUNAS_ORDEM = [
  { chave: "nome", rotulo: "Usuário" },
  { chave: "total", rotulo: "Total" },
  { chave: "cadastros", rotulo: "Cadastros" },
  { chave: "edicoes", rotulo: "Edições" },
  { chave: "exclusoes", rotulo: "Exclusões" },
  { chave: "liberacoes", rotulo: "Liberações" },
  { chave: "primeiro", rotulo: "Primeira alteração" },
  { chave: "ultimo", rotulo: "Última alteração" },
];

export default function AuditoriaTab() {
  const [form, setForm] = useState(filtrosIniciais);
  const [aplicados, setAplicados] = useState(form);
  const [pagina, setPagina] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [exportando, setExportando] = useState("");
  const [ordem, setOrdem] = useState({ chave: "total", dir: "desc" });

  const carregar = useCallback(async (f, page, size) => {
    setCarregando(true);
    setErro("");
    try {
      const corpo = await buscar(f, { page, pageSize: size });
      setDados(corpo);
    } catch (e) {
      setErro(e.message);
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial do relatório
    carregar(aplicados, pagina, pageSize);
  }, [carregar, aplicados, pagina, pageSize]);

  function aplicar(evento) {
    evento?.preventDefault();
    setPagina(1);
    setAplicados({ ...form });
  }

  function limpar() {
    const inicial = filtrosIniciais();
    setForm(inicial);
    setPagina(1);
    setAplicados(inicial);
  }

  function atalho(tipo) {
    const novo = { ...form, ...periodoRapido(tipo) };
    setForm(novo);
    setPagina(1);
    setAplicados(novo);
  }

  function filtrarPorUsuario(cpf) {
    const novo = { ...aplicados, usuario: cpf };
    setForm(novo);
    setPagina(1);
    setAplicados(novo);
  }

  function alternarOrdem(chave) {
    setOrdem((o) =>
      o.chave === chave
        ? { chave, dir: o.dir === "asc" ? "desc" : "asc" }
        : { chave, dir: chave === "nome" ? "asc" : "desc" },
    );
  }

  const usuariosOrdenados = useMemo(() => {
    const lista = [...(dados?.usuarios || [])];
    const { chave, dir } = ordem;
    const fator = dir === "asc" ? 1 : -1;
    lista.sort((a, b) => {
      const va = a[chave];
      const vb = b[chave];
      if (chave === "nome") return fator * String(va).localeCompare(String(vb), "pt-BR");
      if (chave === "primeiro" || chave === "ultimo") {
        return fator * (new Date(va).getTime() - new Date(vb).getTime());
      }
      return fator * ((va || 0) - (vb || 0));
    });
    return lista;
  }, [dados, ordem]);

  const nomeUsuarioFiltro = useMemo(() => {
    if (!aplicados.usuario) return "";
    const achado = dados?.opcoes?.usuarios?.find((u) => u.cpf === aplicados.usuario);
    return achado?.nome || aplicados.usuario;
  }, [aplicados.usuario, dados]);

  async function obterTudo() {
    const completo = await buscar(aplicados, { export: 1 });
    return completo;
  }

  function linhasDetalhe(completo) {
    return completo.itens.map((i) => [
      formatarDataHora(i.ts),
      i.userNome,
      rotuloAcao(i.acao),
      rotuloEntidade(i.entidade),
      i.entidadeId || "",
      i.descricao || "",
      i.ip || "",
    ]);
  }

  function descricaoFiltros(completo) {
    const f = completo.filtros;
    const partes = [`Período: ${textoPeriodo(f)}`];
    if (f.usuario) partes.push(`Usuário: ${nomeUsuarioFiltro || f.usuario}`);
    if (f.acao) partes.push(`Ação: ${rotuloAcao(f.acao)}`);
    if (f.entidade) partes.push(`Objeto: ${rotuloEntidade(f.entidade)}`);
    if (f.q) partes.push(`Busca: "${f.q}"`);
    return partes.join(" | ");
  }

  async function exportarPdf() {
    setExportando("pdf");
    setErro("");
    try {
      const completo = await obterTudo();
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const ind = completo.indicadores;
      doc.setFontSize(15);
      doc.text("Relatório de Auditoria de Alterações — Regulação", 14, 15);
      doc.setFontSize(9);
      doc.text(descricaoFiltros(completo), 14, 21, { maxWidth: 265 });
      doc.text(
        `Gerado em ${formatarDataHora(completo.geradoEm)} por ${completo.geradoPor || "—"}`,
        14,
        26,
      );
      doc.text(
        `Total: ${ind.total} | Usuários: ${ind.usuariosDistintos} | Cadastros: ${ind.cadastros} | Edições: ${ind.edicoes} | Exclusões: ${ind.exclusoes} | Liberações: ${ind.liberacoes}`,
        14,
        31,
      );
      let y = 36;
      if (completo.paginacao.truncado) {
        doc.setTextColor(180, 0, 0);
        doc.text(
          `Atenção: exportação limitada aos ${completo.paginacao.limiteExportacao} registros mais recentes de ${completo.paginacao.total}.`,
          14,
          y,
        );
        doc.setTextColor(0, 0, 0);
        y += 5;
      }
      autoTable(doc, {
        startY: y,
        head: [["Usuário", "Total", "Cadastros", "Edições", "Exclusões", "Liberações", "Primeira", "Última"]],
        body: completo.usuarios.map((u) => [
          u.nome,
          u.total,
          u.cadastros,
          u.edicoes,
          u.exclusoes,
          u.liberacoes,
          formatarDataHora(u.primeiro),
          formatarDataHora(u.ultimo),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [37, 99, 235] },
      });
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        head: [["Data/hora", "Usuário", "Ação", "Objeto", "ID", "Descrição", "IP"]],
        body: linhasDetalhe(completo),
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [37, 99, 235] },
        columnStyles: { 5: { cellWidth: 85 } },
      });
      if (completo.historicoAnterior.itens.length > 0) {
        autoTable(doc, {
          startY: doc.lastAutoTable.finalY + 8,
          head: [["Histórico anterior à auditoria — Data/hora", "Usuário", "Ação", "Pedido", "Detalhe"]],
          body: completo.historicoAnterior.itens.map((h) => [
            formatarDataHora(h.ts),
            h.userNome,
            rotuloAcao(h.acao),
            h.entidadeId,
            h.descricao,
          ]),
          styles: { fontSize: 7, cellPadding: 1.5 },
          headStyles: { fillColor: [100, 116, 139] },
        });
      }
      const total = doc.getNumberOfPages();
      for (let p = 1; p <= total; p += 1) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.text(`Página ${p} de ${total} — Documento confidencial (uso restrito ao Gestor)`, 14, 204);
      }
      doc.save(`Auditoria_Regulacao_${paraIso(new Date())}.pdf`);
    } catch (e) {
      setErro(e.message || "Erro ao exportar PDF.");
    } finally {
      setExportando("");
    }
  }

  async function exportarExcel() {
    setExportando("xlsx");
    setErro("");
    try {
      const completo = await obterTudo();
      const XLSX = await import("xlsx");
      const ind = completo.indicadores;
      const wb = XLSX.utils.book_new();
      const resumo = [
        ["Relatório de Auditoria de Alterações — Regulação"],
        [descricaoFiltros(completo)],
        [`Gerado em ${formatarDataHora(completo.geradoEm)} por ${completo.geradoPor || "—"}`],
        [],
        ["Total de alterações", ind.total],
        ["Usuários distintos", ind.usuariosDistintos],
        ["Cadastros", ind.cadastros],
        ["Edições", ind.edicoes],
        ["Exclusões", ind.exclusoes],
        ["Liberações", ind.liberacoes],
        ["Usuário mais ativo", ind.usuarioMaisAtivo ? `${ind.usuarioMaisAtivo.nome} (${ind.usuarioMaisAtivo.total})` : "—"],
      ];
      if (completo.paginacao.truncado) {
        resumo.push([
          `ATENÇÃO: detalhado limitado a ${completo.paginacao.limiteExportacao} de ${completo.paginacao.total} registros.`,
        ]);
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), "Resumo");
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          completo.usuarios.map((u) => ({
            Usuário: u.nome,
            Perfil: u.perfil || "",
            Total: u.total,
            Cadastros: u.cadastros,
            Edições: u.edicoes,
            Exclusões: u.exclusoes,
            Liberações: u.liberacoes,
            "Primeira alteração": formatarDataHora(u.primeiro),
            "Última alteração": formatarDataHora(u.ultimo),
          })),
        ),
        "Por usuário",
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ["Data/hora", "Usuário", "Ação", "Objeto", "ID", "Descrição", "IP"],
          ...linhasDetalhe(completo),
        ]),
        "Detalhado",
      );
      if (completo.historicoAnterior.itens.length > 0) {
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.aoa_to_sheet([
            ["Data/hora", "Usuário", "CPF", "Ação", "Pedido", "Detalhe"],
            ...completo.historicoAnterior.itens.map((h) => [
              formatarDataHora(h.ts),
              h.userNome,
              h.userCpf,
              rotuloAcao(h.acao),
              h.entidadeId,
              h.descricao,
            ]),
          ]),
          "Histórico anterior",
        );
      }
      XLSX.writeFile(wb, `Auditoria_Regulacao_${paraIso(new Date())}.xlsx`);
    } catch (e) {
      setErro(e.message || "Erro ao exportar Excel.");
    } finally {
      setExportando("");
    }
  }

  const ind = dados?.indicadores;
  const pag = dados?.paginacao;
  const hist = dados?.historicoAnterior;

  return (
    <section className={styles.container} aria-labelledby="auditoria-titulo">
      <header className={styles.header}>
        <div>
          <h2 id="auditoria-titulo" className={styles.title}>
            Auditoria de Alterações
          </h2>
          <p className={styles.subtitle}>
            Quem cadastrou, editou, liberou ou excluiu dados da Regulação. Acesso restrito ao
            Gestor.
          </p>
          {dados && (
            <p className={styles.meta}>
              Período: <strong>{textoPeriodo(dados.filtros)}</strong> · Gerado em{" "}
              {formatarDataHora(dados.geradoEm)} por {dados.geradoPor || "—"}
            </p>
          )}
        </div>
        <div className={styles.exports}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={exportarPdf}
            disabled={!dados || !!exportando}
          >
            {exportando === "pdf" ? "Gerando PDF…" : "Exportar PDF"}
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={exportarExcel}
            disabled={!dados || !!exportando}
          >
            {exportando === "xlsx" ? "Gerando Excel…" : "Exportar Excel"}
          </button>
        </div>
      </header>

      <form className={styles.filtros} onSubmit={aplicar}>
        <div className={styles.field}>
          <label htmlFor="aud-de">Data inicial</label>
          <input
            id="aud-de"
            type="date"
            value={form.de}
            onChange={(e) => setForm((f) => ({ ...f, de: e.target.value }))}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="aud-ate">Data final</label>
          <input
            id="aud-ate"
            type="date"
            value={form.ate}
            onChange={(e) => setForm((f) => ({ ...f, ate: e.target.value }))}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="aud-usuario">Usuário</label>
          <select
            id="aud-usuario"
            value={form.usuario}
            onChange={(e) => setForm((f) => ({ ...f, usuario: e.target.value }))}
          >
            <option value="">Todos os usuários</option>
            {(dados?.opcoes?.usuarios || []).map((u) => (
              <option key={u.cpf} value={u.cpf}>
                {u.nome}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="aud-acao">Tipo de ação</label>
          <select
            id="aud-acao"
            value={form.acao}
            onChange={(e) => setForm((f) => ({ ...f, acao: e.target.value }))}
          >
            <option value="">Todas as ações</option>
            {(dados?.opcoes?.acoes || []).map((a) => (
              <option key={a} value={a}>
                {rotuloAcao(a)}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="aud-entidade">Objeto</label>
          <select
            id="aud-entidade"
            value={form.entidade}
            onChange={(e) => setForm((f) => ({ ...f, entidade: e.target.value }))}
          >
            <option value="">Todos os objetos</option>
            {(dados?.opcoes?.entidades || []).map((e) => (
              <option key={e} value={e}>
                {rotuloEntidade(e)}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="aud-q">Busca (descrição ou ID)</label>
          <input
            id="aud-q"
            type="search"
            value={form.q}
            maxLength={100}
            onChange={(e) => setForm((f) => ({ ...f, q: e.target.value }))}
            placeholder="Ex.: pedido #123"
          />
        </div>
        <div className={styles.atalhos} role="group" aria-label="Atalhos de período">
          <button type="button" className={styles.chipBtn} onClick={() => atalho("7")}>
            Últimos 7 dias
          </button>
          <button type="button" className={styles.chipBtn} onClick={() => atalho("30")}>
            Últimos 30 dias
          </button>
          <button type="button" className={styles.chipBtn} onClick={() => atalho("mes")}>
            Este mês
          </button>
          <button type="button" className={styles.chipBtn} onClick={() => atalho("ano")}>
            Este ano
          </button>
        </div>
        <div className={styles.filtroActions}>
          <button type="button" className={styles.btnSecondary} onClick={limpar}>
            Limpar
          </button>
          <button type="submit" className={styles.btnPrimary} disabled={carregando}>
            Filtrar
          </button>
        </div>
      </form>

      <div aria-live="polite">
        {erro && (
          <div className={styles.alertErro} role="alert">
            {erro}
          </div>
        )}
        {carregando && <div className={styles.estado}>Carregando auditoria…</div>}
      </div>

      {dados && (
        <>
          <p className={styles.aviso}>
            {dados.primeiroRegistroAuditoria
              ? `O registro detalhado de auditoria começou em ${formatarDataHora(dados.primeiroRegistroAuditoria)}. Alterações anteriores a essa data aparecem apenas no histórico de pedidos, mais abaixo. Cadastros de pessoas feitos pelo módulo Gerenciamento não entram neste relatório.`
              : "Ainda não há registros de auditoria da Regulação. Alterações futuras aparecerão aqui."}
          </p>

          <div className={styles.cards}>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Total de alterações</span>
              <strong className={styles.cardValor}>{ind.total}</strong>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Usuários que alteraram</span>
              <strong className={styles.cardValor}>{ind.usuariosDistintos}</strong>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Cadastros</span>
              <strong className={styles.cardValor}>{ind.cadastros}</strong>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Edições</span>
              <strong className={styles.cardValor}>{ind.edicoes}</strong>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Exclusões</span>
              <strong className={styles.cardValor}>{ind.exclusoes}</strong>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Liberações</span>
              <strong className={styles.cardValor}>{ind.liberacoes}</strong>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Usuário mais ativo</span>
              <strong className={styles.cardTexto}>
                {ind.usuarioMaisAtivo
                  ? `${ind.usuarioMaisAtivo.nome} (${ind.usuarioMaisAtivo.total})`
                  : "—"}
              </strong>
            </div>
          </div>

          <h3 className={styles.sectionTitle}>Quem mexeu nos dados</h3>
          {usuariosOrdenados.length === 0 ? (
            <div className={styles.estado}>Nenhum usuário alterou dados com os filtros aplicados.</div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <caption className={styles.srOnly}>
                  Resumo de alterações por usuário
                </caption>
                <thead>
                  <tr>
                    {COLUNAS_ORDEM.map((c) => (
                      <th
                        key={c.chave}
                        scope="col"
                        aria-sort={
                          ordem.chave === c.chave
                            ? ordem.dir === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                      >
                        <button
                          type="button"
                          className={styles.thBtn}
                          onClick={() => alternarOrdem(c.chave)}
                        >
                          {c.rotulo}
                          {ordem.chave === c.chave ? (ordem.dir === "asc" ? " ▲" : " ▼") : ""}
                        </button>
                      </th>
                    ))}
                    <th scope="col">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosOrdenados.map((u) => (
                    <tr key={u.cpf}>
                      <td>
                        <strong>{u.nome}</strong>
                        {u.perfil && <small className={styles.perfil}> {u.perfil}</small>}
                      </td>
                      <td>{u.total}</td>
                      <td>{u.cadastros}</td>
                      <td>{u.edicoes}</td>
                      <td>{u.exclusoes}</td>
                      <td>{u.liberacoes}</td>
                      <td>{formatarDataHora(u.primeiro)}</td>
                      <td>{formatarDataHora(u.ultimo)}</td>
                      <td>
                        <button
                          type="button"
                          className={styles.linkBtn}
                          onClick={() => filtrarPorUsuario(u.cpf)}
                          aria-label={`Ver alterações de ${u.nome}`}
                        >
                          Ver alterações
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 className={styles.sectionTitle}>
            Linha do tempo
            {aplicados.usuario && (
              <span className={styles.filtroAtivo}>
                {" "}
                · {nomeUsuarioFiltro}{" "}
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => filtrarPorUsuario("")}
                >
                  remover filtro
                </button>
              </span>
            )}
          </h3>
          {dados.itens.length === 0 ? (
            <div className={styles.estado}>Nenhuma alteração encontrada para os filtros aplicados.</div>
          ) : (
            <>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <caption className={styles.srOnly}>
                    Alterações detalhadas, da mais recente para a mais antiga
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Data/hora</th>
                      <th scope="col">Usuário</th>
                      <th scope="col">Ação</th>
                      <th scope="col">Objeto</th>
                      <th scope="col">ID</th>
                      <th scope="col">Descrição</th>
                      <th scope="col">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.itens.map((i) => (
                      <tr key={i.id}>
                        <td>{formatarDataHora(i.ts)}</td>
                        <td>{i.userNome}</td>
                        <td>
                          <span className={styles.badge}>{rotuloAcao(i.acao)}</span>
                        </td>
                        <td>{rotuloEntidade(i.entidade)}</td>
                        <td>{i.entidadeId || "—"}</td>
                        <td>{i.descricao || "—"}</td>
                        <td>{i.ip || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.pagination}>
                <span className={styles.paginationInfo}>
                  Página {pag.page} de {pag.totalPaginas} ({pag.total} alterações)
                </span>
                <div className={styles.paginationButtons}>
                  <label htmlFor="aud-size" className={styles.srOnly}>
                    Itens por página
                  </label>
                  <select
                    id="aud-size"
                    className={styles.sizeSelect}
                    value={pageSize}
                    onChange={(e) => {
                      setPagina(1);
                      setPageSize(Number(e.target.value));
                    }}
                  >
                    {[10, 25, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {n} por página
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={styles.btnPage}
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    disabled={carregando || pag.page <= 1}
                  >
                    ‹ Anterior
                  </button>
                  <button
                    type="button"
                    className={styles.btnPage}
                    onClick={() => setPagina((p) => p + 1)}
                    disabled={carregando || pag.page >= pag.totalPaginas}
                  >
                    Próxima ›
                  </button>
                </div>
              </div>
            </>
          )}

          {hist?.aplicavel && (
            <>
              <h3 className={styles.sectionTitle}>
                Histórico anterior à auditoria{" "}
                <span className={styles.selo}>regula_pedidos_historico</span>
              </h3>
              <p className={styles.hint}>
                Registros antigos de alterações em pedidos, gravados antes do log de auditoria
                existir. A autoria vem do CPF gravado no próprio registro.
              </p>
              {hist.itens.length === 0 ? (
                <div className={styles.estado}>Nenhum registro no histórico anterior.</div>
              ) : (
                <>
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <caption className={styles.srOnly}>Histórico anterior à auditoria</caption>
                      <thead>
                        <tr>
                          <th scope="col">Data/hora</th>
                          <th scope="col">Usuário</th>
                          <th scope="col">Ação</th>
                          <th scope="col">Pedido</th>
                          <th scope="col">Detalhe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hist.itens.map((h) => (
                          <tr key={h.id}>
                            <td>{formatarDataHora(h.ts)}</td>
                            <td>{h.userNome}</td>
                            <td>{rotuloAcao(h.acao)}</td>
                            <td>#{h.entidadeId}</td>
                            <td>{h.descricao || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {hist.truncado && (
                    <p className={styles.hint}>
                      Exibindo os {hist.itens.length} mais recentes de {hist.total}.
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
