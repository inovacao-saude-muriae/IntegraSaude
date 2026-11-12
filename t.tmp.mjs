// Teste DINÂMICO: chama as server actions reais contra o banco de
// desenvolvimento, com sessão válida, e confere quem entra e quem é barrado.
import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';

const tokenJefinny = execSync('cat .tmp-token-12912453674.txt').toString().trim();
const tokenAdmin = execSync('cat .tmp-token-00000000000.txt').toString().trim();

console.log('Teste dinâmico preparado. Tokens:',
  tokenJefinny ? 'jefinny ok' : 'FALTA', tokenAdmin ? 'admin ok' : 'FALTA');
