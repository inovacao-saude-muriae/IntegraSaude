"use client";

import { useState, useEffect, useCallback } from "react";
import { Filter, SearchX, User, PawPrint, Cat, Dog } from "lucide-react";
import styles from "../camara-tecnica/processos/ConsultarProcessos.module.css";
import galeria from "./AnimaisGaleria.module.css";
import { consultarAnimais, obterFiltrosAnimais } from "./actions";

// CCZ > Zoonoses > Animais — Consultar Registros
// Mesmo padrão visual e funcional de Leishmaniose/Esporotricose > Consultar
// Registros: container de filtros, estado inicial com lupa, tabela com linha
// clicável (somente leitura) e paginação de 100 no backend.
const FILTROS_VAZIOS = {
  busca: "",
  periodoInicio: "",
  periodoFim: "",
  especie: "",
  sexo: "",
  porte: "",
  situacao: "",
  bairro: "",
};

const SEXOS = [
  { value: "", label: "Todos" },
  { value: "M", label: "Macho" },
  { value: "F", label: "Fêmea" },
];

const PORTES = [
  { value: "", label: "Todos" },
  { value: "Pequeno", label: "Pequeno" },
  { value: "Médio", label: "Médio" },
  { value: "Grande", label: "Grande" },
];

const SITUACOES = [
  { value: "", label: "Todas" },
  { value: "CCZ", label: "No CCZ" },
  { value: "Adotado", label: "Adotado" },
  { value: "Devolvido", label: "Devolvido" },
  { value: "SEM_TUTOR", label: "Sem tutor" },
];

const formatarData = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
};

const badgeSituacao = (situacao) => {
  if (!situacao) return null;
  if (situacao === "Adotado") return { css: galeria.badgeAdotado, texto: "Adotado" };
  if (situacao === "Devolvido") return { css: galeria.badgeDevolvido, texto: "Devolvido" };
  if (situacao === "CCZ") return { css: galeria.badgeCcz, texto: "No CCZ" };
  return { css: galeria.badgeCcz, texto: situacao };
};

// Imagem padrão discreta por espécie (sem inventar fotografia real).
const IconeEspecie = ({ especie, size = 34 }) => {
  const e = String(especie || "").toLowerCase();
  if (e.startsWith("fel")) return <Cat size={size} strokeWidth={1.5} aria-hidden="true" />;
  if (e.startsWith("can")) return <Dog size={size} strokeWidth={1.5} aria-hidden="true" />;
  return <PawPrint size={size} strokeWidth={1.5} aria-hidden="true" />;
};

export default function ConsultarAnimais({ onAbrirFicha = null }) {
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [resultado, setResultado] = useState(null);
  const [consultando, setConsultando] = useState(false);
  const [erro, setErro] = useState("");
  const [opcoes, setOpcoes] = useState({ especies: [], bairros: [] });


  useEffect(() => {
    let ativo = true;
    obterFiltrosAnimais().then((res) => {
      if (ativo && res?.success) {
        setOpcoes({ especies: res.especies || [], bairros: res.bairros || [] });
      }
    });
    return () => {
      ativo = false;
    };
  }, []);

  const consultar = useCallback(async (pagina, filtrosUsados) => {
    setConsultando(true);
    setErro("");
    const res = await consultarAnimais({ ...filtrosUsados, pagina });
    setConsultando(false);
    if (res?.success) {
      setResultado(res);
    } else {
      setResultado(null);
      setErro(res?.error || "Não foi possível consultar os animais.");
    }
  }, []);

  const alterarFiltro = (campo, valor) => setFiltros((f) => ({ ...f, [campo]: valor }));

  const filtrar = (e) => {
    e.preventDefault();
    consultar(1, filtros);
  };

  const limpar = () => {
    setFiltros(FILTROS_VAZIOS);
    setResultado(null);
    setErro("");
  };

  // A ficha completa é montada pelo AnimaisTab (fora das abas), para não ser
  // desmontada quando o formulário de edição abre.
  const abrirFicha = (id) => {
    if (onAbrirFicha) onAbrirFicha(id);
  };

  return (
    <div className={styles.container}>
      <div className={styles.mainWrapper}>
        {erro && (
          <div className={styles.avisoErro} role="alert">
            {erro}
            <button type="button" onClick={() => setErro("")} aria-label="Fechar">
              ×
            </button>
          </div>
        )}

        {/* ── FILTROS ─────────────────────────────────────────────────────── */}
        <form className={styles.cardFiltros} onSubmit={filtrar}>
          <div className={styles.cardFiltrosHeader}>
            <h4>Filtros da Consulta</h4>
          </div>

          <div className={`${styles.gridFiltros} ${galeria.gridFiltrosAnimais}`}>
            <div className={`${styles.fieldGroup} ${galeria.colBuscaAnimais}`}>
              <label>Buscar Registro</label>
              <input
                value={filtros.busca}
                onChange={(e) => alterarFiltro("busca", e.target.value)}
                placeholder="Digite o nome ou ID do animal, nome ou CPF do tutor..."
              />
            </div>

            <div className={`${styles.fieldGroup} ${galeria.colEspecieAnimais}`}>
              <label>Espécie</label>
              <select
                value={filtros.especie}
                onChange={(e) => alterarFiltro("especie", e.target.value)}
              >
                <option value="">Todas</option>
                {opcoes.especies.map((esp) => (
                  <option key={esp} value={esp}>
                    {esp}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${galeria.colSexoAnimais}`}>
              <label>Sexo</label>
              <select
                value={filtros.sexo}
                onChange={(e) => alterarFiltro("sexo", e.target.value)}
              >
                {SEXOS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${galeria.colPorteAnimais}`}>
              <label>Porte</label>
              <select
                value={filtros.porte}
                onChange={(e) => alterarFiltro("porte", e.target.value)}
              >
                {PORTES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${galeria.colSituacaoAnimais}`}>
              <label>Situação do Animal</label>
              <select
                value={filtros.situacao}
                onChange={(e) => alterarFiltro("situacao", e.target.value)}
              >
                {SITUACOES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${galeria.colBairroAnimais}`}>
              <label>Bairro</label>
              <select
                value={filtros.bairro}
                onChange={(e) => alterarFiltro("bairro", e.target.value)}
              >
                <option value="">Todos</option>
                {opcoes.bairros.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {/* Coluna 8–12: o período fica na linha dos campos e os botões
                caem sozinhos na última linha, alinhados à direita. */}
            <div className={`${styles.fieldGroup} ${galeria.colPeriodoCadastroAnimais}`}>
              <label>Período do Cadastro</label>
              <div className={styles.periodo}>
                <input
                  type="date"
                  value={filtros.periodoInicio}
                  onChange={(e) => alterarFiltro("periodoInicio", e.target.value)}
                  aria-label="Data inicial do cadastro"
                />
                <span>até</span>
                <input
                  type="date"
                  value={filtros.periodoFim}
                  onChange={(e) => alterarFiltro("periodoFim", e.target.value)}
                  aria-label="Data final do cadastro"
                />
              </div>
            </div>

            <div className={styles.filtrosAcoes}>
              <button type="submit" className={styles.btnPrimario} disabled={consultando}>
                <Filter size={16} strokeWidth={2.5} aria-hidden="true" />
                {consultando ? "Filtrando…" : "Filtrar"}
              </button>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={limpar}
                disabled={consultando}
              >
                Limpar filtros
              </button>
            </div>
          </div>
        </form>

        {/* ── ESTADO INICIAL ──────────────────────────────────────────────── */}
        {!resultado && (
          <div className={styles.estadoInicial}>
            <SearchX size={44} strokeWidth={1.5} aria-hidden="true" />
            <h3>Nenhuma consulta realizada</h3>
            <p>
              Selecione os filtros ou clique em Filtrar para consultar todos os
              animais.
            </p>
          </div>
        )}

        {/* ── RESULTADOS ──────────────────────────────────────────────────── */}
        {resultado && (
          <div className={styles.resultados}>
            <div className={styles.resumo}>
              <span>
                <strong>{resultado.total}</strong>{" "}
                {resultado.total === 1 ? "registro encontrado" : "registros encontrados"}
              </span>
              <span className={styles.resumoPagina}>
                Página {resultado.pagina} de {resultado.totalPaginas} · 100 por página
              </span>
            </div>

            {resultado.data.length === 0 ? (
              <div className={styles.tabelaVazia} style={{ borderRadius: 10 }}>
                Nenhum registro encontrado
              </div>
            ) : (
              <div className={galeria.galeria}>
                {resultado.data.map((a) => {
                  const badge = badgeSituacao(a.situacao);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className={galeria.card}
                      onClick={() => abrirFicha(a.id)}
                      aria-label={`Abrir a ficha de ${a.nome || a.id}`}
                    >
                      <span className={galeria.cardFoto}>
                        {a.fotoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.fotoUrl}
                            alt={a.nome ? `Foto de ${a.nome}` : "Foto do animal"}
                            loading="lazy"
                          />
                        ) : (
                          <span className={galeria.cardSemFoto}>
                            <IconeEspecie especie={a.especie} />
                            <span>{a.especie || "Sem foto"}</span>
                          </span>
                        )}
                      </span>
                      <span className={galeria.cardCorpo}>
                        <span className={galeria.cardNome}>{a.nome || "Sem nome"}</span>
                        <span className={galeria.cardId}>ID CCZ: {a.id}</span>
                        <span className={galeria.cardLinha}>
                          {a.especie && (
                            <span className={galeria.tag}>
                              <IconeEspecie especie={a.especie} size={12} />
                              {a.especie}
                            </span>
                          )}
                          {a.sexo && (
                            <span className={`${galeria.tag} ${galeria.tagNeutra}`}>{a.sexo}</span>
                          )}
                          {a.porte && (
                            <span className={`${galeria.tag} ${galeria.tagNeutra}`}>
                              Porte {a.porte}
                            </span>
                          )}
                          {badge && (
                            <span className={`${galeria.badge} ${badge.css}`}>{badge.texto}</span>
                          )}
                        </span>
                        <span className={galeria.cardTutor}>
                          <User size={13} aria-hidden="true" />
                          {a.tutorNome || "Sem tutor vinculado"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className={styles.paginacao}>
              <button
                type="button"
                className={styles.btnGhost}
                disabled={resultado.pagina <= 1 || consultando}
                onClick={() => consultar(resultado.pagina - 1, filtros)}
              >
                ← Anterior
              </button>
              <span>
                Página {resultado.pagina} de {resultado.totalPaginas}
              </span>
              <button
                type="button"
                className={styles.btnGhost}
                disabled={resultado.pagina >= resultado.totalPaginas || consultando}
                onClick={() => consultar(resultado.pagina + 1, filtros)}
              >
                Próxima →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
