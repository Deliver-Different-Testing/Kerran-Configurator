import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  rateScheduleService,
  type ReportingClient,
  type ReportingSpeed,
  type ReportingSuburb,
  type RateScheduleItem,
} from '@/services/reporting_rateScheduleService';

// Client Reporting — Rate Schedule generator. Ported from the standalone
// clientcustomreportbuilder app, scoped to the live Existing-Client flow:
// pick a client → choose service speeds → choose destination suburbs →
// generate the suburb x speed rate matrix (priced by the legacy UTL_fncJob_*
// rating functions) → export CSV. The source's Prospect mode + ZIP/upload +
// regional/international tabs were mock-only / non-functional and are left for
// a later slice; regional & international service groups are gated off here.

// ── Helpers ──
function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

const REGIONAL_OR_INTL = /regional|international/i;

// ── Inline icons (no lucide dep in the configurator) ──
type IconProps = { size?: number; className?: string };
const svg = (path: React.ReactNode) => ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
    {path}
  </svg>
);
const SearchIcon = svg(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>);
const DownloadIcon = svg(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>);
const PrinterIcon = svg(<><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>);
const FileTextIcon = svg(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>);
const ChevronDownIcon = svg(<polyline points="6 9 12 15 18 9" />);
const CheckIcon = svg(<polyline points="20 6 9 17 4 12" />);
const XIcon = svg(<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>);
const ZapIcon = svg(<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />);
const AlertTriangleIcon = svg(<><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>);

// ── Client Search ──
function ClientSelector({ selected, onSelect }: { selected: ReportingClient | null; onSelect: (c: ReportingClient | null) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ReportingClient[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await rateScheduleService.searchClients(query);
        setResults(res.data);
      } catch {
        setResults([]);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-semibold text-[#0d0c2c] mb-1.5">Client</label>
      <div className="relative">
        <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9e9da8]" />
        <input
          type="text"
          placeholder="Search by client name or code…"
          value={selected ? `${selected.name} (${selected.code})` : query}
          onChange={e => { setQuery(e.target.value); onSelect(null); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="w-full pl-9 pr-8 py-2.5 rounded-lg border border-[#cfced5] bg-white text-sm text-[#0d0c2c] placeholder:text-[#9e9da8] focus:outline-none focus:border-[#3bc7f4] focus:ring-2 focus:ring-[#3bc7f4]/20 transition-all"
        />
        {selected && (
          <button onClick={() => { onSelect(null); setQuery(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9e9da8] hover:text-[#0d0c2c]">
            <XIcon size={14} />
          </button>
        )}
      </div>
      {open && !selected && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg border border-[#cfced5] shadow-lg max-h-64 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[#9e9da8]">{query.length >= 2 ? 'No clients found' : 'Type to search…'}</div>
          ) : results.map(c => (
            <button
              key={c.id}
              onClick={() => { onSelect(c); setQuery(''); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 hover:bg-[#f4f2f1] flex items-center justify-between transition-colors"
            >
              <span className="text-sm font-medium text-[#0d0c2c]">{c.name}</span>
              <span className="text-xs text-[#6e6d80] font-mono">{c.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Toggle Pill ──
function TogglePill({ label, sublabel, checked, onChange }: { label: string; sublabel?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all',
        checked
          ? 'bg-[#3bc7f4]/10 border-[#3bc7f4] text-[#0d0c2c]'
          : 'bg-white border-[#cfced5] text-[#6e6d80] hover:border-[#9e9da8]'
      )}
    >
      {checked && <CheckIcon size={14} className="text-[#3bc7f4]" />}
      {label}
      {sublabel && <span className="text-xs text-[#9e9da8]">{sublabel}</span>}
    </button>
  );
}

// ── Toggle Switch ──
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer">
      <div
        onClick={() => onChange(!checked)}
        className={cn('w-10 h-[22px] rounded-full relative transition-colors cursor-pointer', checked ? 'bg-[#3bc7f4]' : 'bg-[#cfced5]')}
      >
        <div className={cn('w-[18px] h-[18px] bg-white rounded-full absolute top-[2px] transition-all shadow-sm', checked ? 'left-[20px]' : 'left-[2px]')} />
      </div>
      <span className="text-sm text-[#0d0c2c]">{label}</span>
    </label>
  );
}

// ── Select All / Deselect All ──
function BulkButtons({ onSelectAll, onDeselectAll }: { onSelectAll: () => void; onDeselectAll: () => void }) {
  return (
    <div className="flex gap-2">
      <button onClick={onSelectAll} className="text-xs text-[#3bc7f4] hover:text-[#0d0c2c] font-medium transition-colors">Select All</button>
      <span className="text-[#cfced5]">|</span>
      <button onClick={onDeselectAll} className="text-xs text-[#3bc7f4] hover:text-[#0d0c2c] font-medium transition-colors">Deselect All</button>
    </div>
  );
}

// ── Rate Cell ──
function RateCell({ rate, availability }: { rate: number; availability: string }) {
  const bg = availability === 'Available' ? 'bg-[#d0f1e0] text-[#0d0c2c]'
    : availability === 'Possible' ? 'bg-[#ffe6d1] text-[#0d0c2c]'
    : 'bg-[#f8d6da] text-[#6e6d80]';
  return (
    <td className="px-4 py-2.5 text-right">
      <span className={cn('inline-block px-2 py-0.5 rounded text-xs font-medium', bg)}>
        {availability === 'Unavailable' ? 'N/A' : `$${rate.toFixed(2)}`}
      </span>
    </td>
  );
}

// ── Main Component ──
export default function RateSchedule() {
  const [selectedClient, setSelectedClient] = useState<ReportingClient | null>(null);

  // Services / speeds
  const [speeds, setSpeeds] = useState<ReportingSpeed[]>([]);
  const [selectedSpeeds, setSelectedSpeeds] = useState<Set<number>>(new Set());
  const [activeGroupFilter, setActiveGroupFilter] = useState<number | 'all'>('all');

  useEffect(() => {
    rateScheduleService.getSpeeds().then(res => {
      const data = res.data;
      setSpeeds(data);
      // Default-select the first non-regional/international group's speeds.
      const firstGroup = data.find(s => !REGIONAL_OR_INTL.test(s.groupingName ?? ''));
      if (firstGroup) {
        setSelectedSpeeds(new Set(data.filter(s => s.groupingId === firstGroup.groupingId).map(s => s.id)));
      }
    }).catch(() => setSpeeds([]));
  }, []);

  // Suburbs — fetched when the selected client's site changes
  const [suburbs, setSuburbs] = useState<ReportingSuburb[]>([]);
  useEffect(() => {
    const siteId = selectedClient?.siteId;
    if (!siteId) { setSuburbs([]); return; }
    rateScheduleService.getSuburbs(siteId).then(res => setSuburbs(res.data)).catch(() => setSuburbs([]));
  }, [selectedClient?.siteId]);

  // Destination selection
  const [selectedSuburbs, setSelectedSuburbs] = useState<Set<number>>(new Set());
  const [suburbSearch, setSuburbSearch] = useState('');

  // Options
  const [includeGst, setIncludeGst] = useState(false);
  const [includeFuel, setIncludeFuel] = useState(false);
  const [markup, setMarkup] = useState(0);
  const [includePpd, setIncludePpd] = useState(false);
  const [preparedFor, setPreparedFor] = useState('');
  const [fromSuburbOverride, setFromSuburbOverride] = useState<number | null>(null);

  // Generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateToast, setGenerateToast] = useState<'success' | 'error' | null>(null);
  const [rateItems, setRateItems] = useState<RateScheduleItem[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<number | null>(null);

  // ── Service group derivations ──
  const uniqueGroups = useMemo(() => {
    const seen = new Map<number, string>();
    for (const s of speeds) {
      if (!seen.has(s.groupingId)) seen.set(s.groupingId, s.groupingName ?? `Group ${s.groupingId}`);
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [speeds]);

  const speedsByGroup = useMemo(() => {
    const map = new Map<number, ReportingSpeed[]>();
    for (const s of speeds) {
      const group = map.get(s.groupingId) ?? [];
      group.push(s);
      map.set(s.groupingId, group);
    }
    return map;
  }, [speeds]);

  const toggleGroup = useCallback((groupId: number) => {
    const groupIds = speeds.filter(s => s.groupingId === groupId).map(s => s.id);
    const allSelected = groupIds.every(id => selectedSpeeds.has(id));
    const next = new Set(selectedSpeeds);
    if (allSelected) groupIds.forEach(id => next.delete(id));
    else groupIds.forEach(id => next.add(id));
    setSelectedSpeeds(next);
  }, [speeds, selectedSpeeds]);

  const isGroupFullySelected = useCallback((groupId: number) =>
    speeds.filter(s => s.groupingId === groupId).every(s => selectedSpeeds.has(s.id)),
    [speeds, selectedSpeeds]);

  const isGroupPartiallySelected = useCallback((groupId: number) => {
    const groupSpeeds = speeds.filter(s => s.groupingId === groupId);
    const count = groupSpeeds.filter(s => selectedSpeeds.has(s.id)).length;
    return count > 0 && count < groupSpeeds.length;
  }, [speeds, selectedSpeeds]);

  const activeGroups = useMemo(() =>
    uniqueGroups.filter(g => speeds.filter(s => s.groupingId === g.id).some(s => selectedSpeeds.has(s.id))),
    [uniqueGroups, speeds, selectedSpeeds]);

  // Destinations = suburbs for the client's site
  const filteredSuburbs = useMemo(() => {
    if (!suburbSearch) return suburbs;
    const q = suburbSearch.toLowerCase();
    return suburbs.filter(s => s.name.toLowerCase().includes(q));
  }, [suburbs, suburbSearch]);

  // Auto-select all destinations when the list changes
  useEffect(() => {
    setSelectedSuburbs(new Set(suburbs.map(s => s.id)));
  }, [suburbs]);

  const fromSuburbId = fromSuburbOverride ?? (selectedClient?.homeSuburbId ?? suburbs[0]?.id ?? null);
  const fromSuburbName = suburbs.find(s => s.id === fromSuburbId)?.name
    ?? selectedClient?.homeSuburbName ?? 'Default';

  const canGenerate = !!selectedClient && selectedSpeeds.size > 0 && selectedSuburbs.size > 0;

  const handleGenerate = useCallback(async () => {
    if (!selectedClient) return;
    setIsGenerating(true);
    try {
      const res = await rateScheduleService.generate({
        clientId: selectedClient.id,
        fromSuburbId: fromSuburbId || null,
        preparedFor: preparedFor || null,
        includeGst,
        includeFuelSurcharge: includeFuel,
        markup,
        includePpd,
        suburbIds: Array.from(selectedSuburbs),
        jobTypeIds: Array.from(selectedSpeeds),
      });
      setRateItems(res.data.items ?? []);
      setShowPreview(true);
      if (activeGroups.length > 0) setActiveTab(activeGroups[0].id);
      setGenerateToast('success');
      setTimeout(() => setGenerateToast(null), 3000);
    } catch (err) {
      console.error('Rate generation failed:', err);
      setGenerateToast('error');
      setTimeout(() => setGenerateToast(null), 4000);
    } finally {
      setIsGenerating(false);
    }
  }, [selectedClient, fromSuburbId, preparedFor, selectedSuburbs, selectedSpeeds, includeGst, includeFuel, markup, includePpd, activeGroups]);

  // ── Pivot build (suburb-based groups only) ──
  type PivotSection = { speeds: string[]; rows: { suburb: string; cells: Map<string, RateScheduleItem> }[] };

  const buildPivotForGroup = useCallback((groupId: number): PivotSection | null => {
    const groupName = uniqueGroups.find(g => g.id === groupId)?.name ?? '';
    if (REGIONAL_OR_INTL.test(groupName)) return null;
    const selectedJobTypes = speeds
      .filter(s => s.groupingId === groupId && selectedSpeeds.has(s.id))
      .sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0));
    if (selectedJobTypes.length === 0) return null;

    const speedNames = selectedJobTypes.map(j => j.shortName);
    const speedSet = new Set(speedNames);
    const bySuburb = new Map<string, Map<string, RateScheduleItem>>();
    for (const item of rateItems) {
      if (!speedSet.has(item.speedName)) continue;
      if (!bySuburb.has(item.toSuburbName)) bySuburb.set(item.toSuburbName, new Map());
      bySuburb.get(item.toSuburbName)!.set(item.speedName, item);
    }
    return { speeds: speedNames, rows: Array.from(bySuburb.entries()).map(([suburb, cells]) => ({ suburb, cells })) };
  }, [rateItems, selectedSpeeds, speeds, uniqueGroups]);

  const groupsWithData = useMemo(() => {
    const groups: { id: number; name: string }[] = [];
    for (const g of activeGroups) {
      if (REGIONAL_OR_INTL.test(g.name)) continue;
      const pivot = buildPivotForGroup(g.id);
      if (pivot && pivot.rows.length > 0) groups.push(g);
    }
    return groups;
  }, [activeGroups, buildPivotForGroup]);

  const renderSuburbTable = (groupId: number) => {
    const pivot = buildPivotForGroup(groupId);
    if (!pivot || pivot.rows.length === 0) return <div className="p-6 text-sm text-[#9e9da8]">No rates to display.</div>;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#0d0c2c] text-white">
              <th className="text-left px-4 py-3 font-semibold sticky left-0 bg-[#0d0c2c] z-10">Destination</th>
              {pivot.speeds.map(s => <th key={s} className="text-right px-4 py-3 font-semibold whitespace-nowrap">{s}</th>)}
            </tr>
          </thead>
          <tbody>
            {pivot.rows.map((row, i) => (
              <tr key={row.suburb} className={i % 2 === 0 ? 'bg-white' : 'bg-[#f8f7f7]'}>
                <td className={cn('px-4 py-2.5 font-medium text-[#0d0c2c] sticky left-0 z-10', i % 2 === 0 ? 'bg-white' : 'bg-[#f8f7f7]')}>
                  {row.suburb}
                </td>
                {pivot.speeds.map(s => {
                  const cell = row.cells.get(s);
                  if (!cell) return <td key={s} className="px-4 py-2.5 text-right text-[#9e9da8]">—</td>;
                  return <RateCell key={s} rate={cell.rate} availability={cell.availability} />;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const handleExportCsv = useCallback(() => {
    const lines: string[] = [];
    for (const group of groupsWithData) {
      const pivot = buildPivotForGroup(group.id);
      if (!pivot || pivot.rows.length === 0) continue;
      lines.push(group.name, '');
      lines.push(['Destination', ...pivot.speeds].join(','));
      for (const r of pivot.rows) {
        lines.push([r.suburb, ...pivot.speeds.map(s => {
          const cell = r.cells.get(s);
          return cell ? (cell.availability === 'Unavailable' ? 'N/A' : `$${cell.rate.toFixed(2)}`) : '';
        })].join(','));
      }
      lines.push('');
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rate-schedule-${selectedClient?.code ?? 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [buildPivotForGroup, groupsWithData, selectedClient]);

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      {/* Toast */}
      {generateToast && (
        <div className={cn(
          'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg text-sm font-medium transition-all',
          generateToast === 'success' ? 'bg-[#0d0c2c] text-white' : 'bg-[#f8d6da] text-[#0d0c2c]'
        )}>
          {generateToast === 'success'
            ? <><CheckIcon size={16} className="text-[#3bc7f4]" /> Rate schedule generated</>
            : <><AlertTriangleIcon size={16} /> Generation failed — check console</>}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#3bc7f4]/10 flex items-center justify-center">
            <ZapIcon size={20} className="text-[#3bc7f4]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0d0c2c]">Rate Schedule Generator</h1>
            <p className="text-sm text-[#6e6d80]">Generate a client rate card from live delivery rates</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-6">
        {/* Left Column — Main Config */}
        <div className="space-y-6">
          {/* Client Selector */}
          <div className="bg-white rounded-xl border border-[#cfced5] p-6 shadow-sm">
            <ClientSelector selected={selectedClient} onSelect={setSelectedClient} />
            {selectedClient && (
              <div className="mt-4 p-3 rounded-lg bg-[#f4f2f1] flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span><span className="text-[#6e6d80]">Code:</span> <span className="font-mono font-medium">{selectedClient.code}</span></span>
                {selectedClient.homeSuburbName && <span><span className="text-[#6e6d80]">Home:</span> {selectedClient.homeSuburbName}</span>}
                {selectedClient.ppdRate != null && <span><span className="text-[#6e6d80]">PPD:</span> {(selectedClient.ppdRate * 100).toFixed(2)}%</span>}
              </div>
            )}
          </div>

          {/* Services / Speeds */}
          <div className="bg-white rounded-xl border border-[#cfced5] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[#0d0c2c]">Services / Speeds</h2>
              <BulkButtons
                onSelectAll={() => setSelectedSpeeds(new Set(speeds.filter(s => !REGIONAL_OR_INTL.test(s.groupingName ?? '')).map(s => s.id)))}
                onDeselectAll={() => setSelectedSpeeds(new Set())}
              />
            </div>

            {/* Service Group Filter Pills */}
            <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-[#e6e5ea]">
              <button
                onClick={() => setActiveGroupFilter('all')}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                  activeGroupFilter === 'all' ? 'bg-[#0d0c2c] border-[#0d0c2c] text-white' : 'bg-white border-[#cfced5] text-[#6e6d80] hover:border-[#9e9da8]')}
              >
                All
              </button>
              {uniqueGroups.map(g => (
                <button
                  key={g.id}
                  onClick={() => setActiveGroupFilter(g.id)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                    activeGroupFilter === g.id ? 'bg-[#0d0c2c] border-[#0d0c2c] text-white' : 'bg-white border-[#cfced5] text-[#6e6d80] hover:border-[#9e9da8]')}
                >
                  {g.name}
                </button>
              ))}
            </div>

            {/* Grouped Job Types */}
            <div className="space-y-4">
              {uniqueGroups
                .filter(g => activeGroupFilter === 'all' || activeGroupFilter === g.id)
                .map(g => {
                  // Regional/International aren't suburb-priced by the legacy rating
                  // functions — gate them off until a real rate source is wired.
                  const disabled = REGIONAL_OR_INTL.test(g.name);
                  const groupSpeeds = speedsByGroup.get(g.id) ?? [];
                  const full = isGroupFullySelected(g.id);
                  const partial = isGroupPartiallySelected(g.id);
                  return (
                    <div key={g.id} className={disabled ? 'opacity-40 pointer-events-none' : ''}>
                      <div className="flex items-center gap-2 mb-2">
                        <button
                          onClick={() => toggleGroup(g.id)}
                          disabled={disabled}
                          className={cn('flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide transition-colors',
                            full ? 'text-[#3bc7f4]' : partial ? 'text-[#6e6d80]' : 'text-[#9e9da8]')}
                        >
                          <span className={cn('w-4 h-4 rounded border flex items-center justify-center transition-all',
                            full ? 'bg-[#3bc7f4] border-[#3bc7f4]' : partial ? 'border-[#3bc7f4] bg-[#3bc7f4]/20' : 'border-[#cfced5]')}>
                            {full && <CheckIcon size={10} className="text-white" />}
                            {partial && <span className="w-2 h-0.5 bg-[#3bc7f4] rounded" />}
                          </span>
                          {g.name}
                          {disabled && <span className="ml-1 text-[10px] normal-case tracking-normal font-normal">(not yet wired)</span>}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 ml-6">
                        {groupSpeeds.map(s => (
                          <TogglePill
                            key={s.id}
                            label={s.name}
                            sublabel={s.minutes ? `${s.minutes}m` : undefined}
                            checked={selectedSpeeds.has(s.id)}
                            onChange={v => {
                              const next = new Set(selectedSpeeds);
                              if (v) next.add(s.id); else next.delete(s.id);
                              setSelectedSpeeds(next);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Destinations */}
          <div className="bg-white rounded-xl border border-[#cfced5] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[#0d0c2c]">Destinations</h2>
              <BulkButtons
                onSelectAll={() => setSelectedSuburbs(new Set(suburbs.map(s => s.id)))}
                onDeselectAll={() => setSelectedSuburbs(new Set())}
              />
            </div>

            <p className="text-xs text-[#9e9da8] mb-3">
              {selectedClient ? `${suburbs.length} suburbs at this client's site • ${selectedSuburbs.size} selected` : 'Select a client to load destination suburbs.'}
            </p>

            {/* Suburb search */}
            <div className="relative mb-3">
              <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9e9da8]" />
              <input
                type="text"
                placeholder="Filter suburbs…"
                value={suburbSearch}
                onChange={e => setSuburbSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-[#cfced5] bg-white text-sm placeholder:text-[#9e9da8] focus:outline-none focus:border-[#3bc7f4] focus:ring-2 focus:ring-[#3bc7f4]/20"
              />
            </div>

            {/* Suburb checkboxes */}
            <div className="max-h-64 overflow-y-auto space-y-0.5 pr-1">
              {filteredSuburbs.map(s => (
                <label key={s.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-[#f4f2f1] cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedSuburbs.has(s.id)}
                    onChange={e => {
                      const next = new Set(selectedSuburbs);
                      if (e.target.checked) next.add(s.id); else next.delete(s.id);
                      setSelectedSuburbs(next);
                    }}
                    className="rounded border-[#cfced5] text-[#3bc7f4] focus:ring-[#3bc7f4]/20"
                  />
                  <span className="text-sm text-[#0d0c2c] flex-1">{s.name}</span>
                  <span className="text-xs text-[#9e9da8] font-mono">Z{s.zone}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column — Options + Actions */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-[#cfced5] p-6 shadow-sm space-y-5">
            <h2 className="text-base font-semibold text-[#0d0c2c]">Options</h2>

            <Toggle checked={includeGst} onChange={setIncludeGst} label="Include GST" />
            <Toggle checked={includeFuel} onChange={setIncludeFuel} label="Include Fuel Surcharge" />
            <Toggle checked={includePpd} onChange={setIncludePpd} label="Include PPD" />

            <div>
              <label className="block text-sm text-[#0d0c2c] mb-1">Markup %</label>
              <input
                type="number" min={0} max={100} value={markup}
                onChange={e => setMarkup(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-[#cfced5] bg-white text-sm focus:outline-none focus:border-[#3bc7f4] focus:ring-2 focus:ring-[#3bc7f4]/20"
              />
            </div>

            <div>
              <label className="block text-sm text-[#0d0c2c] mb-1">Prepared For</label>
              <input
                type="text" placeholder="e.g. John Smith" value={preparedFor}
                onChange={e => setPreparedFor(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#cfced5] bg-white text-sm placeholder:text-[#9e9da8] focus:outline-none focus:border-[#3bc7f4] focus:ring-2 focus:ring-[#3bc7f4]/20"
              />
            </div>

            <div>
              <label className="block text-sm text-[#0d0c2c] mb-1">From Location</label>
              <div className="relative">
                <select
                  value={fromSuburbId ?? ''}
                  onChange={e => setFromSuburbOverride(e.target.value ? Number(e.target.value) : null)}
                  className="w-full appearance-none px-3 py-2 pr-8 rounded-lg border border-[#cfced5] bg-white text-sm focus:outline-none focus:border-[#3bc7f4]"
                  disabled={!selectedClient}
                >
                  {selectedClient?.homeSuburbId != null && (
                    <option value={selectedClient.homeSuburbId}>{selectedClient.homeSuburbName ?? 'Home'} (default)</option>
                  )}
                  {suburbs.filter(s => s.id !== selectedClient?.homeSuburbId).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <ChevronDownIcon size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9e9da8] pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating}
            className={cn('w-full py-3 px-6 rounded-full font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2',
              canGenerate && !isGenerating
                ? 'bg-[#3bc7f4] text-white hover:bg-[#2ab0dd] active:scale-[0.98] shadow-[0_4px_12px_rgba(59,199,244,0.3)]'
                : 'bg-[#cfced5] text-[#9e9da8] cursor-not-allowed')}
          >
            {isGenerating && (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {isGenerating ? 'Generating…' : 'Generate Rate Schedule'}
          </button>

          {canGenerate && (
            <p className="text-xs text-center text-[#6e6d80]">
              {selectedSpeeds.size} speeds across {activeGroups.length} service group{activeGroups.length !== 1 ? 's' : ''} • {selectedSuburbs.size} destinations
            </p>
          )}
        </div>
      </div>

      {/* Preview with Tabs */}
      {showPreview && groupsWithData.length > 0 && (
        <div className="mt-8 bg-white rounded-xl border border-[#cfced5] shadow-sm overflow-hidden">
          <div className="p-6 border-b border-[#e6e5ea] flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#0d0c2c]">Rate Schedule — {selectedClient?.name ?? 'Unknown'}</h2>
              <p className="text-sm text-[#6e6d80] mt-0.5">
                From: {fromSuburbName}
                {preparedFor && <> • Prepared for: {preparedFor}</>}
                {includeGst && <> • GST incl.</>}
                {includeFuel && <> • Fuel incl.</>}
                {markup > 0 && <> • +{markup}% markup</>}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleExportCsv} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#cfced5] text-sm font-medium text-[#0d0c2c] hover:bg-[#f4f2f1] transition-colors">
                <DownloadIcon size={14} /> CSV
              </button>
              <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#cfced5] text-sm font-medium text-[#0d0c2c] opacity-50 cursor-not-allowed" title="Coming soon">
                <FileTextIcon size={14} /> PDF
              </button>
              <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#cfced5] text-sm font-medium text-[#0d0c2c] hover:bg-[#f4f2f1] transition-colors">
                <PrinterIcon size={14} /> Print
              </button>
            </div>
          </div>

          {/* Tabs — only when more than one group has data */}
          {groupsWithData.length > 1 && (
            <div className="flex border-b border-[#e6e5ea] bg-[#f8f7f7]">
              {groupsWithData.map(g => (
                <button
                  key={g.id}
                  onClick={() => setActiveTab(g.id)}
                  className={cn('px-6 py-3 text-sm font-semibold transition-all relative',
                    activeTab === g.id ? 'text-[#0d0c2c] bg-white' : 'text-[#6e6d80] hover:text-[#0d0c2c] hover:bg-white/50')}
                >
                  {g.name}
                  {activeTab === g.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3bc7f4]" />}
                </button>
              ))}
            </div>
          )}

          {/* Tab Content */}
          {(() => {
            const tabId = groupsWithData.length === 1 ? groupsWithData[0].id : activeTab;
            const tabGroup = groupsWithData.find(g => g.id === tabId);
            if (!tabGroup) return null;
            return renderSuburbTable(tabGroup.id);
          })()}

          {/* Legend */}
          <div className="px-6 py-3 border-t border-[#e6e5ea] flex gap-6 text-xs text-[#6e6d80]">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#d0f1e0]" /> Available</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#ffe6d1]" /> Possible</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#f8d6da]" /> Unavailable</span>
          </div>
        </div>
      )}
    </div>
  );
}
