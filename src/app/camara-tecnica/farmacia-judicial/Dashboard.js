'use client';

import styles from './Dashboard.module.css';

export default function TabDashboard({
  metrics = {},
  onNavigate,
  loading = false,
  medicamentosList = [],
  estoqueLotes = []
}) {
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <span>Carregando métricas do sistema...</span>
      </div>
    );
  }

  const {
    totalMedicamentosCadastrados = 0,
    totalEstoqueUnidades = 0,
    pacientesAtivos = 0,
    pacientesInativos = 0,
    pacientesObito = 0
  } = metrics;

  const totalPacientes = pacientesAtivos + pacientesInativos + pacientesObito;

  // #7 - Sistema de Alertas de Estoque
  const hoje = new Date();
  const em30Dias = new Date();
  em30Dias.setDate(hoje.getDate() + 30);

  // Lotes próximos ao vencimento (30 dias)
  const lotesVencendo = (estoqueLotes || []).filter(lote => {
    if (!lote.dataValidade) return false;
    const validade = new Date(lote.dataValidade);
    const saldo = lote.qtdInicial - (lote.qtdSaida || 0);
    return saldo > 0 && validade >= hoje && validade <= em30Dias;
  });

  // Medicamentos com estoque baixo (menos de 20 unidades)
  const LIMITE_ESTOQUE_BAIXO = 20;
  const medicamentosEstoqueBaixo = (medicamentosList || []).filter(med => {
    const qtd = med.qtdAtual ?? med.qtdTotal ?? med.estoqueUnidades ?? 0;
    return qtd > 0 && qtd < LIMITE_ESTOQUE_BAIXO;
  });

  const temAlertas = lotesVencendo.length > 0 || medicamentosEstoqueBaixo.length > 0;

  return (
    <div className={styles.container}>
      {/* ALERTAS DE ESTOQUE (#7) */}
      {temAlertas && (
        <div className={styles.alertsSection}>
          {lotesVencendo.length > 0 && (
            <div className={styles.alertCard} style={{ borderLeftColor: '#f59e0b' }}>
              <div className={styles.alertHeader}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <strong>Medicamentos Próximos ao Vencimento</strong>
                <span className={styles.alertBadge}>{lotesVencendo.length}</span>
              </div>
              <div className={styles.alertBody}>
                <p>Os seguintes lotes vencem nos próximos 30 dias:</p>
                <ul className={styles.alertList}>
                  {lotesVencendo.slice(0, 5).map((lote, idx) => {
                    const validade = new Date(lote.dataValidade);
                    const diasRestantes = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
                    return (
                      <li key={idx}>
                        <strong>{lote.nomeMedicamento}</strong> (Lote {lote.numeroLote}) 
                        - Vence em <span style={{ color: '#dc2626', fontWeight: '700' }}>{diasRestantes} dia(s)</span>
                      </li>
                    );
                  })}
                </ul>
                {lotesVencendo.length > 5 && (
                  <p className={styles.alertMore}>+ {lotesVencendo.length - 5} lote(s) adicional(is)</p>
                )}
              </div>
            </div>
          )}

          {medicamentosEstoqueBaixo.length > 0 && (
            <div className={styles.alertCard} style={{ borderLeftColor: '#dc2626' }}>
              <div className={styles.alertHeader}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <strong>Estoque Baixo</strong>
                <span className={styles.alertBadge}>{medicamentosEstoqueBaixo.length}</span>
              </div>
              <div className={styles.alertBody}>
                <p>Medicamentos com menos de {LIMITE_ESTOQUE_BAIXO} unidades em estoque:</p>
                <ul className={styles.alertList}>
                  {medicamentosEstoqueBaixo.slice(0, 5).map((med, idx) => {
                    const qtd = med.qtdAtual ?? med.qtdTotal ?? med.estoqueUnidades ?? 0;
                    return (
                      <li key={idx}>
                        <strong>{med.nome}</strong> - 
                        <span style={{ color: '#dc2626', fontWeight: '700' }}> {qtd} unidade(s)</span>
                      </li>
                    );
                  })}
                </ul>
                {medicamentosEstoqueBaixo.length > 5 && (
                  <p className={styles.alertMore}>+ {medicamentosEstoqueBaixo.length - 5} medicamento(s) adicional(is)</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SEÇÃO 1: METRICAS PRINCIPAIS */}
      <section className={styles.kpiGrid}>
        {/* CARD 1: MEDICAMENTOS NO CATÁLOGO */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Catálogo de Medicamentos</span>
            <div className={`${styles.iconBox} ${styles.blueIcon}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
                <path d="m8.5 8.5 7 7"/>
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>
            {totalMedicamentosCadastrados}
            <span className={styles.kpiUnit}>itens ativos</span>
          </div>
          <div className={styles.kpiFooter}>
            <span>Fármacos cadastrados no sistema</span>
          </div>
        </div>

        {/* CARD 2: TOTAL UNIDADES ESTOQUE */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Estoque Físico Total</span>
            <div className={`${styles.iconBox} ${styles.greenIcon}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                <path d="m3.3 7 8.7 5 8.7-5"/>
                <path d="M12 22V12"/>
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>
            {totalEstoqueUnidades.toLocaleString('pt-BR')}
            <span className={styles.kpiUnit}>unidades</span>
          </div>
          <div className={styles.kpiFooter}>
            <span>Soma do saldo de todos os lotes</span>
          </div>
        </div>

        {/* CARD 3: PACIENTES ATIVOS */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Pacientes Ativos</span>
            <div className={`${styles.iconBox} ${styles.indigoIcon}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>
            {pacientesAtivos}
            <span className={styles.kpiUnit}>em tratamento</span>
          </div>
          <div className={styles.kpiFooter}>
            <span>Processos judiciais em andamento</span>
          </div>
        </div>

        {/* CARD 4: TOTAL PACIENTES CADASTRADOS */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Base de Pacientes</span>
            <div className={`${styles.iconBox} ${styles.slateIcon}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>
            {totalPacientes}
            <span className={styles.kpiUnit}>pastas criadas</span>
          </div>
          <div className={styles.kpiFooter}>
            <span>Histórico total de cadastros</span>
          </div>
        </div>
      </section>

      {/* SEÇÃO 2: DETALHAMENTO & ATALHOS RÁPIDOS */}
      <div className={styles.contentGrid}>
        {/* STATUS DOS PACIENTES */}
        <div className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <h3>Status dos Processos Judiciais</h3>
            <span className={styles.cardSubtitle}>Distribuição por situação do paciente</span>
          </div>

          <div className={styles.statusList}>
            <div className={styles.statusRow}>
              <div className={styles.statusInfo}>
                <span className={`${styles.statusDot} ${styles.dotActive}`}></span>
                <span>Pacientes Ativos</span>
              </div>
              <div className={styles.statusMetrics}>
                <span className={styles.statusCount}>{pacientesAtivos}</span>
                <span className={styles.statusBadgeSuccess}>
                  {totalPacientes > 0 ? Math.round((pacientesAtivos / totalPacientes) * 100) : 0}%
                </span>
              </div>
            </div>

            <div className={styles.statusRow}>
              <div className={styles.statusInfo}>
                <span className={`${styles.statusDot} ${styles.dotInactive}`}></span>
                <span>Pacientes Inativos / Suspensos</span>
              </div>
              <div className={styles.statusMetrics}>
                <span className={styles.statusCount}>{pacientesInativos}</span>
                <span className={styles.statusBadgeWarning}>
                  {totalPacientes > 0 ? Math.round((pacientesInativos / totalPacientes) * 100) : 0}%
                </span>
              </div>
            </div>

            <div className={styles.statusRow}>
              <div className={styles.statusInfo}>
                <span className={`${styles.statusDot} ${styles.dotObito}`}></span>
                <span>Óbitos Registrados</span>
              </div>
              <div className={styles.statusMetrics}>
                <span className={styles.statusCount}>{pacientesObito}</span>
                <span className={styles.statusBadgeNeutral}>
                  {totalPacientes > 0 ? Math.round((pacientesObito / totalPacientes) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* AÇÕES RÁPIDAS */}
        <div className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <h3>Ações do Sistema</h3>
            <span className={styles.cardSubtitle}>Atalhos para operações frequentes</span>
          </div>

          <div className={styles.actionsGrid}>
            <button 
              type="button" 
              className={styles.actionBtn}
              onClick={() => onNavigate && onNavigate('DISPENSACAO')}
            >
              <div className={styles.actionIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </div>
              <div className={styles.actionText}>
                <strong>Registrar Dispensação</strong>
                <span>Realizar entrega de medicamento ao paciente</span>
              </div>
            </button>

            <button 
              type="button" 
              className={styles.actionBtn}
              onClick={() => onNavigate && onNavigate('ESTOQUE')}
            >
              <div className={styles.actionIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                </svg>
              </div>
              <div className={styles.actionText}>
                <strong>Dar Entrada em Lote</strong>
                <span>Adicionar saldo de novos lotes recebidos</span>
              </div>
            </button>

            <button 
              type="button" 
              className={styles.actionBtn}
              onClick={() => onNavigate && onNavigate('PACIENTES')}
            >
              <div className={styles.actionIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                </svg>
              </div>
              <div className={styles.actionText}>
                <strong>Cadastrar Paciente</strong>
                <span>Abrir nova pasta e número de processo</span>
              </div>
            </button>

            <button 
              type="button" 
              className={styles.actionBtn}
              onClick={() => onNavigate && onNavigate('RELATORIOS')}
            >
              <div className={styles.actionIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div className={styles.actionText}>
                <strong>Consultar Relatórios</strong>
                <span>Exportar histórico de movimentações</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* SEÇÃO 3: TABELA DE MEDICAMENTOS EM ESTOQUE */}
      <div className={styles.panelCard}>
        <div className={styles.panelHeader}>
          <h3>Visão Geral de Estoque por Medicamento</h3>
          <span className={styles.cardSubtitle}>
            Relação dos fármacos cadastrados e saldo atual disponível
          </span>
        </div>

        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 1rem', color: '#475569', fontWeight: '700' }}>Medicamento</th>
                <th style={{ padding: '0.75rem 1rem', color: '#475569', fontWeight: '700' }}>Tipo</th>
                <th style={{ padding: '0.75rem 1rem', color: '#475569', fontWeight: '700' }}>Dosagem</th>
                <th style={{ padding: '0.75rem 1rem', color: '#475569', fontWeight: '700', textAlign: 'right' }}>Estoque Disponível</th>
              </tr>
            </thead>
            <tbody>
              {medicamentosList.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    Nenhum medicamento cadastrado ou disponível no momento.
                  </td>
                </tr>
              ) : (
                medicamentosList.map((item, idx) => (
                  <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 1rem', color: '#1e293b', fontWeight: '600' }}>
                      {item.nome}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                      {item.tipo || '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                      {item.dosagem || '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <span className={styles.statusBadgeSuccess}>
                        {(item.qtdAtual ?? item.qtdTotal ?? item.estoqueUnidades ?? 0).toLocaleString('pt-BR')} un
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}