import { useState, useMemo, useCallback } from 'react';
import { contractService } from '@/services/np_contractService';

export function useContracts() {
  const [refreshKey, setRefreshKey] = useState(0);
  const contracts = useMemo(() => contractService.getContracts(), [refreshKey]);
  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const activateContract = useCallback((id: number) => {
    contractService.activateContract(id);
    refresh();
  }, [refresh]);

  const deleteContract = useCallback((id: number) => {
    contractService.deleteContract(id);
    refresh();
  }, [refresh]);

  return { contracts, activateContract, deleteContract, refresh };
}
