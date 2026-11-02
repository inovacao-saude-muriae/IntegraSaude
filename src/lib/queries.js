/**
 * SWR-based query hooks for caching frequently accessed data
 * Uses stale-while-revalidate strategy for optimal UX
 */

import useSWR from "swr";

// Default fetcher for all SWR hooks
const fetcher = async (url) => {
  const res = await fetch(url, { cache: "no-store" });
  
  if (!res.ok) {
    const error = new Error("Falha ao carregar dados");
    error.info = await res.json().catch(() => ({}));
    error.status = res.status;
    throw error;
  }
  
  return res.json();
};

// Configuration for different data types
const CONFIG = {
  // Fast revalidation for frequently changing data
  realtime: {
    refreshInterval: 30000, // 30 seconds
    dedupingInterval: 2000,
    revalidateOnFocus: true,
  },
  // Standard caching for moderately stable data
  standard: {
    refreshInterval: 300000, // 5 minutes
    dedupingInterval: 5000,
    revalidateOnFocus: true,
  },
  // Long-term caching for rarely changing data
  static: {
    refreshInterval: 3600000, // 1 hour
    dedupingInterval: 10000,
    revalidateOnFocus: false,
  },
};

/**
 * Query hook for médicos (doctors)
 * Caches the list of doctors with standard revalidation
 */
export function useMedicos(options = {}) {
  const { data, error, isLoading, mutate } = useSWR(
    "/api/regulacao/medicos",
    fetcher,
    { ...CONFIG.standard, ...options }
  );

  return {
    medicos: data?.data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

/**
 * Query hook for UBS (health units)
 * Caches the list of UBS with static revalidation (rarely changes)
 */
export function useUBS(options = {}) {
  const { data, error, isLoading, mutate } = useSWR(
    "/api/regulacao/ubs",
    fetcher,
    { ...CONFIG.static, ...options }
  );

  return {
    ubs: data?.data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

/**
 * Query hook for procedimentos (procedures)
 * Caches the list of procedures with standard revalidation
 */
export function useProcedimentos(tipoExameId = null, options = {}) {
  const url = tipoExameId
    ? `/api/regulacao/procedimentos?tipoExameId=${tipoExameId}`
    : "/api/regulacao/procedimentos";

  const { data, error, isLoading, mutate } = useSWR(
    url,
    fetcher,
    { ...CONFIG.standard, ...options }
  );

  return {
    procedimentos: data?.data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

/**
 * Query hook for medicamentos (medications)
 * Caches the list of active medications with standard revalidation
 */
export function useMedicamentos(options = {}) {
  const { data, error, isLoading, mutate } = useSWR(
    "/api/farmacia/medicamentos",
    fetcher,
    { ...CONFIG.standard, ...options }
  );

  return {
    medicamentos: data?.data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

/**
 * Query hook for tipos de exame (exam types)
 * Caches the list of exam types with static revalidation (rarely changes)
 */
export function useTiposExame(options = {}) {
  const { data, error, isLoading, mutate } = useSWR(
    "/api/regulacao/tipos-exame",
    fetcher,
    { ...CONFIG.static, ...options }
  );

  return {
    tiposExame: data?.data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

/**
 * Query hook for pessoas (people/patients)
 * Search-based query with conditional fetching
 */
export function usePessoas(searchTerm = "", options = {}) {
  const shouldFetch = searchTerm && searchTerm.length >= 2;
  const url = shouldFetch
    ? `/api/pessoas?q=${encodeURIComponent(searchTerm)}`
    : null;

  const { data, error, isLoading, mutate } = useSWR(
    url,
    fetcher,
    { ...CONFIG.realtime, ...options }
  );

  return {
    pessoas: data?.data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

/**
 * Query hook for single pedido (exam request)
 * Caches individual requests with realtime revalidation
 */
export function usePedido(pedidoId, options = {}) {
  const url = pedidoId ? `/api/regulacao/pedidos/${pedidoId}` : null;

  const { data, error, isLoading, mutate } = useSWR(
    url,
    fetcher,
    { ...CONFIG.realtime, ...options }
  );

  return {
    pedido: data?.data || null,
    isLoading,
    isError: error,
    mutate,
  };
}

/**
 * Query hook for animais CCZ (CCZ animals)
 * Search-based query with conditional fetching
 */
export function useAnimaisCCZ(searchTerm = "", options = {}) {
  const shouldFetch = searchTerm && searchTerm.length >= 2;
  const url = shouldFetch
    ? `/api/ccz/animais?q=${encodeURIComponent(searchTerm)}`
    : null;

  const { data, error, isLoading, mutate } = useSWR(
    url,
    fetcher,
    { ...CONFIG.realtime, ...options }
  );

  return {
    animais: data?.data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

/**
 * Query hook for serviços junta reguladora (regulatory board services)
 * Caches the list of services with static revalidation
 */
export function useServicosJunta(options = {}) {
  const { data, error, isLoading, mutate } = useSWR(
    "/api/junta-reguladora/servicos",
    fetcher,
    { ...CONFIG.static, ...options }
  );

  return {
    servicos: data?.data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

/**
 * Hook to prefetch data
 * Useful for preloading data before navigation
 */
export function usePrefetch() {
  return {
    prefetchMedicos: () => fetcher("/api/regulacao/medicos"),
    prefetchUBS: () => fetcher("/api/regulacao/ubs"),
    prefetchProcedimentos: () => fetcher("/api/regulacao/procedimentos"),
    prefetchMedicamentos: () => fetcher("/api/farmacia/medicamentos"),
  };
}

/**
 * Hook to clear all caches
 * Useful after major data changes
 */
export function useClearCache() {
  const { mutate: mutateMedicos } = useMedicos({ revalidateOnMount: false });
  const { mutate: mutateUBS } = useUBS({ revalidateOnMount: false });
  const { mutate: mutateProcedimentos } = useProcedimentos(null, { revalidateOnMount: false });
  const { mutate: mutateMedicamentos } = useMedicamentos({ revalidateOnMount: false });

  return () => {
    mutateMedicos();
    mutateUBS();
    mutateProcedimentos();
    mutateMedicamentos();
  };
}
