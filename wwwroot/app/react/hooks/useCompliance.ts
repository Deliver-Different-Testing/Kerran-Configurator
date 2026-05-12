import { useState, useEffect, useCallback } from 'react';
import { complianceService } from '@/services/np_complianceService';
import { couriers } from '@/services/np_mockData';
import type {
  ComplianceDashboard,
  ComplianceAlert,
  CourierComplianceScore,
  ComplianceAlertFilter,
} from '@/types';

// Mock data generator for development — matches the mock data pattern used elsewhere
function generateMockDashboard(): ComplianceDashboard {
  const activeCouriers = couriers.filter(c => c.status === 'active');
  const total = activeCouriers.length;

  // Document types we track
  const docTypes = [
    { id: 1, name: "Driver's License", category: 'Licensing' },
    { id: 2, name: 'Vehicle Registration', category: 'Vehicle' },
    { id: 3, name: 'Insurance Certificate', category: 'Insurance' },
    { id: 4, name: 'Dangerous Goods Certificate', category: 'Licensing' },
    { id: 5, name: 'Contract', category: 'Contract' },
  ];

  // Classify each courier
  let compliant = 0, warnings = 0, nonCompliant = 0;
  const alerts: ComplianceAlert[] = [];

  activeCouriers.forEach(c => {
    const name = `${c.firstName} ${c.surName}`;
    let hasExpired = false, hasExpiring = false;

    c.documents.forEach(d => {
      if (d.status === 'expired') {
        hasExpired = true;
        const expDate = d.expiry || '2025-01-01';
        const days = Math.floor((Date.now() - new Date(expDate).getTime()) / 86400000);
        alerts.push({
          courierId: c.id, courierName: name, documentType: d.type,
          expiryDate: expDate, isExpired: true, alertStatus: 'Expired', daysUntilExpiry: -days,
        });
      } else if (d.status === 'expiring') {
        hasExpiring = true;
        const days = Math.floor((new Date(d.expiry).getTime() - Date.now()) / 86400000);
        alerts.push({
          courierId: c.id, courierName: name, documentType: d.type,
          expiryDate: d.expiry, isExpired: false, alertStatus: 'Expiring', daysUntilExpiry: days,
        });
      }
    });

    // Check for missing mandatory docs (License, Insurance, Contract)
    const mandatoryTypes = ["Driver's License", 'Insurance Certificate', 'Contract'];
    mandatoryTypes.forEach(mt => {
      if (!c.documents.some(d => d.type === mt)) {
        alerts.push({
          courierId: c.id, courierName: name, documentType: mt,
          expiryDate: null, isExpired: false, alertStatus: 'Missing', daysUntilExpiry: null,
        });
        hasExpired = true; // Missing mandatory = non-compliant
      }
    });

    if (hasExpired) nonCompliant++;
    else if (hasExpiring) warnings++;
    else compliant++;
  });

  const fleetPercent = total > 0 ? Math.round((compliant / total) * 1000) / 10 : 100;

  const breakdown = docTypes.map(dt => {
    let current = 0, expiring = 0, expired = 0, missing = 0;
    activeCouriers.forEach(c => {
      const doc = c.documents.find(d => d.type === dt.name);
      if (!doc) { missing++; return; }
      if (doc.status === 'current') current++;
      else if (doc.status === 'expiring') expiring++;
      else if (doc.status === 'expired') expired++;
    });
    return {
      documentTypeId: dt.id, documentTypeName: dt.name, category: dt.category,
      totalRequired: total, current, expiring, expired, missing,
    };
  });

  return {
    totalActiveCouriers: total,
    totalCompliant: compliant,
    totalWarnings: warnings,
    totalNonCompliant: nonCompliant,
    fleetCompliancePercent: fleetPercent,
    breakdownByType: breakdown,
    urgentAlerts: alerts.sort((a, b) => {
      const order: Record<string, number> = { Expired: 0, Missing: 1, Expiring: 2 };
      return (order[a.alertStatus] ?? 3) - (order[b.alertStatus] ?? 3);
    }).slice(0, 10),
  };
}

function getMasterName(c: typeof couriers[0]): string {
  if (c.master) {
    const master = couriers.find(m => m.id === c.master);
    if (master) return `${master.firstName} ${master.surName}`;
  }
  return c.type === 'Master' ? 'Master' : 'Unassigned';
}

function generateMockAlerts(filters?: ComplianceAlertFilter): ComplianceAlert[] {
  const activeCouriers = couriers.filter(c => c.status === 'active');
  const fullAlerts: ComplianceAlert[] = [];

  const docTypes = ["Driver's License", 'Vehicle Registration', 'Insurance Certificate', 'Dangerous Goods Certificate', 'Contract'];

  activeCouriers.forEach(c => {
    const name = `${c.firstName} ${c.surName}`;
    const fleet = getMasterName(c);

    c.documents.forEach(d => {
      if (d.status === 'expired') {
        const days = Math.floor((Date.now() - new Date(d.expiry).getTime()) / 86400000);
        fullAlerts.push({
          courierId: c.id, courierName: name, documentType: d.type,
          expiryDate: d.expiry, isExpired: true, alertStatus: 'Expired', daysUntilExpiry: -days, fleet,
        });
      } else if (d.status === 'expiring') {
        const days = Math.floor((new Date(d.expiry).getTime() - Date.now()) / 86400000);
        fullAlerts.push({
          courierId: c.id, courierName: name, documentType: d.type,
          expiryDate: d.expiry, isExpired: false, alertStatus: 'Expiring', daysUntilExpiry: days, fleet,
        });
      } else if (d.status === 'current') {
        const days = d.expiry ? Math.floor((new Date(d.expiry).getTime() - Date.now()) / 86400000) : null;
        fullAlerts.push({
          courierId: c.id, courierName: name, documentType: d.type,
          expiryDate: d.expiry || null, isExpired: false, alertStatus: 'Current', daysUntilExpiry: days, fleet,
        });
      }
    });

    // Check for missing docs across all tracked types
    const mandatoryTypes = ["Driver's License", 'Insurance Certificate', 'Contract'];
    docTypes.forEach(dt => {
      if (!c.documents.some(d => d.type === dt)) {
        // Only flag mandatory ones as missing alerts
        if (mandatoryTypes.includes(dt)) {
          fullAlerts.push({
            courierId: c.id, courierName: name, documentType: dt,
            expiryDate: null, isExpired: false, alertStatus: 'Missing', daysUntilExpiry: null, fleet,
          });
        }
      }
    });
  });

  let alerts = fullAlerts;

  if (filters?.docType) alerts = alerts.filter(a => a.documentType === filters.docType);
  if (filters?.status) alerts = alerts.filter(a => a.alertStatus === filters.status);
  if (filters?.courierName) alerts = alerts.filter(a => a.courierName.toLowerCase().includes(filters.courierName!.toLowerCase()));

  return alerts.sort((a, b) => {
    const order: Record<string, number> = { Expired: 0, Missing: 1, Expiring: 2, Current: 3 };
    return (order[a.alertStatus] ?? 4) - (order[b.alertStatus] ?? 4);
  });
}

const USE_MOCK = true;

export function useComplianceDashboard() {
  const [data, setData] = useState<ComplianceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (USE_MOCK) {
        setData(generateMockDashboard());
      } else {
        setData(await complianceService.getDashboard());
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load compliance dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return { data, loading, error, refresh };
}

export function useComplianceAlerts(filters?: ComplianceAlertFilter) {
  const [alerts, setAlerts] = useState<ComplianceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (USE_MOCK) {
        setAlerts(generateMockAlerts(filters));
      } else {
        setAlerts(await complianceService.getAlerts(filters));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load compliance alerts');
    } finally {
      setLoading(false);
    }
  }, [filters?.docType, filters?.status, filters?.courierName, filters?.daysAhead]);

  useEffect(() => { refresh(); }, [refresh]);
  return { alerts, loading, error, refresh };
}

export function useCourierComplianceScore(courierId: number | null) {
  const [score, setScore] = useState<CourierComplianceScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!courierId) return;
    setLoading(true);
    setError(null);
    try {
      if (USE_MOCK) {
        const c = couriers.find(x => x.id === courierId);
        if (c) {
          const mandatoryTypes = ["Driver's License", 'Insurance Certificate', 'Contract'];
          const docStatuses = mandatoryTypes.map(mt => {
            const doc = c.documents.find(d => d.type === mt);
            let status = 'Missing';
            let expiryDate: string | null = null;
            let daysUntilExpiry: number | null = null;
            if (doc) {
              status = doc.status === 'current' ? 'Current' : doc.status === 'expiring' ? 'ExpiringSoon' : 'Expired';
              expiryDate = doc.expiry || null;
              if (expiryDate) daysUntilExpiry = Math.floor((new Date(expiryDate).getTime() - Date.now()) / 86400000);
            }
            return {
              documentTypeId: mandatoryTypes.indexOf(mt) + 1,
              documentTypeName: mt, category: 'Licensing', mandatory: true,
              status, expiryDate, daysUntilExpiry,
            };
          });
          const currentCount = docStatuses.filter(d => d.status === 'Current').length;
          setScore({
            courierId: c.id, courierName: `${c.firstName} ${c.surName}`,
            status: c.status, compliancePercent: Math.round((currentCount / mandatoryTypes.length) * 100),
            documentStatuses: docStatuses,
          });
        }
      } else {
        setScore(await complianceService.getCourierScore(courierId));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load compliance score');
    } finally {
      setLoading(false);
    }
  }, [courierId]);

  useEffect(() => { refresh(); }, [refresh]);
  return { score, loading, error, refresh };
}
