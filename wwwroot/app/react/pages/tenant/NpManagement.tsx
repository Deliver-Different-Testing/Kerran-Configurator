import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '@/components/tenant/DataTable';
import { StatusBadge } from '@/components/tenant/StatusBadge';
import { TierBadge } from '@/components/tenant/TierBadge';
import { StatCard } from '@/components/tenant/StatCard';
import type { Agent, Column } from '@/types';

const mockNps: Agent[] = [
  { id: 1, name: 'Metro Express Couriers', contactName: 'John Smith', phone: '+1 312-555-0101', email: 'john@metroexpress.com', address: '200 N Michigan Ave', city: 'Chicago', state: 'IL', postCode: '60601', country: 'US', gps: null, status: 'Active', ranking: 5, notes: '', association: 'ECA', associationMemberId: 'ECA-1234', isNetworkPartner: true, npTier: 'Multi-Client', npActivatedDate: '2024-06-01', coverageAreas: ['Chicago Loop', 'North Side'], defaultCourierPayPercent: 65, createdDate: '2024-01-15', updatedDate: '2024-12-01' },
  { id: 2, name: 'Lone Star Logistics', contactName: 'Sarah Chen', phone: '+1 214-555-0202', email: 'sarah@lonestarlogi.com', address: '1200 Main St', city: 'Dallas', state: 'TX', postCode: '75201', country: 'US', gps: null, status: 'Active', ranking: 4, notes: '', association: 'CLDA', associationMemberId: 'CLDA-5678', isNetworkPartner: true, npTier: 'Base', npActivatedDate: '2024-09-15', coverageAreas: ['Dallas Downtown'], defaultCourierPayPercent: 60, createdDate: '2024-03-20', updatedDate: '2024-11-28' },
  { id: 6, name: 'Harbor Freight Express', contactName: 'Alex Tan', phone: '+1 713-555-0606', email: 'alex@harborfreight.com', address: '800 Bagby St', city: 'Houston', state: 'TX', postCode: '77002', country: 'US', gps: null, status: 'Active', ranking: 4, notes: '', association: 'ECA', associationMemberId: 'ECA-2345', isNetworkPartner: true, npTier: 'Multi-Client', npActivatedDate: '2024-04-01', coverageAreas: ['Houston', 'San Antonio'], defaultCourierPayPercent: 62, createdDate: '2024-02-10', updatedDate: '2024-12-10' },
];

// Simulated performance data
const perfData: Record<number, { jobsThisMonth: number; onTimePercent: number; avgRating: number }> = {
  1: { jobsThisMonth: 342, onTimePercent: 96.2, avgRating: 4.8 },
  2: { jobsThisMonth: 128, onTimePercent: 91.5, avgRating: 4.5 },
  6: { jobsThisMonth: 256, onTimePercent: 94.8, avgRating: 4.6 },
};

export function NpManagement() {
  const [search, setSearch] = useState('');

  const filtered = mockNps.filter((np) =>
    !search || np.name.toLowerCase().includes(search.toLowerCase()) || np.city.toLowerCase().includes(search.toLowerCase())
  );

  const columns: Column<Agent>[] = [
    {
      key: 'name', header: 'Network Partner', sortable: true,
      render: (r) => (
        <div>
          <span className="font-bold text-text-primary">{r.name}</span>
          <div className="text-xs text-text-muted">{r.city}, {r.state}</div>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'npTier', header: 'Tier', render: (r) => r.npTier ? <TierBadge tier={r.npTier} /> : <span>—</span> },
    {
      key: 'jobs', header: 'Jobs (Month)', sortable: true,
      render: (r) => <span className="font-bold text-text-primary">{perfData[r.id]?.jobsThisMonth ?? 0}</span>,
    },
    {
      key: 'onTime', header: 'On-Time %',
      render: (r) => {
        const pct = perfData[r.id]?.onTimePercent ?? 0;
        return <span className={`font-bold ${pct >= 95 ? 'text-success' : pct >= 90 ? 'text-warning' : 'text-error'}`}>{pct}%</span>;
      },
    },
    {
      key: 'rating', header: 'Rating',
      render: (r) => (
        <span className="text-sm">
          <span className="text-warning">★</span> {perfData[r.id]?.avgRating ?? '—'}
        </span>
      ),
    },
    {
      key: 'actions', header: '',
      render: (r) => (
        <div className="flex gap-2">
          <Link to={`/agents/${r.id}`} className="px-3 py-1.5 text-xs font-bold rounded-full bg-brand-cyan/10 text-brand-cyan hover:bg-brand-cyan/20 transition-colors">
            Settings
          </Link>
          <button className="px-3 py-1.5 text-xs font-bold rounded-full bg-error/10 text-error hover:bg-error/20 transition-colors">
            Deactivate
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active NPs" value={mockNps.length} color="purple" />
        <StatCard label="Total Jobs (Month)" value={726} color="cyan" />
        <StatCard label="Avg On-Time %" value="94.2%" color="green" icon="⏱️" />
        <StatCard label="Multi-Client Tier" value={2} color="orange" />
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex gap-3 items-center">
          <input
            type="text"
            placeholder="Search NPs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 max-w-md px-4 py-2.5 text-base border-2 border-border rounded-full bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm">
        <DataTable
          columns={columns}
          data={filtered}
          keyField="id"
          emptyMessage="No network partners found"
        />
      </div>
    </div>
  );
}
