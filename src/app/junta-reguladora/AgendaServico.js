'use client';

import { useState, useEffect, useCallback } from 'react';
import { useConfirm } from '@/components/ConfirmDialog';
import {
  getAgendamentosDoMes,
  criarAgendamentoJunta,
  excluirAgendamentoJunta,
  getPacientesPorServico,
  getEspecialidadesPorServico,
} from './actions';
import styles from './AgendaServico.module.css';
import { rotuloEspecialidade } from './rotuloEspecialidade';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Converte Date -> 'YYYY-MM-DD' sem efeito de fuso.
const toYMD = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
};

export default function AgendaServico({ servicoNome }) {
  const confirm = useConfirm();
  const rotuloEsp = rotuloEspecialidade(servicoNome);
  const hoje = new Date();

  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1); // 1-12

  const [agendamentos, setAgendamentos] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal de novo agendamento.
  const [diaSelecionado, setDiaSelecionado] = useState(null); // 'YYYY-MM-DD'
  const [form, setForm] = useState({ pacienteJuntaId: '', especialidade: '', hora: '', observacao: '' });
  const [salvando, setSalvando] = useState(false);

  // Função mantida para ser chamada após adicionar ou excluir um registro
  const carregarAgenda = useCallback(async () => {
    setLoading(true);
    const lista = await getAgendamentosDoMes(servicoNome, ano, mes);
    setAgendamentos(Array.isArray(lista) ? lista : []);
    setLoading(false);
  }, [servicoNome, ano, mes]);

  // Carregamento inicial/mudança de mês isolado para evitar acoplamento de efeito
  useEffect(() => {
    let isMounted = true;

    async function loadAgendaData() {
      setLoading(true);
      const lista = await getAgendamentosDoMes(servicoNome, ano, mes);
      if (isMounted) {
        setAgendamentos(Array.isArray(lista) ? lista : []);
        setLoading(false);
      }
    }

    loadAgendaData();

    return () => {
      isMounted = false;
    };
  }, [servicoNome, ano, mes]);

  // Carrega pacientes do serviço e especialidades (uma vez por serviço).
  useEffect(() => {
    let ativo = true;
    (async () => {
      const [resPac, resEsp] = await Promise.all([
        getPacientesPorServico(servicoNome),
        getEspecialidadesPorServico(servicoNome),
      ]);
      if (!ativo) return;
      setPacientes(resPac?.success && Array.isArray(resPac.data) ? resPac.data : []);
      setEspecialidades(Array.isArray(resEsp) ? resEsp : []);
    })();
    return () => {
      ativo = false;
    };
  }, [servicoNome]);

  const irMes = (delta) => {
    let novoMes = mes + delta;
    let novoAno = ano;
    if (novoMes < 1) {
      novoMes = 12;
      novoAno -= 1;
    } else if (novoMes > 12) {
      novoMes = 1;
      novoAno += 1;
    }
    setMes(novoMes);
    setAno(novoAno);
  };

  // Monta a grade do mês (semanas de domingo a sábado).
  const primeiroDia = new Date(ano, mes - 1, 1);
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const offsetInicio = primeiroDia.getDay(); // 0 = domingo

  const celulas = [];
  for (let i = 0; i < offsetInicio; i++) celulas.push(null);
  for (let d = 1; d <= diasNoMes; d++) celulas.push(new Date(ano, mes - 1, d));
  while (celulas.length % 7 !== 0) celulas.push(null);

  const agendamentosPorDia = agendamentos.reduce((acc, a) => {
    (acc[a.data] = acc[a.data] || []).push(a);
    return acc;
  }, {});

  const ymdHoje = toYMD(hoje);

  const abrirDia = (dateObj) => {
    setDiaSelecionado(toYMD(dateObj));
    setForm({ pacienteJuntaId: '', especialidade: '', hora: '', observacao: '' });
  };

  const fecharModal = () => setDiaSelecionado(null);

  const salvar = async (e) => {
    e.preventDefault();
    if (!form.pacienteJuntaId) return alert('Selecione o paciente.');
    if (!form.especialidade) return alert(`Selecione ${rotuloEsp === 'Oficina' ? 'a oficina' : 'a especialidade'}.`);
    if (!form.hora) return alert('Informe o horário.');

    setSalvando(true);
    const res = await criarAgendamentoJunta({
      servicoNome,
      pacienteJuntaId: form.pacienteJuntaId,
      especialidade: form.especialidade,
      data: diaSelecionado,
      hora: form.hora,
      observacao: form.observacao,
    });
    setSalvando(false);
    if (res?.success === false) return alert('Erro: ' + res.error);
    await carregarAgenda();
    fecharModal();
  };

  const excluir = async (ag) => {
    const ok = await confirm({
      title: 'Excluir agendamento',
      message: `Remover ${ag.pacienteNome} (${ag.hora} — ${ag.especialidade})?`,
      confirmText: 'Excluir',
    });
    if (!ok) return;
    const res = await excluirAgendamentoJunta(ag.id);
    if (res?.success === false) return alert('Erro: ' + res.error);
    await carregarAgenda();
  };

  const formatarDiaBR = (ymd) => {
    if (!ymd) return '';
    const [y, m, d] = ymd.split('-');
    return `${d}/${m}/${y}`;
  };

  const agendamentosDoDiaModal = diaSelecionado
    ? agendamentosPorDia[diaSelecionado] || []
    : [];

  return (
    <div className={styles.card}>
      {/* CABEÇALHO COM NAVEGAÇÃO DE MÊS */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>
            Agenda — <span className={styles.badgeServico}>{servicoNome}</span>
          </h2>
          <p className={styles.subtitle}>Clique em um dia para agendar um paciente.</p>
        </div>
        <div className={styles.monthNav}>
          <button type="button" onClick={() => irMes(-1)} className={styles.navBtn}>‹</button>
          <span className={styles.monthLabel}>{MESES[mes - 1]} {ano}</span>
          <button type="button" onClick={() => irMes(1)} className={styles.navBtn}>›</button>
        </div>
      </div>

      {/* GRADE DO CALENDÁRIO */}
      <div className={styles.weekHeader}>
        {DIAS_SEMANA.map((d) => (
          <div key={d} className={styles.weekDay}>{d}</div>
        ))}
      </div>

      <div className={styles.grid}>
        {celulas.map((dateObj, idx) => {
          if (!dateObj) return <div key={`e-${idx}`} className={styles.emptyCell} />;
          const ymd = toYMD(dateObj);
          const doDia = agendamentosPorDia[ymd] || [];
          const ehHoje = ymd === ymdHoje;
          return (
            <div
              key={ymd}
              className={`${styles.dayCell} ${ehHoje ? styles.today : ''}`}
              onClick={() => abrirDia(dateObj)}
            >
              <div className={styles.dayNumber}>{dateObj.getDate()}</div>
              <div className={styles.events}>
                {doDia.slice(0, 4).map((a) => (
                  <div
                    key={a.id}
                    className={styles.event}
                    title={`${a.hora} — ${a.pacienteNome} (${a.especialidade})`}
                  >
                    <span className={styles.eventHora}>{a.hora}</span>{' '}
                    {a.pacienteNome.split(' ')[0]} · {a.especialidade}
                  </div>
                ))}
                {doDia.length > 4 && (
                  <div className={styles.moreEvents}>+{doDia.length - 4} mais</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {loading && <div className={styles.loadingBox}>Carregando agenda...</div>}

      {/* MODAL DO DIA */}
      {diaSelecionado && (
        <div className={styles.modalOverlay} onClick={fecharModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>Agendamentos</h3>
                <p className={styles.modalSubtitle}>{formatarDiaBR(diaSelecionado)} — {servicoNome}</p>
              </div>
              <button type="button" className={styles.modalClose} onClick={fecharModal}>✕</button>
            </div>

            <div className={styles.modalBody}>
              {/* LISTA DO DIA */}
              {agendamentosDoDiaModal.length > 0 && (
                <div className={styles.diaList}>
                  {agendamentosDoDiaModal.map((a) => (
                    <div key={a.id} className={styles.diaItem}>
                      <div>
                        <strong>{a.hora}</strong> — {a.pacienteNome}
                        <div className={styles.diaItemSub}>{a.especialidade}{a.observacao ? ` · ${a.observacao}` : ''}</div>
                      </div>
                      <button type="button" className={styles.removeBtn} onClick={() => excluir(a)}>
                        Excluir
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* FORMULÁRIO */}
              <form onSubmit={salvar} className={styles.form}>
                <div className={styles.formRow}>
                  <div className={styles.fieldGroup}>
                    <label>Paciente *</label>
                    <select
                      value={form.pacienteJuntaId}
                      onChange={(e) => setForm({ ...form, pacienteJuntaId: e.target.value })}
                      required
                    >
                      <option value="">-- Selecione o paciente ({pacientes.length}) --</option>
                      {pacientes.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nomeCompleto || p.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.fieldGroupSmall}>
                    <label>Horário *</label>
                    <input
                      type="time"
                      value={form.hora}
                      onChange={(e) => setForm({ ...form, hora: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label>{rotuloEsp} *</label>
                  <select
                    value={form.especialidade}
                    onChange={(e) => setForm({ ...form, especialidade: e.target.value })}
                    required
                  >
                    <option value="">
                      {especialidades.length > 0
                        ? `-- Selecione ${rotuloEsp === 'Oficina' ? 'a Oficina' : 'a Especialidade'} --`
                        : `Nenhuma ${rotuloEsp === 'Oficina' ? 'oficina' : 'especialidade'} cadastrada`}
                    </option>
                    {especialidades.map((esp) => (
                      <option key={esp.id} value={esp.nome}>{esp.nome}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.fieldGroup}>
                  <label>Observação</label>
                  <input
                    type="text"
                    placeholder="Opcional"
                    value={form.observacao}
                    onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                  />
                </div>

                <div className={styles.modalActions}>
                  <button type="button" className={styles.cancelBtn} onClick={fecharModal} disabled={salvando}>
                    Fechar
                  </button>
                  <button type="submit" className={styles.primaryBtn} disabled={salvando}>
                    {salvando ? 'Salvando...' : 'Adicionar agendamento'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}