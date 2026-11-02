import Link from 'next/link';
import styles from './page.module.css';

export const metadata = {
  title: 'Acesso Negado - IntegraSaúde',
  description: 'Você não tem permissão para acessar esta página',
};

// Mapeamento de cargos para nomes amigáveis
const CARGO_LABELS = {
  'GESTOR': 'Gestor Geral',
  'REGULACAO_ADMIN': 'Administrador da Regulação',
  'REGULACAO_COMUM': 'Usuário da Regulação',
  'FARMACIA_ADMIN': 'Farmácia Judicial',
  'PROCESSO_ADMIN': 'Processos Judiciais',
  'JUNTA_ADMIN': 'Administrador da Junta Reguladora',
  'JUNTA_CAEE': 'Usuário do CAEE',
  'JUNTA_EDUCACAO': 'Usuário da Educação',
  'JUNTA_SAUDE': 'Usuário da Saúde',
  'JUNTA_ASSISTENCIA': 'Usuário da Assistência Social',
  'CCZ_ADMIN': 'Administrador do CCZ',
  'CCZ_COMUM': 'Operador do CCZ',
};

export default function AcessoNegado({ searchParams }) {
  const rota = searchParams?.rota || 'esta página';
  const role = searchParams?.role || 'desconhecido';
  const cargoLabel = CARGO_LABELS[role] || role;

  return (
    <main className={styles.container}>
      <div className={styles.content}>
        <div className={styles.icon}>🚫</div>
        <h1 className={styles.title}>Acesso Negado</h1>
        <p className={styles.message}>
          Você não tem permissão para acessar: <strong>{rota}</strong>
        </p>
        <div className={styles.info}>
          <p className={styles.infoLabel}>Seu cargo atual:</p>
          <p className={styles.infoValue}>{cargoLabel}</p>
        </div>
        <p className={styles.submessage}>
          Cada usuário tem acesso apenas aos módulos específicos do seu cargo.
          Se você acredita que deveria ter acesso a esta área, entre em contato 
          com o administrador do sistema para revisar suas permissões.
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
