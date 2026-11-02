"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./DashboardCCZ.module.css";
import {
  listarTutoresComAnimais,
  listarAnimais,
  listarProcedimentos,
  listarEsporotricose,
  listarZoonoses,
  listarDenuncias,
} from "./actions";

export default function DashboardCCZ() {
  const router = useRouter();
  const [stats, setStats] = useState({
    tutores: 0,
    animais: 0,
    animaisComTutor: 0,
    animaisSemTutor: 0,
    procedimentos: 0,
    esporotricose: 0,
    zoonoses: 0,
    denuncias: 0,
  });
  const [procedimentosPorTipo, setProcedimentosPorTipo] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregarStats() {
      setLoading(true);
      
      try {
        const [tutoresRes, animaisRes, procedimentosRes, esporoRes, zoonosesRes, denunciasRes] = 
          await Promise.all([
            listarTutoresComAnimais(),
            listarAnimais(),
            listarProcedimentos(),
            listarEsporotricose(),
            listarZoonoses(),
            listarDenuncias(),
          ]);

        const animaisData = animaisRes.success ? animaisRes.data : [];
        const animaisComTutor = animaisData.filter(a => a.tutorNome && a.tutorNome.trim() !== "");
        const animaisSemTutor = animaisData.filter(a => !a.tutorNome || a.tutorNome.trim() === "");

        // Agrupar procedimentos por tipo
        const procedimentosData = procedimentosRes.success ? procedimentosRes.data : [];
        const tiposMap = {};
        procedimentosData.forEach(proc => {
          const tipo = proc.tipo || "Não especificado";
          tiposMap[tipo] = (tiposMap[tipo] || 0) + 1;
        });

        const tiposArray = Object.entries(tiposMap)
          .map(([tipo, count]) => ({ tipo, count }))
          .sort((a, b) => b.count - a.count);

        setProcedimentosPorTipo(tiposArray);

        const newStats = {
          tutores: tutoresRes.success ? tutoresRes.data.length : 0,
          animais: animaisData.length,
          animaisComTutor: animaisComTutor.length,
          animaisSemTutor: animaisSemTutor.length,
          procedimentos: procedimentosRes.success ? procedimentosRes.data.length : 0,
          esporotricose: esporoRes.success ? esporoRes.data.length : 0,
          zoonoses: zoonosesRes.success ? zoonosesRes.data.length : 0,
          denuncias: denunciasRes.success ? denunciasRes.data.length : 0,
        };

        console.log("[Dashboard] Stats carregadas:", newStats);
        setStats(newStats);
      } catch (err) {
        console.error("Erro ao carregar estatísticas:", err);
      } finally {
        setLoading(false);
      }
    }

    carregarStats();
  }, []);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  const navegarPara = (tab, subTab = "LISTA") => {
    router.push(`/ccz?tab=${tab}&subTab=${subTab}`);
  };

  return (
    <div className={styles.container}>
      {/* KPIs PRINCIPAIS */}
      <section className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} ${styles.clickable}`} onClick={() => navegarPara("TUTORES")}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Tutores Cadastrados</span>
            <div className={`${styles.iconBox} ${styles.indigoIcon}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>{stats.tutores}<span className={styles.kpiUnit}>tutores</span></div>
          <div className={styles.kpiFooter}>Responsáveis pelos animais cadastrados</div>
        </div>

        <div className={`${styles.kpiCard} ${styles.clickable}`} onClick={() => navegarPara("ANIMAIS")}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Animais Registrados</span>
            <div className={`${styles.iconBox} ${styles.greenIcon}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="4" r="2" />
                <circle cx="18" cy="8" r="2" />
                <circle cx="20" cy="16" r="2" />
                <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" />
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>{stats.animais}<span className={styles.kpiUnit}>animais</span></div>
          <div className={styles.kpiFooter}>Total de animais no sistema</div>
        </div>

        <div className={`${styles.kpiCard} ${styles.clickable}`} onClick={() => navegarPara("ANIMAIS")}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Animais com Tutor</span>
            <div className={`${styles.iconBox} ${styles.greenIcon}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>{stats.animaisComTutor}<span className={styles.kpiUnit}>animais</span></div>
          <div className={styles.kpiFooter}>Animais com responsável cadastrado</div>
        </div>

        <div className={`${styles.kpiCard} ${styles.clickable}`} onClick={() => navegarPara("ANIMAIS")}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Animais sem Tutor</span>
            <div className={`${styles.iconBox} ${styles.yellowIcon}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>{stats.animaisSemTutor}<span className={styles.kpiUnit}>animais</span></div>
          <div className={styles.kpiFooter}>Animais sem responsável identificado</div>
        </div>

        <div className={`${styles.kpiCard} ${styles.clickable}`} onClick={() => navegarPara("PROCEDIMENTOS")}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Procedimentos</span>
            <div className={`${styles.iconBox} ${styles.yellowIcon}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.5 2 9 7.5l-7 7a2.12 2.12 0 0 0 3 3l7-7L17.5 5" />
                <path d="m14 7 3 3" />
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>{stats.procedimentos}<span className={styles.kpiUnit}>registros</span></div>
          <div className={styles.kpiFooter}>Vacinas, consultas e outros atendimentos</div>
        </div>

        <div className={`${styles.kpiCard} ${styles.clickable}`} onClick={() => navegarPara("ESPOROTRICOSE")}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Esporotricose</span>
            <div className={`${styles.iconBox} ${styles.yellowIcon}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="1" />
                <circle cx="19" cy="12" r="1" />
                <circle cx="5" cy="12" r="1" />
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>{stats.esporotricose}<span className={styles.kpiUnit}>casos</span></div>
          <div className={styles.kpiFooter}>Casos em monitoramento</div>
        </div>

        <div className={`${styles.kpiCard} ${styles.clickable}`} onClick={() => navegarPara("ZOONOSES")}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Outras Zoonoses</span>
            <div className={`${styles.iconBox} ${styles.redIcon}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>{stats.zoonoses}<span className={styles.kpiUnit}>notificações</span></div>
          <div className={styles.kpiFooter}>Notificações de outras doenças</div>
        </div>

        <div className={`${styles.kpiCard} ${styles.clickable}`} onClick={() => navegarPara("DENUNCIAS")}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Denúncias</span>
            <div className={`${styles.iconBox} ${styles.redIcon}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8.7 3A6 6 0 0 1 15 9a6 6 0 0 1-1.2 3.6L21 20l-2.8 2.8-7.4-7.2A6 6 0 1 1 8.7 3Z" />
                <circle cx="9" cy="9" r="2" />
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>{stats.denuncias}<span className={styles.kpiUnit}>registros</span></div>
          <div className={styles.kpiFooter}>Denúncias de cães agressivos</div>
        </div>

        {/* GRÁFICO DE PROCEDIMENTOS POR TIPO */}
        <div className={styles.chartPanel}>
          <div className={styles.panelHeader}>
            <h3>Procedimentos por Tipo</h3>
            <span className={styles.cardSubtitle}>
              Distribuição dos {stats.procedimentos} procedimentos registrados
            </span>
          </div>
          
          {procedimentosPorTipo.length === 0 ? (
            <div className={styles.emptyState}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.5 2 9 7.5l-7 7a2.12 2.12 0 0 0 3 3l7-7L17.5 5" />
                <path d="m14 7 3 3" />
              </svg>
              <p>Nenhum procedimento registrado ainda.</p>
            </div>
          ) : (
            <div className={styles.chartContainer}>
              {procedimentosPorTipo.map((item, index) => {
                const maxCount = procedimentosPorTipo[0]?.count || 1;
                const percentage = (item.count / maxCount) * 100;
                
                // Cores alternadas para as barras
                const colors = [
                  '#3b82f6', // azul
                  '#8b5cf6', // roxo
                  '#06b6d4', // ciano
                  '#10b981', // verde
                  '#f59e0b', // âmbar
                  '#ef4444', // vermelho
                  '#ec4899', // rosa
                ];
                const color = colors[index % colors.length];

                return (
                  <div key={item.tipo} className={styles.chartRow}>
                    <div className={styles.chartLabel}>
                      <span className={styles.chartLabelText}>{item.tipo}</span>
                      <span className={styles.chartLabelCount}>{item.count}</span>
                    </div>
                    <div className={styles.chartBarContainer}>
                      <div 
                        className={styles.chartBar}
                        style={{ 
                          width: `${percentage}%`,
                          backgroundColor: color 
                        }}
                      >
                        <span className={styles.chartBarLabel}>
                          {((item.count / stats.procedimentos) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
