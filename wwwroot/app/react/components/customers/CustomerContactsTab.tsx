import type { Customer } from '@/data/sampleCustomers';

function ContactCard({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-2 text-sm font-medium text-brand-dark">{value?.trim() ? value : '—'}</div>
    </div>
  );
}

export default function CustomerContactsTab({ customer }: { customer: Customer }) {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-bold text-brand-dark">Contacts</h3>
            <p className="mt-1 text-sm text-slate-500">Primary contact and billing/contact channels for this customer.</p>
          </div>
          <button className="px-3 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
            Add Contact
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ContactCard label="Primary phone" value={customer.phone} />
          <ContactCard label="Secondary phone" value={customer.phone2} />
          <ContactCard label="Primary email" value={customer.email} />
          <ContactCard label="Invoice email" value={customer.invoiceEmail} />
          <ContactCard label="Website" value={customer.internet} />
          <ContactCard label="Account manager" value={customer.staffAccountManager} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-bold text-brand-dark">People & ownership</h3>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Name / value</th>
                <th className="px-4 py-3 text-left">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white text-brand-dark">
              <tr>
                <td className="px-4 py-3 font-semibold">Account manager</td>
                <td className="px-4 py-3">{customer.staffAccountManager || '—'}</td>
                <td className="px-4 py-3 text-slate-500">Internal owner</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold">Sales rep</td>
                <td className="px-4 py-3">{customer.salesRep || '—'}</td>
                <td className="px-4 py-3 text-slate-500">Commercial relationship</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold">Billing contact</td>
                <td className="px-4 py-3">{customer.invoiceEmail || customer.email || '—'}</td>
                <td className="px-4 py-3 text-slate-500">Invoices / remittance</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
