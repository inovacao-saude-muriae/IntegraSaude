import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 401 });
    }

    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            cpf: true, // Usa o CPF como identificador
            nome: true,
            role: true,
            cargo: true,
            primeiroAcesso: true,
            // Ampliação ADITIVA (design §7.2): vínculos de acesso para os
            // consumidores novos. Os campos acima permanecem para não quebrar
            // a Sidebar e demais consumidores atuais (AC-16).
            acessos: {
              select: {
                modulo: true,
                nivel: true,
                servicoJunta: true,
              },
            },
          },
        },
      },
    });

    if (!session || (session.expiresAt && session.expiresAt < new Date())) {
      return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
    }


    return NextResponse.json(
      {
        user: {
          id: session.user.cpf, // Atribui o CPF no lugar do id para manter compatibilidade com o frontend
          nomeCompleto: session.user.nome,
          cpf: session.user.cpf,
          role: session.user.role,
          cargo: session.user.cargo || session.user.role,
          // Campos ADITIVOS (design §7.2 / AC-16): não substituem os acima.
          isGestor: session.user.role === "GESTOR",
          primeiroAcesso: session.user.primeiroAcesso ?? false, // ← Garantir que sempre retorna um boolean
          acessos: session.user.acessos,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro na rota /api/me:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}