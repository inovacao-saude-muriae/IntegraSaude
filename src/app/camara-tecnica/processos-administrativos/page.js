import { carregarContextoAcesso, usuarioTemAcessoModulo, MODULOS } from "@/lib/permissions";
import AcessoNegadoModulo from "@/components/AcessoNegadoModulo";

// Processos Administrativos — área separada, para desenvolvimento futuro.
// Usará o mesmo catálogo próprio da área Processos quando as regras de
// negócio forem definidas. Nenhuma operação fictícia aqui.
export default async function ProcessosAdministrativosPage() {
  const ctx = await carregarContextoAcesso();
  const permitido = ctx && (await usuarioTemAcessoModulo(ctx.user, MODULOS.PROCESSOS));
  if (!permitido) return <AcessoNegadoModulo modulo="Processos" />;

  return (
    <div style={{ padding: "1.5rem", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: 0, fontSize: "1.5rem", color: "#0f172a" }}>
        Processos Administrativos
      </h1>
      <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
        Câmara Técnica › Processos Administrativos
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
          Área reservada para desenvolvimento futuro. Os Processos Administrativos
          poderão utilizar o mesmo catálogo de Especialidades e Procedimentos da
          área Processos, quando as regras de negócio forem definidas.
        </p>
      </div>
    </div>
  );
}
