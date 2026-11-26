"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  PawPrint,
  Cat,
  Dog,
  User,
  Stethoscope,
  ClipboardList,
  Syringe,
  Calendar,
  FileDown,
  Pencil,
  ChevronRight,
  Info,
} from "lucide-react";
import styles from "./AnimaisGaleria.module.css";
import { obterFichaCompleta } from "./actions";
import { gerarHistoricoCompletoPdf } from "./historicoAnimalPdf";

// Ficha individual do animal (somente leitura por padrão), no padrão de
// prontuário: cabeçalho com fotografia, blocos de identificação e tutor, e
// histórico cronológico com detalhe por registro.
const formatarData = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
};

const formatarEndereco = (end) => {
  if (!end) return "";
  const partes = [];
  if (end.logradouro) partes.push(end.logradouro);
  if (end.numero) partes.push(`nº ${end.numero}`);
  if (end.complemento) partes.push(end.complemento);
  if (end.bairro) partes.push(end.bairro);
  if (end.cidade && end.uf) partes.push(`${end.cidade}/${end.uf}`);
  if (end.cep) partes.push(`CEP ${end.cep}`);
  return partes.join(", ");
};

const badgeSituacao = (situacao) => {
  if (!situacao) return null;
  if (situacao === "Adotado") return { css: styles.badgeAdotado, texto: "Adotado" };
  if (situacao === "Devolvido") return { css: styles.badgeDevolvido, texto: "Devolvido" };
  if (situacao === "Arquivado") return { css: styles.badgeArquivado, texto: "Arquivado" };
  if (situacao === "CCZ") return { css: styles.badgeCcz, texto: "No CCZ" };
  return { css: styles.badgeCcz, texto: situacao };
};

// Imagem padrão discreta por espécie (sem inventar fotografia real).
function IconeEspecie({ especie, size = 34 }) {
  const e = String(especie || "").toLowerCase();
  if (e.startsWith("fel")) return <Cat size={size} strokeWidth={1.5} aria-hidden="true" />;
  if (e.startsWith("can")) return <Dog size={size} strokeWidth={1.5} aria-hidden="true" />;
  return <PawPrint size={size} strokeWidth={1.5} aria-hidden="true" />;
}

function FotoAnimal({ fotoUrl, nome, especie, grande = false }) {
  if (fotoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={fotoUrl} alt={nome ? `Foto de ${nome}` : "Foto do animal"} loading="lazy" />
    );
  }
  return (
    <div className={styles.cardSemFoto}>
      <IconeEspecie especie={especie} size={grande ? 44 : 34} />
      <span>{especie || "Sem foto"}</span>
    </div>
  );
}

// Identificação visual do tipo de atendimento no histórico.
const ICONE_TIPO = {
  ESPORO_VISITA: {
    Icone: Stethoscope,
    css: styles.itemIconeEsporo,
    badge: styles.itemBadgeEsporo,
    rotulo: "Visita de acompanhamento",
  },
  PROCEDIMENTO: { Icone: Syringe, css: "", badge: "", rotulo: "Procedimento" },
  ESPOROTRICOSE: {
    Icone: Stethoscope,
    css: styles.itemIconeEsporo,
    badge: styles.itemBadgeEsporo,
    rotulo: "Esporotricose",
  },
  LEISHMANIOSE: {
    Icone: ClipboardList,
    css: styles.itemIconeLeish,
    badge: styles.itemBadgeLeish,
    rotulo: "Leishmaniose",
  },
  DENUNCIA: { Icone: Info, css: "", badge: "", rotulo: "Denúncia" },
};

export default function FichaAnimalCompleta({
  animalId,
  onFechar,
  onEditar = null,
  podeEditar = false,
}) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [registro, setRegistro] = useState(null);
  // Abrir o detalhe de um atendimento movia a rolagem da ficha (o foco ia
  // para o elemento clicado). Guardamos a posição e a devolvemos ao fechar,
  // para a ficha continuar exatamente onde estava.
  const corpoRef = useRef(null);
  const rolagemRef = useRef(0);

  // O detalhe abre sobre a ficha sem deslocar a rolagem dela: a posição é
  // capturada no mouse down (antes de o foco mexer na rolagem), o foco do
  // clique é neutralizado e a posição é reposta ao fechar o detalhe.
  const registrarPosicao = () => {
    const alvo = corpoRef.current;
    if (alvo) rolagemRef.current = alvo.scrollTop;
  };

  const abrirRegistro = (item) => setRegistro(item);

  const fecharRegistro = () => {
    const alvo = rolagemRef.current;
    setRegistro(null);
    [0, 120, 400].forEach((atraso) =>
      setTimeout(() => {
        if (corpoRef.current) corpoRef.current.scrollTop = alvo;
      }, atraso),
    );
  };

  useEffect(() => {
    let ativo = true;
    obterFichaCompleta(animalId).then((res) => {
      if (!ativo) return;
      if (res.success) setDados(res.data);
      else setErro(res.error || "Não foi possível carregar a ficha do animal.");
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, [animalId]);

  const baixarPdf = async () => {
    if (!dados) return;
    await gerarHistoricoCompletoPdf({
      animal: dados.animal,
      tutor: dados.tutor,
      historico: dados.historico || [],
    });
  };

  const animal = dados?.animal;
  const tutor = dados?.tutor;
  const historico = dados?.historico || [];
  const badge = animal ? badgeSituacao(animal.situacao) : null;

  return (
    <div className={styles.fichaFundo} onClick={onFechar}>
      <div
        className={styles.ficha}
        role="dialog"
        aria-label="Ficha do animal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.fichaTopo}>
          <h2 className={styles.fichaTopoTitulo}>Ficha do Animal</h2>
          <div className={styles.fichaTopoAcoes}>
            {dados && (
              <button type="button" className={styles.btnSecundario} onClick={baixarPdf}>
                <FileDown size={15} aria-hidden="true" />
                Gerar PDF
              </button>
            )}
            {dados && podeEditar && onEditar && (
              <button
                type="button"
                className={styles.btnPrimario}
                onClick={() => onEditar(animalId)}
              >
                <Pencil size={15} aria-hidden="true" />
                Editar
              </button>
            )}
            <button
              type="button"
              className={styles.btnFechar}
              onClick={onFechar}
              aria-label="Fechar ficha"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {carregando && (
          <div className={styles.estadoFicha}>Carregando ficha do animal…</div>
        )}

        {!carregando && erro && (
          <div className={styles.fichaCorpo}>
            <div className={styles.erro}>{erro}</div>
          </div>
        )}

        {!carregando && !erro && dados && (
          <div className={styles.fichaCorpo} ref={corpoRef}>
            {/* ── CABEÇALHO ─────────────────────────────────────────────── */}
            <div className={styles.cabecalho}>
              <div className={styles.cabecalhoFoto}>
                <FotoAnimal
                  fotoUrl={animal.fotoUrl}
                  nome={animal.nome}
                  especie={animal.especie}
                  grande
                />
              </div>
              <div className={styles.cabecalhoInfo}>
                <h3 className={styles.cabecalhoNome}>{animal.nome || "Animal sem nome"}</h3>
                <span className={styles.cabecalhoSub}>ID CCZ: {animal.id}</span>
                <div className={styles.cabecalhoTags}>
                  {animal.especie && (
                    <span className={styles.tag}>
                      <IconeEspecie especie={animal.especie} size={13} />
                      {animal.especie}
                    </span>
                  )}
                  {animal.sexo && (
                    <span className={`${styles.tag} ${styles.tagNeutra}`}>{animal.sexo}</span>
                  )}
                  {animal.porte && (
                    <span className={`${styles.tag} ${styles.tagNeutra}`}>Porte {animal.porte}</span>
                  )}
                  {badge && <span className={`${styles.badge} ${badge.css}`}>{badge.texto}</span>}
                </div>
              </div>
            </div>

            {/* ── BLOCO 1: IDENTIFICAÇÃO DO ANIMAL ─────────────────────── */}
            <div className={styles.bloco}>
              <h4 className={styles.blocoTitulo}>
                <PawPrint size={15} aria-hidden="true" />
                Identificação do Animal
              </h4>
              <div className={styles.gridCampos}>
                <Campo rotulo="Espécie" valor={animal.especie} />
                <Campo rotulo="Sexo" valor={animal.sexo} />
                <Campo rotulo="Idade" valor={animal.idade} />
                <Campo rotulo="Porte" valor={animal.porte} />
                <Campo rotulo="Raça / Pelagem" valor={animal.racaPelagem} />
                <Campo rotulo="Possui identificação" valor={animal.possuiIdentificacao} />
                <Campo rotulo="Castrado" valor={animal.castrado} />
                <Campo rotulo="Data do cadastro" valor={formatarData(animal.dataCadastro)} />
                <Campo rotulo="Situação" valor={animal.situacao || ""} />
                <Campo
                  rotulo="Data da situação"
                  valor={animal.dataDevolucao ? formatarData(animal.dataDevolucao) : ""}
                />
                <Campo rotulo="Doença crônica" valor={animal.doencaCronica} />
                <Campo rotulo="Em tratamento" valor={animal.emTratamento} />
                {animal.qualDoenca && <Campo rotulo="Qual doença" valor={animal.qualDoenca} />}
                {animal.qualTratamento && (
                  <Campo rotulo="Tratamento" valor={animal.qualTratamento} />
                )}
                <Campo rotulo="Apetite normal" valor={animal.apetiteNormal} />
                <Campo rotulo="Vômito / Diarreia" valor={animal.sintomasVomitoDiarreia} />
                {animal.observacoes && (
                  <Campo rotulo="Observações" valor={animal.observacoes} largo />
                )}
              </div>
            </div>

            {/* ── BLOCO 2: INFORMAÇÕES DO TUTOR ────────────────────────── */}
            <div className={styles.bloco}>
              <h4 className={styles.blocoTitulo}>
                <User size={15} aria-hidden="true" />
                Informações do Tutor
              </h4>
              {tutor ? (
                <div className={styles.gridCampos}>
                  <Campo rotulo="Nome completo" valor={tutor.nome} largo />
                  <Campo rotulo="CPF" valor={tutor.cpf} />
                  <Campo rotulo="Telefone" valor={tutor.telefone} />
                  <Campo rotulo="CNS" valor={tutor.cns} />
                  <Campo
                    rotulo="Endereço completo"
                    valor={formatarEndereco(tutor.endereco)}
                    largo
                  />
                </div>
              ) : (
                <div className={styles.avisoSemTutor}>
                  <Info size={16} aria-hidden="true" />
                  Animal sem tutor vinculado no cadastro central.
                </div>
              )}
            </div>

            {/* ── BLOCO 3: HISTÓRICO DO ANIMAL ─────────────────────────── */}
            <div className={styles.bloco}>
              <h4 className={styles.blocoTitulo}>
                <ClipboardList size={15} aria-hidden="true" />
                Histórico de Atendimentos
                {historico.length > 0 && (
                  <span className={styles.contadorHistorico}>{historico.length}</span>
                )}
              </h4>
              {historico.length === 0 ? (
                <div className={styles.vazio}>
                  <Info size={16} aria-hidden="true" />
                  Nenhum registro de acompanhamento para este animal.
                </div>
              ) : (
                <div className={styles.listaHistorico}>
                  {historico.map((h, i) => {
                    const cfg = ICONE_TIPO[h.tipo] || ICONE_TIPO.PROCEDIMENTO;
                    const Icone = cfg.Icone;
                    return (
                      <button
                        key={h.chave}
                        id={`item-${i}`}
                        type="button"
                        className={styles.itemHistorico}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          registrarPosicao();
                        }}
                        onClick={() => abrirRegistro(h)}
                      >
                        <span className={`${styles.itemIcone} ${cfg.css || ""}`}>
                          <Icone size={18} aria-hidden="true" />
                        </span>
                        <span className={styles.itemConteudo}>
                          <span className={styles.itemTitulo}>
                            {cfg.badge ? (
                              <span className={`${styles.itemBadge} ${cfg.badge}`}>
                                {cfg.rotulo}
                              </span>
                            ) : (
                              <span className={styles.itemBadgeNeutro}>{cfg.rotulo}</span>
                            )}{" "}
                            {h.situacaoCaso && (
                              <span
                                className={`${styles.situacaoBadge} ${
                                  h.situacaoCaso === "ENCERRADO"
                                    ? styles.situacaoEncerrado
                                    : styles.situacaoEmAndamento
                                }`}
                              >
                                {h.situacaoLabel ||
                                  (h.situacaoCaso === "ENCERRADO"
                                    ? "Encerrado"
                                    : "Em andamento")}
                              </span>
                            )}{" "}
                            {h.situacaoCaso === "ENCERRADO" && h.desfecho && (
                              <span className={styles.itemDesfecho}>· {h.desfecho}</span>
                            )}{" "}
                            {h.titulo}
                          </span>
                          <span className={styles.itemResumo}>
                            {/* Procedimento / Zoonose: finalidade específica do
                                atendimento, identificada automaticamente. */}
                            {h.finalidade && (
                              <span className={styles.itemFinalidade}>{h.finalidade}</span>
                            )}
                            {h.titulo === "Visita de acompanhamento" && h.subtitulo
                              ? `${h.finalidade ? " · " : ""}Fiscalização ${h.subtitulo}${
                                  h.resumo ? ` · ${h.resumo}` : ""
                                }`
                              : (h.finalidade ? " · " : "") +
                                (h.resumo || h.subtitulo || "Sem detalhes adicionais")}
                          </span>
                        </span>
                        <span className={styles.itemData}>{formatarData(h.data)}</span>
                        <ChevronRight size={16} aria-hidden="true" color="#94a3b8" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── DETALHE DE UM REGISTRO DO HISTÓRICO ──────────────────────── */}
      {registro && (
        <div
          className={styles.detalheFundo}
          onClick={(e) => {
            e.stopPropagation();
            fecharRegistro();
          }}
        >
          <div className={styles.detalhe} onClick={(e) => e.stopPropagation()}>
            <div className={styles.detalheTopo}>
              <h4 className={styles.detalheTopoTitulo}>
                {registro.titulo} · {formatarData(registro.data)}
              </h4>
              <button
                type="button"
                className={styles.btnFechar}
                onClick={fecharRegistro}
                aria-label="Fechar detalhe"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className={styles.detalheCorpo}>
              {(registro.detalhes || []).length === 0 ? (
                <p className={styles.detalheVazio}>Nenhum detalhe registrado.</p>
              ) : (
                (registro.detalhes || []).map((d) => (
                  <Campo key={d.rotulo} rotulo={d.rotulo} valor={d.valor} largo={d.largo} />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Campo({ rotulo, valor, largo = false }) {
  return (
    <div className={`${styles.campo} ${largo ? styles.campoLargo : ""}`}>
      <label>{rotulo}</label>
      <div className={styles.campoValor}>{String(valor || "").trim() || "—"}</div>
    </div>
  );
}
