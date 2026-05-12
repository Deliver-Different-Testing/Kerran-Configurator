import { useState, useEffect, useCallback, useRef } from 'react';
import { openforceService, OfSettings, OfApiLogEntry } from '@/services/np_openforceService';

type Filter = 'all' | 'invitation' | 'settlement' | 'webhook' | 'errors';

function StatusBadge({ connected }: { connected: boolean | null }) {
  if (connected === null) return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600"><span className="w-2 h-2 rounded-full bg-amber-400" />Unknown ⚠️</span>;
  if (connected) return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />Connected ✅</span>;
  return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600"><span className="w-2 h-2 rounded-full bg-red-500" />Not Connected ❌</span>;
}

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium text-[#0d0c2c] mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#3bc7f4]/40 focus:border-[#3bc7f4] outline-none"
        />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  );
}

function statusColor(status: number) {
  if (status >= 200 && status < 300) return 'text-emerald-600 bg-emerald-50';
  if (status >= 400 && status < 500) return 'text-amber-600 bg-amber-50';
  return 'text-red-600 bg-red-50';
}

export default function OpenforceSettings() {
  const [settings, setSettings] = useState<OfSettings>(openforceService.getSettings());
  const [originalSettings, setOriginalSettings] = useState<OfSettings>(openforceService.getSettings());
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<boolean | null>(settings.connected ? true : null);
  const [saved, setSaved] = useState(false);

  const [log, setLog] = useState<OfApiLogEntry[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadLog = useCallback(() => setLog(openforceService.getApiLog()), []);

  useEffect(() => { loadLog(); }, [loadLog]);

  useEffect(() => {
    if (autoRefresh) {
      timerRef.current = setInterval(loadLog, 30000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [autoRefresh, loadLog]);

  const handleTest = async () => {
    setTesting(true);
    const ok = await openforceService.testConnection(settings);
    setConnectionStatus(ok);
    setSettings(s => ({ ...s, connected: ok }));
    setTesting(false);
  };

  const handleSave = () => {
    openforceService.saveSettings({ ...settings, lastSync: new Date().toISOString() });
    setOriginalSettings({ ...settings });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDiscard = () => {
    setSettings({ ...originalSettings });
    setConnectionStatus(originalSettings.connected ? true : null);
  };

  const dirty = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  const filtered = log.filter(e => {
    if (filter === 'all') return true;
    if (filter === 'errors') return !e.success;
    if (filter === 'invitation') return e.category === 'invitation';
    if (filter === 'settlement') return e.category === 'settlement';
    if (filter === 'webhook') return e.category === 'webhook';
    return true;
  }).slice(0, 50);

  // Stats
  const now = Date.now();
  const last24h = log.filter(e => now - new Date(e.timestamp).getTime() < 86400000);
  const successRate = last24h.length ? Math.round((last24h.filter(e => e.success).length / last24h.length) * 100) : 0;
  const avgDuration = last24h.length ? Math.round(last24h.reduce((s, e) => s + e.durationMs, 0) / last24h.length) : 0;
  const lastSuccess = log.find(e => e.success);
  const lastError = log.find(e => !e.success);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0d0c2c]">🔗 Openforce Integration</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your Openforce API connection and monitor activity</p>
        </div>
        {settings.lastSync && (
          <div className="text-right">
            <div className="text-xs text-gray-400">Last Sync</div>
            <div className="text-sm font-medium text-[#0d0c2c]">{new Date(settings.lastSync).toLocaleString()}</div>
          </div>
        )}
      </div>

      {/* Section A: API Configuration */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#0d0c2c]">API Configuration</h2>
            <StatusBadge connected={connectionStatus} />
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#0d0c2c] mb-1">Client ID</label>
              <input type="text" value={settings.clientId} onChange={e => setSettings(s => ({ ...s, clientId: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#3bc7f4]/40 focus:border-[#3bc7f4] outline-none" placeholder="Enter Client ID" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0d0c2c] mb-1">Client GUID</label>
              <input type="text" value={settings.clientGuid} onChange={e => setSettings(s => ({ ...s, clientGuid: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#3bc7f4]/40 focus:border-[#3bc7f4] outline-none" placeholder="Enter Client GUID" />
            </div>
            <PasswordField label="Access Key" value={settings.accessKey} onChange={v => setSettings(s => ({ ...s, accessKey: v }))} />
            <PasswordField label="API Key" value={settings.apiKey} onChange={v => setSettings(s => ({ ...s, apiKey: v }))} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-[#0d0c2c] mb-1">Activation Code — IC</label>
              <input type="text" value={settings.activationCodeIC} onChange={e => setSettings(s => ({ ...s, activationCodeIC: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#3bc7f4]/40 focus:border-[#3bc7f4] outline-none" placeholder="Independent Contractor" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0d0c2c] mb-1">Activation Code — Master</label>
              <input type="text" value={settings.activationCodeMaster} onChange={e => setSettings(s => ({ ...s, activationCodeMaster: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#3bc7f4]/40 focus:border-[#3bc7f4] outline-none" placeholder="Master" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0d0c2c] mb-1">Activation Code — Subcontractor</label>
              <input type="text" value={settings.activationCodeSub} onChange={e => setSettings(s => ({ ...s, activationCodeSub: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#3bc7f4]/40 focus:border-[#3bc7f4] outline-none" placeholder="Subcontractor" />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
            <button onClick={handleTest} disabled={testing} className="px-4 py-2 bg-[#0d0c2c] text-white rounded-lg text-sm font-medium hover:bg-[#0d0c2c]/90 disabled:opacity-50 transition-colors">
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
            <button onClick={handleSave} disabled={!dirty} className="px-4 py-2 bg-[#3bc7f4] text-white rounded-lg text-sm font-medium hover:bg-[#3bc7f4]/90 disabled:opacity-40 transition-colors">
              {saved ? '✓ Saved' : 'Save'}
            </button>
            <button onClick={handleDiscard} disabled={!dirty} className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40 transition-colors">
              Discard
            </button>
          </div>
        </div>
      </div>

      {/* Section B: API Monitoring Window */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#0d0c2c]">API Monitoring</h2>
            <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer select-none">
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="rounded border-gray-300 text-[#3bc7f4] focus:ring-[#3bc7f4]" />
              Auto-refresh (30s)
            </label>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-6 border-b border-gray-100 bg-[#f4f2f1]/50">
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide">Calls (24h)</div>
            <div className="text-xl font-bold text-[#0d0c2c]">{last24h.length}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide">Success Rate</div>
            <div className={`text-xl font-bold ${successRate >= 90 ? 'text-emerald-600' : successRate >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{successRate}%</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide">Avg Response</div>
            <div className="text-xl font-bold text-[#0d0c2c]">{avgDuration}ms</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide">Last Success</div>
            <div className="text-sm font-medium text-emerald-600">{lastSuccess ? new Date(lastSuccess.timestamp).toLocaleString() : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide">Last Error</div>
            <div className="text-sm font-medium text-red-600">{lastError ? new Date(lastError.timestamp).toLocaleString() : '—'}</div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          {([['all', 'All'], ['invitation', 'Invitations'], ['settlement', 'Settlements'], ['webhook', 'Webhooks'], ['errors', 'Errors Only']] as [Filter, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === key ? 'bg-[#3bc7f4] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {label}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={() => { openforceService.clearApiLog(); loadLog(); }} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Clear Log</button>
        </div>

        {/* Log table */}
        <div className="overflow-auto" style={{ maxHeight: 400 }}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <svg className="w-12 h-12 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /></svg>
              <p className="text-sm font-medium">No monitoring data yet</p>
              <p className="text-xs mt-1">API calls will appear here once the connection is active</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[#f4f2f1] sticky top-0 z-10">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Direction</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Endpoint</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Duration</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{new Date(entry.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${entry.direction === 'Inbound' ? 'text-purple-600' : 'text-blue-600'}`}>
                        {entry.direction === 'Inbound' ? '↙' : '↗'} {entry.direction}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-gray-700 max-w-[260px] truncate">{entry.endpoint}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(entry.status)}`}>
                        {entry.success ? '✅' : '❌'} {entry.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 text-right whitespace-nowrap">{entry.durationMs.toLocaleString()}ms</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[240px] truncate">{entry.responseSummary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
