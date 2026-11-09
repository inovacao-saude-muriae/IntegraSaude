'use client';

import { useState, useEffect } from 'react';
import styles from './GerenciarUsuarios.module.css';
import { useConfirm } from '@/components/ConfirmDialog';
import { mascararTelefone } from '@/lib/telefone';
import { usePagination } from '@/hooks/usePagination';
import Pagination from '@/components/Pagination';

export default function GerenciarUsuarios() {
  const confirm = useConfirm();
  const [cpf, setCpf] = useState('');
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [role, setRole] = useState('REGULACAO_COMUM');

  const [pessoaExiste, setPessoaExiste] = useState(false);
  const [buscandoCpf, setBuscandoCpf] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });

  // Estado para listar usuários existentes
  const [usuarios, setUsuarios] = useState([]);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(false);
  const [editandoUsuario, setEditandoUsuario] = useState(null);
  const [novoRoleEdicao, setNovoRoleEdicao] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  
  // Estado para controlar exibição do formulário
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  
  // Estado para busca e filtros (#8)
  const [buscaUsuario, setBuscaUsuario] = useState('');
  const [filtroRole, setFiltroRole] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  // Mapeia os perfis exatamente como definidos no Enum 'Role' do Prisma
  const obterNomePerfil = (perfilRole) => {
    switch (perfilRole) {
      case 'GESTOR':
        return 'Gestor Geral do Sistema';
      
      // REGULAÇÃO
      case 'REGULACAO_ADMIN':
        return 'Administrador da Regulação';
      case 'REGULACAO_COMUM':
        return 'Operador da Regulação';
      
      // CÂMARA TÉCNICA
      case 'FARMACIA_ADMIN':
        return 'Farmácia Judicial';
      case 'PROCESSO_ADMIN':
        return 'Processos Judiciais';
      
      // JUNTA REGULADORA
      case 'JUNTA_ADMIN':
        return 'Administrador da Junta Reguladora';
      case 'JUNTA_CAEE':
        return 'Operador do CAEE';
      case 'JUNTA_EDUCACAO':
        return 'Operador da APAE';
      case 'JUNTA_SAUDE':
        return 'Operador do Ambulatório';
      case 'JUNTA_ASSISTENCIA':
        return 'Operador do Centro de Especialidades';
      
      // CCZ
      case 'CCZ_ADMIN':
        return 'Administrador do CCZ';
      case 'CCZ_COMUM':
        return 'Operador do CCZ';
      
      default:
        return 'Operador do Sistema';
    }
  };

  // Busca automática ao digitar os 11 dígitos do CPF
  const handleCpfChange = async (e) => {
    const valorLimpo = e.target.value.replace(/\D/g, '');
    setCpf(valorLimpo);

    if (valorLimpo.length === 11) {
      setBuscandoCpf(true);
      setMensagem({ tipo: '', texto: '' });

      try {
        // Primeiro verifica se já existe um USUÁRIO com esse CPF
        const resUser = await fetch(`/api/gerenciamento/usuarios/${valorLimpo}`);
        const dataUser = await resUser.json();

        if (resUser.ok && dataUser.usuario) {
          // Usuário já existe no sistema
          setPessoaExiste(true);
          setNomeCompleto(dataUser.usuario.nome || '');
          setTelefone('');
          setMensagem({
            tipo: 'alerta',
            texto: `Este CPF já está cadastrado como usuário: ${dataUser.usuario.nome} (${dataUser.usuario.role})`,
          });
          setBuscandoCpf(false);
          return;
        }

        // Se não é usuário, busca na tabela de Pessoas
        const res = await fetch(`/api/pessoas/${valorLimpo}`);
        const data = await res.json();

        if (res.ok && data.pessoa) {
          setPessoaExiste(true);
          setNomeCompleto(data.pessoa.nomeCompleto || '');
          setTelefone(data.pessoa.telefone || '');
          setMensagem({
            tipo: 'sucesso',
            texto: 'Pessoa encontrada no sistema! Defina o perfil abaixo para criar acesso.',
          });
        } else {
          setPessoaExiste(false);
          setNomeCompleto('');
          setTelefone('');
          setMensagem({
            tipo: 'alerta',
            texto: 'CPF não encontrado. Preencha o nome completo para cadastrar.',
          });
        }
      } catch {
        setMensagem({ tipo: 'erro', texto: 'Erro ao verificar o CPF.' });
      } finally {
        setBuscandoCpf(false);
      }
    } else {
      setPessoaExiste(false);
      if (valorLimpo.length < 11) {
        setMensagem({ tipo: '', texto: '' });
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (cpf.length < 11) {
      setMensagem({ tipo: 'erro', texto: 'Informe um CPF válido com 11 dígitos.' });
      return;
    }

    const ok = await confirm({
      title: 'Cadastrar usuário',
      message: 'Deseja confirmar o cadastro deste usuário?',
      confirmText: 'Cadastrar',
    });
    if (!ok) return;

    setSalvando(true);
    setMensagem({ tipo: '', texto: '' });

    const cargoFormatado = obterNomePerfil(role);

    try {
      const res = await fetch('/api/gerenciamento/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpf,
          nomeCompleto,
          dataNascimento,
          telefone,
          role,
          cargo: cargoFormatado,
          // Senha padrão será definida no backend
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMensagem({
          tipo: 'sucesso',
          texto: `Usuário cadastrado com sucesso como "${cargoFormatado}"! Senha padrão: Integr@123`,
        });
        // Limpar formulário
        setCpf('');
        setNomeCompleto('');
        setDataNascimento('');
        setTelefone('');
        setRole('REGULACAO_COMUM');
        setPessoaExiste(false);
        // Recarregar lista e fechar formulário
        carregarUsuarios();
        setTimeout(() => {
          setMostrarFormulario(false);
        }, 2000);
      } else {
        setMensagem({ tipo: 'erro', texto: data.error || 'Erro ao salvar usuário.' });
      }
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Erro de conexão com o servidor.' });
    } finally {
      setSalvando(false);
    }
  };


  const carregarUsuarios = async () => {
    setCarregandoUsuarios(true);
    try {
      const res = await fetch('/api/gerenciamento/usuarios/listar');
      const data = await res.json();
      if (res.ok) {
        setUsuarios(data.usuarios || []);
      } else {
        setMensagem({ tipo: 'erro', texto: data.error || 'Erro ao carregar usuarios.' });
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    } finally {
      setCarregandoUsuarios(false);
    }
  };
  // Carregar lista de usuários ao montar o componente
  useEffect(() => {
    carregarUsuarios();
  }, []);

  // Filtros aplicados
  const usuariosFiltrados = usuarios.filter((user) => {
    // Filtro de busca por nome, CPF ou username
    if (buscaUsuario) {
      const termo = buscaUsuario.toLowerCase();
      const nomeMatch = user.nome?.toLowerCase().includes(termo);
      const cpfMatch = user.cpf?.replace(/\D/g, '').includes(termo.replace(/\D/g, ''));
      const usernameMatch = user.username?.toLowerCase().includes(termo);
      if (!nomeMatch && !cpfMatch && !usernameMatch) return false;
    }
    
    // Filtro por perfil/role
    if (filtroRole && user.role !== filtroRole) return false;
    
    // Filtro por status
    if (filtroStatus === 'ativo' && !user.ativo) return false;
    if (filtroStatus === 'inativo' && user.ativo) return false;
    
    return true;
  });

  // Paginação (#4)
  const {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    paginatedItems: usuariosPaginados,
    goToPage,
    resetPage
  } = usePagination(usuariosFiltrados, 20);

  // Reset página ao mudar filtros
  useEffect(() => {
    resetPage();
  }, [buscaUsuario, filtroRole, filtroStatus, resetPage]);

  const iniciarEdicao = (usuario) => {
    setEditandoUsuario(usuario.cpf);
    setNovoRoleEdicao(usuario.role);
  };

  const cancelarEdicao = () => {
    setEditandoUsuario(null);
    setNovoRoleEdicao('');
  };

  const salvarEdicaoRole = async (cpf) => {
    const ok = await confirm({
      title: 'Alterar nível de acesso',
      message: 'Deseja confirmar a alteração do perfil deste usuário?',
      confirmText: 'Confirmar',
    });
    if (!ok) return;

    setSalvandoEdicao(true);
    try {
      const res = await fetch('/api/gerenciamento/usuarios/alterar-role', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpf,
          novoRole: novoRoleEdicao,
          novoCargo: obterNomePerfil(novoRoleEdicao),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMensagem({
          tipo: 'sucesso',
          texto: 'Nível de acesso alterado com sucesso!',
        });
        setEditandoUsuario(null);
        carregarUsuarios(); // Recarrega a lista
      } else {
        setMensagem({ tipo: 'erro', texto: data.error || 'Erro ao alterar perfil.' });
      }
    } catch (error) {
      setMensagem({ tipo: 'erro', texto: 'Erro de conexão com o servidor.' });
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const desativarUsuario = async (cpf, nome) => {
    const ok = await confirm({
      title: 'Desativar usuário',
      message: `Deseja desativar o acesso de ${nome}?`,
      confirmText: 'Desativar',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      const res = await fetch('/api/gerenciamento/usuarios/desativar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf }),
      });

      const data = await res.json();

      if (res.ok) {
        setMensagem({
          tipo: 'sucesso',
          texto: 'Usuário desativado com sucesso!',
        });
        carregarUsuarios();
      } else {
        setMensagem({ tipo: 'erro', texto: data.error || 'Erro ao desativar usuário.' });
      }
    } catch (error) {
      setMensagem({ tipo: 'erro', texto: 'Erro de conexão com o servidor.' });
    }
  };

  const reativarUsuario = async (cpf, nome) => {
    const ok = await confirm({
      title: 'Reativar usuário',
      message: `Deseja reativar o acesso de ${nome}?`,
      confirmText: 'Reativar',
    });
    if (!ok) return;

    try {
      const res = await fetch('/api/gerenciamento/usuarios/reativar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf }),
      });

      const data = await res.json();

      if (res.ok) {
        setMensagem({
          tipo: 'sucesso',
          texto: 'Usuário reativado com sucesso!',
        });
        carregarUsuarios();
      } else {
        setMensagem({ tipo: 'erro', texto: data.error || 'Reativar usuário.' });
      }
    } catch (error) {
      setMensagem({ tipo: 'erro', texto: 'Erro de conexão com o servidor.' });
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div>
            <h1>Gerenciar Usuários</h1>
            <p>Gerencie os usuários que terão acesso ao sistema.</p>
          </div>
          {!mostrarFormulario && (
            <button 
              onClick={() => {
                setMostrarFormulario(true);
                setMensagem({ tipo: '', texto: '' });
              }} 
              className={styles.btnNovoUsuario}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <line x1="20" y1="8" x2="20" y2="14"/>
                <line x1="23" y1="11" x2="17" y2="11"/>
              </svg>
              Novo Usuário
            </button>
          )}
        </div>
      </header>

      {mensagem.texto && (
        <div className={`${styles.message} ${styles[mensagem.tipo]}`}>
          {mensagem.texto}
        </div>
      )}

      {mostrarFormulario && (
        <div className={styles.formCard}>
          <div className={styles.formCardHeader}>
            <h2>Cadastrar Novo Usuário</h2>
            <button 
              onClick={() => {
                setMostrarFormulario(false);
                setMensagem({ tipo: '', texto: '' });
                setCpf('');
                setNomeCompleto('');
                setDataNascimento('');
                setTelefone('');
                setPessoaExiste(false);
              }} 
              className={styles.btnFecharForm}
              type="button"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className={styles.form} autoComplete="off">
        {/* CPF COM VALIDAÇÃO/BUSCA AUTOMÁTICA */}
        <div className={styles.inputGroup}>
          <label className={styles.label}>CPF de Acesso (Login):</label>
          <div className={styles.relativeWrapper}>
            <input
              type="text"
              required
              value={cpf}
              onChange={handleCpfChange}
              placeholder="Digite os 11 dígitos do CPF"
              maxLength={11}
              autoComplete="off"
              className={styles.input}
            />
            {buscandoCpf && <span className={styles.searchingBadge}>Buscando...</span>}
          </div>
        </div>

        {/* NOME COMPLETO */}
        <div className={styles.inputGroup}>
          <label className={styles.label}>
            Nome Completo: {pessoaExiste && <small className={styles.registeredBadge}>Cadastrado</small>}
          </label>
          <input
            type="text"
            required
            disabled={pessoaExiste}
            value={nomeCompleto}
            onChange={(e) => setNomeCompleto(e.target.value)}
            className={`${styles.input} ${pessoaExiste ? styles.inputDisabled : ''}`}
            placeholder={pessoaExiste ? '' : 'Digite o nome do operador'}
            autoComplete="off"
          />
        </div>

        {/* DATA E TELEFONE */}
        <div className={styles.gridTwoCols}>
          <div>
            <label className={styles.fieldLabel}>Data de Nascimento</label>
            <input
              type="date"
              disabled={pessoaExiste}
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
              className={`${styles.input} ${pessoaExiste ? styles.inputDisabled : ''}`}
              autoComplete="off"
            />
          </div>
          <div>
            <label className={styles.fieldLabel}>Telefone</label>
            <input
              type="text"
              disabled={pessoaExiste}
              value={mascararTelefone(telefone)}
              onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
              placeholder="(00) 00000-0000"
              className={`${styles.input} ${pessoaExiste ? styles.inputDisabled : ''}`}
              autoComplete="off"
            />
          </div>
        </div>

        {/* PERFIL / PERMISSÃO DE ACESSO */}
        <div className={`${styles.inputGroup} ${styles.roleInputGroup}`}>
          <label className={styles.label}>Perfil / Módulo de Acesso:</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={styles.select}
          >
            {/* GESTOR GERAL */}
            <option value="GESTOR">GESTOR</option>
            
            {/* REGULAÇÃO */}
            <optgroup label="REGULAÇÃO DE EXAMES">
              <option value="REGULACAO_ADMIN">Administrador</option>
              <option value="REGULACAO_COMUM">Operador</option>
            </optgroup>

            {/* CÂMARA TÉCNICA */}
            <optgroup label="CÂMARA TÉCNICA">
              <option value="FARMACIA_ADMIN">Farmácia Judicial</option>
              <option value="PROCESSO_ADMIN">Processos Judiciais</option>
            </optgroup>

            {/* JUNTA REGULADORA */}
            <optgroup label="JUNTA REGULADORA">
              <option value="JUNTA_ADMIN">Administrador</option>
              <option value="JUNTA_CAEE">CAEE</option>
              <option value="JUNTA_EDUCACAO">APAE</option>
              <option value="JUNTA_SAUDE">Ambulatório</option>
              <option value="JUNTA_ASSISTENCIA">Centro de Especialidades</option>
            </optgroup>

            {/* CCZ */}
            <optgroup label="CCZ">
              <option value="CCZ_ADMIN">Administrador</option>
              <option value="CCZ_COMUM">Operador</option>
            </optgroup>
          </select>
          <span className={styles.roleSubtext}>
            Cargo exibido no sistema: <strong>{obterNomePerfil(role)}</strong>
          </span>
        </div>

        {/* NOTA SOBRE SENHA PADRÃO */}
        <div className={styles.infoBox}>
          <p className={styles.infoText}>
            ℹ️ <strong>Senha Padrão:</strong> Todos os novos usuários receberão a senha <strong>Integr@123</strong>
          </p>
          <p className={styles.infoSubtext}>
            O usuário será solicitado a trocar a senha no primeiro acesso ao sistema.
          </p>
        </div>

        <button
          type="submit"
          disabled={salvando || buscandoCpf}
          className={styles.submitButton}
        >
          {salvando ? 'Salvando...' : 'Concluir Cadastro de Usuário'}
        </button>
      </form>
        </div>
      )}

      {/* SEÇÃO DE USUÁRIOS CADASTRADOS */}
      <div className={styles.usuariosSection}>
        <div className={styles.sectionHeader}>
          <h2>Usuários do Sistema</h2>
          <button onClick={carregarUsuarios} className={styles.refreshButton} disabled={carregandoUsuarios}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
            {carregandoUsuarios ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>

        {/* BUSCA E FILTROS */}
        <div className={styles.searchFiltersBar}>
          <div className={styles.searchBox}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Buscar por nome, CPF ou username..."
              value={buscaUsuario}
              onChange={(e) => setBuscaUsuario(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          
          <select 
            value={filtroRole} 
            onChange={(e) => setFiltroRole(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">Todos os perfis</option>
            <option value="GESTOR">GESTOR</option>
            <optgroup label="REGULAÇÃO">
              <option value="REGULACAO_ADMIN">Administrador</option>
              <option value="REGULACAO_COMUM">Operador</option>
            </optgroup>
            <optgroup label="CÂMARA TÉCNICA">
              <option value="FARMACIA_ADMIN">Farmácia Judicial</option>
              <option value="PROCESSO_ADMIN">Processos Judiciais</option>
            </optgroup>
            <optgroup label="JUNTA REGULADORA">
              <option value="JUNTA_ADMIN">Administrador</option>
              <option value="JUNTA_CAEE">CAEE</option>
              <option value="JUNTA_EDUCACAO">APAE</option>
              <option value="JUNTA_SAUDE">Ambulatório</option>
              <option value="JUNTA_ASSISTENCIA">Centro de Especialidades</option>
            </optgroup>
            <optgroup label="CCZ">
              <option value="CCZ_ADMIN">Administrador</option>
              <option value="CCZ_COMUM">Operador</option>
            </optgroup>
          </select>
          
          <select 
            value={filtroStatus} 
            onChange={(e) => setFiltroStatus(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">Todos os status</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
          </select>
        </div>

        {carregandoUsuarios ? (
          <div className={styles.loadingState}>Carregando usuários...</div>
        ) : usuariosFiltrados.length === 0 ? (
          <div className={styles.emptyState}>Nenhum usuário encontrado com os filtros aplicados.</div>
        ) : (
          <>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>CPF</th>
                    <th>Perfil/Cargo</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosPaginados.map((user) => (
                  <tr key={user.cpf} className={!user.ativo ? styles.inactiveRow : ''}>
                    <td className={styles.nameCell}>
                      <div className={styles.userName}>{user.nome}</div>
                      {user.username && (
                        <div className={styles.userUsername}>@{user.username}</div>
                      )}
                    </td>
                    <td>{user.cpf}</td>
                    <td>
                      {editandoUsuario === user.cpf ? (
                        <select
                          value={novoRoleEdicao}
                          onChange={(e) => setNovoRoleEdicao(e.target.value)}
                          className={styles.selectInline}
                        >
                          <option value="GESTOR">GESTOR</option>
                          <optgroup label="REGULAÇÃO">
                            <option value="REGULACAO_ADMIN">Administrador</option>
                            <option value="REGULACAO_COMUM">Operador</option>
                          </optgroup>
                          <optgroup label="CÂMARA TÉCNICA">
                            <option value="FARMACIA_ADMIN">Farmácia Judicial</option>
                            <option value="PROCESSO_ADMIN">Processos Judiciais</option>
                          </optgroup>
                          <optgroup label="JUNTA REGULADORA">
                            <option value="JUNTA_ADMIN">Administrador</option>
                            <option value="JUNTA_CAEE">CAEE</option>
                            <option value="JUNTA_EDUCACAO">APAE</option>
                            <option value="JUNTA_SAUDE">Ambulatório</option>
                            <option value="JUNTA_ASSISTENCIA">Centro de Especialidades</option>
                          </optgroup>
                          <optgroup label="CCZ">
                            <option value="CCZ_ADMIN">Administrador</option>
                            <option value="CCZ_COMUM">Operador</option>
                          </optgroup>
                        </select>
                      ) : (
                        <div>
                          <div className={styles.roleLabel}>{user.role}</div>
                          <div className={styles.cargoLabel}>{user.cargo}</div>
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={user.ativo ? styles.statusAtivo : styles.statusInativo}>
                        {user.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionButtons}>
                        {editandoUsuario === user.cpf ? (
                          <>
                            <button
                              onClick={() => salvarEdicaoRole(user.cpf)}
                              className={styles.btnSave}
                              disabled={salvandoEdicao}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                              Salvar
                            </button>
                            <button
                              onClick={cancelarEdicao}
                              className={styles.btnCancel}
                              disabled={salvandoEdicao}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => iniciarEdicao(user)}
                              className={styles.btnEdit}
                              disabled={!user.ativo}
                              title="Alterar nível de acesso"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                              Editar
                            </button>
                            {user.ativo ? (
                              <button
                                onClick={() => desativarUsuario(user.cpf, user.nome)}
                                className={styles.btnDeactivate}
                                title="Desativar acesso"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10"/>
                                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                                </svg>
                                Desativar
                              </button>
                            ) : (
                              <button
                                onClick={() => reativarUsuario(user.cpf, user.nome)}
                                className={styles.btnActivate}
                                title="Reativar acesso"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                  <polyline points="22 4 12 14.01 9 11.01"/>
                                </svg>
                                Reativar
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={goToPage}
          />
        </>
        )}
      </div>
    </div>
  );
}
