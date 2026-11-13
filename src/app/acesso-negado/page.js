import Link from 'next/link';
import styles from './page.module.css';

export const metadata = {
  title: 'Acesso Negado - IntegraSaúde',
  description: 'Você não tem permissão para acessar esta página',
};

export default function AcessoNegado({ searchParams }) {
  const rota = searchParams?.rota || 'esta página';
  // Não existe mais "perfil do usuário" (`users.role`): a autorização é por
  // módulo. A página mostra só a rota pedida e como pedir revisão de acesso.
  const modulo = searchParams?.modulo || null;

  return (
    <main className={styles.container}>
      <div className={styles.content}>
        <div className={styles.icon}>🚫</div>
        <h1 className={styles.title}>Acesso Negado</h1>
        <p className={styles.message}>
          Você não tem permissão para acessar: <strong>{rota}</strong>
        </p>
        {modulo && (
          <div className={styles.info}>
            <p className={styles.infoLabel}>Módulo:</p>
            <p className={styles.infoValue}>{modulo}</p>
          </div>
        )}
        <p className={styles.submessage}>
          O acesso é concedido módulo por módulo, com perfil, serviços e
          permissões definidos pela Gestão Geral. Se você acredita que deveria
          ter acesso a esta área, peça a revisão das suas permissões.
        </p>
        <div className={styles.actions}>
          <Link href="/dashboard" className={styles.button}>
            Voltar ao Dashboard
          </Link>
          <Link href="/login" className={styles.buttonSecondary}>
            Fazer Login com Outro Usuário
          </Link>
        </div>
      </div>
    </main>
  );
}
