// Phase 3 stub: see np_dashboardService.ts for the conversion pattern.
import { couriers as mockCouriers } from './np_devData';
import type { Courier } from '@/types';

export function getAllCouriersWithApproval(): Courier[] {
  return mockCouriers;
}

export function getPendingDrivers(): Courier[] {
  return mockCouriers.filter(c => c.tenantApprovalStatus === 'pending_approval');
}

export function getApprovedDrivers(): Courier[] {
  return mockCouriers.filter(c => c.tenantApprovalStatus === 'approved');
}

export function getPendingCount(): number {
  return mockCouriers.filter(c => c.tenantApprovalStatus === 'pending_approval').length;
}

export function flagForApproval(_courierId: number, _profileId: number): void {
  /* no-op stub */
}

export function approveDriver(_courierId: number, _notes?: string): void {
  /* no-op stub */
}

export function rejectDriver(_courierId: number, _notes: string): void {
  /* no-op stub */
}

export const driverApprovalService = {
  getAllCouriersWithApproval,
  getPendingDrivers,
  getApprovedDrivers,
  getPendingCount,
  flagForApproval,
  approveDriver,
  rejectDriver,
};
