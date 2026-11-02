'use client';

import { useState, useEffect } from 'react';
import { buscarHistoricoPedido } from './actions/auditoria';
import styles from './HistoricoPedidoModal.module.css';

export default function HistoricoPedidoModal({ pedidoId, onClose }) {
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (pedidoId) {
      carregarHistorico();
    }
  }, [pedidoId]);

  const carregarHistorico = async () => {
    setLoading(true);
    try {
      const dados = await buscarHistoricoPedido(pedidoId);
      setHistorico(dados);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (isoString) => {
    const data = new Date(isoString);
    return data.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getIconeAcao = (acao) => {
    switch (acao) {
      case 'CRIACAO':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        );
      case 'ALTERACAO':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        );
      case 'LIBERACAO':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        );
      case 'CANCELAMENTO':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        );
      default:
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4M12 8h.01"/>
          </svg>
        );
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Histórico de Alterações</h2>
          <button onClick={onClose} className={styles.closeBtn}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <span>Carregando histórico...</span>
            </div>
          ) : historico.length === 0 ? (
            <div className={styles.empty}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4M12 16h.01"/>
              </svg>
              <p>Nenhum registro de alteração encontrado para este pedido.</p>
            </div>
          ) : (
            <div className={styles.timeline}>
              {historico.map((item, idx) => (
                <div key={item.id} className={styles.timelineItem}>
                  <div className={styles.timelineMarker}>
                    {getIconeAcao(item.acao)}
                  </div>
                  <div className={styles.timelineContent}>
                    <div className={styles.timelineHeader}>
                      <strong className={styles.acaoLabel}>{item.acao}</strong>
                      <span className={styles.dataLabel}>{formatarData(item.dataHora)}</span>
                    </div>
                    
                    {item.campoAlterado && (
                      <div className={styles.alteracaoInfo}>
                        <div className={styles.campoLabel}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="m9 18 6-6-6-6"/>
                          </svg>
                          {item.campoAlterado}
                        </div>
                        <div className={styles.valoresGrid}>
                          {item.valorAnterior && (
                            <div className={styles.valorBox}>
                              <span className={styles.valorLabel}>De:</span>
                              <span className={styles.valorTexto}>{item.valorAnterior}</span>
                            </div>
                          )}
                          {item.valorNovo && (
                            <div className={styles.valorBox}>
                              <span className={styles.valorLabel}>Para:</span>
                              <span className={styles.valorTexto}>{item.valorNovo}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {item.observacao && (
                      <div className={styles.observacao}>
                        <span className={styles.obsLabel}>Observação:</span> {item.observacao}
                      </div>
                    )}

                    <div className={styles.usuario}>
                      Por: <strong>{item.usuarioNome}</strong> ({item.usuarioCpf})
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button onClick={onClose} className={styles.btnFechar}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
