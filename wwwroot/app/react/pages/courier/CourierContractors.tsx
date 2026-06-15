import { useEffect, useState } from 'react';
import { courierContractorsService, type CourierContractor } from '@/services/courier_contractorsService';
import { extractCourierError } from '@/services/courier_api';

// Phase 2 — master courier manages subcontractor splits. Percentages edited as
// whole numbers (0–100), sent as fractions (0–1). Empty state for couriers with
// no subs.

interface RowDraft { percentage: string; fuelPercentage: string; bonusPercentage: string; }
const toPct = (frac: number) => Math.round(frac * 10000) / 100;          // 0.42 -> 42
const toFrac = (pct: string) => Math.round(Number(pct) * 100) / 10000;   // "42" -> 0.42

export default function CourierContractors() {
  const [items, setItems] = useState<CourierContractor[] | null>(null);
  const [drafts, setDrafts] = useState<Record<number, RowDraft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    courierContractorsService.list()
      .then(d => { if (!alive) return; setItems(d); setDrafts(seed(d)); })
      .catch(e => { if (alive) setError(extractCourierError(e, 'Could not load your subcontractors.')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) return <Card>Loading…</Card>;
  if (error && !items) return <Card><div className="text-sm text-red-700">⚠️ {error}</div></Card>;

  async function save(c: CourierContractor) {
    const d = drafts[c.id];
    setBusyId(c.id); setError(null); setSavedId(null);
    try {
      const updated = await courierContractorsService.update(c.id, {
        percentage: toFrac(d.percentage),
        fuelPercentage: toFrac(d.fuelPercentage),
        bonusPercentage: toFrac(d.bonusPercentage),
      });
      setItems(prev => prev?.map(x => x.id === c.id ? updated : x) ?? null);
      setSavedId(c.id);
    } catch (e) {
      setError(extractCourierError(e, 'Could not save the split.'));
    } finally {
      setBusyId(null);
    }
  }

  const set = (id: number, k: keyof RowDraft) => (v: string) => {
    setSavedId(null);
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [k]: v } }));
  };

  return (
    <div className="space-y-4">
      <Card>
        <h1 className="text-xl font-bold text-text-primary">Subcontractors</h1>
        <p className="text-sm text-text-muted">Set the payment, fuel and bonus split for each of your drivers.</p>
      </Card>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-sm">⚠️ {error}</div>}

      {items && items.length === 0 && (
        <Card><div className="text-sm text-text-muted">You don't have any subcontractors linked to your account.</div></Card>
      )}

      {items?.map(c => {
        const d = drafts[c.id];
        return (
          <div key={c.id} className="rounded-lg bg-white border border-border shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-text-primary">{c.firstName} {c.surname} <span className="text-text-muted font-normal">· {c.code}</span></div>
              {savedId === c.id && <span className="text-xs text-success">✅ Saved</span>}
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <Pct label="Payment %" value={d.percentage} onChange={set(c.id, 'percentage')} />
              <Pct label="Fuel %" value={d.fuelPercentage} onChange={set(c.id, 'fuelPercentage')} />
              <Pct label="Bonus %" value={d.bonusPercentage} onChange={set(c.id, 'bonusPercentage')} />
            </div>
            <div className="flex justify-end mt-3">
              <button
                onClick={() => save(c)}
                disabled={busyId === c.id}
                className="px-4 py-1.5 text-sm font-bold rounded-full bg-brand-cyan text-brand-dark hover:shadow-cyan-glow disabled:opacity-50"
              >
                {busyId === c.id ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Pct({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-text-secondary uppercase tracking-wide">{label}</label>
      <input
        type="number" min="0" max="100" step="0.01"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="rounded-md border border-border px-3 py-2 text-sm"
      />
    </div>
  );
}

function seed(items: CourierContractor[]): Record<number, RowDraft> {
  return Object.fromEntries(items.map(c => [c.id, {
    percentage: String(toPct(c.percentage)),
    fuelPercentage: String(toPct(c.fuelPercentage)),
    bonusPercentage: String(toPct(c.bonusPercentage)),
  }]));
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg bg-white border border-border shadow-sm p-5">{children}</div>;
}
