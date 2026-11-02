"use client";

import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import styles from "./FichaAnimal.module.css";
import { useNotify } from "@/components/ConfirmDialog";
import { mascararTelefone } from "@/lib/telefone";
import { obterDadosTermoInternacao, salvarTermoInternacao } from "./actions";

const maskCpf = (v) =>
  (v || "")
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

const TEXTO_NAO_ADOTADO =
  "Estou ciente de que: O animal será recuperado, castrado, vacinado e disponibilizado " +
  "para adoção ou devolvido no local de recolhimento. Qualquer informação referente ao " +
  "adotante não será concedida a mim, já que se tratam de informações confidenciais.";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const dataPorExtenso = (ymd) => {
  if (!ymd) return { dia: "____", mes: "____________", ano: "______" };
  const [a, m, d] = ymd.split("-");
  return { dia: d, mes: MESES[Number(m) - 1] || "____________", ano: a };
};

export default function TermoInternacao({ procedimentoId, onFechar }) {
  const notify = useNotify();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Campos editáveis do termo.
  const [form, setForm] = useState({
    responsavelNome: "",
    responsavelCpf: "",
    seraAdotado: "Não",
    dataTermo: "",
    cidade: "Muriaé",
  });

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro("");
    obterDadosTermoInternacao(procedimentoId).then((res) => {
      if (!ativo) return;
      if (res.success) {
        setDados(res.data);
        setForm({
          responsavelNome: res.data.termo.responsavelNome,
          responsavelCpf: res.data.termo.responsavelCpf
            ? maskCpf(res.data.termo.responsavelCpf)
            : "",
          seraAdotado: res.data.termo.seraAdotado,
          dataTermo: res.data.termo.dataTermo,
          cidade: res.data.termo.cidade,
        });
      } else {
        setErro(res.error || "Não foi possível carregar o termo.");
      }
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, [procedimentoId]);

  const atualizar = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }));

  const salvar = async () => {
    setSalvando(true);
    const res = await salvarTermoInternacao({
      procedimentoId,
      responsavelNome: form.responsavelNome,
      responsavelCpf: form.responsavelCpf,
      seraAdotado: form.seraAdotado,
      dataTermo: form.dataTermo,
      cidade: form.cidade,
    });
    setSalvando(false);
    if (res.success) {
      setErro("");
      await notify({ tipo: "sucesso", title: "Pronto", message: "Termo salvo com sucesso!" });
    } else {
      setErro(res.error || "Não foi possível salvar o termo.");
    }
  };

  // ── Gera o PDF do termo de internação ──
  const baixarPdf = () => {
    if (!dados) return;
    const a = dados.animal;

    const doc = new jsPDF();
    const margemX = 18;
    const larguraUtil = 210 - margemX * 2;
    let y = 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("TERMO DE INTERNAÇÃO / DEPÓSITO DE ANIMAL", 105, y, { align: "center" });
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Centro de Controle de Zoonoses — Muriaé/MG", 105, y, { align: "center" });
    y += 10;

    doc.setDrawColor(203, 213, 225);
    doc.line(margemX, y, 210 - margemX, y);
    y += 8;

    const linha = (rotulo, valor) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`${rotulo}: `, margemX, y);
      const w = doc.getTextWidth(`${rotulo}: `);
      doc.setFont("helvetica", "normal");
      const t = doc.splitTextToSize(String(valor || "-"), larguraUtil - w);
      doc.text(t, margemX + w, y);
      y += t.length * 5 + 1.5;
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Dados do animal", margemX, y);
    y += 6;
    linha("ID", a.id);
    linha("Nome", a.nome || "Sem nome");
    linha("Espécie", a.especie);
    linha("Sexo", a.sexo);
    linha("Porte", a.porte);
    linha("Idade", a.idade || "-");
    linha("Castrado", a.castrado);
    linha(
      "Doença crônica",
      a.doencaCronica === "Sim" ? `Sim${a.qualDoenca ? ` — ${a.qualDoenca}` : ""}` : "Não",
    );
    if (a.observacoes) linha("Observações", a.observacoes);
    linha("Data da internação", dados.procedimento.dataProcedimento
      ? dados.procedimento.dataProcedimento.split("-").reverse().join("/")
      : "-");

    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Responsável / Depositante", margemX, y);
    y += 6;
    linha("Nome", form.responsavelNome || "-");
    linha("CPF", form.responsavelCpf || "-");

    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const adotado = form.seraAdotado === "Sim";
    doc.text(
      `O animal será adotado pelo depositante?  ( ${adotado ? "X" : " "} ) Sim   ( ${
        adotado ? " " : "X"
      } ) Não`,
      margemX,
      y,
    );
    y += 8;

    if (!adotado) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const t = doc.splitTextToSize(TEXTO_NAO_ADOTADO, larguraUtil);
      doc.text(t, margemX, y);
      y += t.length * 5 + 6;
    }

    const ext = dataPorExtenso(form.dataTermo);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    y += 6;
    doc.text(`${form.cidade || "Muriaé"}, ${ext.dia} de ${ext.mes} de ${ext.ano}`, margemX, y);

    y += 24;
    doc.line(margemX + 20, y, 210 - margemX - 20, y);
    y += 5;
    doc.setFontSize(10);
    doc.text("Assinatura do depositante", 105, y, { align: "center" });
    
    // Se tiver tutor, mostra o nome abaixo da linha
    if (dados.temTutor && dados.tutorNome) {
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(dados.tutorNome, 105, y, { align: "center" });
    }

    doc.save(`termo-internacao-${a.id}-${dados.procedimentoId}.pdf`);
  };

  const naoAdotado = form.seraAdotado !== "Sim";

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Termo de internação</h2>
            {dados && (
              <p className={styles.subtitle}>
                {dados.animal.nome || "Sem nome"} ({dados.animal.id})
              </p>
            )}
          </div>
          <button type="button" className={styles.closeBtn} onClick={onFechar}>
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {carregando ? (
            <p className={styles.info}>Carregando termo...</p>
          ) : erro && !dados ? (
            <p className={styles.erro}>{erro}</p>
          ) : (
            <>
              {erro && <p className={styles.erro}>{erro}</p>}

              {/* DADOS DO ANIMAL */}
              <div className={styles.secao}>
                <h4 className={styles.secaoTitulo}>Dados do animal</h4>
                <div className={styles.dadosGrid}>
                  <div className={styles.dado}>
                    <span className={styles.dadoLabel}>Nome</span>
                    <span className={styles.dadoValor}>{dados.animal.nome || "Sem nome"}</span>
                  </div>
                  <div className={styles.dado}>
                    <span className={styles.dadoLabel}>ID</span>
                    <span className={styles.dadoValor}>{dados.animal.id}</span>
                  </div>
                  <div className={styles.dado}>
                    <span className={styles.dadoLabel}>Espécie</span>
                    <span className={styles.dadoValor}>{dados.animal.especie}</span>
                  </div>
                  <div className={styles.dado}>
                    <span className={styles.dadoLabel}>Sexo</span>
                    <span className={styles.dadoValor}>{dados.animal.sexo}</span>
                  </div>
                  <div className={styles.dado}>
                    <span className={styles.dadoLabel}>Porte</span>
                    <span className={styles.dadoValor}>{dados.animal.porte}</span>
                  </div>
                  <div className={styles.dado}>
                    <span className={styles.dadoLabel}>Idade</span>
                    <span className={styles.dadoValor}>{dados.animal.idade || "-"}</span>
                  </div>
                </div>
              </div>

              {/* RESPONSÁVEL / DEPOSITANTE */}
              <div className={styles.secao}>
                <h4 className={styles.secaoTitulo}>Responsável / Depositante</h4>
                {dados.temTutor && (
                  <p className={styles.infoTutor}>
                    Dados preenchidos a partir do tutor cadastrado. Você pode ajustar se necessário.
                  </p>
                )}
                <div className={styles.formGrid}>
                  <div className={styles.campo}>
                    <label>Nome *</label>
                    <input
                      type="text"
                      value={form.responsavelNome}
                      onChange={(e) => atualizar("responsavelNome", e.target.value)}
                      placeholder="Nome do responsável"
                    />
                  </div>
                  <div className={styles.campo}>
                    <label>CPF</label>
                    <input
                      type="text"
                      value={form.responsavelCpf}
                      onChange={(e) => atualizar("responsavelCpf", maskCpf(e.target.value))}
                      placeholder="000.000.000-00"
                    />
                  </div>
                </div>
              </div>

              {/* ADOÇÃO */}
              <div className={styles.secao}>
                <h4 className={styles.secaoTitulo}>Adoção</h4>
                <div className={styles.formGrid}>
                  <div className={styles.campo}>
                    <label>O animal será adotado pelo depositante?</label>
                    <select
                      value={form.seraAdotado}
                      onChange={(e) => atualizar("seraAdotado", e.target.value)}
                    >
                      <option value="Não">Não</option>
                      <option value="Sim">Sim</option>
                    </select>
                  </div>
                </div>
                {naoAdotado && <p className={styles.cienciaTexto}>{TEXTO_NAO_ADOTADO}</p>}
              </div>

              {/* DATA / LOCAL */}
              <div className={styles.secao}>
                <h4 className={styles.secaoTitulo}>Local e data</h4>
                <div className={styles.formGrid}>
                  <div className={styles.campo}>
                    <label>Cidade</label>
                    <input
                      type="text"
                      value={form.cidade}
                      onChange={(e) => atualizar("cidade", e.target.value)}
                    />
                  </div>
                  <div className={styles.campo}>
                    <label>Data do termo *</label>
                    <input
                      type="date"
                      value={form.dataTermo}
                      onChange={(e) => atualizar("dataTermo", e.target.value)}
                    />
                  </div>
                </div>
                <p className={styles.assinaturaPreview}>Assinatura do depositante</p>
              </div>
            </>
          )}
        </div>

        <div className={styles.footer}>
          {dados && (
            <>
              <button
                type="button"
                className={styles.baixarBtn}
                onClick={baixarPdf}
                disabled={salvando}
              >
                Baixar PDF
              </button>
              <button
                type="button"
                className={styles.fecharBtn}
                onClick={salvar}
                disabled={salvando}
              >
                {salvando ? "Salvando..." : "Salvar termo"}
              </button>
            </>
          )}
          <button type="button" className={styles.cancelarBtn} onClick={onFechar}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
