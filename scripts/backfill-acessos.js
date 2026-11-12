#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BACKFILL DO CONTROLE DE ACESSO POR MÓDULO
 * ─────────────────────────────────────────────────────────────────────────
 * Preenche `perfil`, `servicos` e `permissoes` dos vínculos já existentes em
 * `user_acessos`, a partir do perfil legado (`users.role`) — o mesmo mapa
 * usado por `lib/roleAcessos.mapearRoleParaAcessos`.
 *
 * CARACTERÍSTICAS
 *  • Idempotente: só toca vínculos ainda não convertidos
 *    (`atualizado_em IS NULL`). Rodar duas vezes não muda nada na segunda.
 *  • Transacional: ou converte tudo, ou não converte nada.
 *  • Não concede privilégio novo: `nivel` e `servico_junta` não são alterados,
 *    e as permissões gravadas são exatamente o pacote padrão do perfil novo.
 *  • Não remove vínculo: nenhum DELETE.
 *  • Relatório: imprime, vínculo por vínculo, o antes e o depois; com
 *    `--json=arquivo` grava o relatório completo.
 *  • `--dry-run` mostra o relatório sem gravar.
 *
 * USO
 *   node scripts/backfill-acessos.js --dry-run
 *   node scripts/backfill-acessos.js
 *   node scripts/backfill-acessos.js --json=relatorio-acessos.json
 * ═══════════════════════════════════════════════════════════════════════════
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Pool } = require('pg');

// ── Mapa perfil legado → { perfil, servicos, funcionalidades por permissão } ─
// Mantido em sincronia com lib/roleAcessos.js e lib/permissoesCatalogo.js.
const PERFIS = {
  ADMINISTRADOR: 'ADMINISTRADOR',
  SUPERVISOR: 'SUPERVISOR',
  OPERADOR: 'OPERADOR',
  CONSULTA: 'CONSULTA',
  AUDITOR: 'AUDITOR',
};

const PACOTES = {
  REGULACAO: {
    ADMINISTRADOR: {
      novo_pedido: ['visualizar', 'criar', 'editar', 'excluir'],
      lista_espera: ['visualizar', 'editar', 'liberar', 'exportar'],
      liberados: ['visualizar', 'editar', 'liberar'],
      financeiro: ['visualizar', 'editar', 'exportar'],
      procedimentos: ['visualizar', 'criar', 'editar', 'excluir'],
      medicos: ['visualizar', 'criar', 'editar', 'excluir'],
      ubs: ['visualizar', 'criar', 'editar', 'excluir'],
      dashboard: ['visualizar', 'exportar'],
      auditoria: ['visualizar', 'exportar'],
    },
    SUPERVISOR: {
      novo_pedido: ['visualizar', 'criar', 'editar'],
      lista_espera: ['visualizar', 'editar', 'liberar', 'exportar'],
      liberados: ['visualizar', 'editar', 'liberar'],
      financeiro: ['visualizar'],
      dashboard: ['visualizar', 'exportar'],
    },
    OPERADOR: {
      novo_pedido: ['visualizar', 'criar', 'editar'],
      lista_espera: ['visualizar', 'editar', 'liberar'],
      liberados: ['visualizar', 'editar', 'liberar'],
      financeiro: ['visualizar'],
      dashboard: ['visualizar'],
    },
    CONSULTA: {
      novo_pedido: ['visualizar'],
      lista_espera: ['visualizar'],
      liberados: ['visualizar'],
      dashboard: ['visualizar'],
    },
    AUDITOR: {
      novo_pedido: ['visualizar'],
      lista_espera: ['visualizar', 'exportar'],
      liberados: ['visualizar'],
      financeiro: ['visualizar', 'exportar'],
      dashboard: ['visualizar', 'exportar'],
      auditoria: ['visualizar', 'exportar'],
    },
  },
  FARMACIA: {
    ADMINISTRADOR: {
      pacientes: ['visualizar', 'criar', 'editar'],
      medicamentos: ['visualizar', 'criar', 'editar', 'excluir'],
      estoque: ['visualizar', 'criar', 'editar', 'gerenciar'],
      dispensacao: ['visualizar', 'criar', 'dispensar', 'exportar'],
      relatorios: ['visualizar', 'exportar'],
      dashboard: ['visualizar', 'exportar'],
    },
    SUPERVISOR: {
      pacientes: ['visualizar', 'criar', 'editar'],
      medicamentos: ['visualizar'],
      estoque: ['visualizar', 'editar'],
      dispensacao: ['visualizar', 'criar', 'dispensar', 'exportar'],
      relatorios: ['visualizar', 'exportar'],
      dashboard: ['visualizar', 'exportar'],
    },
    OPERADOR: {
      pacientes: ['visualizar'],
      medicamentos: ['visualizar'],
      estoque: ['visualizar'],
      dispensacao: ['visualizar', 'criar', 'dispensar'],
      dashboard: ['visualizar'],
    },
    CONSULTA: {
      pacientes: ['visualizar'],
      medicamentos: ['visualizar'],
      estoque: ['visualizar'],
      dashboard: ['visualizar'],
    },
    AUDITOR: {
      pacientes: ['visualizar'],
      medicamentos: ['visualizar'],
      estoque: ['visualizar'],
      dispensacao: ['visualizar', 'exportar'],
      relatorios: ['visualizar', 'exportar'],
      dashboard: ['visualizar', 'exportar'],
    },
  },
  PROCESSOS: {
    ADMINISTRADOR: {
      novo_processo: ['criar'],
      consulta: ['visualizar', 'exportar'],
      movimentacoes: ['visualizar', 'criar', 'editar'],
      documentos: ['visualizar', 'criar', 'excluir', 'exportar'],
      acompanhamento: ['visualizar', 'editar', 'exportar'],
    },
    SUPERVISOR: {
      consulta: ['visualizar', 'exportar'],
      movimentacoes: ['visualizar', 'criar', 'editar'],
      documentos: ['visualizar', 'exportar'],
      acompanhamento: ['visualizar', 'editar', 'exportar'],
    },
    OPERADOR: {
      consulta: ['visualizar'],
      movimentacoes: ['visualizar', 'criar', 'editar'],
      documentos: ['visualizar', 'criar'],
    },
    CONSULTA: { consulta: ['visualizar'] },
    AUDITOR: {
      consulta: ['visualizar', 'exportar'],
      acompanhamento: ['visualizar', 'exportar'],
    },
  },
  JUNTA: {
    ADMINISTRADOR: {
      novo_pedido: ['visualizar', 'criar', 'editar'],
      servicos: ['visualizar', 'criar', 'editar', 'exportar'],
      agendas: ['visualizar', 'criar', 'editar', 'excluir'],
      prontuario: ['visualizar', 'exportar'],
      dashboard: ['visualizar', 'exportar'],
    },
    SUPERVISOR: {
      novo_pedido: ['visualizar', 'criar', 'editar'],
      servicos: ['visualizar', 'editar', 'exportar'],
      agendas: ['visualizar', 'criar', 'editar', 'excluir'],
      prontuario: ['visualizar', 'exportar'],
      dashboard: ['visualizar', 'exportar'],
    },
    OPERADOR: {
      novo_pedido: ['visualizar'],
      servicos: ['visualizar'],
      agendas: ['visualizar', 'criar', 'editar'],
      dashboard: ['visualizar'],
    },
    CONSULTA: {
      servicos: ['visualizar'],
      agendas: ['visualizar'],
      dashboard: ['visualizar'],
    },
    AUDITOR: {
      servicos: ['visualizar', 'exportar'],
      agendas: ['visualizar', 'exportar'],
      prontuario: ['visualizar', 'exportar'],
      dashboard: ['visualizar', 'exportar'],
    },
  },
  CCZ: {
    ADMINISTRADOR: {
      procedimentos: ['visualizar', 'criar', 'editar', 'excluir'],
      zoonoses: ['visualizar', 'criar', 'editar'],
      denuncias: ['visualizar', 'criar', 'editar', 'excluir'],
      agenda: ['visualizar', 'criar', 'editar', 'excluir'],
      animais: ['visualizar', 'criar', 'editar', 'excluir'],
      termos: ['visualizar', 'criar', 'editar', 'exportar'],
      tutores: ['visualizar', 'criar', 'editar'],
      dashboard: ['visualizar', 'exportar'],
    },
    SUPERVISOR: {
      procedimentos: ['visualizar', 'criar', 'editar'],
      zoonoses: ['visualizar', 'criar', 'editar'],
      denuncias: ['visualizar', 'criar', 'editar'],
      agenda: ['visualizar', 'criar', 'editar'],
      animais: ['visualizar', 'criar', 'editar'],
      termos: ['visualizar', 'criar', 'exportar'],
      tutores: ['visualizar', 'criar', 'editar'],
      dashboard: ['visualizar', 'exportar'],
    },
    OPERADOR: {
      procedimentos: ['visualizar', 'criar', 'editar'],
      zoonoses: ['visualizar', 'criar', 'editar'],
      denuncias: ['visualizar', 'criar', 'editar'],
      agenda: ['visualizar', 'criar', 'editar'],
      animais: ['visualizar', 'criar', 'editar'],
      termos: ['visualizar', 'criar', 'exportar'],
      tutores: ['visualizar', 'criar', 'editar'],
      dashboard: ['visualizar'],
    },
    CONSULTA: {
      procedimentos: ['visualizar'],
      zoonoses: ['visualizar'],
      denuncias: ['visualizar'],
      agenda: ['visualizar'],
      animais: ['visualizar'],
      termos: ['visualizar'],
      tutores: ['visualizar'],
      dashboard: ['visualizar'],
    },
    AUDITOR: {
      procedimentos: ['visualizar', 'exportar'],
      zoonoses: ['visualizar', 'exportar'],
      denuncias: ['visualizar', 'exportar'],
      agenda: ['visualizar', 'exportar'],
      animais: ['visualizar', 'exportar'],
      termos: ['visualizar', 'exportar'],
      tutores: ['visualizar', 'exportar'],
      dashboard: ['visualizar', 'exportar'],
    },
  },
};

// Perfil legado → perfil novo, por vínculo.
// JUNTA/OPERADOR com sub-serviço → OPERADOR restrito àquele serviço.
// JUNTA/OPERADOR sem sub-serviço (não ocorre hoje) → SUPERVISOR.
function converterVinculo(role, vinculo) {
  const { modulo, nivel, servico_junta: servicoJunta } = vinculo;

  // Gestão Geral: perfil com permissões administrativas próprias. A Gestão
  // Geral NÃO é módulo operacional — o acesso a cada módulo do GESTOR é
  // concedido como qualquer outro, vínculo por vínculo.
  if (role === 'GESTOR') {
    return { perfil: PERFIS.ADMINISTRADOR, servicos: [], motivo: 'Gestão Geral: permissões administrativas' };
  }

  let perfil;
  if (nivel === 'ADMIN') perfil = PERFIS.ADMINISTRADOR;
  else if (modulo === 'JUNTA' && servicoJunta) perfil = PERFIS.OPERADOR;
  else if (modulo === 'JUNTA') perfil = PERFIS.SUPERVISOR;
  else if (modulo === 'REGULACAO') perfil = PERFIS.SUPERVISOR;
  else perfil = PERFIS.OPERADOR;

  const servicos = servicoJunta ? [servicoJunta] : [];
  return { perfil, servicos, motivo: `Perfil legado ${role} (${nivel}${servicoJunta ? '/' + servicoJunta : ''})` };
}

function permissoesDoPacote(modulo, perfil) {
  const pacote = (PACOTES[modulo] || {})[perfil];
  if (!pacote) return [];
  const lista = [];
  for (const [funcionalidade, permissoes] of Object.entries(pacote)) {
    for (const p of permissoes) lista.push(`${funcionalidade}:${p}`);
  }
  return lista.sort();
}

// Permissões de exclusão que o perfil tinha antes e deixa de ter.
const EXCLUSOES_AFETADAS = {
  REGULACAO: ['novo_pedido:excluir'],
  CCZ: ['animais:excluir', 'denuncias:excluir', 'procedimentos:excluir', 'agenda:excluir'],
};

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const jsonArg = args.find((a) => a.startsWith('--json='));
  const jsonPath = jsonArg ? jsonArg.split('=')[1] : null;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  const relatorio = {
    geradoEm: new Date().toISOString(),
    dryRun,
    vinculos: [],
    resumo: {
      total: 0,
      convertidos: 0,
      jaConvertidos: 0,
      exclusoesRestringidas: 0,
      semPacote: 0,
    },
  };

  try {
    await client.query('BEGIN');

    // A migração pode ainda não ter rodado: detecta as colunas novas antes.
    const { rows: colunas } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'user_acessos' AND column_name IN ('perfil','servicos','permissoes','ativo','atualizado_por','atualizado_em')
    `);
    const migrado = colunas.length > 0;
    if (!migrado) {
      console.log('\n⚠  A migração 20261112120000_acesso_por_modulo ainda não foi aplicada.');
      console.log('   Nada a fazer por enquanto: as colunas perfil/servicos/permissoes não existem.\n');
      await client.query('ROLLBACK');
      return;
    }

    const { rows } = await client.query(`
      SELECT a.id, a.user_cpf, u.nome AS user_nome, u.role::text AS role,
             a.modulo::text AS modulo, a.nivel::text AS nivel,
             a.servico_junta::text AS servico_junta,
             a.perfil::text AS perfil_atual, a.atualizado_em
      FROM user_acessos a
      JOIN users u ON u.cpf = a.user_cpf
      ORDER BY u.nome, a.modulo, a.nivel
    `);

    relatorio.resumo.total = rows.length;

    for (const v of rows) {
      if (v.atualizado_em) {
        relatorio.resumo.jaConvertidos += 1;
        relatorio.vinculos.push({
          id: v.id,
          usuario: v.user_nome,
          cpf: v.user_cpf,
          role: v.role,
          modulo: v.modulo,
          nivel: v.nivel,
          servicoJunta: v.servico_junta,
          status: 'ja-convertido',
          perfil: v.perfil_atual,
        });
        continue;
      }

      const { perfil, servicos, motivo } = converterVinculo(v.role, v);
      const permissoes = permissoesDoPacote(v.modulo, perfil);
      if (permissoes.length === 0) relatorio.resumo.semPacote += 1;

      // Exclusões que deixam de ser permitidas para este perfil.
      const perdidas = (EXCLUSOES_AFETADAS[v.modulo] || []).filter(
        (p) => !permissoes.includes(p),
      );
      if (perdidas.length) relatorio.resumo.exclusoesRestringidas += 1;

      if (!dryRun) {
        await client.query(
          `UPDATE user_acessos
              SET perfil = $1::"PerfilModulo",
                  servicos = $2::text[],
                  permissoes = $3::text[],
                  ativo = true,
                  atualizado_por = NULL,
                  atualizado_em = now()
            WHERE id = $4 AND atualizado_em IS NULL`,
          [perfil, servicos, permissoes, v.id],
        );
      }

      relatorio.resumo.convertidos += 1;
      relatorio.vinculos.push({
        id: v.id,
        usuario: v.user_nome,
        cpf: v.user_cpf,
        role: v.role,
        modulo: v.modulo,
        nivel: v.nivel,
        servicoJunta: v.servico_junta,
        status: dryRun ? 'seria-convertido' : 'convertido',
        motivo,
        antes: { nivel: v.nivel, servicoJunta: v.servico_junta },
        depois: { perfil, servicos, permissoes: permissoes.length },
        exclusoesQueDeixamDeSerPermitidas: perdidas,
      });
    }

    if (dryRun) await client.query('ROLLBACK');
    else await client.query('COMMIT');

    // ── Impressão do relatório ─────────────────────────────────────────────
    console.log('');
    console.log('══════════════════════════════════════════════════════════════');
    console.log(dryRun ? ' SIMULAÇÃO (nada foi gravado)' : ' BACKFILL APLICADO');
    console.log('══════════════════════════════════════════════════════════════');
    for (const item of relatorio.vinculos) {
      console.log(`\n• ${item.usuario} (${item.cpf}) — perfil legado ${item.role}`);
      console.log(`  ${item.modulo}${item.servicoJunta ? '/' + item.servicoJunta : ''} (${item.nivel})`);
      if (item.status === 'ja-convertido') {
        console.log(`  já convertido — perfil ${item.perfil}`);
        continue;
      }
      console.log(`  → perfil ${item.depois.perfil}` +
        (item.depois.servicos.length ? ` | serviços: ${item.depois.servicos.join(', ')}` : ' | todos os serviços') +
        ` | ${item.depois.permissoes} permissões`);
      console.log(`  motivo: ${item.motivo}`);
      if (item.exclusoesQueDeixamDeSerPermitidas.length) {
        console.log(`  ⚠ EXCLUSÕES RESTRINGIDAS: ${item.exclusoesQueDeixamDeSerPermitidas.join(', ')}`);
      }
    }
    console.log('\n──────────────────────────────────────────────────────────────');
    console.log(`Vínculos: ${relatorio.resumo.total}` +
      ` | convertidos: ${relatorio.resumo.convertidos}` +
      ` | já convertidos: ${relatorio.resumo.jaConvertidos}`);
    console.log(`Vínculos com exclusão restringida: ${relatorio.resumo.exclusoesRestringidas}`);
    if (relatorio.resumo.semPacote) {
      console.log(`⚠ ${relatorio.resumo.semPacote} vínculo(s) sem pacote de permissões — revisar`);
    }
    console.log('──────────────────────────────────────────────────────────────\n');

    if (jsonPath) {
      fs.writeFileSync(jsonPath, JSON.stringify(relatorio, null, 2), 'utf8');
      console.log(`Relatório gravado em ${jsonPath}\n`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('ERRO — nada foi gravado:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
