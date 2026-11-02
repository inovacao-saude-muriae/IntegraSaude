require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Função para decodificar JWT sem verificar assinatura
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch (error) {
    return null;
  }
}

async function diagnosticoCompleto() {
  try {
    console.log('\n========================================');
    console.log('🔍 DIAGNÓSTICO COMPLETO - PRIMEIRO ACESSO');
    console.log('========================================\n');

    const cpf = '12912453674';

    // 1. Verificar usuário no banco
    console.log('1️⃣ VERIFICANDO BANCO DE DADOS:');
    console.log('─────────────────────────────────────');
    
    const user = await prisma.user.findUnique({
      where: { cpf },
      include: {
        acessos: true,
        sessions: true
      }
    });

    if (!user) {
      console.log('❌ Usuário não encontrado no banco!');
      return;
    }

    console.log('✅ Usuário encontrado:');
    console.log(`   Nome: ${user.nome}`);
    console.log(`   CPF: ${user.cpf}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   primeiroAcesso: ${user.primeiroAcesso ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`   Acessos: ${user.acessos.length} módulos configurados`);

    // 2. Verificar sessões ativas
    console.log('\n2️⃣ VERIFICANDO SESSÕES ATIVAS:');
    console.log('─────────────────────────────────────');
    
    if (user.sessions.length === 0) {
      console.log('⚠️  Nenhuma sessão ativa encontrada');
    } else {
      console.log(`✅ ${user.sessions.length} sessão(ões) encontrada(s):\n`);
      
      user.sessions.forEach((session, index) => {
        console.log(`   Sessão ${index + 1}:`);
        
        try {
          const decoded = decodeJWT(session.token);
          console.log(`   Token criado: ${new Date(session.createdAt).toLocaleString()}`);
          console.log(`   Token expira: ${new Date(session.expiresAt).toLocaleString()}`);
          console.log(`   JWT Payload:`);
          console.log(`     - nome: ${decoded.nome}`);
          console.log(`     - cpf: ${decoded.cpf}`);
          console.log(`     - role: ${decoded.role}`);
          console.log(`     - primeiroAcesso: ${decoded.primeiroAcesso ? '✅ SIM' : '❌ NÃO'}`);
          console.log(`     - acessos: ${decoded.acessos?.length || 0} módulos`);
        } catch (error) {
          console.log(`   ❌ Erro ao decodificar JWT: ${error.message}`);
        }
        console.log('');
      });
    }

    // 3. Simular resposta da API /api/me
    console.log('3️⃣ SIMULANDO RESPOSTA DA API /api/me:');
    console.log('─────────────────────────────────────');
    
    const apiResponse = {
      user: {
        nome: user.nome,
        cpf: user.cpf,
        role: user.role,
        primeiroAcesso: user.primeiroAcesso ?? false,
        acessos: user.acessos.map(a => ({
          moduloId: a.moduloId,
          nivel: a.nivel
        }))
      }
    };

    console.log('Resposta esperada:');
    console.log(JSON.stringify(apiResponse, null, 2));

    // 4. Verificar lógica do frontend
    console.log('\n4️⃣ VERIFICANDO LÓGICA DO FRONTEND:');
    console.log('─────────────────────────────────────');
    
    const primeiroAcesso = apiResponse.user.primeiroAcesso;
    console.log(`dataUser.user?.primeiroAcesso = ${primeiroAcesso}`);
    console.log(`Condição: dataUser.user?.primeiroAcesso === true`);
    console.log(`Resultado: ${primeiroAcesso === true ? '✅ VERDADEIRO (deve mostrar modal)' : '❌ FALSO (não mostra modal)'}`);

    // 5. Diagnóstico final
    console.log('\n5️⃣ DIAGNÓSTICO FINAL:');
    console.log('─────────────────────────────────────');
    
    const problemas = [];
    
    if (!user.primeiroAcesso) {
      problemas.push('❌ Campo primeiroAcesso está FALSE no banco');
    }
    
    if (user.sessions.length === 0) {
      problemas.push('⚠️  Usuário não possui sessão ativa - precisa fazer login');
    } else {
      const sessionAtual = user.sessions[0];
      try {
        const decoded = decodeJWT(sessionAtual.token);
        if (!decoded.primeiroAcesso) {
          problemas.push('❌ JWT não contém primeiroAcesso=true - sessão foi criada antes da atualização');
        }
      } catch (error) {
        problemas.push('❌ Erro ao decodificar JWT da sessão');
      }
    }

    if (problemas.length === 0) {
      console.log('✅ TUDO ESTÁ CORRETO NO BACKEND!');
      console.log('\n💡 POSSÍVEIS CAUSAS NO FRONTEND:');
      console.log('   1. Cache do navegador com dados antigos');
      console.log('   2. Cookie de sessão antigo (fazer logout completo)');
      console.log('   3. Componente ModalTrocarSenha não está sendo importado corretamente');
      console.log('   4. Estado React não está atualizando (verificar console do navegador)');
      console.log('   5. Erro de JavaScript impedindo a renderização');
      console.log('\n🔧 AÇÕES RECOMENDADAS:');
      console.log('   1. Limpar todos os cookies do site');
      console.log('   2. Fazer logout completo');
      console.log('   3. Fechar e abrir o navegador');
      console.log('   4. Fazer login novamente');
      console.log('   5. Abrir console do navegador (F12) e verificar logs');
    } else {
      console.log('⚠️  PROBLEMAS ENCONTRADOS:');
      problemas.forEach(p => console.log(`   ${p}`));
      
      console.log('\n🔧 AÇÕES CORRETIVAS:');
      if (!user.primeiroAcesso) {
        console.log('   • Execute: node prisma/set-primeiro-acesso.js');
      }
      if (sessions.length > 0) {
        const sessionAtual = sessions[0];
        try {
          const decoded = jwt.decode(sessionAtual.token);
          if (!decoded.primeiroAcesso) {
            console.log('   • Execute: node prisma/clear-sessions.js');
            console.log('   • Depois faça login novamente');
          }
        } catch (error) {
          console.log('   • Execute: node prisma/clear-sessions.js');
        }
      }
    }

    console.log('\n========================================\n');

  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnosticoCompleto();
