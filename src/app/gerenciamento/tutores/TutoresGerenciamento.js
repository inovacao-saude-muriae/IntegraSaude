"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CadastroPessoas from "@/components/CadastroPessoas/CadastroPessoas";
import { useConfirm, useNotify } from "@/components/ConfirmDialog";
import { listarTutoresComAnimais, excluirTutor } from "@/app/ccz/actions";
import styles from "./Tutores.module.css";

// Gerenciamento → Tutores.
//
// A tela de cadastro é a MESMA do cadastro único (Pessoa/EMPI) — nada de tabela
// nova nem duplicação de dados pessoais. O que muda aqui é a visão do CCZ:
// lista de tutores com os animais vinculados, a consulta da ficha do animal e a
// ação de EXCLUIR O VÍNCULO DE TUTOR (que nunca exclui a Pessoa central).
export default function TutoresGerenciamento({ podeExcluir = false, podeExcluirPessoa = false }) {
  const confirm = useConfirm();
  const notify = useNotify();

  const [tutores, setTutores] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [termo, setTermo] = useState("");
  const [selecionado, setSelecionado] = useState(null);
  const [excluindo, setExcluindo] = useState(false);

  // A busca é assíncrona: o setState acontece depois do await, fora do corpo
  // síncrono do effect (padrão já usado nas outras telas do sistema).
  const carregar = useCallback(async () => {
    const res = await listarTutoresComAnimais();
    if (res.success) {
      setTutores(res.data || []);
      setErro("");
    } else {
      setTutores([]);
      setErro(res.error || "Não foi possível carregar os tutores.");
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    let ativo = true;
    (async () => {
      if (ativo) await carregar();
    })();
    return () => {
      ativo = false;
    };
  }, [carregar]);

  const filtrados = useMemo(() => {
    const t = termo.trim().toLowerCase();
    if (!t) return tutores;
    const digitos = t.replace(/\D/g, "");
    return tutores.filter(
      (x) =>
        (x.nome || "").toLowerCase().includes(t) ||
        (digitos && String(x.cpf || "").includes(digitos)) ||
        (digitos && String(x.cns || "").includes(digitos)),
    );
  }, [tutores, termo]);

  const pedirExclusao = async (tutor) => {
    if (!podeExcluir || excluindo) return;

    if ((tutor.animais || []).length > 0) {
      await notify({
        tipo: "erro",
        title: "Tutor com animais vinculados",
        message:
          `Este tutor possui ${tutor.animais.length} animal(is). ` +
          "Transfira ou desvincule os animais antes de excluir o vínculo de tutor.",
      });
      return;
    }

    const ok = await confirm({
      title: "Excluir vínculo de tutor",
      message:
        `Excluir o vínculo de tutor de ${tutor.nome}? ` +
        "O cadastro da pessoa é preservado — apenas o vínculo com o CCZ é removido.",
      confirmText: "Sim, excluir vínculo",
      cancelText: "Cancelar",
      danger: true,
    });
    if (!ok) return;

    setExcluindo(true);
    const res = await excluirTutor(tutor.pessoaCpf);
    setExcluindo(false);

    if (res.success) {
      await notify({
        tipo: "sucesso",
        title: "Vínculo excluído",
        message: `O vínculo de tutor de ${tutor.nome} foi removido. O cadastro da pessoa foi preservado.`,
      });
      if (selecionado === tutor.pessoaCpf) setSelecionado(null);
      carregar();
    } else {
      await notify({
        tipo: "erro",
        title: "Não foi possível excluir",
        message: res.error || "Erro ao excluir o vínculo de tutor.",
      });
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.cabecalho}>
        <div>
          <h1 className={styles.titulo}>Tutores</h1>
          <p className={styles.subtitulo}>
            Gerenciamento › Tutores — vínculos do CCZ sobre o cadastro único de pessoas.
          </p>
        </div>
      </header>

      <section className={styles.card} aria-labelledby="tutores-lista">
        <div className={styles.cardTopo}>
          <h2 id="tutores-lista" className={styles.cardTitulo}>
            Tutores cadastrados
          </h2>
          <input
            type="search"
            className={styles.busca}
            placeholder="Buscar por nome, CPF ou CNS…"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            aria-label="Buscar tutores"
          />
        </div>

        {erro && <div className={styles.erro}>{erro}</div>}
        {carregando ? (
          <p className={styles.vazio}>Carregando tutores…</p>
        ) : filtrados.length === 0 ? (
          <p className={styles.vazio}>
            {tutores.length === 0
              ? "Nenhum tutor cadastrado."
              : "Nenhum tutor encontrado para esta busca."}
          </p>
        ) : (
          <div className={styles.tabelaWrap}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>CPF / CNS</th>
                  <th>Telefone</th>
                  <th>Animais</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((t) => (
                  <tr key={t.pessoaCpf}>
                    <td>{t.nome}</td>
                    <td>{t.cpf || t.cns || "—"}</td>
                    <td>{t.telefone || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.linkAnimais}
                        onClick={() => setSelecionado(t)}
                      >
                        {t.animais.length} animal(is)
                      </button>
                    </td>
                    <td className={styles.acoes}>
                      <button
                        type="button"
                        className={styles.btnGhost}
                        onClick={() => setSelecionado(t)}
                      >
                        Consultar
                      </button>
                      {podeExcluir && (
                        <button
                          type="button"
                          className={styles.btnDanger}
                          onClick={() => pedirExclusao(t)}
                          disabled={excluindo}
                        >
                          Excluir vínculo
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selecionado && (
        <section className={styles.card} aria-labelledby="tutor-animais">
          <div className={styles.cardTopo}>
            <h2 id="tutor-animais" className={styles.cardTitulo}>
              Animais de {selecionado.nome}
            </h2>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() => setSelecionado(null)}
            >
              Fechar
            </button>
          </div>

          {selecionado.animais.length === 0 ? (
            <p className={styles.vazio}>Este tutor não possui animais vinculados.</p>
          ) : (
            <div className={styles.tabelaWrap}>
              <table className={styles.tabela}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Espécie</th>
                    <th>Sexo</th>
                    <th>Porte</th>
                    <th>Idade</th>
                    <th>Castrado</th>
                  </tr>
                </thead>
                <tbody>
                  {selecionado.animais.map((a) => (
                    <tr key={a.id}>
                      <td>{a.nome || "—"}</td>
                      <td>{a.especie || "—"}</td>
                      <td>{a.sexo}</td>
                      <td>{a.porte || "—"}</td>
                      <td>{a.idade || "—"}</td>
                      <td>{a.castrado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className={styles.nota}>
            A ficha completa do animal (histórico e procedimentos) fica no módulo
            CCZ.{" "}
            <Link href="/ccz?tab=ANIMAIS" className={styles.link}>
              Abrir CCZ
            </Link>
          </p>
        </section>
      )}

      {/* Cadastro único (Pessoa/EMPI): a MESMA tela de Paciente. */}
      <section className={styles.card} aria-labelledby="tutor-cadastro">
        <h2 id="tutor-cadastro" className={styles.cardTitulo}>
          Cadastro de pessoas
        </h2>
        <p className={styles.nota}>
          Tutor é uma pessoa do cadastro único: os dados pessoais são compartilhados
          com os demais módulos e não são duplicados aqui.
        </p>
        <CadastroPessoas podeExcluir={podeExcluirPessoa} />
      </section>
    </div>
  );
}
