import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAcessoModulo } from "@/lib/auth";
import { MODULOS } from "@/lib/permissions";
import { registrarAuditoria } from "@/lib/audit";

export async function GET(request) {
  try {
    await requireAcessoModulo(MODULOS.CCZ);

    // Filtro por tipo ("AGRESSIVO" | "DOENTE"). Callers antigos sem o parâmetro
    // continuam recebendo todas as denúncias (where vazio).
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get("tipo");

    const denuncias = await prisma.denunciaCaoAgressivo.findMany({
      where: tipo ? { tipo } : undefined,
      include: {
        animal: true,
      },
      orderBy: { dataDenuncia: "desc" },
    });

    return NextResponse.json(denuncias);
  } catch (error) {
    console.error("Erro ao buscar denúncias:", error);
    return NextResponse.json(
      { error: "Erro ao buscar denúncias" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const user = await requireAcessoModulo(MODULOS.CCZ);

    const dados = await request.json();

    // Gerar próximo ID no formato DEN-XX
    const denuncias = await prisma.denunciaCaoAgressivo.findMany({
      where: {
        id: {
          startsWith: "DEN-"
        }
      },
      orderBy: { id: 'desc' },
      select: { id: true }
    });

    // Filtra apenas IDs no formato DEN-[número] e extrai o maior número
    let novoNumero = 1;
    for (const denuncia of denuncias) {
      const match = denuncia.id.match(/^DEN-(\d+)$/);
      if (match) {
        const numero = parseInt(match[1]);
        if (numero >= novoNumero) {
          novoNumero = numero + 1;
        }
      }
    }

    const novoId = `DEN-${String(novoNumero).padStart(2, '0')}`;

    const denuncia = await prisma.denunciaCaoAgressivo.create({
      data: {
        id: novoId,
        ...dados,
        tipo: dados.tipo || "AGRESSIVO",
      },
      include: {
        animal: true,
      },
    });

    await registrarAuditoria({
      user,
      acao: "CRIAR",
      modulo: "CCZ",
      entidade: "Denuncia",
      entidadeId: novoId,
      descricao: `Denúncia ${novoId} registrada`,
      detalhes: { tipo: denuncia.tipo },
    });

    return NextResponse.json(denuncia);
  } catch (error) {
    console.error("Erro ao criar denúncia:", error);
    return NextResponse.json(
      { error: "Erro ao criar denúncia" },
      { status: 500 }
    );
  }
}
