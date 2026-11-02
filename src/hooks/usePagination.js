'use client';

import { useState, useMemo } from 'react';

/**
 * Hook para gerenciar paginação client-side
 * @param {Array} items - Array de itens a serem paginados
 * @param {number} itemsPerPage - Número de itens por página (padrão: 20)
 * @returns {object} Estado e métodos de paginação
 */
export function usePagination(items = [], itemsPerPage = 20) {
  const [currentPage, setCurrentPage] = useState(1);

  // Calcula totais
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  // Ajusta página atual se exceder o total
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(totalPages);
  }

  // Calcula itens da página atual
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }, [items, currentPage, itemsPerPage]);

  // Vai para uma página específica
  const goToPage = (page) => {
    const pageNum = parseInt(page, 10);
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
    }
  };

  // Reseta para a primeira página (útil quando os filtros mudam)
  const resetPage = () => {
    setCurrentPage(1);
  };

  return {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    paginatedItems,
    goToPage,
    resetPage,
    setCurrentPage
  };
}
