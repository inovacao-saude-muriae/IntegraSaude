"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./GerenciarUsuarios.module.css";
import { useConfirm } from "@/components/ConfirmDialog";
import { mascararTelefone } from "@/lib/telefone";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/Pagination";
import GerenciarAcessos, { formataCpf } from "./GerenciarAcessos";
import PainelAcessos from "./PainelAcessos";

// ═══════════════════════════════════════════════════════════════════════════
// GERENCIAR USUÁRIOS — área única (sem abas).
//   • lista de contas com módulos, perfis, situação e ações;
//   • cadastro em DUAS ETAPAS: dados da conta → acessos (opcional);
//   • botão "Acessos" abre o painel amplo direto no usuário escolhido.
//
// Nada de autorização aqui: a tela só monta a intenção; quem decide é o
// backend (requirePermissaoGestao + lib/acessoService).
// ═══════════════════════════════════════════════════════════════════════════

const ETAPA_DADOS = 1;
const ETAPA_ACESSOS = 2;

export default function GerenciarUsuarios() {
  const confirm = useConfirm();

  // ── Dados da conta (etapa 1) ────────────────────────────────────────────
  const [cpf, setCpf] = useState("");
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cargo, setCargo] = useState("");
  const [pessoaExiste, setPessoaExiste] = useState(false);
  const [buscandoCpf, setBuscandoCpf] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: "", texto: "" });

  // ── Cadastro em etapas ──────────────────────────────────────────────────
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [etapa, setEtapa] = useState(ETAPA_DADOS);
  // Acessos montados na etapa 2: são enviados JUNTO com a criação da conta.
  const [acessosNovos, setAcessosNovos] = useState({ vinculos: [], totalModulos: 0 });

  // ── Lista, painel e credenciais ─────────────────────────────────────────
  const [usuarios, setUsuarios] = useState([]);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(false);
  const [catalogo, setCatalogo] = useState(null);
  const [meuCpf, setMeuCpf] = useState(null);
  const [painel, setPainel] = useState(null); // usuário com o painel de acessos aberto
  const [redefinindo, setRedefinindo] = useState(null);
  const [credencial, setCredencial] = useState(null);

  // ── Busca e filtros ─────────────────────────────────────────────────────
  const [buscaUsuario, setBuscaUsuario] = useState("");
  const [filtroModulo, setFiltroModulo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");

  const modulosCatalogo = useMemo(() => catalogo?.modulos || [], [catalogo]);

  const carregarUsuarios = useCallback(async () => {
    setCarregandoUsuarios(true);
    try {
      const res = await fetch("/api/gerenciamento/usuarios", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setUsuarios(data.data || []);
      else setMensagem({ tipo: "erro", texto: data.error || "Erro ao carregar usuários." });
    } catch {
      setMensagem({ tipo: "erro", texto: "Erro de conexão com o servidor." });
    } finally {
      setCarregandoUsuarios(false);
    }
  }, []);

  // Carga inicial: lista, catálogo de permissões e o CPF do próprio usuário.
  // Tudo chega por resposta assíncrona (sem setState no corpo do efeito).
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(async () => {
      if (!vivo) return;
      carregarUsuarios();
      try {
        const [resCat, resMe] = await Promise.all([
          fetch("/api/gerenciamento/permissoes/catalogo", { cache: "no-store" }),
          fetch("/api/me"),
        ]);
        if (!vivo) return;
        if (resCat.ok) setCatalogo(await resCat.json());
        if (resMe.ok) {
          const me = await resMe.json();
          setMeuCpf(me?.user?.cpf ?? null);
        }
      } catch {
        /* a lista já mostra o erro de conexão */
      }
    }, 0);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [carregarUsuarios]);

  // ── CPF: busca automática ao completar 11 dígitos ───────────────────────
  const handleCpfChange = async (e) => {
    const valorLimpo = e.target.value.replace(/\D/g, "");
    setCpf(valorLimpo);

    if (valorLimpo.length === 11) {
      setBuscandoCpf(true);
      setMensagem({ tipo: "", texto: "" });
      try {
        const resUser = await fetch(`/api/gerenciamento/usuarios/${valorLimpo}`);
        const dataUser = await resUser.json();

        if (resUser.ok && dataUser.usuario) {
          setPessoaExiste(true);
          setNomeCompleto(dataUser.usuario.nome || "");
          setTelefone("");
          setCargo("");
          setMensagem({
            tipo: "alerta",
            texto: `Este CPF já está cadastrado como usuário: ${dataUser.usuario.nome}`,
          });
          setBuscandoCpf(false);
          return;
        }

        const res = await fetch(`/api/pessoas/${valorLimpo}`);
        const data = await res.json();

        if (res.ok && data.pessoa) {
          setPessoaExiste(true);
          setNomeCompleto(data.pessoa.nomeCompleto || "");
          setTelefone(data.pessoa.telefone || "");
          setMensagem({
            tipo: "sucesso",
            texto: "Pessoa encontrada no sistema. Avance para definir os acessos.",
          });
        } else {
          setPessoaExiste(false);
          setNomeCompleto("");
          setTelefone("");
          setMensagem({
            tipo: "alerta",
            texto: "CPF não encontrado. Preencha o nome completo para cadastrar.",
          });
        }
      } catch {
        setMensagem({ tipo: "erro", texto: "Erro ao verificar o CPF." });
      } finally {
        setBuscandoCpf(false);
      }
    } else {
      setPessoaExiste(false);
      if (valorLimpo.length < 11) setMensagem({ tipo: "", texto: "" });
    }
  };

  const limparFormulario = () => {
    setCpf("");
    setNomeCompleto("");
    setDataNascimento("");
    setTelefone("");
    setCargo("");
    setPessoaExiste(false);
    setAcessosNovos({ vinculos: [], totalModulos: 0 });
    setEtapa(ETAPA_DADOS);
  };

  const abrirFormulario = () => {
    limparFormulario();
    setMensagem({ tipo: "", texto: "" });
    setMostrarFormulario(true);
  };

  const fecharFormulario = () => {
    setMostrarFormulario(false);
    setMensagem({ tipo: "", texto: "" });
    limparFormulario();
  };

  // Etapa 1 → 2: só os dados obrigatórios precisam estar preenchidos.
  const avancarParaAcessos = (e) => {
    e?.preventDefault();
    if (cpf.length < 11) {
      setMensagem({ tipo: "erro", texto: "Informe um CPF válido com 11 dígitos." });
      return;
    }
    if (nomeCompleto.trim().length < 3) {
      setMensagem({ tipo: "erro", texto: "Informe o nome completo." });
      return;
    }
    setMensagem({ tipo: "", texto: "" });
    setEtapa(ETAPA_ACESSOS);
  };

  // ── Conclusão do cadastro (etapa 2 ou "Configurar depois") ─────────────
  const concluirCadastro = async ({ comAcessos }) => {
    const vinculos = comAcessos ? acessosNovos.vinculos : [];

    // Checagem local: escopo ESPECÍFICO exige serviço (o backend repete).
    const semServico = vinculos.filter(
      (v) => v.escopo === "ESPECIFICOS" && (v.servicos || []).length === 0,
    );
    if (semServico.length > 0) {
      setMensagem({
        tipo: "erro",
        texto: `Escolha ao menos um serviço em: ${semServico
          .map((v) => modulosCatalogo.find((m) => m.chave === v.modulo)?.nome || v.modulo)
          .join(", ")}.`,
      });
      return;
    }

    const ok = await confirm({
      title: "Cadastrar usuário",
      message:
        vinculos.length === 0
          ? "Deseja cadastrar este usuário SEM acessos configurados?\n\n" +
            "Ele poderá entrar no sistema e trocar a senha, mas não verá nenhum módulo " +
            "até que um administrador configure os acessos."
          : `Deseja cadastrar este usuário com ${vinculos.length} módulo(s) de acesso?`,
      confirmText: "Cadastrar",
    });
    if (!ok) return;

    setSalvando(true);
    setMensagem({ tipo: "", texto: "" });

    try {
      const res = await fetch("/api/gerenciamento/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpf,
          nomeCompleto,
          dataNascimento,
          telefone,
          cargo: cargo || null,
          // Gravados na MESMA requisição: conta + vínculos juntos, ou nada.
          vinculos,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.success === false) {
        setMensagem({
          tipo: "erro",
          texto: data.error || "Não foi possível concluir o cadastro. Nada foi gravado.",
        });
        return;
      }

      // Só agora a confirmação: a conta existe e os vínculos, se vieram, também.
      setCredencial({
        origem: "cadastro",
        nome: data.usuario?.nome || nomeCompleto,
        login: data.usuario?.cpf || cpf,
        senha: data.senhaTemporaria || null,
        sessoesRevogadas: null,
        totalModulos: data.totalModulos ?? vinculos.length,
      });
      setMensagem({
        tipo: "sucesso",
        texto:
          vinculos.length === 0
            ? "Usuário cadastrado sem acessos configurados. Use o botão Acessos na lista quando quiser liberar módulos."
            : `Usuário cadastrado com ${vinculos.length} módulo(s) de acesso.`,
      });
      await carregarUsuarios();
      setMostrarFormulario(false);
      limparFormulario();
    } catch {
      setMensagem({ tipo: "erro", texto: "Erro de conexão com o servidor. Nada foi gravado." });
    } finally {
      setSalvando(false);
    }
  };

  // ── Situação da conta ───────────────────────────────────────────────────
  const desativarUsuario = async (cpfAlvo, nome) => {
    const ok = await confirm({
      title: "Desativar usuário",
      message: `Deseja desativar o acesso de ${nome}?`,
      confirmText: "Desativar",
      variant: "danger",
    });
    if (!ok) return;

    try {
      const res = await fetch("/api/gerenciamento/usuarios/desativar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: cpfAlvo }),
      });
      const data = await res.json();
      if (res.ok) {
        setMensagem({ tipo: "sucesso", texto: "Usuário desativado com sucesso!" });
        carregarUsuarios();
      } else {
        setMensagem({ tipo: "erro", texto: data.error || "Erro ao desativar usuário." });
      }
    } catch {
      setMensagem({ tipo: "erro", texto: "Erro de conexão com o servidor." });
    }
  };

  const reativarUsuario = async (cpfAlvo, nome) => {
    const ok = await confirm({
      title: "Reativar usuário",
      message: `Deseja reativar o acesso de ${nome}?`,
      confirmText: "Reativar",
    });
    if (!ok) return;

    try {
      const res = await fetch("/api/gerenciamento/usuarios/reativar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: cpfAlvo }),
      });
      const data = await res.json();
      if (res.ok) {
        setMensagem({ tipo: "sucesso", texto: "Usuário reativado com sucesso!" });
        carregarUsuarios();
      } else {
        setMensagem({ tipo: "erro", texto: data.error || "Erro ao reativar usuário." });
      }
    } catch {
      setMensagem({ tipo: "erro", texto: "Erro de conexão com o servidor." });
    }
  };

  // Copia para a área de transferência. Nunca grava a senha em storage.
  const copiar = async (texto, aviso) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(texto);
        setMensagem({ tipo: "sucesso", texto: aviso });
      } else {
        setMensagem({
          tipo: "erro",
          texto: "Não foi possível copiar. Selecione o texto e copie manualmente.",
        });
      }
    } catch {
      setMensagem({
        tipo: "erro",
        texto: "Não foi possível copiar. Selecione o texto e copie manualmente.",
      });
    }
  };

  const redefinirSenha = async (cpfAlvo, nome) => {
    const ok = await confirm({
      title: "Resetar senha",
      message:
        `Resetar a senha de ${nome}?\n\n` +
        "Uma senha temporária será gerada, as sessões abertas desse usuário " +
        "serão encerradas e ele terá de criar uma nova senha no próximo acesso. " +
        "Perfis, módulos, serviços e permissões NÃO são alterados.",
      confirmText: "Resetar senha",
      variant: "danger",
    });
    if (!ok) return;

    setRedefinindo(cpfAlvo);
    setMensagem({ tipo: "", texto: "" });
    setCredencial(null);

    try {
      const res = await fetch("/api/gerenciamento/usuarios/redefinir-senha", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: cpfAlvo }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success && data.senhaTemporaria) {
        setCredencial({
          origem: "reset",
          nome: data.usuario?.nome || nome,
          login: cpfAlvo,
          senha: data.senhaTemporaria,
          sessoesRevogadas: data.sessoesRevogadas ?? 0,
          totalModulos: null,
        });
        setMensagem({
          tipo: "sucesso",
          texto: `Senha de ${nome} redefinida. Entregue a senha temporária ao usuário.`,
        });
        carregarUsuarios();
      } else {
        setMensagem({
          tipo: "erro",
          texto: data.error || "Não foi possível redefinir a senha.",
        });
      }
    } catch {
      setMensagem({ tipo: "erro", texto: "Erro de conexão com o servidor." });
    } finally {
      setRedefinindo(null);
    }
  };

  // ── Painel de acessos ───────────────────────────────────────────────────
  const abrirAcessos = (usuario) => {
    setMensagem({ tipo: "", texto: "" });
    setPainel(usuario);
  };

  // Depois de salvar, o resumo da lista é atualizado na hora — sem recarregar
  // a página: o backend devolve o estado relido do banco.
  const aposSalvarAcessos = async (dados) => {
    setUsuarios((prev) =>
      prev.map((u) =>
        u.cpf === painel?.cpf
          ? {
              ...u,
              modulos: (dados.vinculos || []).map((v) => ({
                modulo: v.modulo,
                nome: modulosCatalogo.find((m) => m.chave === v.modulo)?.nome || v.modulo,
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
    setPainel((atual) =>
      atual
        ? {
            ...atual,
            modulos: (dados.vinculos || []).map((v) => ({
              modulo: v.modulo,
              nome: modulosCatalogo.find((m) => m.chave === v.modulo)?.nome || v.modulo,
              perfil: v.perfil,
              ativo: v.ativo,
            })),
          }
        : null,
    );
    // O banco é a fonte: recarrega também para trazer totalEfetivas.
    carregarUsuarios();
  };

  // ── Filtros e paginação ─────────────────────────────────────────────────
  const usuariosFiltrados = usuarios.filter((user) => {
    if (buscaUsuario) {
      const termo = buscaUsuario.toLowerCase();
      const nomeMatch = user.nome?.toLowerCase().includes(termo);
      const cpfMatch = user.cpf?.replace(/\D/g, "").includes(termo.replace(/\D/g, ""));
      if (!nomeMatch && !cpfMatch) return false;
    }
    if (filtroModulo && !(user.ativos || []).includes(filtroModulo)) return false;
    if (filtroStatus === "ativo" && !user.ativo) return false;
    if (filtroStatus === "inativo" && user.ativo) return false;
    if (filtroStatus === "sem_acesso" && (user.ativos || []).length > 0) return false;
    return true;
  });

  const {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    paginatedItems: usuariosPaginados,
    goToPage,
    resetPage,
  } = usePagination(usuariosFiltrados, 20);

  useEffect(() => {
    resetPage();
  }, [buscaUsuario, filtroModulo, filtroStatus, resetPage]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div>
            <h1>Gerenciar Usuários</h1>
            <p>Contas, situação e acessos por módulo — em um só lugar.</p>
          </div>
          {!mostrarFormulario && (
            <button onClick={abrirFormulario} className={styles.btnNovoUsuario} type="button">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              Novo Usuário
            </button>
          )}
        </div>
      </header>

      {mensagem.texto && (
        <div className={`${styles.message} ${styles[mensagem.tipo]}`}>{mensagem.texto}</div>
      )}

      {credencial && (
        <div className={styles.senhaCard} role="dialog" aria-modal="false" aria-labelledby="titulo-cred">
          <h3 id="titulo-cred">
            {credencial.origem === "cadastro"
              ? `Conta criada — senha temporária de ${credencial.nome}`
              : `Senha temporária de ${credencial.nome}`}
          </h3>
          <p>
            Esta senha aparece <strong>uma única vez</strong> e não pode ser recuperada depois.
            Entregue ao usuário por um canal seguro: no próximo acesso ele será obrigado a criar
            uma nova senha.
            {credencial.origem === "reset" && (
              <> {credencial.sessoesRevogadas} sessão(ões) anterior(es) foram encerradas.</>
            )}
            {credencial.origem === "cadastro" && credencial.totalModulos === 0 && (
              <> A conta foi criada <strong>sem acessos configurados</strong>: use o botão
              Acessos na lista para liberar módulos.</>
            )}
            {' '}Perfis, módulos e permissões não foram alterados.
          </p>
          <dl className={styles.credenciais}>
            <div>
              <dt>Usuário</dt>
              <dd>{credencial.nome}</dd>
            </div>
            <div>
              <dt>Login</dt>
              <dd>
                <code>{credencial.login}</code>
              </dd>
            </div>
          </dl>
          <div className={styles.senhaValor}>
            <code>{credencial.senha}</code>
            <div className={styles.senhaAcoes}>
              <button
                type="button"
                className={styles.btnCopiar}
                onClick={() => copiar(credencial.senha, "Senha copiada. Ela não será exibida novamente.")}
              >
                Copiar senha
              </button>
              <button
                type="button"
                className={styles.btnCopiar}
                onClick={() =>
                  copiar(
                    `IntegraSaúde\nUsuário: ${credencial.login}\nSenha temporária: ${credencial.senha}\n\nNo primeiro acesso será necessário criar uma nova senha.`,
                    "Credenciais copiadas.",
                  )
                }
              >
                Copiar credenciais
              </button>
              <button
                type="button"
                className={styles.btnFecharSenha}
                onClick={() => {
                  setCredencial(null);
                  setMensagem({ tipo: "", texto: "" });
                }}
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ CADASTRO — ETAPA 1: DADOS DA CONTA ═══════════════════════════ */}
      {mostrarFormulario && etapa === ETAPA_DADOS && (
        <div className={styles.formCard}>
          <div className={styles.formCardHeader}>
            <div>
              <h2>Cadastrar Novo Usuário</h2>
              <div className={styles.etapas} aria-label="Etapas do cadastro">
                <span className={`${styles.etapa} ${styles.etapaAtual}`}>1 · Dados da conta</span>
                <span className={styles.etapa}>2 · Acessos (opcional)</span>
              </div>
            </div>
            <button onClick={fecharFormulario} className={styles.btnFecharForm} type="button">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <form onSubmit={avancarParaAcessos} className={styles.form} autoComplete="off">
            <div className={styles.inputGroup}>
              <label className={styles.label}>CPF de Acesso (Login):</label>
              <div className={styles.relativeWrapper}>
                <input
                  type="text"
                  required
                  value={cpf}
                  onChange={handleCpfChange}
                  placeholder="Digite os 11 dígitos do CPF"
                  maxLength={11}
                  autoComplete="off"
                  className={styles.input}
                />
                {buscandoCpf && <span className={styles.searchingBadge}>Buscando...</span>}
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>
                Nome Completo:{" "}
                {pessoaExiste && <small className={styles.registeredBadge}>Cadastrado</small>}
              </label>
              <input
                type="text"
                required
                disabled={pessoaExiste}
                value={nomeCompleto}
                onChange={(e) => setNomeCompleto(e.target.value)}
                className={`${styles.input} ${pessoaExiste ? styles.inputDisabled : ""}`}
                placeholder={pessoaExiste ? "" : "Digite o nome do operador"}
                autoComplete="off"
              />
            </div>

            <div className={styles.gridTwoCols}>
              <div>
                <label className={styles.fieldLabel}>Data de Nascimento</label>
                <input
                  type="date"
                  disabled={pessoaExiste}
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  className={`${styles.input} ${pessoaExiste ? styles.inputDisabled : ""}`}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className={styles.fieldLabel}>Telefone</label>
                <input
                  type="text"
                  disabled={pessoaExiste}
                  value={mascararTelefone(telefone)}
                  onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className={`${styles.input} ${pessoaExiste ? styles.inputDisabled : ""}`}
                  autoComplete="off"
                />
              </div>
            </div>

            <div className={`${styles.inputGroup} ${styles.roleInputGroup}`}>
              <label className={styles.label}>Cargo:</label>
              <input
                type="text"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                placeholder="Ex.: Operador da Regulação"
                className={styles.input}
                autoComplete="off"
              />
              <span className={styles.roleSubtext}>
                O cargo é só a identificação do servidor. Quem define o que a pessoa pode fazer
                são os <strong>acessos por módulo</strong> — na próxima etapa.
              </span>
            </div>

            <div className={styles.infoBox}>
              <p className={styles.infoText}>
                🔐 <strong>Senha temporária individual:</strong> ao concluir o cadastro, o sistema
                gera uma senha aleatória só para este usuário e a mostra uma única vez, para você
                entregar a ele.
              </p>
              <p className={styles.infoSubtext}>
                A senha não é recuperável depois. Se for perdida, use &quot;Resetar senha&quot;. No
                primeiro acesso o usuário será obrigado a criar uma nova senha.
              </p>
            </div>

            <div className={styles.acoesEtapa}>
              <button type="button" className={styles.btnSecundario} onClick={fecharFormulario}>
                Cancelar
              </button>
              <button type="submit" disabled={buscandoCpf} className={styles.submitButton}>
                Avançar para acessos →
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ══ CADASTRO — ETAPA 2: ACESSOS (OPCIONAL) ══════════════════════ */}
      {mostrarFormulario && etapa === ETAPA_ACESSOS && (
        <div className={styles.formCard}>
          <div className={styles.formCardHeader}>
            <div>
              <h2>Acessos de {nomeCompleto}</h2>
              <div className={styles.etapas}>
                <span className={styles.etapa}>1 · Dados da conta ✓</span>
                <span className={`${styles.etapa} ${styles.etapaAtual}`}>2 · Acessos (opcional)</span>
              </div>
            </div>
            <button onClick={fecharFormulario} className={styles.btnFecharForm} type="button">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className={styles.avisoOpcional}>
            Esta etapa é <strong>opcional</strong>: você pode cadastrar agora ou depois. Sem
            módulos, o usuário entra no sistema, troca a senha e vê apenas a página Início — sem
            nenhuma permissão operacional.
          </div>

          <div className={styles.etapaAcessos}>
          <GerenciarAcessos
            modo="cadastro"
            catalogo={catalogo}
            conta={{ cpf, nome: nomeCompleto, cargo }}
            mostrarLista={false}
            onEstado={setAcessosNovos}
            onVoltar={() => setEtapa(ETAPA_DADOS)}
            rotuloVoltar="← Voltar aos dados"
          />
          </div>

          <div className={styles.acoesEtapa}>
            <button
              type="button"
              className={styles.btnSecundario}
              onClick={() => concluirCadastro({ comAcessos: false })}
              disabled={salvando}
            >
              Configurar depois
            </button>
            <button
              type="button"
              className={styles.submitButton}
              onClick={() => concluirCadastro({ comAcessos: true })}
              disabled={salvando}
            >
              {salvando
                ? "Cadastrando..."
                : acessosNovos.totalModulos > 0
                  ? `Concluir cadastro com ${acessosNovos.totalModulos} módulo(s)`
                  : "Concluir cadastro sem acessos"}
            </button>
          </div>
        </div>
      )}

      {/* ══ LISTA DE USUÁRIOS ════════════════════════════════════════════ */}
      <div className={styles.usuariosSection}>
        <div className={styles.sectionHeader}>
          <h2>Usuários do Sistema</h2>
          <button onClick={carregarUsuarios} className={styles.refreshButton} disabled={carregandoUsuarios}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
            {carregandoUsuarios ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        <div className={styles.searchFiltersBar}>
          <div className={styles.searchBox}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por nome ou CPF..."
              value={buscaUsuario}
              onChange={(e) => setBuscaUsuario(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <select
            value={filtroModulo}
            onChange={(e) => setFiltroModulo(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">Todos os módulos</option>
            {modulosCatalogo.map((m) => (
              <option key={m.chave} value={m.chave}>
                {m.nome}
              </option>
            ))}
          </select>

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">Todos os status</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
            <option value="sem_acesso">Sem acessos configurados</option>
          </select>
        </div>

        {carregandoUsuarios ? (
          <div className={styles.loadingState}>Carregando usuários...</div>
        ) : usuariosFiltrados.length === 0 ? (
          <div className={styles.emptyState}>Nenhum usuário encontrado com os filtros aplicados.</div>
        ) : (
          <>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>CPF</th>
                    <th>Cargo</th>
                    <th>Módulos e perfis</th>
                    <th>Situação</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosPaginados.map((user) => {
                    const modulosAtivos = (user.modulos || []).filter((m) => m.ativo !== false);
                    const semAcessos = modulosAtivos.length === 0;
                    return (
                      <tr key={user.cpf} className={!user.ativo ? styles.inactiveRow : ""}>
                        <td className={styles.nameCell} data-rotulo="Nome">
                          <div className={styles.userName}>{user.nome}</div>
                        </td>
                        <td className={styles.cpfCell} data-rotulo="CPF">{formataCpf(user.cpf)}</td>
                        <td className={styles.cargoCell} data-rotulo="Cargo">{user.cargo || "—"}</td>
                        <td data-rotulo="Módulos e perfis">
                          {semAcessos ? (
                            <span className={styles.badgeSemAcesso}>
                              Sem acessos configurados
                            </span>
                          ) : (
                            <div className={styles.modulosCell}>
                              {modulosAtivos.map((m) => (
                                <span key={m.modulo} className={styles.moduloTag}>
                                  {m.nome}
                                  <strong>{m.perfil}</strong>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td data-rotulo="Situação">
                          <div className={styles.situacaoCell}>
                            <span
                              className={user.ativo ? styles.statusAtivo : styles.statusInativo}
                            >
                              {user.ativo ? "Ativa" : "Inativa"}
                            </span>
                            {user.primeiroAcesso && user.ativo && (
                              <span className={styles.statusPendente}>Senha inicial</span>
                            )}
                          </div>
                        </td>
                        <td data-rotulo="Ações">
                          <div className={styles.actionButtons}>
                            <button
                              onClick={() => abrirAcessos(user)}
                              className={styles.btnEdit}
                              title="Configurar módulos, perfis, serviços e permissões deste usuário"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                              Acessos
                            </button>
                            <button
                              onClick={() => redefinirSenha(user.cpf, user.nome)}
                              className={styles.btnReset}
                              disabled={!user.ativo || redefinindo === user.cpf}
                              title={
                                user.ativo
                                  ? "Gerar senha temporária e exigir troca no próximo acesso"
                                  : "Reative a conta antes de redefinir a senha"
                              }
                            >
                              {redefinindo === user.cpf ? (
                                <span className={styles.spinner} aria-hidden="true" />
                              ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M21 2v6h-6" />
                                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                                  <path d="M3 22v-6h6" />
                                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                                </svg>
                              )}
                              {redefinindo === user.cpf ? "Redefinindo..." : "Resetar senha"}
                            </button>
                            {user.ativo ? (
                              <button
                                onClick={() => desativarUsuario(user.cpf, user.nome)}
                                className={styles.btnDeactivate}
                                disabled={user.cpf === meuCpf}
                                title={
                                  user.cpf === meuCpf
                                    ? "Você não pode desativar a sua própria conta"
                                    : "Desativar acesso"
                                }
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                </svg>
                                Desativar
                              </button>
                            ) : (
                              <button
                                onClick={() => reativarUsuario(user.cpf, user.nome)}
                                className={styles.btnActivate}
                                title="Reativar acesso"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                  <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                                Reativar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={goToPage}
            />
          </>
        )}
      </div>

      {painel && (
        <PainelAcessos
          usuario={painel}
          catalogo={catalogo}
          onFechar={() => setPainel(null)}
          onSalvo={aposSalvarAcessos}
        />
      )}
    </div>
  );
}
