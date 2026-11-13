import Link from "next/link";
import { carregarContextoAcesso, usuarioTemAcessoModulo, MODULOS } from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";

// Dashboard de Processos Judiciais — item do menu.
//
// Será desenvolvido/integrado em etapa posterior, a partir dos dados já
// existentes (processos_judiciais e o catálogo próprio). Aqui só a rota,
// com o número atual de processos como referência real (nada inventado).
export default async function DashboardProcessosPage() {
  const ctx = await carregarContextoAcesso();
  const permitido = ctx && (await usuarioTemAcessoModulo(ctx.user, MODULOS.PROCESSOS));
  if (!permitido) return <AcessoNegadoModulo modulo="Processos Judiciais" />;

  const { prisma } = await import("@/lib/prisma");
  const total = await prisma.processoJudicial.count();

  return (
    <div style={{ padding: "1.5rem", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: 0, fontSize: "1.5rem", color: "#0f172a" }}>
        Dashboard — Processos Judiciais
      </h1>
      <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
        Câmara Técnica › Processos Judiciais › Dashboard
      </p>

      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: "1.25rem",
          marginTop: "1rem",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700 }}>
          Processos cadastrados
        </p>
        <p style={{ margin: "0.35rem 0 0", fontSize: "2rem", fontWeight: 700, color: "#0f172a" }}>
          {total}
        </p>
        <p style={{ margin: "0.75rem 0 0", fontSize: "0.9rem", color: "#334155", lineHeight: 1.6 }}>
          Os indicadores completos (por especialidade, procedimento e período)
          serão integrados em etapa posterior, sobre os mesmos dados. Nada aqui é
          dado de exemplo.
        </p>
        <p style={{ margin: "0.75rem 0 0", fontSize: "0.9rem" }}>
          <Link href="/camara-tecnica/processos" style={{ color: "#1d4ed8", fontWeight: 600 }}>
            Ir para Processos Judiciais
          </Link>
        </p>
      </div>
    </div>
  );
}
