"use client";

// Botão único de situação: "Inativar" (vermelho) quando o registro está ativo,
// "Reativar" (azul) quando está inativo. A confirmação é feita pelo chamador
// (useConfirm), porque a mensagem depende do cadastro.

export default function AcoesSituacao({
  ativo,
  onAlternar,
  podeInativar = false,
  ocupado = false,
  rotuloInativar = "Inativar",
  rotuloReativar = "Reativar",
}) {
  if (!podeInativar) return null;

  const inativando = Boolean(ativo);

  return (
    <button
      type="button"
      className={inativando ? "cadBtnInativar" : "cadBtnReativar"}
      onClick={onAlternar}
      disabled={ocupado}
      title={
        inativando
          ? "Deixa de aparecer em novos cadastros; o histórico é preservado"
          : "Volta a aparecer nos cadastros"
      }
    >
      {ocupado ? "Aguarde…" : inativando ? rotuloInativar : rotuloReativar}
    </button>
  );
}
