'use client';

import { useEffect, useState } from 'react';
import GerenciarUsuarios from '@/components/GerenciarUsuarios/GerenciarUsuarios';
import GerenciarAcessos from '@/components/GerenciarUsuarios/GerenciarAcessos';
import styles from '@/components/GerenciarUsuarios/GerenciarAcessos.module.css';

// Duas frentes do gerenciamento:
//  • "Acessos por módulo" — configuração individual (perfil, escopo, serviços,
//    funcionalidades e permissões) de cada vínculo. É a tela principal.
//  • "Contas" — cadastro de usuário e situação da conta.
export default function AdminUsuariosPage() {
  const [aba, setAba] = useState('acessos');
  // A aba "Contas" pede para abrir a configuração de um usuário específico:
  // evento `integra:abrir-acessos` com { cpf }. A aba de acessos escuta.
  const [cpfPedido, setCpfPedido] = useState(null);

  useEffect(() => {
    function aoAbrirAcessos(e) {
      setCpfPedido(e.detail?.cpf || null);
      setAba('acessos');
    }
    window.addEventListener('integra:abrir-acessos', aoAbrirAcessos);
    return () => window.removeEventListener('integra:abrir-acessos', aoAbrirAcessos);
  }, []);

  return (
    <div className={styles.pagina}>
      <div className={styles.abas} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={aba === 'acessos'}
          className={`${styles.aba} ${aba === 'acessos' ? styles.abaAtiva : ''}`}
          onClick={() => setAba('acessos')}
        >
          Acessos por módulo
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={aba === 'contas'}
          className={`${styles.aba} ${aba === 'contas' ? styles.abaAtiva : ''}`}
          onClick={() => setAba('contas')}
        >
          Contas
        </button>
      </div>

      {aba === 'acessos' ? (
        <GerenciarAcessos cpfInicial={cpfPedido} />
      ) : (
        <GerenciarUsuarios />
      )}
    </div>
  );
}
