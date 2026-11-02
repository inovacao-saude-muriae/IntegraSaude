'use client';

import styles from './Pagination.module.css';

export default function Pagination({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  itemsPerPage = 20,
  onPageChange,
  className = ''
}) {
  if (totalPages <= 1) return null;

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const handleGotoPage = (page) => {
    const pageNum = parseInt(page, 10);
    if (pageNum >= 1 && pageNum <= totalPages && pageNum !== currentPage) {
      onPageChange(pageNum);
    }
  };

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate page number buttons (show current, prev 2, next 2, first and last)
  const generatePageNumbers = () => {
    const pages = [];
    const range = 2; // Show 2 pages before and after current
    
    // Always show first page
    if (currentPage > range + 1) {
      pages.push(1);
      if (currentPage > range + 2) {
        pages.push('...');
      }
    }
    
    // Show pages around current
    for (let i = Math.max(1, currentPage - range); i <= Math.min(totalPages, currentPage + range); i++) {
      pages.push(i);
    }
    
    // Always show last page
    if (currentPage < totalPages - range) {
      if (currentPage < totalPages - range - 1) {
        pages.push('...');
      }
      pages.push(totalPages);
    }
    
    return pages;
  };

  const pageNumbers = generatePageNumbers();

  return (
    <div className={`${styles.paginationContainer} ${className}`}>
      <div className={styles.paginationInfo}>
        Exibindo <strong>{startItem}</strong> a <strong>{endItem}</strong> de <strong>{totalItems}</strong> registro(s)
      </div>
      
      <div className={styles.paginationControls}>
        <button
          onClick={handlePrevious}
          disabled={currentPage === 1}
          className={styles.paginationBtn}
          aria-label="Página anterior"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Anterior
        </button>

        <div className={styles.pageNumbers}>
          {pageNumbers.map((page, idx) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${idx}`} className={styles.ellipsis}>
                  ...
                </span>
              );
            }
            
            return (
              <button
                key={page}
                onClick={() => handleGotoPage(page)}
                className={`${styles.pageBtn} ${page === currentPage ? styles.active : ''}`}
                aria-label={`Ir para página ${page}`}
                aria-current={page === currentPage ? 'page' : undefined}
              >
                {page}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleNext}
          disabled={currentPage === totalPages}
          className={styles.paginationBtn}
          aria-label="Próxima página"
        >
          Próximo
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
