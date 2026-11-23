"use client";

// Aba "Consultar Pedidos" da Junta Reguladora — MESMA estrutura visual e
// funcional da Consulta de Processos da Farmácia Judicial: card de filtros,
// busca suspensa, Filtrar/Limpar filtros, estado inicial, tabela com a linha
// inteira clicável, visualização completa (somente leitura) e paginação de
// 100 por página processada no backend.
import { useEffect, useState } from "react";
import { Filter, SearchX } from "lucide-react";
import SeletorPedido from "@/components/SeletorPedido";
import { formatarCpfExibicao } from "@/lib/cpf";
import { mascararTelefone } from "@/lib/telefone";
import {
  buscarPedidosJunta,
  listarPedidosJunta,
  listarFiltrosPedidosJunta,
  obterPedidoJunta,
} from "./actions";
import consultaStyles from "../camara-tecnica/processos/ConsultarProcessos.module.css";

const FILTROS_VAZIOS = {
  busca: "",
  servicoId: "",
  especialidadeId: "",
  situacao: "todos",
  dataInicio: "",
  dataFim: "",
};

// ISO (yyyy-mm-dd) → dd/mm/aaaa sem passar por Date (evita efeito de fuso).
const formatarData = (v) => {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ""));
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : "—";
};

export default function ConsultarPedidos() {
  const [catalogo, setCatalogo] = useState({ servicos: [], especialidades: [], situacoes: [] });
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [resultado, setResultado] = useState(null); // null = nenhuma consulta ainda
  const [consultando, setConsultando] = useState(false);
  const [erro, setErro] = useState("");

  const [detalhe, setDetalhe] = useState(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  // Catálogo dos filtros: serviços e especialidades do escopo do usuário.
  useEffect(() => {
    let ativo = true;
    (async () => {
      const res = await listarFiltrosPedidosJunta();
      if (!ativo) return;
      if (res?.success) {
        setCatalogo({
          servicos: res.servicos || [],
          especialidades: res.especialidades || [],
          situacoes: res.situacoes || [],
        });
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const alterarFiltro = (campo, valor) => setFiltros((f) => ({ ...f, [campo]: valor }));

  async function consultar(pagina = 1, atuais = filtros) {
    setConsultando(true);
    setErro("");
    try {
      const res = await listarPedidosJunta({
        busca: atuais.busca,
        buscaId: pedidoSelecionado?.id || null,
        servicoId: atuais.servicoId,
        especialidadeId: atuais.especialidadeId,
        situacao: atuais.situacao,
        dataInicio: atuais.dataInicio,
        dataFim: atuais.dataFim,
        pagina,
      });
      if (!res.success) {
        setErro(res.error || "Não foi possível consultar os pedidos.");
        setResultado(null);
        return;
      }
      setResultado(res);
    } finally {
      setConsultando(false);
    }
  }

  // Filtrar sem nenhum campo preenchido devolve todos os pedidos do escopo.
  const filtrar = (e) => {
    e?.preventDefault?.();
    consultar(1, filtros);
  };

  // Limpar filtros: zera os campos, a seleção da busca E oculta os resultados.
  const limpar = () => {
    setFiltros(FILTROS_VAZIOS);
    setPedidoSelecionado(null);
    setResultado(null);
    setErro("");
  };

  async function abrirDetalhe(id) {
    setCarregandoDetalhe(true);
    setDetalhe(null);
    setErro("");
    try {
      const res = await obterPedidoJunta(id);
      if (!res.success) {
        setErro(res.error || "Não foi possível abrir o pedido.");
        return;
      }
      setDetalhe(res.data);
    } finally {
      setCarregandoDetalhe(false);
    }
  }

  const fecharDetalhe = () => {
    setDetalhe(null);
    setCarregandoDetalhe(false);
  };

  return (
    <div className={consultaStyles.container}>
      <div className={consultaStyles.mainWrapper}>
        {erro && (
          <div className={consultaStyles.avisoErro} role="alert">
            {erro}
            <button type="button" onClick={() => setErro("")} aria-label="Fechar">
              ×
            </button>
          </div>
        )}

        {/* ── FILTROS ─────────────────────────────────────────────────────── */}
        <form className={consultaStyles.cardFiltros} onSubmit={filtrar}>
          <div className={consultaStyles.cardFiltrosHeader}>
            <h4>Filtros da Consulta</h4>
          </div>

          <div className={consultaStyles.gridFiltros}>
            <div className={consultaStyles.colBuscaRegistro}>
              <SeletorPedido
                label="Buscar Registro"
                placeholder="Digite o nome ou CPF do paciente..."
                selecionado={pedidoSelecionado}
                onSelect={(p) => {
                  setPedidoSelecionado(p);
                  setFiltros((f) => ({ ...f, busca: p ? p.patientName : "" }));
                }}
                buscar={buscarPedidosJunta}
              />
            </div>

            <div className={`${consultaStyles.fieldGroup} ${consultaStyles.colEspecialidade}`}>
              <label>Serviço</label>
              <select
                value={filtros.servicoId}
                onChange={(e) => alterarFiltro("servicoId", e.target.value)}
              >
                <option value="">Todos os serviços</option>
                {catalogo.servicos.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${consultaStyles.fieldGroup} ${consultaStyles.colProcedimento}`}>
              <label>Especialidade</label>
              <select
                value={filtros.especialidadeId}
                onChange={(e) => alterarFiltro("especialidadeId", e.target.value)}
              >
                <option value="">Todas as especialidades</option>
                {catalogo.especialidades.map((esp) => (
                  <option key={esp.id} value={String(esp.id)}>
                    {esp.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${consultaStyles.fieldGroup} ${consultaStyles.colStatus}`}>
              <label>Status do Pedido</label>
              <select
                value={filtros.situacao}
                onChange={(e) => alterarFiltro("situacao", e.target.value)}
              >
                <option value="todos">Todos</option>
                {catalogo.situacoes.map((s) => (
                  <option key={s.valor} value={s.valor}>
                    {s.rotulo}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${consultaStyles.fieldGroup} ${consultaStyles.colPeriodoCadastro}`}>
              <label>Período do cadastro</label>
              <div className={consultaStyles.periodo}>
                <input
                  type="date"
                  value={filtros.dataInicio}
                  onChange={(e) => alterarFiltro("dataInicio", e.target.value)}
                  aria-label="Data inicial do cadastro"
                />
                <span>até</span>
                <input
                  type="date"
                  value={filtros.dataFim}
                  onChange={(e) => alterarFiltro("dataFim", e.target.value)}
                  aria-label="Data final do cadastro"
                />
              </div>
            </div>

            <div className={consultaStyles.filtrosAcoes}>
              <button type="submit" className={consultaStyles.btnPrimario} disabled={consultando}>
                <Filter size={16} strokeWidth={2.5} aria-hidden="true" />
                {consultando ? "Filtrando…" : "Filtrar"}
              </button>
              <button
                type="button"
                className={consultaStyles.btnGhost}
                onClick={limpar}
                disabled={consultando}
              >
                Limpar filtros
              </button>
            </div>
          </div>
        </form>

        {/* ── ESTADO INICIAL: nada é consultado até clicar em Filtrar ─────── */}
        {!resultado && (
          <div className={consultaStyles.estadoInicial}>
            <SearchX size={44} strokeWidth={1.5} aria-hidden="true" />
            <h3>Nenhuma consulta realizada</h3>
            <p>Selecione os filtros ou clique em Filtrar para consultar todos os pedidos.</p>
          </div>
        )}

        {/* ── RESULTADOS (só após consultar) ──────────────────────────────── */}
        {resultado && (
          <div className={consultaStyles.resultados}>
            <div className={consultaStyles.resumo}>
              <span>
                <strong>{resultado.total}</strong>{" "}
                {resultado.total === 1 ? "registro encontrado" : "registros encontrados"}
              </span>
              <span className={consultaStyles.resumoPagina}>
                Página {resultado.pagina} de {resultado.totalPaginas} · 100 por página
              </span>
            </div>

            <div className={consultaStyles.tabelaWrapper}>
              <table className={consultaStyles.tabela}>
                <thead>
                  <tr>
                    <th>Data do Cadastro</th>
                    <th>Nome do Paciente</th>
                    <th>Serviço</th>
                    <th>Especialidade</th>
                    <th>Situação do Pedido</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.registros.length === 0 && (
                    <tr>
                      <td colSpan={5} className={consultaStyles.tabelaVazia}>
                        Nenhum registro encontrado
                      </td>
                    </tr>
                  )}
                  {resultado.registros.map((r) => (
                    <tr
                      key={r.id}
                      className={consultaStyles.linhaClicavel}
                      onClick={() => abrirDetalhe(r.id)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") abrirDetalhe(r.id);
                      }}
                      title="Clique para visualizar o pedido completo"
                    >
                      <td>{formatarData(r.dataCadastro)}</td>
                      <td>{r.patientName || "—"}</td>
                      <td>{r.servicoNome || "—"}</td>
                      <td>{r.especialidade || "—"}</td>
                      <td>{r.situacao || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={consultaStyles.paginacao}>
              <button
                type="button"
                className={consultaStyles.btnGhost}
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
                className={consultaStyles.btnGhost}
                disabled={resultado.pagina >= resultado.totalPaginas || consultando}
                onClick={() => consultar(resultado.pagina + 1, filtros)}
              >
                Próxima →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── VISUALIZAÇÃO COMPLETA (somente leitura) ───────────────────────── */}
      {(carregandoDetalhe || detalhe) && (
        <div className={consultaStyles.painelFundo} role="presentation" onClick={fecharDetalhe}>
          <div
            className={consultaStyles.painelDetalhe}
            role="dialog"
            aria-modal="true"
            aria-label="Detalhes do pedido"
            onClick={(e) => e.stopPropagation()}
          >
            {carregandoDetalhe && !detalhe && <p className={consultaStyles.vazio}>Carregando pedido...</p>}

            {detalhe && (
              <>
                <div className={consultaStyles.painelTopo}>
                  <h3>Detalhes do pedido</h3>
                  <button
                    type="button"
                    className={consultaStyles.btnFechar}
                    onClick={fecharDetalhe}
                    aria-label="Fechar"
                  >
                    ×
                  </button>
                </div>

                <div className={consultaStyles.corpoDetalhe}>
                  {/* 1. IDENTIFICAÇÃO DO PACIENTE */}
                  <div className={consultaStyles.cardSection}>
                    <h4 className={consultaStyles.sectionHeaderTitle}>1. Identificação do Paciente</h4>
                    <div className={consultaStyles.grid3}>
                      <div className={consultaStyles.campoLeitura}>
                        <label>Nome do Paciente</label>
                        <input readOnly value={detalhe.patientName || "—"} />
                      </div>
                      <div className={consultaStyles.campoLeitura}>
                        <label>CPF</label>
                        <input readOnly value={formatarCpfExibicao(detalhe.cpf) || "—"} />
                      </div>
                      <div className={consultaStyles.campoLeitura}>
                        <label>CNS (Cartão SUS)</label>
                        <input readOnly value={detalhe.cns || "—"} />
                      </div>
                      <div className={consultaStyles.campoLeitura}>
                        <label>Data de Nascimento</label>
                        <input readOnly value={formatarData(detalhe.dataNascimento)} />
                      </div>
                      <div className={consultaStyles.campoLeitura}>
                        <label>Sexo</label>
                        <input readOnly value={detalhe.sexo || "—"} />
                      </div>
                      <div className={consultaStyles.campoLeitura}>
                        <label>Telefone</label>
                        <input readOnly value={mascararTelefone(detalhe.telefone) || "—"} />
                      </div>
                      <div className={consultaStyles.campoLeitura}>
                        <label>Nome da Mãe</label>
                        <input readOnly value={detalhe.nomeMae || "—"} />
                      </div>
                      <div className={consultaStyles.campoLeitura}>
                        <label>Situação Cadastral</label>
                        <input readOnly value={detalhe.situacaoCadastral || "—"} />
                      </div>
                      <div className={consultaStyles.campoLeitura}>
                        <label>UBS de referência</label>
                        <input readOnly value={detalhe.ubsReferencia || "—"} />
                      </div>
                      <div className={`${consultaStyles.campoLeitura} ${consultaStyles.campoLeituraLargo}`}>
                        <label>Endereço</label>
                        <input
                          readOnly
                          value={
                            [
                              [detalhe.logradouro, detalhe.numero].filter(Boolean).join(", "),
                              detalhe.complemento,
                              detalhe.bairro,
                              [detalhe.cidade, detalhe.uf].filter(Boolean).join("/"),
                              detalhe.cep ? `CEP ${detalhe.cep}` : "",
                            ]
                              .filter(Boolean)
                              .join(" - ") || "—"
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. INFORMAÇÕES DO PEDIDO */}
                  <div className={consultaStyles.cardSection}>
                    <h4 className={consultaStyles.sectionHeaderTitle}>2. Informações do Pedido</h4>
                    <div className={consultaStyles.grid3}>
                      <div className={consultaStyles.campoLeitura}>
                        <label>Serviço</label>
                        <input readOnly value={detalhe.servicoNome || "—"} />
                      </div>
                      <div className={consultaStyles.campoLeitura}>
                        <label>Especialidade</label>
                        <input readOnly value={detalhe.especialidade || "—"} />
                      </div>
                      <div className={consultaStyles.campoLeitura}>
                        <label>Situação do Pedido</label>
                        <input readOnly value={detalhe.situacao || "—"} />
                      </div>
                      <div className={consultaStyles.campoLeitura}>
                        <label>Data do Atendimento</label>
                        <input readOnly value={formatarData(detalhe.dataAtendimento)} />
                      </div>
                      <div className={consultaStyles.campoLeitura}>
                        <label>Profissional Responsável</label>
                        <input readOnly value={detalhe.profissionalResponsavel || "—"} />
                      </div>
                      <div className={consultaStyles.campoLeitura}>
                        <label>Data do Cadastro</label>
                        <input readOnly value={formatarData(detalhe.dataCadastro)} />
                      </div>
                      <div className={consultaStyles.campoLeitura}>
                        <label>Tipo de Deficiência</label>
                        <input readOnly value={detalhe.tipoDeficiencia || "—"} />
                      </div>
                      <div className={`${consultaStyles.campoLeitura} ${consultaStyles.campoLeituraLargo}`}>
                        <label>Observação</label>
                        <input readOnly value={detalhe.observacao || "—"} />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
