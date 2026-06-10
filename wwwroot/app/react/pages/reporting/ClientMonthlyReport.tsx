import { useState, useRef, useEffect } from 'react';
import { rateScheduleService, type ReportingClient } from '@/services/reporting_rateScheduleService';
import { downloadClientMonthlyReport, type ReportFormat } from '@/services/reporting_clientMonthlyService';

// Client Reporting — Client Monthly Report runner. Ported from AdminManager's
// reportView for this one report: pick a client + month range + format, Run →
// the backend renders the QuestPDF/ClosedXML doc (shared DeliverDifferentReporting
// package) and the file downloads. Client search is NP-scoped server-side.

function cn(...c: (string | false | undefined | null)[]) { return c.filter(Boolean).join(' '); }

const svg = (path: React.ReactNode) => ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>{path}</svg>
);
const SearchIcon = svg(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>);
const XIcon = svg(<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>);
const FileTextIcon = svg(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>);
const AlertTriangleIcon = svg(<><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>);

function currentMonthRange() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const first = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const lastStr = `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`;
  return { first, lastStr };
}

function ClientPicker({ selected, onSelect }: { selected: ReportingClient | null; onSelect: (c: ReportingClient | null) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ReportingClient[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      try { setResults((await rateScheduleService.searchClients(query)).data); } catch { setResults([]); }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
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
          className="w-full pl-9 pr-8 py-2.5 rounded-lg border border-[#cfced5] bg-white text-sm text-[#0d0c2c] placeholder:text-[#9e9da8] focus:outline-none focus:border-[#3bc7f4] focus:ring-2 focus:ring-[#3bc7f4]/20"
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
            <button key={c.id} onClick={() => { onSelect(c); setQuery(''); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 hover:bg-[#f4f2f1] flex items-center justify-between transition-colors">
              <span className="text-sm font-medium text-[#0d0c2c]">{c.name}</span>
              <span className="text-xs text-[#6e6d80] font-mono">{c.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClientMonthlyReport() {
  const { first, lastStr } = currentMonthRange();
  const [client, setClient] = useState<ReportingClient | null>(null);
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(lastStr);
  const [format, setFormat] = useState<ReportFormat>('PDF');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRun = !!client && !!from && !!to && !running;

  const run = async () => {
    if (!client) return;
    setError(null);
    setRunning(true);
    try {
      await downloadClientMonthlyReport(
        { clientId: client.id, from, to, format },
        `Client Monthly Report - ${client.name}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Report generation failed.');
    } finally {
      setRunning(false);
    }
  };

  const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-[#cfced5] bg-white text-sm text-[#0d0c2c] focus:outline-none focus:border-[#3bc7f4] focus:ring-2 focus:ring-[#3bc7f4]/20';

  return (
    <div className="p-8 max-w-[760px] mx-auto">
      <div className="mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#3bc7f4]/10 flex items-center justify-center">
          <FileTextIcon size={20} className="text-[#3bc7f4]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#0d0c2c]">Client Monthly Report</h1>
          <p className="text-sm text-[#6e6d80]">Monthly performance summary, expenditure and job detail for a client</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#cfced5] p-6 shadow-sm space-y-5">
        <ClientPicker selected={client} onSelect={setClient} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-[#0d0c2c] mb-1.5">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#0d0c2c] mb-1.5">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#0d0c2c] mb-1.5">Format</label>
          <div className="flex gap-2">
            {(['PDF', 'EXCEL'] as ReportFormat[]).map(f => (
              <button key={f} onClick={() => setFormat(f)}
                className={cn('px-4 py-2 rounded-lg text-sm font-semibold border transition-all',
                  format === f ? 'bg-[#0d0c2c] border-[#0d0c2c] text-white' : 'bg-white border-[#cfced5] text-[#6e6d80] hover:border-[#9e9da8]')}>
                {f === 'EXCEL' ? 'Excel' : 'PDF'}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[#f8d6da] text-[#0d0c2c] text-sm">
            <AlertTriangleIcon size={16} /> {error}
          </div>
        )}

        <button
          onClick={run}
          disabled={!canRun}
          className={cn('w-full py-3 px-6 rounded-full font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2',
            canRun ? 'bg-[#3bc7f4] text-white hover:bg-[#2ab0dd] active:scale-[0.98]' : 'bg-[#cfced5] text-[#9e9da8] cursor-not-allowed')}
        >
          {running && (
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {running ? 'Generating…' : 'Run Report'}
        </button>
        {!client && <p className="text-xs text-center text-[#9e9da8]">Select a client to run the report.</p>}
      </div>
    </div>
  );
}
