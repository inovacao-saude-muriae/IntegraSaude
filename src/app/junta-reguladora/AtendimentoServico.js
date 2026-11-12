'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './AtendimentoServico.module.css';
import { useConfirm, useNotify } from '@/components/ConfirmDialog';
import { getAgendamentosDoDia } from './actions';
import { rotuloEspecialidade } from './rotuloEspecialidade';
import { usaRelatorioFinal } from './usaRelatorioFinal';

const STATUS_OPCOES = [
  { value: 'PRESENCA', label: '✅ Presença' },
  { value: 'FALTA', label: '❌ Falta' },
  { value: 'FALTA_JUSTIFICADA', label: '⚠️ Falta justificada' },
];

const hojeYMD = () => new Date().toISOString().split('T')[0];

export default function AtendimentoServico({ servicoNome, onRegistrar }) {
  const confirm = useConfirm();
  const notify = useNotify();
  const rotuloEsp = rotuloEspecialidade(servicoNome);
  const [data, setData] = useState(hojeYMD());
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [registrando, setRegistrando] = useState(null); // id em processamento
  // Modal do "Relatório Final" (campo grande de descrição da avaliação).
  const [relatorioModal, setRelatorioModal] = useState(null); // { id } ou null

  // Estado por agendamento: status + observação da recepção.
  const [registros, setRegistros] = useState({});
  // Ids já registrados (ficam travados até clicar em Editar).
  const [registrados, setRegistrados] = useState({});

  // Função para recarga manual (passada para ações/botões de refetch)
  const carregar = useCallback(async () => {
    setLoading(true);
    const lista = await getAgendamentosDoDia(servicoNome, data);
    setAgendamentos(Array.isArray(lista) ? lista : []);
    
    const base = {};
    const travados = {};
    (lista || []).forEach((a) => {
      if (a.registrado) {
        base[a.id] = {
          status: a.statusRegistrado || 'PRESENCA',
          observacao: a.observacaoRegistrada || '',
        };
        travados[a.id] = true;
      } else {
        base[a.id] = { status: 'PRESENCA', observacao: '' };
      }
    });
    setRegistros(base);
    setRegistrados(travados);
    setLoading(false);
  }, [servicoNome, data]);

  // Carregamento inicial e reações à troca de data/serviço isolados no efeito
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      const lista = await getAgendamentosDoDia(servicoNome, data);
      
      if (isMounted) {
        setAgendamentos(Array.isArray(lista) ? lista : []);
        
        const base = {};
        const travados = {};
        (lista || []).forEach((a) => {
          if (a.registrado) {
            base[a.id] = {
              status: a.statusRegistrado || 'PRESENCA',
              observacao: a.observacaoRegistrada || '',
            };
            travados[a.id] = true;
          } else {
            base[a.id] = { status: 'PRESENCA', observacao: '' };
          }
        });
        
        setRegistros(base);
        setRegistrados(travados);
        setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [servicoNome, data]);

  const setCampo = (id, campo, valor) => {
    setRegistros((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || { status: 'PRESENCA', observacao: '' }), [campo]: valor },
    }));
  };

  const fecharRelatorio = () => setRelatorioModal(null);

  const registrar = async (ag) => {
    const reg = registros[ag.id] || { status: 'PRESENCA', observacao: '' };

    const ok = await confirm({
      title: 'Registrar atendimento',
      message: `Registrar ${ag.pacienteNome} (${ag.especialidade}) como "${
        STATUS_OPCOES.find((s) => s.value === reg.status)?.label || reg.status
      }"?`,
      confirmText: 'Registrar',
    });
    if (!ok) return;

    setRegistrando(ag.id);
    let ok2 = true;
    if (onRegistrar) {
      const res = await onRegistrar({
        pacienteJuntaId: ag.pacienteJuntaId,
        servicoNome,
        especialidade: ag.especialidade,
        data,
        status: reg.status,
        observacao: reg.observacao,
      });
      if (res && res.success === false) ok2 = false;
    }
    setRegistrando(null);
    if (ok2) {
      // Trava o registro deste agendamento (botão fica inativo até editar).
      setRegistrados((prev) => ({ ...prev, [ag.id]: true }));
    }
  };

  const editar = (ag) => {
    setRegistrados((prev) => {
      const novo = { ...prev };
      delete novo[ag.id];
      return novo;
    });
  };

  const formatarDiaBR = (ymd) => {
    if (!ymd) return '';
    const [y, m, d] = ymd.split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <div className={styles.card}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>
          Recepção e Controle — Serviço: <span className={styles.badgeServico}>{servicoNome}</span>
        </h2>
        <div className={styles.datePicker}>
          <label>Dia</label>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
      </div>

      <p className={styles.subtitle}>
        Pacientes agendados para <strong>{formatarDiaBR(data)}</strong>:
        {' '}{agendamentos.length} agendamento(s).
      </p>

      {loading ? (
        <div className={styles.loadingBox}>Carregando agendamentos do dia...</div>
      ) : agendamentos.length === 0 ? (
        <div className={styles.emptyBox}>
          Nenhum paciente agendado para este dia neste serviço.
          <br />
          <small>Agende pela aba <strong>Agenda</strong>.</small>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Horário</th>
                <th>Paciente</th>
                <th>{rotuloEsp}</th>
                <th>Frequência</th>
                <th>Observação</th>
                <th style={{ textAlign: 'center' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {agendamentos.map((ag) => {
                const reg = registros[ag.id] || { status: 'PRESENCA', observacao: '' };
                const foiRegistrado = !!registrados[ag.id];
                return (
                  <tr key={ag.id} className={foiRegistrado ? styles.rowRegistrado : ''}>
                    <td><strong>{ag.hora}</strong></td>
                    <td>
                      <strong>{ag.pacienteNome}</strong>
                      {ag.pacienteCpf && <div className={styles.subText}>CPF: {ag.pacienteCpf}</div>}
                    </td>
                    <td>{ag.especialidade}</td>
                    <td>
                      <select
                        className={styles.statusSelect}
                        value={reg.status}
                        onChange={(e) => setCampo(ag.id, 'status', e.target.value)}
                        disabled={foiRegistrado}
                      >
                        {STATUS_OPCOES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {usaRelatorioFinal(servicoNome, ag.especialidade) ? (
                        <button
                          type="button"
                          className={styles.relatorioBtn}
                          onClick={() => setRelatorioModal({ id: ag.id })}
                          disabled={foiRegistrado}
                        >
                          {reg.observacao?.trim()
                            ? '📄 Ver / editar relatório'
                            : '📝 Escrever relatório final'}
                        </button>
                      ) : (
                        <input
                          type="text"
                          className={styles.obsInput}
                          placeholder="Opcional"
                          value={reg.observacao}
                          onChange={(e) => setCampo(ag.id, 'observacao', e.target.value)}
                          disabled={foiRegistrado}
                        />
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {foiRegistrado ? (
                        <div className={styles.acoesCell}>
                          <span className={styles.registradoTag}>✓ Registrado</span>
                          <button
                            type="button"
                            className={styles.editarBtn}
                            onClick={() => editar(ag)}
                          >
                            Editar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={styles.registrarBtn}
                          onClick={() => registrar(ag)}
                          disabled={registrando === ag.id}
                        >
                          {registrando === ag.id ? '...' : 'Registrar'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: RELATÓRIO FINAL (campo grande de descrição da avaliação) */}
      {relatorioModal && (() => {
        const ag = agendamentos.find((a) => a.id === relatorioModal.id);
        if (!ag) return null;
        const reg = registros[ag.id] || { status: 'PRESENCA', observacao: '' };
        const bloqueado = !!registrados[ag.id];
        return (
          <div className={styles.modalOverlay} onClick={fecharRelatorio}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <div>
                  <h3 className={styles.modalTitle}>Relatório Final</h3>
                  <p className={styles.modalSubtitle}>
                    {ag.pacienteNome} — {ag.especialidade}
                  </p>
                </div>
                <button type="button" className={styles.modalClose} onClick={fecharRelatorio}>
                  ✕
                </button>
              </div>
              <div className={styles.modalBody}>
                <label className={styles.modalLabel}>
                  Descrição da avaliação
                </label>
                <textarea
                  className={styles.relatorioTextarea}
                  rows={12}
                  placeholder="Descreva o resultado da avaliação..."
                  value={reg.observacao}
                  onChange={(e) => setCampo(ag.id, 'observacao', e.target.value)}
                  disabled={bloqueado}
                  autoFocus
                />
                <div className={styles.modalActions}>
                  <button type="button" className={styles.cancelBtn} onClick={fecharRelatorio}>
                    {bloqueado ? 'Fechar' : 'Concluir'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}