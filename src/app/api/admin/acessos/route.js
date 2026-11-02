import { NextResponse } from "next/server";
import { requireGestor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req) {
  try {
    await requireGestor();

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
          role: true,
          ultimoAcesso: true,
          acessos: {
            select: {
              modulo: true,
              nivel: true,
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
          role: true,
          ultimoAcesso: true,
          acessos: {
            select: {
              modulo: true,
              nivel: true,
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
      role: user.role,
      ultimoAcesso: user.ultimoAcesso,
      modulos: user.acessos.map((a) => ({
        modulo: a.modulo,
        nivel: a.nivel,
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
