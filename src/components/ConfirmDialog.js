"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useModalKeyboard } from "@/hooks/useModalKeyboard";
import styles from "./ConfirmDialog.module.css";

const ConfirmContext = createContext(null);
const AlertContext = createContext(null);

/**
 * Provider de confirmação. Disponibiliza a função `confirm(opts)` que retorna
 * uma Promise<boolean> — true se o usuário confirmar, false se cancelar.
 *
 * Uso:
 *   const confirm = useConfirm();
 *   if (!(await confirm({ message: "Deseja salvar?" }))) return;
 */
export function ConfirmProvider({ children }) {
  const [config, setConfig] = useState(null);
  const resolverRef = useRef(null);

  // Aviso (um só botão OK) — substitui os alert() nativos.
  const [aviso, setAviso] = useState(null);
  const avisoResolverRef = useRef(null);

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setConfig({
        title: opts.title || "Confirmar",
        message: opts.message || "Deseja confirmar esta ação?",
        confirmText: opts.confirmText || "Confirmar",
        cancelText: opts.cancelText || "Cancelar",
      });
    });
  }, []);

  const fechar = useCallback((resultado) => {
    setConfig(null);
    if (resolverRef.current) {
      resolverRef.current(resultado);
      resolverRef.current = null;
    }
  }, []);

  const notify = useCallback((opts = {}) => {
    const dados = typeof opts === "string" ? { message: opts } : opts;
    return new Promise((resolve) => {
      avisoResolverRef.current = resolve;
      setAviso({
        title: dados.title || "Aviso",
        message: dados.message || "",
        tipo: dados.tipo || "info", // info | sucesso | erro
        okText: dados.okText || "OK",
      });
    });
  }, []);

  const fecharAviso = useCallback(() => {
    setAviso(null);
    if (avisoResolverRef.current) {
      avisoResolverRef.current(true);
      avisoResolverRef.current = null;
    }
  }, []);

  // Hooks de teclado para os dois modais
  const { modalRef: confirmModalRef } = useModalKeyboard(!!config, () => fechar(false));
  const { modalRef: alertModalRef } = useModalKeyboard(!!aviso, fecharAviso);

  return (
    <ConfirmContext.Provider value={confirm}>
      <AlertContext.Provider value={notify}>
        {children}

        {config && (
          <div className={styles.overlay} onClick={() => fechar(false)}>
            <div ref={confirmModalRef} className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
              <h3 id="confirm-title" className={styles.title}>{config.title}</h3>
              <p className={styles.message}>{config.message}</p>
              <div className={styles.actions}>
                <button type="button" className={styles.cancelBtn} onClick={() => fechar(false)}>
                  {config.cancelText}
                </button>
                <button type="button" className={styles.confirmBtn} onClick={() => fechar(true)}>
                  {config.confirmText}
                </button>
              </div>
            </div>
          </div>
        )}

        {aviso && (
          <div className={styles.overlay} onClick={fecharAviso}>
            <div ref={alertModalRef} className={styles.modal} onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-labelledby="alert-title">
              <h3
                id="alert-title"
                className={styles.title}
                style={{
                  color:
                    aviso.tipo === "erro"
                      ? "#dc2626"
                      : aviso.tipo === "sucesso"
                        ? "#15803d"
                        : "#0f172a",
                }}
              >
                {aviso.title}
              </h3>
              <p className={styles.message}>{aviso.message}</p>
              <div className={styles.actions}>
                <button type="button" className={styles.confirmBtn} onClick={fecharAviso}>
                  {aviso.okText}
                </button>
              </div>
            </div>
          </div>
        )}
      </AlertContext.Provider>
    </ConfirmContext.Provider>
  );
}

/**
 * Hook para disparar a confirmação. Se o provider não estiver montado,
 * cai no window.confirm nativo para não quebrar.
 */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    return (opts = {}) =>
      Promise.resolve(
        typeof window !== "undefined"
          ? window.confirm(opts.message || "Deseja confirmar esta ação?")
          : true,
      );
  }
  return ctx;
}

/**
 * Hook para exibir um aviso (um botão OK) — substitui o alert() nativo.
 * Uso: const notify = useNotify(); await notify({ tipo: "sucesso", message: "..." });
 */
export function useNotify() {
  const ctx = useContext(AlertContext);
  if (!ctx) {
    return (opts = {}) => {
      const msg = typeof opts === "string" ? opts : opts.message || "";
      if (typeof window !== "undefined") window.alert(msg);
      return Promise.resolve(true);
    };
  }
  return ctx;
}
