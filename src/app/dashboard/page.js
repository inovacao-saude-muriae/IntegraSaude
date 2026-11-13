'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './DashboardAdmin.module.css';

const formatarData = (valor) => {
  if (!valor) return '-';
  return new Date(valor).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatarDataHora = (valor) => {
  if (!valor) return '-';
  return new Date(valor).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function GestorDashboardPage() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/metrics', { cache: 'no-store' });

      if (!res.ok) {
        const corpo = await res.json().catch(() => ({}));
        throw new Error(corpo.error || 'Falha ao carregar as métricas gerenciais.');
      }

      const data = await res.json();
      setMetrics(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento inicial dos indicadores; comportamento intencional
    fetchMetrics();
  }, [fetchMetrics]);

  if (loading && !metrics) {
    return (
      <div className={styles.container}>
        <p>Carregando indicadores do sistema...</p>
      </div>
    );
  }

  // O Início é de TODOS os usuários autenticados. Quem não tem painel
  // gerencial (ex.: Operador do CCZ) recebe da API apenas o bloco mínimo —
  // nenhum indicador de módulo — e vê esta versão da página.
  const semPainel = metrics && !metrics.pessoas && !metrics.regulacao &&
    !metrics.farmacia && !metrics.junta && !metrics.ccz && !metrics.processos;

  if (semPainel) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>
              Bem-vindo(a), {metrics.inicio?.usuario || "usuário"}
            </h1>
            <p className={styles.subtitle}>
              Você tem acesso a {metrics.inicio?.modulos || 0} módulo
              {metrics.inicio?.modulos === 1 ? "" : "s"}. Use o menu lateral para
              começar a trabalhar.
            </p>
          </div>
        </div>
        <div className={styles.gridCards}>
          <div className={styles.card}>
            <span className={styles.cardLabel}>Seus módulos</span>
            <strong className={styles.cardNumber}>{metrics.inicio?.modulos || 0}</strong>
            <span className={styles.cardSubtext}>
              Os módulos liberados para você aparecem na Sidebar.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* CABEÇALHO */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Painel Gerencial</h1>
          <p className={styles.subtitle}>
            Visão consolidada dos módulos de Regulação, Farmácia Judicial e Junta Reguladora.
          </p>
        </div>
        <button className={styles.btnPrimary} onClick={fetchMetrics}>
          Atualizar
        </button>
      </div>

      {error && (
        <div className={styles.cardDanger}>
          <span className={styles.cardLabel}>Erro ao carregar dados</span>
          <span className={styles.cardSubtext}>{error}</span>
        </div>
      )}

      {metrics && (
        <>
          {/* KPIs PRINCIPAIS POR MÓDULO */}
          <div className={styles.gridCards}>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Pessoas cadastradas</span>
              <strong className={styles.cardNumber}>{metrics.pessoas.total}</strong>
              <span className={styles.cardSubtext}>Base compartilhada entre os módulos</span>
            </div>

            {/* Cada bloco só aparece se a API liberou aquele módulo para o
                usuário (admin do módulo ou GESTOR). Bloco não autorizado vem
                como null. */}
            {metrics.regulacao && (
              <div className={metrics.regulacao.aguardando > 0 ? styles.cardWarning : styles.card}>
                <span className={styles.cardLabel}>Regulação — aguardando</span>
                <strong className={styles.cardNumber}>{metrics.regulacao.aguardando}</strong>
                <span className={styles.cardSubtext}>
                  {metrics.regulacao.liberados} liberados de {metrics.regulacao.total} pedidos
                </span>
              </div>
            )}

            {metrics.farmacia && (
              <>
                <div className={styles.card}>
                  <span className={styles.cardLabel}>Farmácia — pacientes ativos</span>
                  <strong className={styles.cardNumber}>{metrics.farmacia.ativos}</strong>
                  <span className={styles.cardSubtext}>
                    {metrics.farmacia.total} pacientes judiciais no total
                  </span>
                </div>

                <div className={metrics.farmacia.estoqueUnidades > 0 ? styles.cardSuccess : styles.cardDanger}>
                  <span className={styles.cardLabel}>Estoque de medicamentos</span>
                  <strong className={styles.cardNumber}>{metrics.farmacia.estoqueUnidades}</strong>
                  <span className={styles.cardSubtext}>
                    unidades disponíveis · {metrics.farmacia.medicamentosAtivos} medicamentos ativos
                  </span>
                </div>
              </>
            )}

            {metrics.junta && (
              <div className={styles.card}>
                <span className={styles.cardLabel}>Junta Reguladora</span>
                <strong className={styles.cardNumber}>{metrics.junta.pacientes}</strong>
                <span className={styles.cardSubtext}>
                  pacientes · {metrics.junta.atendimentos} atendimentos
                </span>
              </div>
            )}

            {metrics.ccz && (
              <div className={styles.card}>
                <span className={styles.cardLabel}>CCZ</span>
                <strong className={styles.cardNumber}>{metrics.ccz.animais}</strong>
                <span className={styles.cardSubtext}>
                  animais cadastrados · {metrics.ccz.denuncias} denúncia(s)
                </span>
              </div>
            )}
          </div>

          {/* PAINÉIS DE APOIO */}
          <div className={styles.mainGrid}>
            {/* REGULAÇÃO POR CLASSIFICAÇÃO DE RISCO */}
            {metrics.regulacao && (
            <div className={styles.panel}>
              <h2>Regulação por classificação de risco</h2>
              <ul className={styles.moduleList}>
                {metrics.regulacao.risco.length > 0 ? (
                  metrics.regulacao.risco.map((item) => (
                    <li key={item.classificacao} className={styles.moduleItem}>
                      <strong>{item.classificacao}</strong>
                      <span className={styles.badgeWarning}>{item.total} pedido(s)</span>
                    </li>
                  ))
                ) : (
                  <p className={styles.cardSubtext}>Nenhum pedido registrado.</p>
                )}
              </ul>
            </div>
            )}

            {/* LOTES A VENCER */}
            {metrics.farmacia && (
            <div className={styles.panel}>
              <h2>Lotes a vencer (próximos 30 dias)</h2>
              <ul className={styles.moduleList}>
                {metrics.farmacia.lotesAVencer.length > 0 ? (
                  metrics.farmacia.lotesAVencer.map((lote) => (
                    <li key={lote.id} className={styles.moduleItem}>
                      <div>
                        <strong>{lote.medicamento}</strong>
                        <p>Lote {lote.numeroLote}</p>
                      </div>
                      <span className={styles.badgeWarning}>
                        Vence {formatarData(lote.dataValidade)}
                      </span>
                    </li>
                  ))
                ) : (
                  <p className={styles.cardSubtext}>Nenhum lote próximo do vencimento.</p>
                )}
              </ul>
            </div>
            )}

            {/* ATIVIDADE RECENTE (só GESTOR) */}
            {(metrics.atividadeRecente || []).length > 0 && (
            <div className={styles.panel} style={{ gridColumn: 'span 2' }}>
              <h2>Atividade recente do sistema</h2>
              <ul className={styles.logList}>
                {metrics.atividadeRecente.length > 0 ? (
                  metrics.atividadeRecente.map((item) => (
                    <li key={item.id} className={styles.logItem}>
                      <div>
                        <strong>{item.descricao}</strong>
                        <p>{item.modulo}</p>
                      </div>
                      <small className={styles.logTime}>{formatarDataHora(item.data)}</small>
                    </li>
                  ))
                ) : (
                  <p className={styles.cardSubtext}>Nenhuma atividade recente registrada.</p>
                )}
              </ul>
            </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
