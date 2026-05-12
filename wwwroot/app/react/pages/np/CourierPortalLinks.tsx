import { useState } from 'react';
import { courierService } from '@/services/np_courierService';

export default function CourierPortalLinks() {
  const [links, setLinks] = useState(courierService.getPortalLinks());
  const [copied, setCopied] = useState<number | null>(null);

  const copyLink = (id: number, url: string) => {
    navigator.clipboard?.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const regenerate = (id: number) => {
    setLinks(prev => prev.map(l =>
      l.courierId === id
        ? { ...l, url: `https://portal.dfrnt.com/courier/${l.code.toLowerCase()}/${Math.random().toString(36).substr(2, 12)}` }
        : l
    ));
  };

  return (
    <>
      <h2 className="text-xl font-bold mb-5">Courier Portal Links</h2>
      <p className="text-text-secondary text-sm mb-5">
        Generate unique portal access URLs for your couriers. They can use these links to view their jobs and update their status.
      </p>
      <div className="bg-white border border-border rounded-lg">
        {links.map(l => (
          <div key={l.courierId} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0">
            <div className="min-w-[120px]">
              <div className="font-bold text-sm">{l.code}</div>
              <div className="text-xs text-text-secondary">{l.name}</div>
            </div>
            <div className="flex-1 font-mono text-xs text-brand-cyan bg-surface-light px-2.5 py-1.5 rounded overflow-hidden text-ellipsis whitespace-nowrap">
              {l.url}
            </div>
            <button
              onClick={() => copyLink(l.courierId, l.url)}
              className="bg-transparent border border-border text-text-primary px-3 py-1.5 rounded-md text-xs whitespace-nowrap hover:border-brand-cyan hover:text-brand-cyan transition-all"
            >
              {copied === l.courierId ? '✅ Copied!' : '📋 Copy'}
            </button>
            <button
              onClick={() => regenerate(l.courierId)}
              className="bg-transparent border border-border text-text-primary px-3 py-1.5 rounded-md text-xs whitespace-nowrap hover:border-brand-cyan hover:text-brand-cyan transition-all"
            >
              🔄 Regenerate
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
