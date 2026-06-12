import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useComplianceDashboard, useComplianceAlerts } from '@/hooks/useCompliance';
import { complianceProfileService } from '@/services/np_complianceProfileService';
import { quizService } from '@/services/np_quizService';
import StatCard from '@/components/common/StatCard';
import { DriverApproval } from '@/pages/tenant/DriverApproval';
import type { ComplianceAlertFilter, ComplianceProfile } from '@/types';

// Monitoring › Drivers/Contractors sub-tabs (Steve refinement 2026-06-11):
// the Fleet Compliance Overview stays above; the lower area splits into the
// expiry/compliance-risk list and the tenant courier-approval queue.
type DriverMonitorTab = 'risk' | 'approval';

interface ComplianceDashboardProps {
  // Lets a caller open straight onto a tab — e.g. the legacy /driver-approval
  // route lands on 'approval'. Defaults to the compliance-risk list.
  initialTab?: DriverMonitorTab;
}

type DrilldownFilter = {
  status?: string;
  docType?: string;
  label?: string;
};

const statusBadgeClasses: Record<string, string> = {
  Expired: 'bg-red-100 text-red-800',
  Expiring: 'bg-amber-100 text-amber-800',
  Missing: 'bg-purple-100 text-purple-800',
  Current: 'bg-green-100 text-green-800',
};

function AlertStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeClasses[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

function DonutChart({
  compliant, warnings, nonCompliant, missing,
  onSegmentClick, activeSegment,
}: {
  compliant: number; warnings: number; nonCompliant: number; missing: number;
  onSegmentClick: (status: string) => void;
  activeSegment?: string;
}) {
  const total = compliant + warnings + nonCompliant + missing;
  if (total === 0) return <div className="text-text-secondary text-sm">No data</div>;

  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    { pct: (compliant / total) * 100, color: '#22c55e', status: 'Current', label: 'Compliant', count: compliant },
    { pct: (warnings / total) * 100, color: '#f59e0b', status: 'Expiring', label: 'Expiring', count: warnings },
    { pct: (nonCompliant / total) * 100, color: '#ef4444', status: 'Expired', label: 'Non-Compliant', count: nonCompliant },
    { pct: (missing / total) * 100, color: '#a855f7', status: 'Missing', label: 'Missing', count: missing },
  ];

  let offset = 0;
  return (
    <div className="flex items-center gap-6">
      <svg width="120" height="120" viewBox="0 0 100 100" className="cursor-pointer">
        {segments.map((seg, i) => {
          const dashLength = (seg.pct / 100) * circumference;
          const dashOffset = -(offset / 100) * circumference;
          offset += seg.pct;
          if (seg.pct === 0) return null;
          return (
            <circle
              key={i}
              cx="50" cy="50" r={radius}
              fill="none" stroke={seg.color} strokeWidth={activeSegment === seg.status ? 20 : 16}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 50 50)"
              className="cursor-pointer transition-all hover:opacity-80"
              onClick={() => onSegmentClick(seg.status)}
              opacity={activeSegment && activeSegment !== seg.status ? 0.4 : 1}
            />
          );
        })}
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="text-lg font-bold fill-text-primary" fontSize="16">
          {total}
        </text>
      </svg>
      <div className="space-y-2 text-sm">
        {segments.map(seg => (
          <button
            key={seg.status}
            onClick={() => onSegmentClick(seg.status)}
            className={`flex items-center gap-2 hover:underline transition-opacity ${activeSegment && activeSegment !== seg.status ? 'opacity-40' : ''}`}
          >
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            {seg.label} ({seg.count})
          </button>
        ))}
      </div>
    </div>
  );
}

function ComplianceScoreRing({ percent }: { percent: number }) {
  const color = percent >= 80 ? '#22c55e' : percent >= 60 ? '#f59e0b' : '#ef4444';
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const filled = (percent / 100) * circumference;

  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="6" />
      <circle
        cx="36" cy="36" r={radius} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${filled} ${circumference - filled}`}
        strokeDashoffset={circumference * 0.25}
        strokeLinecap="round" transform="rotate(-90 36 36)"
      />
      <text x="36" y="36" textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="bold" fill={color}>
        {Math.round(percent)}%
      </text>
    </svg>
  );
}

export default function ComplianceDashboard({ initialTab = 'risk' }: ComplianceDashboardProps = {}) {
  const navigate = useNavigate();
  const { data: dashboard, loading: dashLoading } = useComplianceDashboard();

  const [drilldown, setDrilldown] = useState<DrilldownFilter | null>(null);
  const [searchText, setSearchText] = useState('');
  const [notifying, setNotifying] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [profiles, setProfiles] = useState<ComplianceProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [driverTab, setDriverTab] = useState<DriverMonitorTab>(initialTab);

  useEffect(() => {
    complianceProfileService.getAll().then(ps => setProfiles(ps.filter(p => p.active)));
  }, []);

  // Build alert filters from drilldown
  const activeFilters = useMemo<ComplianceAlertFilter>(() => {
    const f: ComplianceAlertFilter = {};
    if (drilldown?.status) f.status = drilldown.status;
    if (drilldown?.docType) f.docType = drilldown.docType;
    if (searchText) f.courierName = searchText;
    return f;
  }, [drilldown, searchText]);

  // Always fetch the full alert set (one row per courier × tracked doc type,
  // all statuses incl. Current) — the Compliance Risk roster below groups it by
  // courier client-side, and card/donut drill-downs filter the rows in memory.
  const { alerts, loading: alertsLoading } = useComplianceAlerts({});

  // Compliance Risk roster (Steve 2026-06-12): the "Breakdown by Document Type"
  // reshaped to one row PER COURIER + the courier identity columns. Required =
  // tracked docs for the courier; Current/Expiring/Expired/Missing = that
  // courier's per-status document counts.
  const courierRows = useMemo(() => {
    const byCourier = new Map<number, {
      courierId: number; code?: string; name: string; role?: string;
      phone?: string; email?: string; vehicle?: string; networkPartner: string;
      required: number; current: number; expiring: number; expired: number; missing: number;
    }>();
    for (const a of alerts) {
      let row = byCourier.get(a.courierId);
      if (!row) {
        row = {
          courierId: a.courierId, code: a.code, name: a.courierName, role: a.role,
          phone: a.phone, email: a.email, vehicle: a.vehicle, networkPartner: a.networkPartner || 'Direct',
          required: 0, current: 0, expiring: 0, expired: 0, missing: 0,
        };
        byCourier.set(a.courierId, row);
      }
      row.required += 1;
      if (a.alertStatus === 'Current') row.current += 1;
      else if (a.alertStatus === 'Expiring') row.expiring += 1;
      else if (a.alertStatus === 'Expired') row.expired += 1;
      else if (a.alertStatus === 'Missing') row.missing += 1;
    }
    let rows = [...byCourier.values()];
    if (searchText) {
      const q = searchText.toLowerCase();
      rows = rows.filter(r => r.name.toLowerCase().includes(q) || (r.code ?? '').toLowerCase().includes(q));
    }
    if (drilldown?.status) {
      const s = drilldown.status;
      rows = rows.filter(r =>
        s === 'Current' ? r.current > 0 :
        s === 'Expiring' ? r.expiring > 0 :
        s === 'Expired' ? r.expired > 0 :
        s === 'Missing' ? r.missing > 0 : true);
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [alerts, searchText, drilldown]);

  // Compute missing count from dashboard
  const missingCount = useMemo(() => {
    if (!dashboard) return 0;
    return dashboard.breakdownByType.reduce((sum, b) => sum + b.missing, 0);
  }, [dashboard]);

  const selectedProfile = profiles.find(p => p.id === selectedProfileId);
  const profileDocTypes = selectedProfile?.requirements.map(r => r.documentTypeName) || null;

  // Build breakdown rows that include profile doc types even if not in dashboard data
  const filteredBreakdown = useMemo(() => {
    if (!dashboard) return [];
    if (!selectedProfile || !profileDocTypes) return dashboard.breakdownByType;

    return profileDocTypes.map(docName => {
      const existing = dashboard.breakdownByType.find(b => b.documentTypeName === docName);
      if (existing) return existing;
      // Doc type exists in profile but not in dashboard — all couriers are missing it
      return {
        documentTypeId: 0,
        documentTypeName: docName,
        category: 'Other',
        totalRequired: dashboard.totalActiveCouriers,
        current: 0,
        expiring: 0,
        expired: 0,
        missing: dashboard.totalActiveCouriers,
      };
    });
  }, [dashboard, selectedProfile, profileDocTypes]);

  const sortedAlerts = useMemo(() => {
    let filtered = [...alerts];
    // Filter by compliance profile's required doc types
    if (profileDocTypes) {
      filtered = filtered.filter(a => profileDocTypes.includes(a.documentType));
    }
    filtered.sort((a, b) => {
      // nulls (missing) go last when ascending, first when descending
      if (a.daysUntilExpiry === null && b.daysUntilExpiry === null) return 0;
      if (a.daysUntilExpiry === null) return sortAsc ? 1 : -1;
      if (b.daysUntilExpiry === null) return sortAsc ? -1 : 1;
      return sortAsc ? a.daysUntilExpiry - b.daysUntilExpiry : b.daysUntilExpiry - a.daysUntilExpiry;
    });
    return filtered;
  }, [alerts, sortAsc, profileDocTypes]);

  const handleCardClick = useCallback((status: string, label: string) => {
    if (drilldown?.status === status && !drilldown?.docType) {
      setDrilldown(null);
    } else {
      setDrilldown({ status, label });
      setSearchText('');
      setDriverTab('risk'); // surface the risk list when drilling in from the overview
    }
  }, [drilldown]);

  const handleDonutClick = useCallback((status: string) => {
    const labelMap: Record<string, string> = {
      Current: 'Compliant',
      Expiring: 'Expiring Soon',
      Expired: 'Non-Compliant',
      Missing: 'Missing',
    };
    handleCardClick(status, labelMap[status] || status);
  }, [handleCardClick]);

  const handleBreakdownClick = useCallback((docType: string, status: string, count: number) => {
    if (count === 0) return;
    const statusLabel: Record<string, string> = {
      current: 'Current', expiring: 'Expiring', expired: 'Expired', missing: 'Missing',
    };
    setDrilldown({
      status: statusLabel[status] || status,
      docType,
      label: `${docType} — ${statusLabel[status] || status}`,
    });
    setSearchText('');
    setDriverTab('risk'); // surface the risk list when drilling in from the breakdown
  }, []);

  const handleSendReminder = async (courierId: number) => {
    setNotifying(courierId);
    await new Promise(r => setTimeout(r, 800));
    setNotifying(null);
  };

  if (dashLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-cyan" />
      </div>
    );
  }

  if (!dashboard) return <div className="text-text-secondary">Failed to load compliance dashboard.</div>;

  return (
    <div className="space-y-6">
      {/* Header (title + explanatory subtitle) and the Configure Document Types
          button removed per Steve's markup — this view is already labelled by
          the Monitoring › Drivers/Contractors › Compliance Risk tabs above, and
          doc-type config lives under Compliance › Set up. */}

      {/* Compliance Profile Filter */}
      {profiles.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-text-secondary font-medium">Filter by Profile:</span>
          <button
            onClick={() => setSelectedProfileId(null)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
              !selectedProfileId
                ? 'bg-[#0d0c2c] text-white border-[#0d0c2c]'
                : 'bg-white text-text-secondary border-border hover:border-[#3bc7f4]/40'
            }`}
          >
            All Profiles
          </button>
          {profiles.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedProfileId(p.id === selectedProfileId ? null : p.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                selectedProfileId === p.id
                  ? 'bg-[#0d0c2c] text-white border-[#0d0c2c]'
                  : 'bg-white text-text-secondary border-border hover:border-[#3bc7f4]/40'
              }`}
            >
              {p.name}
              <span className="ml-1 text-[10px] opacity-60">({p.requirements.length})</span>
            </button>
          ))}
        </div>
      )}

      {/* Fleet Compliance Overview (donut) sits to the LEFT of the summary
          tiles (Steve 2026-06-12 — moved up out of the old charts row). */}
      <div className="flex flex-col xl:flex-row gap-4 items-start">
        <div className="bg-white border border-border rounded-lg p-5 shadow-sm shrink-0">
          <h3 className="font-bold text-text-primary mb-4">Fleet Compliance Overview</h3>
          <DonutChart
            compliant={dashboard.totalCompliant}
            warnings={dashboard.totalWarnings}
            nonCompliant={dashboard.totalNonCompliant}
            missing={missingCount}
            onSegmentClick={handleDonutClick}
            activeSegment={drilldown?.status && !drilldown?.docType ? drilldown.status : undefined}
          />
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 flex-1 content-start">
        <StatCard label="Total Couriers" value={dashboard.totalActiveCouriers} />
        <div
          className={`bg-white border rounded-lg p-5 shadow-sm cursor-pointer hover:shadow-lg transition-all ${
            !drilldown ? 'ring-2 ring-brand-cyan border-brand-cyan' : 'border-border'
          }`}
          onClick={() => { setDrilldown(null); setSearchText(''); }}
        >
          <div className="text-sm text-text-secondary mb-1">All</div>
          <div className="text-[28px] font-bold text-brand-cyan">
            {dashboard.totalCompliant + dashboard.totalWarnings + dashboard.totalNonCompliant + missingCount}
          </div>
        </div>
        <StatCard
          label="Compliant"
          value={dashboard.totalCompliant}
          color="green"
          onClick={() => handleCardClick('Current', 'Compliant')}
          active={drilldown?.status === 'Current' && !drilldown?.docType}
        />
        <StatCard
          label="Expiring Soon"
          value={dashboard.totalWarnings}
          color="amber"
          onClick={() => handleCardClick('Expiring', 'Expiring Soon')}
          active={drilldown?.status === 'Expiring' && !drilldown?.docType}
        />
        <div
          className={`bg-white border rounded-lg p-5 shadow-sm cursor-pointer hover:shadow-lg transition-all ${
            drilldown?.status === 'Expired' && !drilldown?.docType ? 'ring-2 ring-red-500 border-red-500' : 'border-border'
          }`}
          onClick={() => handleCardClick('Expired', 'Non-Compliant')}
        >
          <div className="text-sm text-text-secondary mb-1">Non-Compliant</div>
          <div className="text-[28px] font-bold text-red-600">{dashboard.totalNonCompliant}</div>
        </div>
        <div
          className={`bg-white border rounded-lg p-5 shadow-sm cursor-pointer hover:shadow-lg transition-all ${
            drilldown?.status === 'Missing' && !drilldown?.docType ? 'ring-2 ring-purple-500 border-purple-500' : 'border-border'
          }`}
          onClick={() => handleCardClick('Missing', 'Missing Documents')}
        >
          <div className="text-sm text-text-secondary mb-1">Missing</div>
          <div className="text-[28px] font-bold text-purple-600">{missingCount}</div>
        </div>
        <div className="bg-white border border-border rounded-lg p-5 shadow-sm">
          <div className="text-sm text-text-secondary mb-1">Fleet Score</div>
          <ComplianceScoreRing percent={dashboard.fleetCompliancePercent} />
        </div>
        </div>
      </div>

      {/* Drivers / Contractors monitoring tabs — Compliance Risk (the
          expiry/drill-down list below) and Awaiting Approval (the tenant
          courier-approval queue). Fleet Compliance Overview above stays put. */}
      <div className="flex gap-1 rounded-2xl border border-border bg-white p-1 shadow-sm w-fit">
        <button
          onClick={() => setDriverTab('risk')}
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
            driverTab === 'risk' ? 'bg-brand-cyan/15 text-brand-dark' : 'text-text-secondary hover:bg-slate-50'
          }`}
        >
          Compliance Risk
        </button>
        <button
          onClick={() => setDriverTab('approval')}
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
            driverTab === 'approval' ? 'bg-brand-cyan/15 text-brand-dark' : 'text-text-secondary hover:bg-slate-50'
          }`}
        >
          Awaiting Approval
        </button>
      </div>

      {driverTab === 'approval' && <DriverApproval />}

      {/* Drill-down List — Compliance Risk tab */}
      {driverTab === 'risk' && (
        <div className="bg-white border border-border rounded-lg p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-text-primary">{drilldown ? drilldown.label : 'Compliance Risk'}</h3>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-brand-cyan/10 text-brand-cyan">
                {courierRows.length} courier{courierRows.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search courier..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="border border-border rounded-md px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-brand-cyan/50"
              />
              {drilldown && (
                <button
                  onClick={() => { setDrilldown(null); setSearchText(''); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-border text-text-secondary hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  Clear Filter
                </button>
              )}
            </div>
          </div>

          {alertsLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-cyan" />
            </div>
          ) : courierRows.length === 0 ? (
            <div className="text-center py-8 text-text-secondary">
              <div className="text-4xl mb-2">📋</div>
              <p>No couriers match this filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2.5 pr-4 text-text-secondary font-medium">Code</th>
                    <th className="text-left py-2.5 pr-4 text-text-secondary font-medium">Name</th>
                    <th className="text-left py-2.5 pr-4 text-text-secondary font-medium">Role</th>
                    <th className="text-left py-2.5 pr-4 text-text-secondary font-medium">Phone</th>
                    <th className="text-left py-2.5 pr-4 text-text-secondary font-medium">Email</th>
                    <th className="text-left py-2.5 pr-4 text-text-secondary font-medium">Vehicle</th>
                    <th className="text-left py-2.5 pr-4 text-text-secondary font-medium">Network Partner</th>
                    <th className="text-center py-2.5 px-2 text-text-secondary font-medium">Required</th>
                    <th className="text-center py-2.5 px-2 text-text-secondary font-medium">Current</th>
                    <th className="text-center py-2.5 px-2 text-text-secondary font-medium">Expiring</th>
                    <th className="text-center py-2.5 px-2 text-text-secondary font-medium">Expired</th>
                    <th className="text-center py-2.5 px-2 text-text-secondary font-medium">Missing</th>
                    <th className="text-left py-2.5 text-text-secondary font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {courierRows.map((r) => (
                    <tr key={r.courierId} className="border-b border-border last:border-b-0 hover:bg-gray-50">
                      <td className="py-2.5 pr-4 text-text-secondary">{r.code || '—'}</td>
                      <td className="py-2.5 pr-4 font-medium text-text-primary">{r.name}</td>
                      <td className="py-2.5 pr-4 text-text-secondary">{r.role || '—'}</td>
                      <td className="py-2.5 pr-4 text-text-secondary">{r.phone || '—'}</td>
                      <td className="py-2.5 pr-4 text-text-secondary">{r.email || '—'}</td>
                      <td className="py-2.5 pr-4 text-text-secondary">{r.vehicle || '—'}</td>
                      <td className="py-2.5 pr-4 text-text-secondary">{r.networkPartner || 'Direct'}</td>
                      <td className="text-center py-2.5 px-2 text-text-secondary">{r.required}</td>
                      <td className="text-center py-2.5 px-2"><span className={r.current > 0 ? 'text-green-600 font-medium' : 'text-text-secondary'}>{r.current}</span></td>
                      <td className="text-center py-2.5 px-2"><span className={r.expiring > 0 ? 'text-amber-600 font-medium' : 'text-text-secondary'}>{r.expiring}</span></td>
                      <td className="text-center py-2.5 px-2"><span className={r.expired > 0 ? 'text-red-600 font-medium' : 'text-text-secondary'}>{r.expired}</span></td>
                      <td className="text-center py-2.5 px-2"><span className={r.missing > 0 ? 'text-purple-600 font-medium' : 'text-text-secondary'}>{r.missing}</span></td>
                      <td className="py-2.5">
                        <button
                          onClick={() => navigate(`/courier/${r.courierId}?tab=documents`)}
                          title="View Documents"
                          className="p-1.5 rounded-md bg-gray-100 text-text-secondary hover:bg-gray-200 transition-colors"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
