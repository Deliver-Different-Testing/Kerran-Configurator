import { useEffect, useState } from 'react';
import {
  courierScheduleService,
  type CourierScheduleItem,
} from '@/services/courier_scheduleService';
import { extractCourierError } from '@/services/courier_api';

// Phase 2 — courier availability. Renders inside CourierPortalShell. Lists
// upcoming schedules for the courier's region and lets them mark
// Available / Unavailable (with an optional time-slot pick). StatusId 1=Available,
// 2=Unavailable.

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const fmtSlot = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export default function CourierSchedule() {
  const [items, setItems] = useState<CourierScheduleItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [slotPick, setSlotPick] = useState<Record<number, number>>({});

  useEffect(() => {
    let alive = true;
    courierScheduleService.list()
      .then(d => { if (alive) setItems(d); })
      .catch(e => { if (alive) setError(extractCourierError(e, 'Could not load your schedule.')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  async function respond(item: CourierScheduleItem, available: boolean) {
    setBusyId(item.id); setError(null);
    try {
      const updated = available
        ? await courierScheduleService.available(item.id, slotPick[item.id])
        : await courierScheduleService.unavailable(item.id);
      setItems(updated);
    } catch (e) {
      setError(extractCourierError(e, 'Could not update your availability.'));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <Card>Loading…</Card>;
  if (error && !items) return <Card><div className="text-sm text-red-700">⚠️ {error}</div></Card>;

  return (
    <div className="space-y-4">
      <Card>
        <h1 className="text-xl font-bold text-text-primary">Schedule</h1>
        <p className="text-sm text-text-muted">Let dispatch know when you're available to work.</p>
      </Card>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-sm">⚠️ {error}</div>}

      {items && items.length === 0 && (
        <Card><div className="text-sm text-text-muted">No upcoming schedules for your region right now.</div></Card>
      )}

      {items?.map(item => {
        const status = item.response?.statusId;
        return (
          <div key={item.id} className="rounded-lg bg-white border border-border shadow-sm p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-text-primary">{fmtDate(item.bookDate)} · {item.name || 'Shift'}</div>
                <div className="text-xs text-text-muted">{item.startTime}–{item.endTime} · {item.wanted} wanted</div>
              </div>
              {status === 1 && <span className="text-xs px-2 py-1 rounded-full bg-success-bg text-success font-semibold">Available</span>}
              {status === 2 && <span className="text-xs px-2 py-1 rounded-full bg-surface-light text-text-muted font-semibold">Unavailable</span>}
            </div>

            {item.hasTimeSlots && (
              <div className="mt-3">
                <label className="text-xs text-text-secondary uppercase tracking-wide">Preferred time slot</label>
                <select
                  value={slotPick[item.id] ?? item.response?.timeSlotId ?? ''}
                  onChange={e => setSlotPick(p => ({ ...p, [item.id]: Number(e.target.value) }))}
                  className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm"
                >
                  <option value="">Any</option>
                  {item.timeSlots.map(t => (
                    <option key={t.id} value={t.id} disabled={t.remaining !== null && t.remaining <= 0}>
                      {fmtSlot(t.bookDateTime)}{t.remaining !== null ? ` (${Math.max(t.remaining, 0)} left)` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => respond(item, true)}
                disabled={busyId === item.id}
                className="px-4 py-1.5 text-sm font-bold rounded-full bg-brand-cyan text-brand-dark hover:shadow-cyan-glow disabled:opacity-50"
              >
                I'm available
              </button>
              <button
                onClick={() => respond(item, false)}
                disabled={busyId === item.id}
                className="px-4 py-1.5 text-sm font-semibold rounded-full border border-border text-text-secondary hover:bg-surface-light disabled:opacity-50"
              >
                Not available
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg bg-white border border-border shadow-sm p-5">{children}</div>;
}
