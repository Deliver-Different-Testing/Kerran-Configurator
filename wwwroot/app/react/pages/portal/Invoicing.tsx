import { useState } from 'react';
import {
  mockCourier, getMockUninvoiced, mockRecentInvoices, mockPastInvoices,
  type Invoice, type UninvoicedData,
} from '@/services/portal_mockData';

type Section = 'list' | 'create' | 'view';

function fmt(n: number) { return `$${n.toFixed(2)}`; }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_COLORS: Record<string, string> = {
  Paid: 'bg-success/20 text-success',
  Pending: 'bg-warning/20 text-warning',
  Overdue: 'bg-error/20 text-error',
};

export default function PortalInvoicing() {
  const [section, setSection] = useState<Section>('list');
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [listMode, setListMode] = useState<'recent' | 'past'>('recent');
  const [pastLimit, setPastLimit] = useState(10);
  const [creating, setCreating] = useState(false);

  const country = mockCourier.country;
  const uninvoiced = getMockUninvoiced(country);

  const handleCreate = () => {
    setCreating(true);
    setTimeout(() => { setCreating(false); setSection('list'); }, 800);
  };

  const openInvoice = (inv: Invoice) => { setViewInvoice(inv); setSection('view'); };

  if (section === 'view' && viewInvoice) {
    return <InvoiceView invoice={viewInvoice} onBack={() => setSection('list')} />;
  }

  if (section === 'create') {
    return <InvoiceCreate uninvoiced={uninvoiced} creating={creating} onCreate={handleCreate} onBack={() => setSection('list')} />;
  }

  return (
    <div className="space-y-4">
      {/* Uninvoiced Total */}
      <div className="bg-brand-dark rounded-xl p-5 text-center">
        <div className="text-3xl font-bold text-white">{fmt(uninvoiced.courier.total)}</div>
        <div className="text-white/60 text-xs mt-1">To Invoice</div>
      </div>

      {/* Create Button */}
      <button
        onClick={() => setSection('create')}
        className="w-full bg-brand-cyan text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 text-sm hover:bg-brand-cyan/90 transition-colors"
      >
        ➕ Create Invoice
      </button>

      {/* Toggle Recent/Past */}
      <div className="flex gap-2">
        <button
          onClick={() => setListMode('recent')}
          className={`flex-1 py-2 rounded-lg text-xs font-medium ${listMode === 'recent' ? 'bg-brand-cyan text-white' : 'bg-white border border-border text-text-muted'}`}
        >
          Recent Invoices
        </button>
        <button
          onClick={() => setListMode('past')}
          className={`flex-1 py-2 rounded-lg text-xs font-medium ${listMode === 'past' ? 'bg-brand-cyan text-white' : 'bg-white border border-border text-text-muted'}`}
        >
          Past Invoices
        </button>
      </div>

      {/* Invoice List */}
      <div className="space-y-2">
        {(listMode === 'recent' ? mockRecentInvoices : mockPastInvoices.slice(0, pastLimit)).map(inv => (
          <button
            key={inv.invoiceNo}
            onClick={() => openInvoice(inv)}
            className="w-full bg-white rounded-xl border border-border p-3 flex items-center justify-between text-left hover:border-brand-cyan transition-colors"
          >
            <div>
              <div className="text-sm font-medium">{inv.invoiceNo}</div>
              <div className="text-xs text-text-muted">{fmtDate(inv.created)}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold">{fmt(inv.total)}</div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[inv.status]}`}>
                {inv.status}
              </span>
            </div>
          </button>
        ))}
      </div>

      {listMode === 'past' && pastLimit < mockPastInvoices.length && (
        <button onClick={() => setPastLimit(p => p + 10)} className="w-full text-center text-sm text-brand-cyan py-2">
          Show more...
        </button>
      )}
    </div>
  );
}

function InvoiceCreate({ uninvoiced, creating, onCreate, onBack }: {
  uninvoiced: UninvoicedData; creating: boolean; onCreate: () => void; onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-brand-cyan">← Back</button>

      <div className="bg-white rounded-xl border border-border p-4">
        <div className="text-center text-xs font-bold text-text-muted mb-3">TAX INVOICE</div>
        <div className="grid grid-cols-2 gap-3 text-xs mb-4">
          <div>
            <div className="text-text-muted">FROM</div>
            <div className="font-medium">{mockCourier.firstName} {mockCourier.surname}</div>
            <div className="text-text-muted">{mockCourier.address}</div>
          </div>
          <div className="text-right">
            <div className="text-text-muted">Date</div>
            <div className="font-medium">{new Date().toLocaleDateString('en-NZ')}</div>
            <div className="text-text-muted mt-1">Ref</div>
            <div className="font-medium">{mockCourier.code}</div>
          </div>
        </div>

        {/* Line Items */}
        <div className="border-t border-border pt-3 space-y-2">
          {uninvoiced.courier.runs.map((run, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span>{fmtDate(run.bookDate)} : {run.runName}</span>
              <span className="font-medium">{fmt(run.amount)}</span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t border-border mt-3 pt-3 space-y-1 text-xs">
          {(uninvoiced.courier.gstAmount !== 0 || uninvoiced.courier.withholdingTaxAmount !== 0) && (
            <div className="flex justify-between">
              <span className="text-text-muted">Subtotal</span>
              <span>{fmt(uninvoiced.courier.subtotal)}</span>
            </div>
          )}
          {uninvoiced.courier.gstAmount !== 0 && (
            <div className="flex justify-between">
              <span className="text-text-muted">GST ({uninvoiced.courier.gstPercentage}%)</span>
              <span>{fmt(uninvoiced.courier.gstAmount)}</span>
            </div>
          )}
          {uninvoiced.courier.withholdingTaxAmount !== 0 && (
            <div className="flex justify-between">
              <span className="text-text-muted">Withholding Tax ({uninvoiced.courier.withholdingTaxPercentage}%)</span>
              <span>-{fmt(uninvoiced.courier.withholdingTaxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm pt-1 border-t border-border">
            <span>Total</span>
            <span>{fmt(uninvoiced.courier.total)}</span>
          </div>
        </div>
      </div>

      <button
        onClick={onCreate}
        disabled={creating}
        className="w-full bg-brand-cyan text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50"
      >
        {creating ? '⏳ Creating...' : 'Create Invoice'}
      </button>
    </div>
  );
}

function InvoiceView({ invoice, onBack }: { invoice: Invoice; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-brand-cyan">← Back</button>

      <div className="bg-white rounded-xl border border-border p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="text-xs font-bold text-text-muted">TAX INVOICE</div>
            <div className="text-lg font-bold">{invoice.invoiceNo}</div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[invoice.status]}`}>
            {invoice.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs mb-4">
          <div><span className="text-text-muted">Date:</span> {fmtDate(invoice.created)}</div>
          <div><span className="text-text-muted">Ref:</span> {invoice.reference}</div>
        </div>

        <div className="border-t border-border pt-3 space-y-2">
          {invoice.lines.map((line, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span>{line.description}</span>
              <span className="font-medium">{fmt(line.total)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-border mt-3 pt-3 space-y-1 text-xs">
          {(invoice.gstAmount !== 0 || invoice.withholdingTaxAmount !== 0) && (
            <div className="flex justify-between">
              <span className="text-text-muted">Subtotal</span>
              <span>{fmt(invoice.subtotal)}</span>
            </div>
          )}
          {invoice.gstAmount !== 0 && (
            <div className="flex justify-between">
              <span className="text-text-muted">GST</span>
              <span>{fmt(invoice.gstAmount)}</span>
            </div>
          )}
          {invoice.withholdingTaxAmount !== 0 && (
            <div className="flex justify-between">
              <span className="text-text-muted">Withholding Tax</span>
              <span>-{fmt(invoice.withholdingTaxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm pt-1 border-t border-border">
            <span>Total</span>
            <span>{fmt(invoice.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
