import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Undo2, X } from 'lucide-react';
import type { AvailableService, Customer } from '@/data/sampleCustomers';
import AccountDetailsTab, { type AccountTabGroupId } from './AccountDetailsTab';
import AvailableServicesTab from './AvailableServicesTab';
import ActivityTab from './ActivityTab';
import ContextPanel from './ContextPanel';
import CustomerHero from './CustomerHero';
import CustomerOverviewTab from './CustomerOverviewTab';
import CustomerContactsTab from './CustomerContactsTab';

interface Props {
  customer: Customer;
  onClose: () => void;
  onSave?: (updated: Customer) => void;
}

/* ------------------------------------------------------------------ */
/*  Tab list                                                            */
/*  Consolidated 7 → 5 (Steve 2026-06-05 reimagining):                 */
/*  - Turnover / Communications / History merged into Activity timeline */
/* ------------------------------------------------------------------ */

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'profile', label: 'Profile' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'operations', label: 'Operations' },
  { id: 'services', label: 'Available Services' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'activity', label: 'Activity' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function CustomerDetailModal({ customer, onClose, onSave }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [draft, setDraft] = useState<Customer>(customer);

  useEffect(() => setDraft(customer), [customer.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const update = <K extends keyof Customer>(key: K, value: Customer[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  // Dirty-state — count fields that differ from the loaded customer
  const dirtyCount = useMemo(() => {
    let count = 0;
    const keys = new Set<keyof Customer>([
      ...(Object.keys(customer) as (keyof Customer)[]),
      ...(Object.keys(draft) as (keyof Customer)[]),
    ]);
    keys.forEach((k) => {
      if (JSON.stringify(customer[k]) !== JSON.stringify(draft[k])) count += 1;
    });
    return count;
  }, [customer, draft]);

  const isDirty = dirtyCount > 0;

  return (
    <div className="fixed inset-0 z-[100] bg-white flex">
      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <div className="px-6 pt-4 pb-3 border-b border-slate-200 flex items-center gap-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-brand-dark transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-extrabold text-brand-dark truncate">{draft.displayName}</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-brand-cyan/15 text-brand-cyan text-xs font-bold uppercase tracking-wider">
                Customer
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-mono">
                {draft.code}
              </span>
            </div>
          </div>

          {/* Dirty-state pill */}
          {isDirty && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                {dirtyCount} unsaved change{dirtyCount === 1 ? '' : 's'}
              </span>
              <button
                onClick={() => setDraft(customer)}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-600 hover:text-brand-dark hover:bg-slate-100 rounded-md transition-colors"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Discard
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 text-sm font-semibold text-white bg-brand-cyan hover:bg-brand-cyan/90 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors"
              onClick={() => {
                onSave?.(draft);
                onClose();
              }}
              disabled={!isDirty}
            >
              Save Changes
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-brand-dark transition-colors ml-1"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Hero summary header */}
        <CustomerHero customer={draft} />

        {/* Tab strip */}
        <div className="px-6 border-b border-slate-200 flex-shrink-0 overflow-x-auto bg-white">
          <div className="flex gap-0 min-w-max">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  activeTab === tab.id
                    ? 'text-brand-cyan border-brand-cyan'
                    : 'text-slate-500 border-transparent hover:text-brand-dark'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          <div className="px-6 py-5">
            {activeTab === 'overview' && <CustomerOverviewTab customer={draft} />}
            {(activeTab === 'profile' || activeTab === 'commercial' || activeTab === 'operations') && (
              <AccountDetailsTab
                customer={draft}
                onChange={update}
                groupId={activeTab as AccountTabGroupId}
              />
            )}
            {activeTab === 'services' && (
              <AvailableServicesTab
                customer={draft}
                onChange={(services: AvailableService[]) => update('availableServices', services)}
              />
            )}
            {activeTab === 'contacts' && <CustomerContactsTab customer={draft} />}
            {activeTab === 'activity' && <ActivityTab customer={draft} />}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 flex justify-between items-center flex-shrink-0 bg-white">
          <button
            className="text-sm font-semibold text-red-600 hover:text-red-700 flex items-center gap-1.5"
            onClick={() => {/* deactivate flow — placeholder */}}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
            {draft.active ? 'Deactivate Customer' : 'Reactivate Customer'}
          </button>
          <div className="text-xs text-slate-400">
            Changes apply on Save. Press Esc or click Back to discard.
          </div>
        </div>
      </div>

      <ContextPanel customer={draft} />
    </div>
  );
}

/* ================================================================== */
/*  Coming Soon placeholder                                             */
/* ================================================================== */

function ComingSoonTab({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-brand-cyan/10 flex items-center justify-center mb-4">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-cyan">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <h3 className="text-base font-bold text-brand-dark">{label}</h3>
      <p className="text-sm text-slate-500 mt-1.5 max-w-md">
        Next iteration. The tab strip and modal chrome are real for review.
      </p>
    </div>
  );
}
