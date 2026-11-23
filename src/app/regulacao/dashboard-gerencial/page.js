import DashboardGerencial from "./DashboardGerencial";

// Dashboard Gerencial da Regulação — rota própria (/regulacao/dashboard-gerencial),
// protegida pelo layout do módulo (gate server-side) e, nas server actions,
// por requireAcessoModulo(MODULOS.REGULACAO).
export default function DashboardGerencialPage() {
  return <DashboardGerencial />;
}
