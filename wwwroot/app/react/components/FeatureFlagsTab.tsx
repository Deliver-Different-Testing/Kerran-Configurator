import React, { useEffect, useState, useCallback } from 'react';
import { appConfigApi } from '../services/api';
import type { AppConfigDto } from '../types';

export const FeatureFlagsTab: React.FC = () => {
  const [flags, setFlags] = useState<AppConfigDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadFlags = useCallback(async () => {
    try {
      setLoading(true);
      const res = await appConfigApi.search('feature');
      setFlags(res.configs || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFlags(); }, [loadFlags]);

  const toggleFlag = (id: number) => {
    setFlags((prev) =>
      prev.map((f) =>
        f.id === id
          ? { ...f, configValue: f.configValue === 'true' ? 'false' : 'true' }
          : f
      )
    );
    setDirty(true);
    setSuccessMsg(null);
  };

  const saveAll = async () => {
    try {
      setSaving(true);
      setError(null);
      for (const flag of flags) {
        await appConfigApi.update(flag.id, {
          configKey: flag.configKey,
          configValue: flag.configValue,
          dataType: flag.dataType,
          category: flag.category,
          description: flag.description,
        });
      }
      setDirty(false);
      setSuccessMsg('Feature flags saved successfully.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center p-4">Loading feature flags...</div>;

  return (
    <div className="feature-flags-tab">
      {error && <div className="alert alert-danger">{error}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      <div className="row">
        {flags.map((flag) => {
          const key = flag.configKey.replace('feature.', '');
          const enabled = flag.configValue === 'true';

          return (
            <div className="col-md-6 col-lg-4 mb-3" key={flag.id}>
              <div className={`card h-100 ${enabled ? 'border-success' : ''}`}>
                <div className="card-body d-flex justify-content-between align-items-start">
                  <div>
                    <h6 className="card-title mb-1">{formatKeyName(key)}</h6>
                    <small className="text-muted">{flag.description}</small>
                  </div>
                  <div className="form-check form-switch ms-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      checked={enabled}
                      onChange={() => toggleFlag(flag.id)}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {flags.length === 0 && (
        <p className="text-muted text-center">No feature flags configured yet.</p>
      )}

      <div className="mt-3">
        <button
          className="btn btn-primary"
          onClick={saveAll}
          disabled={!dirty || saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

function formatKeyName(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

export default FeatureFlagsTab;
