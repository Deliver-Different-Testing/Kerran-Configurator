// Phase 3 stub: see np_dashboardService.ts for the conversion pattern.
import { mockContracts } from './np_devData';
import type { CourierContract } from '@/types';

export const contractService = {
  getContracts(): CourierContract[] {
    return mockContracts;
  },

  getContractById(id: number): CourierContract | undefined {
    return mockContracts.find(c => c.id === id);
  },

  createContract(_contract: Partial<CourierContract>): CourierContract {
    throw new Error('createContract() not yet wired to backend');
  },

  activateContract(_id: number): CourierContract | undefined {
    return undefined;
  },

  deleteContract(_id: number): boolean {
    return false;
  },
};
