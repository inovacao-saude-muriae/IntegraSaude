"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./GerenciarAcessos.module.css";
import { useConfirm, useNotify } from "@/components/ConfirmDialog";

// ═══════════════════════════════════════════════════════════════════════════
// GERENCIAMENTO DE USUÁRIOS E ACESSOS — configuração individual por módulo
// ─────────────────────────────────────────────────────────────────────────
// Três áreas na tela:
//   1. Identificação do usuário (dados da conta e situação);
//   2. Módulos (cartões: tem acesso? qual perfil?);
//   3. Configuração do módulo selecionado (perfil, escopo/serviços,
//      funcionalidades × permissões) + resumo consolidado.
//
// A regra de autorização NÃO está aqui: o cliente só monta a intenção, e o
// backend (lib/acessoService) valida contra o catálogo central e devolve o que
// ficou gravado. Depois de salvar, a tela mostra o estado RELIDO DO BANCO.
//
// Perfis podem ser diferentes por módulo — é o ponto da tela. Gestão Geral é
// um módulo como os outros e não abre os demais.
// ═══════════════════════════════════════════════════════════════════════════

const VAZIO_ESCOPO = { TODOS: "TODOS", ESPECIFICOS: "ESPECIFICOS", NENHUM: "NENHUM" };

function formataData(valor) {
  if (!valor) return "—";
  try {
    return new Date(valor).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formataCpf(cpf) {
  const d = String(cpf || "").replace(/\D/g, "");
  if (d.length !== 11) return cpf || "—";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// Estado inicial de um módulo sem vínculo.
function moduloVazio(modulo) {
  return {
    modulo,
    ativo: false,
    perfil: "OPERADOR",
    escopo: VAZIO_ESCOPO.TODOS,
    servicos: [],
    concedidas: [], // fora do pacote do perfil
    removidas: [], // retiradas do pacote
  };
}

// Converte o vínculo vindo do banco para o estado da tela.
function moduloDoBanco(v) {
  return {
    modulo: v.modulo,
    ativo: v.ativo !== false,
    perfil: v.perfil,
    escopo: v.escopo || VAZIO_ESCOPO.TODOS,
    servicos: v.servicos || [],
    concedidas: v.permissoes || [],
    removidas: v.removidas || [],
  };
}

export default function GerenciarAcessos({ cpfInicial = null }) {
  const confirm = useConfirm();
  const notify = useNotify();

  const [catalogo, setCatalogo] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [busca, setBusca] = useState("");
  const [cpfBusca, setCpfBusca] = useState("");
  const [cpfSelecionado, setCpfSelecionado] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [modulos, setModulos] = useState({}); // modulo → estado da tela
  const [moduloAberto, setModuloAberto] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  // ── Carregamento inicial ────────────────────────────────────────────────
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [resCat, resUsu] = await Promise.all([
          fetch("/api/gerenciamento/permissoes/catalogo", { cache: "no-store" }),
          fetch("/api/gerenciamento/usuarios", { cache: "no-store" }),
        ]);
        const cat = await resCat.json();
        const usu = await resUsu.json();
        if (!vivo) return;
        if (!resCat.ok) throw new Error(cat.error || "Erro ao carregar o catálogo.");
        if (!resUsu.ok) throw new Error(usu.error || "Erro ao carregar os usuários.");
        setCatalogo(cat);
        setUsuarios(usu.data || []);
      } catch (e) {
        if (vivo) setErro(e.message);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // ── Selecionar usuário: lê a configuração do BANCO ──────────────────────
  const carregarUsuario = useCallback(
    async (cpf) => {
      setMensagem(null);
      setErro("");
      try {
        const res = await fetch(`/api/gerenciamento/usuarios/${cpf}/acessos`, {
          cache: "no-store",
        });
        const dados = await res.json();
        if (!res.ok) throw new Error(dados.error || "Erro ao carregar o usuário.");
        setCpfSelecionado(cpf);
        setDetalhe(dados);
        const mapa = {};
        for (const v of dados.vinculos || []) mapa[v.modulo] = moduloDoBanco(v);
        setModulos(mapa);
        setModuloAberto((atual) => atual || dados.vinculos?.[0]?.modulo || null);
      } catch (e) {
        setErro(e.message);
      }
    },
    [],
  );

  // Pedido vindo da aba "Contas" (evento `integra:abrir-acessos`): abre direto o
  // usuário escolhido. A carga roda no callback do evento — não no corpo de um
  // efeito — e o CPF também entra na busca do cabeçalho.
  useEffect(() => {
    function aoPedir(e) {
      const cpf = e.detail?.cpf;
      if (!cpf) return;
      setCpfBusca(cpf);
      carregarUsuario(cpf);
    }
    window.addEventListener("integra:abrir-acessos", aoPedir);
    return () => window.removeEventListener("integra:abrir-acessos", aoPedir);
  }, [carregarUsuario]);

  // ── Helpers de catálogo ─────────────────────────────────────────────────
  const modulosCatalogo = useMemo(() => catalogo?.modulos || [], [catalogo]);
  const perfisCatalogo = useMemo(() => catalogo?.perfis || [], [catalogo]);
  const escoposCatalogo = useMemo(() => catalogo?.escopos || [], [catalogo]);

  const catDoModulo = useCallback(
    (chave) => modulosCatalogo.find((m) => m.chave === chave) || null,
    [modulosCatalogo],
  );

  const estadoDoModulo = useCallback(
    (chave) => modulos[chave] || moduloVazio(chave),
    [modulos],
  );

  const pacoteDoPerfil = useCallback(
    (modulo, perfil) => catDoModulo(modulo)?.pacotes?.[perfil] || [],
    [catDoModulo],
  );

  // Permissões efetivas do estado da tela (mesma conta do backend).
  const efetivasDoModulo = useCallback(
    (estado) => {
      const pacote = new Set(pacoteDoPerfil(estado.modulo, estado.perfil));
      for (const p of estado.concedidas) pacote.add(p);
      for (const p of estado.removidas) pacote.delete(p);
      return [...pacote].sort();
    },
    [pacoteDoPerfil],
  );

  // ── Alterações de estado ────────────────────────────────────────────────
  const atualizarModulo = (chave, mudanca) => {
    setModulos((prev) => {
      const atual = prev[chave] || moduloVazio(chave);
      const novo = { ...atual, ...mudanca };
      // Coerência imediata: ESPECIFICOS exige serviços; os outros limpam.
      if (novo.escopo !== VAZIO_ESCOPO.ESPECIFICOS) novo.servicos = [];
      return { ...prev, [chave]: novo };
    });
    setMensagem(null);
  };

  const alternarModulo = (chave) => {
    const atual = estadoDoModulo(chave);
    atualizarModulo(chave, { ativo: !atual.ativo });
    if (!atual.ativo) setModuloAberto(chave);
  };

  const trocarPerfil = (chave, perfil) => {
    // Trocar de perfil NÃO carrega as personalizações do perfil anterior:
    // as concessões/retiradas são do pacote antigo e não fazem sentido novo.
    setModulos((prev) => {
      const atual = prev[chave] || moduloVazio(chave);
      return {
        ...prev,
        [chave]: { ...atual, perfil, concedidas: [], removidas: [] },
      };
    });
    setMensagem(null);
  };

  const alternarServico = (chave, servico) => {
    const atual = estadoDoModulo(chave);
    const tem = atual.servicos.includes(servico);
    atualizarModulo(chave, {
      servicos: tem
        ? atual.servicos.filter((s) => s !== servico)
        : [...atual.servicos, servico],
    });
  };

  // Clique numa permissão: alterna entre herdada (pacote) → retirada → concedida.
  const alternarPermissao = (chave, alvo) => {
    const atual = estadoDoModulo(chave);
    const pacote = pacoteDoPerfil(chave, atual.perfil);
    const noPacote = pacote.includes(alvo);

    let concedidas = [...atual.concedidas];
    let removidas = [...atual.removidas];

    if (noPacote) {
      // herdada ⇄ retirada
      if (removidas.includes(alvo)) removidas = removidas.filter((p) => p !== alvo);
      else removidas.push(alvo);
    } else {
      // fora do pacote: concedida ⇄ não concedida
      if (concedidas.includes(alvo)) concedidas = concedidas.filter((p) => p !== alvo);
      else concedidas.push(alvo);
    }
    atualizarModulo(chave, { concedidas, removidas });
  };

  // ── Salvar ──────────────────────────────────────────────────────────────
  const salvar = async () => {
    if (!cpfSelecionado) return;

    const lista = Object.values(modulos)
      .filter((m) => m.ativo)
      .map((m) => ({
        modulo: m.modulo,
        perfil: m.perfil,
        escopo: m.escopo,
        servicos: m.escopo === VAZIO_ESCOPO.ESPECIFICOS ? m.servicos : [],
        permissoes: m.concedidas,
        removidas: m.removidas,
        ativo: true,
      }));

    // Checagem local (o backend repete): ESPECIFICOS sem serviço não passa.
    const semServico = lista.filter(
      (v) => v.escopo === VAZIO_ESCOPO.ESPECIFICOS && v.servicos.length === 0,
    );
    if (semServico.length > 0) {
      const nomes = semServico
        .map((v) => catDoModulo(v.modulo)?.nome || v.modulo)
        .join(", ");
      setMensagem({
        tipo: "erro",
        texto: `Escolha ao menos um serviço em: ${nomes}.`,
      });
      return;
    }

    const desligados = Object.values(modulos).filter((m) => !m.ativo);

    const ok = await confirm({
      message:
        `Salvar os acessos de ${detalhe?.usuario?.nome || "usuário"}?\n\n` +
        `Módulos com acesso: ${lista.length || "nenhum"}.` +
        (desligados.length
          ? `\nSem acesso (vínculo removido): ${desligados
              .map((m) => catDoModulo(m.modulo)?.nome || m.modulo)
              .join(", ")}.`
          : ""),
      confirmLabel: "Salvar acessos",
    });
    if (!ok) return;

    setSalvando(true);
    setMensagem(null);
    try {
      const res = await fetch(`/api/gerenciamento/usuarios/${cpfSelecionado}/acessos`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vinculos: lista }),
      });
      const dados = await res.json();
      if (!res.ok) throw new Error(dados.error || "Erro ao salvar.");

      // Estado RELIDO DO BANCO — não o estado da tela.
      setDetalhe(dados);
      const mapa = {};
      for (const v of dados.vinculos || []) mapa[v.modulo] = moduloDoBanco(v);
      setModulos(mapa);
      setMensagem({ tipo: "ok", texto: "Acessos salvos e confirmados no banco." });
      // Atualiza o resumo da lista lateral.
      setUsuarios((prev) =>
        prev.map((u) =>
          u.cpf === cpfSelecionado
            ? {
                ...u,
                modulos: (dados.vinculos || []).map((v) => ({
                  modulo: v.modulo,
                  nome: catDoModulo(v.modulo)?.nome || v.modulo,
                  perfil: v.perfil,
                  escopo: v.escopo,
                  servicos: v.servicos,
                  ativo: v.ativo,
                  totalEfetivas: v.efetivas?.length || 0,
                })),
                ativos: (dados.vinculos || [])
                  .filter((v) => v.ativo !== false)
                  .map((v) => v.modulo),
              }
            : u,
          ),
      );
      await notify({ tipo: "sucesso", message: "Acessos salvos com sucesso." });
    } catch (e) {
      setMensagem({ tipo: "erro", texto: e.message });
    } finally {
      setSalvando(false);
    }
  };

  // ── Filtro da lista ─────────────────────────────────────────────────────
  const usuariosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return usuarios;
    return usuarios.filter(
      (u) =>
        (u.nome || "").toLowerCase().includes(termo) ||
        (u.cpf || "").includes(termo.replace(/\D/g, "")),
    );
  }, [usuarios, busca]);

  const moduloCorrente = moduloAberto ? estadoDoModulo(moduloAberto) : null;
  const catCorrente = moduloAberto ? catDoModulo(moduloAberto) : null;

  if (carregando) return <div className={styles.carregando}>Carregando usuários e permissões…</div>;

  return (
    <div className={styles.pagina}>
      {erro && <div className={styles.erroBox}>{erro}</div>}

      {/* ── Lista de usuários ─────────────────────────────────────────── */}
      <div className={styles.barra}>
        <input
          className={styles.campo}
          placeholder="Buscar por nome ou CPF…"
          value={busca || cpfBusca}
          onChange={(e) => {
            setBusca(e.target.value);
            setCpfBusca("");
          }}
        />
      </div>

      <div className={styles.lista}>
        {usuariosFiltrados.length === 0 && (
          <div className={styles.vazio}>Nenhum usuário encontrado.</div>
        )}
        {usuariosFiltrados.map((u) => {
          const selecionado = u.cpf === cpfSelecionado;
          return (
            <div
              key={u.cpf}
              role="button"
              tabIndex={0}
              className={`${styles.linhaUsuario} ${selecionado ? styles.linhaSelecionada : ""}`}
              onClick={() => carregarUsuario(u.cpf)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") carregarUsuario(u.cpf);
              }}
            >
              <div>
                <div className={styles.nomeUsuario}>{u.nome}</div>
                <div className={styles.metaUsuario}>
                  {formataCpf(u.cpf)} · {u.cargo || "sem cargo"} ·{" "}
                  {u.ativo ? "ativo" : "inativo"}
                  {u.ultimoAcesso ? ` · último acesso ${formataData(u.ultimoAcesso)}` : ""}
                </div>
                <div className={styles.medalhas}>
                  {(u.modulos || []).length === 0 && (
                    <span className={styles.semAcesso}>Nenhum módulo liberado</span>
                  )}
                  {(u.modulos || []).map((m) => (
                    <span
                      key={m.modulo}
                      className={`${styles.medalha} ${m.ativo === false ? styles.medalhaInativa : ""}`}
                    >
                      {m.nome} · {m.perfil}
                    </span>
                  ))}
                </div>
              </div>
              <span className={styles.seta}>{selecionado ? "▾" : "›"}</span>
            </div>
          );
        })}
      </div>

      {/* ── Áreas 1, 2 e 3 ────────────────────────────────────────────── */}
      {detalhe && (
        <div className={styles.areaTrabalho}>
          {/* Coluna esquerda: identificação + módulos */}
          <div style={{ display: "grid", gap: 18 }}>
            {/* Área 1 */}
            <section className={styles.cartao}>
              <h3 className={styles.cartaoTitulo}>1 · Identificação</h3>
              <div className={styles.identCpf}>{formataCpf(detalhe.usuario.cpf)}</div>
              <div className={styles.identNome}>{detalhe.usuario.nome}</div>
              <div className={styles.identGrid}>
                <div>
                  <div className={styles.identRotulo}>Situação da conta</div>
                  <div>
                    <span
                      className={detalhe.usuario.ativo ? styles.statusAtivo : styles.statusInativo}
                    >
                      {detalhe.usuario.ativo ? "Ativa" : "Inativa"}
                    </span>
                  </div>
                </div>
                <div>
                  <div className={styles.identRotulo}>Cargo</div>
                  <div className={styles.identValor}>{detalhe.usuario.cargo || "—"}</div>
                </div>
                <div>
                  <div className={styles.identRotulo}>Primeiro acesso</div>
                  <div className={styles.identValor}>
                    {detalhe.usuario.primeiroAcesso ? "Pendente (senha padrão)" : "Concluído"}
                  </div>
                </div>
                <div>
                  <div className={styles.identRotulo}>Último acesso</div>
                  <div className={styles.identValor}>{formataData(detalhe.usuario.ultimoAcesso)}</div>
                </div>
                <div>
                  <div className={styles.identRotulo}>Conta criada em</div>
                  <div className={styles.identValor}>{formataData(detalhe.usuario.createdAt)}</div>
                </div>
                <div>
                  <div className={styles.identRotulo}>Módulos com acesso</div>
                  <div className={styles.identValor}>
                    {(detalhe.vinculos || []).filter((v) => v.ativo !== false).length} de{" "}
                    {modulosCatalogo.length}
                  </div>
                </div>
              </div>
            </section>

            {/* Área 2 */}
            <section className={styles.cartao}>
              <h3 className={styles.cartaoTitulo}>2 · Módulos</h3>
              <div className={styles.modulos}>
                {modulosCatalogo.map((m) => {
                  const estado = estadoDoModulo(m.chave);
                  const aberto = moduloAberto === m.chave;
                  return (
                    <div
                      key={m.chave}
                      className={`${styles.modulo} ${aberto ? styles.moduloAtivo : ""} ${
                        estado.ativo ? "" : styles.moduloSem
                      }`}
                      onClick={() => setModuloAberto(m.chave)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setModuloAberto(m.chave);
                      }}
                    >
                      <button
                        type="button"
                        aria-label={
                          estado.ativo
                            ? `Desativar acesso a ${m.nome}`
                            : `Ativar acesso a ${m.nome}`
                        }
                        className={`${styles.interruptor} ${
                          estado.ativo ? styles.interruptorAtivo : ""
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          alternarModulo(m.chave);
                        }}
                      >
                        <span className={styles.interruptorBolinha} />
                      </button>
                      <div>
                        <div className={styles.moduloNome}>
                          {m.nome}
                          {m.administracao ? " · Gestão Geral" : ""}
                        </div>
                        <div className={styles.moduloResumo}>
                          {estado.ativo
                            ? `${estado.perfil} · ${
                                estado.escopo === VAZIO_ESCOPO.TODOS
                                  ? "todos os serviços"
                                  : estado.escopo === VAZIO_ESCOPO.ESPECIFICOS
                                    ? `${estado.servicos.length} serviço(s)`
                                    : "nenhum serviço"
                              } · ${efetivasDoModulo(estado).length} permissões`
                            : "Sem acesso"}
                        </div>
                      </div>
                      <span className={styles.seta}>{aberto ? "▾" : "›"}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Coluna direita: configuração + resumo */}
          <div style={{ display: "grid", gap: 18 }}>
            {/* Área 3 */}
            <section className={styles.cartao}>
              <h3 className={styles.cartaoTitulo}>3 · Configuração do módulo</h3>

              {!moduloAberto || !catCorrente ? (
                <div className={styles.vazio}>Escolha um módulo para configurar.</div>
              ) : (
                <div className={styles.config}>
                  <div className={styles.configTopo}>
                    <div>
                      <h2 className={styles.configModulo}>{catCorrente.nome}</h2>
                      <div className={styles.configSub}>
                        {moduloCorrente.ativo
                          ? "Com acesso — configure abaixo."
                          : "Sem acesso. Ligue o interruptor em Módulos para liberar."}
                      </div>
                    </div>
                  </div>

                  {/* Perfil */}
                  <div className={styles.bloco}>
                    <h4 className={styles.blocoTitulo}>Perfil</h4>
                    <div className={styles.perfis}>
                      {perfisCatalogo.map((p) => (
                        <button
                          key={p.chave}
                          type="button"
                          className={`${styles.perfil} ${
                            moduloCorrente.perfil === p.chave ? styles.perfilEscolhido : ""
                          }`}
                          onClick={() => trocarPerfil(moduloAberto, p.chave)}
                        >
                          <div className={styles.perfilNome}>{p.nome}</div>
                          <div className={styles.perfilDesc}>{p.descricao}</div>
                        </button>
                      ))}
                    </div>
                    <div className={styles.dica}>
                      O perfil carrega {pacoteDoPerfil(moduloAberto, moduloCorrente.perfil).length}{" "}
                      permissões do pacote padrão. Personalizações abaixo substituem apenas o que
                      você alterar.
                    </div>
                  </div>

                  {/* Escopo e serviços */}
                  <div className={styles.bloco}>
                    <h4 className={styles.blocoTitulo}>Escopo de acesso</h4>
                    <div className={styles.escopos}>
                      {escoposCatalogo.map((e) => (
                        <label
                          key={e.chave}
                          className={`${styles.escopo} ${
                            moduloCorrente.escopo === e.chave ? styles.escopoEscolhido : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name={`escopo-${moduloAberto}`}
                            checked={moduloCorrente.escopo === e.chave}
                            onChange={() =>
                              atualizarModulo(moduloAberto, { escopo: e.chave, servicos: [] })
                            }
                          />
                          <div>
                            <div className={styles.escopoNome}>{e.nome}</div>
                            <div className={styles.escopoDesc}>{e.descricao}</div>
                          </div>
                        </label>
                      ))}
                    </div>

                    {moduloCorrente.escopo === VAZIO_ESCOPO.ESPECIFICOS && (
                      <>
                        {catCorrente.escopoServico?.length ? (
                          <div className={styles.servicos}>
                            {catCorrente.escopoServico.map((s) => (
                              <button
                                key={s}
                                type="button"
                                className={`${styles.servico} ${
                                  moduloCorrente.servicos.includes(s) ? styles.servicoMarcado : ""
                                }`}
                                onClick={() => alternarServico(moduloAberto, s)}
                              >
                                {moduloCorrente.servicos.includes(s) ? "✓ " : ""}
                                {s}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className={styles.aviso}>
                            Este módulo não é organizado por serviço.
                          </div>
                        )}
                        {moduloCorrente.servicos.length === 0 && (
                          <div className={styles.aviso}>
                            Selecione ao menos um serviço — não é possível salvar sem isso.
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Funcionalidades × permissões */}
                  <div className={styles.bloco}>
                    <h4 className={styles.blocoTitulo}>Funcionalidades e permissões</h4>
                    <div className={styles.legenda}>
                      <span className={styles.legendaItem}>
                        <span className={`${styles.ponto} ${styles.pontoHerdada}`} /> do perfil
                      </span>
                      <span className={styles.legendaItem}>
                        <span className={`${styles.ponto} ${styles.pontoExtra}`} /> concedida a mais
                      </span>
                      <span className={styles.legendaItem}>
                        <span className={`${styles.ponto} ${styles.pontoRetirada}`} /> retirada do
                        perfil
                      </span>
                    </div>
                    <div className={styles.funcionalidades}>
                      {catCorrente.funcionalidades.map((f) => {
                        const pacote = pacoteDoPerfil(moduloAberto, moduloCorrente.perfil);
                        const resumo = f.permissoes.filter((p) =>
                          efetivasDoModulo(moduloCorrente).includes(`${f.chave}:${p.chave}`),
                        ).length;
                        return (
                          <div key={f.chave} className={styles.funcionalidade}>
                            <div className={styles.funcTopo}>
                              <span className={styles.funcNome}>{f.nome}</span>
                              <span className={styles.funcResumo}>
                                {resumo} de {f.permissoes.length}
                              </span>
                            </div>
                            <div className={styles.permissoes}>
                              {f.permissoes.map((p) => {
                                const alvo = `${f.chave}:${p.chave}`;
                                const noPacote = pacote.includes(alvo);
                                const retirada = moduloCorrente.removidas.includes(alvo);
                                const extra = moduloCorrente.concedidas.includes(alvo);
                                const classe = retirada
                                  ? styles.permissaoRetirada
                                  : extra
                                    ? styles.permissaoExtra
                                    : noPacote
                                      ? styles.permissaoMarcada
                                      : "";
                                return (
                                  <button
                                    key={p.chave}
                                    type="button"
                                    title={
                                      noPacote
                                        ? "No pacote do perfil — clique para retirar"
                                        : "Fora do pacote — clique para conceder"
                                    }
                                    className={`${styles.permissao} ${classe}`}
                                    onClick={() => alternarPermissao(moduloAberto, alvo)}
                                  >
                                    {p.nome}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className={styles.dica}>
                      Total efetivo neste módulo:{" "}
                      <strong>{efetivasDoModulo(moduloCorrente).length} permissões</strong> ·{" "}
                      {moduloCorrente.concedidas.length} concedida(s) a mais ·{" "}
                      {moduloCorrente.removidas.length} retirada(s).
                    </div>
                  </div>

                  {moduloCorrente.ativo &&
                    moduloCorrente.escopo === VAZIO_ESCOPO.NENHUM && (
                      <div className={styles.avisoBox}>
                        Escopo <strong>Nenhum serviço</strong>: o vínculo existe, mas não alcança
                        nenhum serviço do módulo. Só as permissões de leitura de painel continuam
                        fazendo sentido.
                      </div>
                    )}
                </div>
              )}
            </section>

            {/* Resumo consolidado */}
            <section className={styles.cartao}>
              <h3 className={styles.cartaoTitulo}>Resumo dos acessos</h3>
              <div className={styles.resumo}>
                {modulosCatalogo.map((m) => {
                  const estado = estadoDoModulo(m.chave);
                  if (!estado.ativo) {
                    return (
                      <div key={m.chave} className={styles.resumoLinha}>
                        <span className={styles.resumoDetalhe}>{m.nome}: sem acesso</span>
                        <span />
                      </div>
                    );
                  }
                  return (
                    <div key={m.chave} className={styles.resumoLinha}>
                      <span className={styles.resumoModulo}>{m.nome}</span>
                      <span className={styles.resumoDetalhe}>
                        {estado.perfil} ·{" "}
                        {estado.escopo === VAZIO_ESCOPO.TODOS
                          ? "todos os serviços"
                          : estado.escopo === VAZIO_ESCOPO.ESPECIFICOS
                            ? estado.servicos.join(", ") || "nenhum serviço escolhido"
                            : "nenhum serviço"}{" "}
                        · {efetivasDoModulo(estado).length} permissões
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            {mensagem && (
              <div
                className={mensagem.tipo === "ok" ? styles.okBox : styles.erroBox}
                role={mensagem.tipo === "ok" ? "status" : "alert"}
              >
                {mensagem.texto}
              </div>
            )}

            <div className={styles.rodape}>
              <button
                type="button"
                className={styles.botao}
                onClick={() => carregarUsuario(cpfSelecionado)}
                disabled={salvando}
              >
                Descartar alterações
              </button>
              <button
                type="button"
                className={`${styles.botao} ${styles.botaoPrimario}`}
                onClick={salvar}
                disabled={salvando}
              >
                {salvando ? "Salvando…" : "Salvar acessos"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
