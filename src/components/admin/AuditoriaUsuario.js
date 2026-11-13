"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./AuditoriaUsuario.module.css";

const MODULOS = [
  { valor: "CCZ", rotulo: "CCZ" },
  { valor: "REGULACAO", rotulo: "Regulação" },
  { valor: "FARMACIA_JUDICIAL", rotulo: "Farmácia Judicial" },
  { valor: "JUNTA", rotulo: "Junta Reguladora" },
  { valor: "GERENCIAMENTO", rotulo: "Gerenciamento" },
  { valor: "AUTH", rotulo: "Autenticação" },
];

const rotuloModulo = (valor) =>
  MODULOS.find((m) => m.valor === valor)?.rotulo || valor;

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

const FILTROS_VAZIOS = { dataInicio: "", dataFim: "", modulo: "" };

export default function AuditoriaUsuario() {
  const [termo, setTermo] = useState("");
  const [sugestoes, setSugestoes] = useState([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [usuario, setUsuario] = useState(null);
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const buscaRef = useRef(null);

  // Busca de usuários com debounce de 300 ms (mínimo 2 caracteres).
  useEffect(() => {
    const texto = termo.trim();
    if (texto.length < 2 || (usuario && texto === usuario.nome)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpeza das sugestões conforme o termo
      setSugestoes([]);
      return undefined;
    }
    let cancelado = false;
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await fetch(
          `/api/gerenciamento/auditoria/usuarios?q=${encodeURIComponent(texto)}`,
          { cache: "no-store" },
        );
        const corpo = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(corpo.error || "Erro ao buscar usuários.");
        if (!cancelado) {
          setSugestoes(corpo.usuarios || []);
          setMostrarSugestoes(true);
        }
      } catch (e) {
        if (!cancelado) setErro(e.message);
      } finally {
        if (!cancelado) setBuscando(false);
      }
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [termo, usuario]);

  // Fecha o dropdown ao clicar fora.
  useEffect(() => {
    function aoClicarFora(evento) {
      if (buscaRef.current && !buscaRef.current.contains(evento.target)) {
        setMostrarSugestoes(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  async function consultar(cpf, filtrosAtuais, page = 1) {
    setCarregando(true);
    setErro("");
    const params = new URLSearchParams({ cpf, page: String(page), limit: "25" });
    if (filtrosAtuais.modulo) params.set("modulo", filtrosAtuais.modulo);
    if (filtrosAtuais.dataInicio) params.set("dataInicio", filtrosAtuais.dataInicio);
    if (filtrosAtuais.dataFim) params.set("dataFim", filtrosAtuais.dataFim);
    try {
      const res = await fetch(`/api/gerenciamento/auditoria?${params.toString()}`, {
        cache: "no-store",
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.error || "Erro ao consultar auditoria.");
      setDados(corpo);
    } catch (e) {
      setErro(e.message);
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }

  function selecionar(u) {
    setUsuario(u);
    setTermo(u.nome);
    setMostrarSugestoes(false);
    setSugestoes([]);
    setFiltros(FILTROS_VAZIOS);
    consultar(u.cpf, FILTROS_VAZIOS, 1);
  }

  function aplicarFiltros(evento) {
    evento.preventDefault();
    if (usuario) consultar(usuario.cpf, filtros, 1);
  }

  function limparFiltros() {
    setFiltros(FILTROS_VAZIOS);
    if (usuario) consultar(usuario.cpf, FILTROS_VAZIOS, 1);
  }

  const resumo = dados?.resumo;
  const paginacao = dados?.paginacao;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Auditoria de usuário</h2>
        <p className={styles.subtitle}>
          Busque um usuário do sistema para ver tudo o que foi registrado sobre ele.
        </p>
      </div>

      <div className={styles.busca} ref={buscaRef}>
        <label htmlFor="auditoria-busca" className={styles.label}>
          Usuário (nome, username ou CPF)
        </label>
        <input
          id="auditoria-busca"
          type="text"
          className={styles.input}
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value);
            setUsuario(null);
            setDados(null);
          }}
          onFocus={() => sugestoes.length > 0 && setMostrarSugestoes(true)}
          placeholder="Digite ao menos 2 caracteres"
          autoComplete="off"
        />
        {buscando && <span className={styles.hint}>Buscando…</span>}
        {mostrarSugestoes && (
          <ul className={styles.sugestoes} role="listbox" aria-label="Usuários encontrados">
            {sugestoes.length === 0 ? (
              <li className={styles.sugestaoVazia}>Nenhum usuário encontrado.</li>
            ) : (
              sugestoes.map((u) => (
                <li key={u.cpf} role="option" aria-selected={usuario?.cpf === u.cpf}>
                  <button
                    type="button"
                    className={styles.sugestaoBtn}
                    onClick={() => selecionar(u)}
                  >
                    <strong>{u.nome}</strong>
                    <span>
                      {u.username ? `@${u.username} · ` : ""}CPF {u.cpf}
                      {u.ativo === false ? " · inativo" : ""}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <div aria-live="polite">
        {erro && <div className={styles.alertErro}>{erro}</div>}
        {carregando && <div className={styles.estado}>Carregando auditoria…</div>}
      </div>

      {!usuario && !carregando && !erro && (
        <div className={styles.estado}>Selecione um usuário para ver o histórico.</div>
      )}

      {usuario && dados && (
        <>
          <div className={styles.usuarioBox}>
            <strong>{dados.usuario.nome}</strong>
            <span>
              {dados.usuario.username ? `@${dados.usuario.username} · ` : ""}
              CPF {dados.usuario.cpf}
              {dados.usuario.cargo ? ` · ${dados.usuario.cargo}` : ""}
              {dados.usuario.ativo === false ? " · inativo" : ""}
            </span>
          </div>

          <p className={styles.aviso}>
            {resumo.primeiroRegistroAuditoria
              ? `Registros de auditoria existem a partir de ${formatarDataHora(resumo.primeiroRegistroAuditoria)}; antes disso, apenas rastros do histórico.`
              : "Ainda não há registros de auditoria; exibindo apenas rastros do histórico."}
          </p>

          <div className={styles.cards}>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Total de eventos</span>
              <strong className={styles.cardValor}>{resumo.total}</strong>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Primeiro evento</span>
              <strong className={styles.cardTexto}>{formatarDataHora(resumo.primeiro)}</strong>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Último evento</span>
              <strong className={styles.cardTexto}>{formatarDataHora(resumo.ultimo)}</strong>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Do histórico anterior</span>
              <strong className={styles.cardValor}>{resumo.totalHistorico}</strong>
            </div>
          </div>

          <div className={styles.distribuicao}>
            <div>
              <span className={styles.cardLabel}>Por módulo</span>
              <div className={styles.chips}>
                {resumo.porModulo.length === 0 && <span className={styles.hint}>—</span>}
                {resumo.porModulo.map((m) => (
                  <span key={m.modulo} className={styles.chip}>
                    {rotuloModulo(m.modulo)}: {m.total}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className={styles.cardLabel}>Por ação</span>
              <div className={styles.chips}>
                {resumo.porAcao.length === 0 && <span className={styles.hint}>—</span>}
                {resumo.porAcao.map((a) => (
                  <span key={a.acao} className={styles.chip}>
                    {a.acao}: {a.total}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <form className={styles.filtros} onSubmit={aplicarFiltros}>
            <div className={styles.field}>
              <label htmlFor="aud-inicio">Data inicial</label>
              <input
                id="aud-inicio"
                type="date"
                value={filtros.dataInicio}
                onChange={(e) => setFiltros((f) => ({ ...f, dataInicio: e.target.value }))}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="aud-fim">Data final</label>
              <input
                id="aud-fim"
                type="date"
                value={filtros.dataFim}
                onChange={(e) => setFiltros((f) => ({ ...f, dataFim: e.target.value }))}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="aud-modulo">Módulo</label>
              <select
                id="aud-modulo"
                value={filtros.modulo}
                onChange={(e) => setFiltros((f) => ({ ...f, modulo: e.target.value }))}
              >
                <option value="">Todos os módulos</option>
                {MODULOS.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.rotulo}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.filtroActions}>
              <button type="button" className={styles.btnSecondary} onClick={limparFiltros}>
                Limpar
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={carregando}>
                Filtrar
              </button>
            </div>
          </form>

          {dados.itens.length === 0 ? (
            <div className={styles.estado}>Nenhum evento encontrado para os filtros aplicados.</div>
          ) : (
            <>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Data/hora</th>
                      <th>Módulo</th>
                      <th>Ação</th>
                      <th>Entidade</th>
                      <th>Descrição</th>
                      <th>IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.itens.map((item, i) => (
                      <tr key={`${item.ts}-${item.origem}-${i}`}>
                        <td>{formatarDataHora(item.ts)}</td>
                        <td>{rotuloModulo(item.modulo)}</td>
                        <td>
                          <span className={styles.badge}>{item.acao}</span>
                        </td>
                        <td>
                          {item.entidade}
                          {item.entidadeId ? <small> #{item.entidadeId}</small> : null}
                        </td>
                        <td>
                          {item.descricao || "—"}
                          {item.origem === "HISTORICO" && (
                            <span className={styles.selo}>Histórico anterior à auditoria</span>
                          )}
                          {item.matchTipo === "NOME" && (
                            <span className={styles.seloAviso}>correspondência por nome</span>
                          )}
                        </td>
                        <td>{item.ip || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.pagination}>
                <span className={styles.paginationInfo}>
                  Página {paginacao.page} de {paginacao.totalPaginas} ({paginacao.total} eventos)
                </span>
                <div className={styles.paginationButtons}>
                  <button
                    type="button"
                    className={styles.btnPage}
                    onClick={() => consultar(usuario.cpf, filtros, paginacao.page - 1)}
                    disabled={carregando || paginacao.page <= 1}
                  >
                    ‹ Anterior
                  </button>
                  <button
                    type="button"
                    className={styles.btnPage}
                    onClick={() => consultar(usuario.cpf, filtros, paginacao.page + 1)}
                    disabled={carregando || paginacao.page >= paginacao.totalPaginas}
                  >
                    Próxima ›
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
