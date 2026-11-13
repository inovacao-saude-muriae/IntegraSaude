import { NextResponse } from "next/server";
import { requirePermissaoGestao } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req) {
  try {
    await requirePermissaoGestao("acessos", "visualizar");

    const { searchParams } = new URL(req.url);
    const userCpf = searchParams.get("userCpf");
    const modulo = searchParams.get("modulo");
    const dataInicio = searchParams.get("dataInicio");
    const dataFim = searchParams.get("dataFim");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const where = {};

    if (userCpf) {
      where.cpf = userCpf;
    }

    if (dataInicio || dataFim) {
      where.ultimoAcesso = {};
      if (dataInicio) {
        where.ultimoAcesso.gte = new Date(dataInicio);
      }
      if (dataFim) {
        const endDate = new Date(dataFim);
        endDate.setHours(23, 59, 59, 999);
        where.ultimoAcesso.lte = endDate;
      }
    }

    // If modulo filter is provided, join with UserAcesso
    let users;
    let total;

    if (modulo) {
      // Filter by users who have access to the specified module
      const usersWithModuleAccess = await prisma.userAcesso.findMany({
        where: { modulo },
        select: { userCpf: true },
        distinct: ["userCpf"],
      });

      const userCpfs = usersWithModuleAccess.map((ua) => ua.userCpf);
      where.cpf = { in: userCpfs };

      total = await prisma.user.count({ where });
      users = await prisma.user.findMany({
        where,
        select: {
          cpf: true,
          nome: true,
          cargo: true,
          ultimoAcesso: true,
          acessos: {
            select: {
              modulo: true,
              perfil: true,
              escopo: true,
              ativo: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { ultimoAcesso: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      });
    } else {
      total = await prisma.user.count({ where });
      users = await prisma.user.findMany({
        where,
        select: {
          cpf: true,
          nome: true,
          cargo: true,
          ultimoAcesso: true,
          acessos: {
            select: {
              modulo: true,
              perfil: true,
              escopo: true,
              ativo: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { ultimoAcesso: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      });
    }

    // Transform data for response
    const acessos = users.map((user) => ({
      cpf: user.cpf,
      nome: user.nome,
      cargo: user.cargo,
      ultimoAcesso: user.ultimoAcesso,
      // Perfis vêm dos VÍNCULOS por módulo (um usuário pode ter perfis
      // diferentes em módulos diferentes). `users.role` não existe mais.
      modulos: user.acessos.map((a) => ({
        modulo: a.modulo,
        perfil: a.perfil,
        escopo: a.escopo,
        ativo: a.ativo,
        dataVinculo: a.createdAt,
      })),
    }));

    return NextResponse.json({
      success: true,
      data: acessos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Erro ao buscar acessos:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar histórico de acessos" },
      { status: 500 }
    );
  }
}
