import { useAuth } from '@/context/AuthContext';

export default function Operations() {
  const { user } = useAuth();
  const despatch = user.despatchWebBaseUrl;
  const runViewer = user.runViewerBaseUrl;

  const ops = [
    { icon: '📦', title: 'Dispatch Board', desc: 'View and manage your assigned jobs in real-time. Create, edit, and track deliveries.', app: 'DispatchWeb', url: despatch ?? '' },
    { icon: '🗺️', title: 'Route Viewer', desc: 'Track your couriers and routes in real-time on an interactive map.', app: 'Route Viewer (Read-Only)', url: runViewer ?? '' },
    { icon: '🖨️', title: 'Print Manager', desc: 'Print job labels, manifests, and delivery documentation.', app: 'Print Manager', url: runViewer ? `${runViewer}/#/print` : '' },
  ];

  return (
    <>
      <h2 className="text-xl font-bold mb-5">Operations</h2>
      <p className="text-text-secondary text-sm mb-6">
        Your operational tools open in their respective DFRNT applications.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ops.map(op => (
          <div key={op.title} className="bg-white border border-border rounded-lg p-6 transition-colors hover:border-brand-cyan">
            <h3 className="font-bold mb-1.5">{op.icon} {op.title}</h3>
            <p className="text-text-secondary text-[13px] mb-3.5">{op.desc}</p>
            <div className="text-[11px] text-warning mb-2.5">Opens in {op.app} ↗</div>
            <button
              onClick={() => op.url ? window.open(op.url, '_blank', 'noopener,noreferrer') : undefined}
              disabled={!op.url}
              title={!op.url ? 'Not yet connected — contact admin' : undefined}
              className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Open {op.title} →
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
