import { NextResponse } from 'next/server';
import { carregarSessao } from '@/lib/auth';

// /api/me — dados do usuário autenticado.
// A sessão vem da fonte única (lib/auth): cookie presente, sessão registrada no
// banco, não expirada e usuário ativo. Não há leitura de cookie solta aqui.
export async function GET() {
  try {
    const ctx = await carregarSessao();
    if (!ctx) {
      return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
    }

    const user = ctx.user;

    return NextResponse.json(
      {
        user: {
          id: user.cpf, // CPF como identificador (compatibilidade com o frontend)
          nomeCompleto: user.nome,
          cpf: user.cpf,
          role: user.role,
          cargo: user.cargo || user.role,
          isGestor: user.role === 'GESTOR',
          primeiroAcesso: user.primeiroAcesso ?? false,
          acessos: (user.acessos || []).map((a) => ({
            modulo: a.modulo,
            nivel: a.nivel,
            servicoJunta: a.servicoJunta,
          })),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro na rota /api/me:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
