import { useEffect, useState } from 'react';
import { courierService } from '@/services/np_courierService';
import type { Courier } from '@/types';

export function useCouriers() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [locationFilter, setLocationFilter] = useState('All Locations');
  const [vehicleFilter, setVehicleFilter] = useState('All Vehicles');
  const [allCouriers, setAllCouriers] = useState<Courier[]>([]);

  useEffect(() => {
    let alive = true;
    courierService.getAll().then(rows => {
      if (alive) setAllCouriers(rows);
    });
    return () => { alive = false; };
  }, []);

  // Client-side filtering on the already-fetched list — keeps the page
  // snappy and avoids a roundtrip per keystroke. Backend filtering can be
  // added later if the dataset grows large.
  const filtered = allCouriers.filter(c => {
    const q = search.trim().toLowerCase();
    if (q) {
      const hay = `${c.firstName} ${c.surName} ${c.code} ${c.email}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (statusFilter !== 'All Status' && c.status !== statusFilter.toLowerCase()) return false;
    if (locationFilter !== 'All Locations' && c.location !== locationFilter) return false;
    if (vehicleFilter !== 'All Vehicles' && c.vehicle !== vehicleFilter) return false;
    return true;
  });

  const active = allCouriers.filter(c => c.status === 'active').length;
  const inactive = allCouriers.filter(c => c.status === 'inactive').length;
  const alerts = allCouriers.filter(c => c.compliance !== 'ok').length;

  return {
    couriers: filtered,
    allCouriers,
    search, setSearch,
    statusFilter, setStatusFilter,
    locationFilter, setLocationFilter,
    vehicleFilter, setVehicleFilter,
    active, inactive, alerts,
  };
}
