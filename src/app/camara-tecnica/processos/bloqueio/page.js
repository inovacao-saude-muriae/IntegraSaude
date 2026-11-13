import Link from "next/link";
import { carregarContextoAcesso, usuarioTemAcessoModulo, MODULOS } from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";

// Realizar Bloqueio — item do menu Processos Judiciais.
//
// A funcionalidade será implementada em uma etapa posterior. Esta página
// apenas reserva a rota e explica a situação: nenhuma operação fictícia é
// oferecida (nada de botão que não faz nada ou grava dado de mentira).
export default async function BloqueioProcessosPage() {
  const ctx = await carregarContextoAcesso();
  const permitido = ctx && (await usuarioTemAcessoModulo(ctx.user, MODULOS.PROCESSOS));
  if (!permitido) return <AcessoNegadoModulo modulo="Processos Judiciais" />;

  return (
    <div style={{ padding: "1.5rem", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: 0, fontSize: "1.5rem", color: "#0f172a" }}>Realizar Bloqueio</h1>
      <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
        Câmara Técnica › Processos Judiciais › Realizar Bloqueio
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
        <p style={{ margin: 0, fontSize: "0.9rem", color: "#334155", lineHeight: 1.6 }}>
          O bloqueio de processos judiciais ainda não foi implementado. A rota e o
          item de menu estão preparados para receber a funcionalidade na próxima
          etapa — nenhuma operação fictícia é exibida aqui.
        </p>
        <p style={{ margin: "0.75rem 0 0", fontSize: "0.9rem" }}>
          <Link href="/camara-tecnica/processos" style={{ color: "#1d4ed8", fontWeight: 600 }}>
            Ir para Processos Judiciais (Novo Processo)
          </Link>
        </p>
      </div>
    </div>
  );
}
