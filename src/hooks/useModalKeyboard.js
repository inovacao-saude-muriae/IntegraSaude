import { useEffect, useRef } from "react";

/**
 * Hook para gerenciar navegação por teclado em modais
 * - Focus trapping: Tab fica dentro do modal
 * - ESC fecha o modal
 * - Foco automático no primeiro campo ao abrir
 * 
 * @param {boolean} isOpen - Se o modal está aberto
 * @param {function} onClose - Callback para fechar o modal
 * @param {boolean} autoFocus - Se deve focar automaticamente o primeiro elemento (padrão: true)
 * @returns {Object} - { modalRef } - Ref para aplicar no container do modal
 */
export function useModalKeyboard(isOpen, onClose, autoFocus = true) {
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // Salva o elemento que tinha foco antes de abrir o modal
    previousFocusRef.current = document.activeElement;

    const modalElement = modalRef.current;
    if (!modalElement) return;

    // Foca o primeiro elemento focável do modal
    if (autoFocus) {
      const focusableElements = modalElement.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      if (firstElement) {
        // Pequeno delay para garantir que o modal já foi renderizado
        setTimeout(() => firstElement.focus(), 10);
      }
    }

    // Handler para ESC
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && onClose) {
        e.preventDefault();
        onClose();
      }

      // Focus trap: mantém Tab dentro do modal
      if (e.key === "Tab") {
        const focusableElements = modalElement.querySelectorAll(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
        );
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        if (e.shiftKey) {
          // Shift + Tab: volta para o último elemento ao sair do primeiro
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: volta para o primeiro elemento ao sair do último
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    // Cleanup: restaura o foco ao elemento anterior quando fechar
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocusRef.current && previousFocusRef.current.focus) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, onClose, autoFocus]);

  return { modalRef };
}
