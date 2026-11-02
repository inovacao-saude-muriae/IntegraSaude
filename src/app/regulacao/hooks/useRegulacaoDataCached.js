"use client";

/**
 * SWR-cached version of auxiliary data loading for Regulação
 * Replaces direct server action calls with cached hooks from @/lib/queries
 */

import { useMedicos, useUBS, useProcedimentos, useTiposExame, usePessoas } from "@/lib/queries";

/**
 * Hook to load all auxiliary data with SWR caching
 * Returns the same shape as getAuxiliaryData() but with automatic caching
 */
export function useAuxiliaryDataCached() {
  const { medicos, isLoading: loadingMedicos, isError: errorMedicos, mutate: mutateMedicos } = useMedicos();
  const { ubs, isLoading: loadingUBS, isError: errorUBS, mutate: mutateUBS } = useUBS();
  const { procedimentos, isLoading: loadingProc, isError: errorProc, mutate: mutateProc } = useProcedimentos();
  const { tiposExame, isLoading: loadingTipos, isError: errorTipos, mutate: mutateTipos } = useTiposExame();
  const { pessoas, isLoading: loadingPessoas, isError: errorPessoas, mutate: mutatePessoas } = usePessoas("");

  const isLoading = loadingMedicos || loadingUBS || loadingProc || loadingTipos || loadingPessoas;
  const isError = errorMedicos || errorUBS || errorProc || errorTipos || errorPessoas;

  // Function to refresh all caches (useful after creating/updating data)
  const mutateAll = () => {
    mutateMedicos();
    mutateUBS();
    mutateProc();
    mutateTipos();
    mutatePessoas();
  };

  return {
    auxData: {
      medicos: medicos || [],
      ubsList: ubs || [],
      procedimentos: procedimentos || [],
      tiposExame: tiposExame || [],
      pessoas: pessoas || [],
    },
    isLoading,
    isError,
    mutateAll,
  };
}
