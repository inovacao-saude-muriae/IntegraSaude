"use client";

// Busca de PEDIDO da Junta Reguladora no MESMO modelo do SeletorProcesso da
// Farmácia Judicial: input único + tabela suspensa (nome do paciente, serviço
// e data do cadastro). A busca é feita no backend a cada digitação (debounce).
// Campo vazio NÃO carrega registros: a tabela abre sem linhas.
import { useState, useEffect, useRef, useId } from "react";
import styles from "./SeletorPaciente.module.css";

// ISO (yyyy-mm-dd...) → dd/mm/aaaa sem passar por Date (evita efeito de fuso).
const formatarData = (v) => {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ""));
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : "—";
};

/**
 * @param {object}   props
 * @param {object}   props.selecionado  pedido selecionado ou null
 * @param {function} props.onSelect     recebe o pedido escolhido (ou null)
 * @param {function} props.buscar       async (termo) => array de pedidos
 */
export default function SeletorPedido({
  label = "Buscar Registro",
  placeholder = "Digite o nome ou CPF do paciente...",
  selecionado = null,
  onSelect = () => {},
  buscar,
  minCaracteres = 1,
}) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [dropAberto, setDropAberto] = useState(false);
  const dropdownRef = useRef(null);
  const timerRef = useRef(null);
  const reqRef = useRef(0);
  const listaId = useId();

  // Fecha a tabela suspensa ao clicar fora.
  useEffect(() => {
    function aoClicarFora(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropAberto(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Limpa o texto quando a seleção é removida por fora (ex.: Limpar filtros).
  useEffect(() => {
    if (selecionado) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronização com a seleção externa (Limpar filtros)
    setTermo("");
    setResultados([]);
  }, [selecionado]);

  const agendarBusca = (novoTermo) => {
    clearTimeout(timerRef.current);
    const consulta = novoTermo.trim();
    const req = ++reqRef.current;
    // Campo vazio: abre a tabela sem registros (nada é carregado).
    if (consulta.length < minCaracteres) {
      setResultados([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    timerRef.current = setTimeout(async () => {
      try {
        const lista = await buscar(consulta);
        if (req === reqRef.current) setResultados(Array.isArray(lista) ? lista : []);
      } catch (error) {
        console.error("Erro ao buscar pedidos:", error);
        if (req === reqRef.current) setResultados([]);
      } finally {
        if (req === reqRef.current) setBuscando(false);
      }
    }, 300);
  };

  const selecionar = (pedido) => {
    clearTimeout(timerRef.current);
    reqRef.current++;
    setBuscando(false);
    setTermo(pedido.patientName || "");
    setDropAberto(false);
    onSelect(pedido);
  };

  const alterar = (e) => {
    const valor = e.target.value;
    setTermo(valor);
    setDropAberto(true);
    if (selecionado) onSelect(null); // digitou de novo: descarta a seleção
    agendarBusca(valor);
  };

  const limpar = () => {
    clearTimeout(timerRef.current);
    reqRef.current++;
    setTermo("");
    setResultados([]);
    setBuscando(false);
    setDropAberto(false);
    onSelect(null);
  };

  return (
    <div className={styles.container}>
      <label className={styles.label}>{label}</label>

      <div className={`${styles.inputWrapper} seletorProcessoWrap`} ref={dropdownRef}>
        <div className={`${styles.inputContainer} seletorProcessoCampo`}>
          <input
            type="text"
            className={`${styles.input} seletorProcessoInput`}
            placeholder={placeholder}
            value={termo}
            onChange={alterar}
            onFocus={() => setDropAberto(true)}
            onKeyDown={(e) => e.key === "Escape" && setDropAberto(false)}
            autoComplete="off"
            role="combobox"
            aria-expanded={dropAberto}
            aria-controls={listaId}
            aria-autocomplete="list"
          />
          {buscando && <div className={styles.spinner}></div>}
          <span
            className={styles.arrowIcon}
            aria-hidden="true"
            onClick={() => (selecionado ? limpar() : setDropAberto(!dropAberto))}
            title={selecionado ? "Limpar seleção" : undefined}
          >
            {selecionado ? "×" : dropAberto ? "▲" : "▼"}
          </span>
        </div>

        {dropAberto && (
          <div className={styles.dropdown} id={listaId}>
            <div className={styles.dropdownList}>
              <table className={styles.tabela}>
                <thead>
                  <tr>
                    <th scope="col">Nome do Paciente</th>
                    <th scope="col">Serviço</th>
                    <th scope="col">Data do Cadastro</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.length > 0 ? (
                    resultados.map((p) => (
                      <tr
                        key={p.id}
                        className={`${styles.linha} ${
                          selecionado?.id === p.id ? styles.linhaSelecionada : ""
                        }`}
                        tabIndex={0}
                        onClick={() => selecionar(p)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            selecionar(p);
                          }
                        }}
                      >
                        <td className={styles.nomeUsuario}>{p.patientName || "—"}</td>
                        <td>{p.servicoNome || "—"}</td>
                        <td>{formatarData(p.dataCadastro)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className={styles.semDados}>
                        {buscando
                          ? "Buscando pedidos..."
                          : termo.trim().length < minCaracteres
                            ? "Digite para buscar um pedido."
                            : "Nenhum pedido encontrado."}
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
  );
}
