import { useState, useEffect, useCallback } from 'react';
import type { FeatureFlag, AppConfigDto } from '../types/configurator';
import { appConfigApi } from '../services/api';
import { FEATURES_META } from '../data/featuresMeta';
import type { ToastFn } from '../pages/DfDriveConfigPage';

interface Props { showToast: ToastFn }

// Strip 'feature.' prefix to match featuresMeta keys
function shortKey(configKey: string): string {
  return configKey.startsWith('feature.') ? configKey.slice(8) : configKey;
}

interface FeatureFlagWithType extends FeatureFlag {
  type: 'standalone' | 'step-capability';
}

function configToFeatureFlag(cfg: AppConfigDto): FeatureFlagWithType {
  const meta = FEATURES_META[shortKey(cfg.configKey)];
  return {
    id: String(cfg.id),
    icon: meta?.icon || '⚡',
    name: meta?.displayName || cfg.configKey.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim(),
    desc: meta?.description || cfg.description || '',
    enabled: cfg.configValue === 'true',
    overrides: 0,
    type: meta?.type || 'standalone',
  };
}

export default function FeatureFlagsTab({ showToast }: Props) {
  const [features, setFeatures] = useState<FeatureFlagWithType[]>([]);
  const [configMap, setConfigMap] = useState<Map<string, AppConfigDto>>(new Map());
  const [loading, setLoading] = useState(true);

  const loadFlags = useCallback(async () => {
    try {
      setLoading(true);
      const res = await appConfigApi.search('feature');
      const configs: AppConfigDto[] = res.configs || [];
      const map = new Map(configs.map(c => [String(c.id), c]));
      setConfigMap(map);
      setFeatures(configs.map(configToFeatureFlag));
    } catch (e: unknown) {
      console.error('Failed to load feature flags:', e);
      setFeatures([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFlags(); }, [loadFlags]);

  const toggle = async (idx: number) => {
    const f = features[idx];
    const newEnabled = !f.enabled;

    // Optimistic update
    setFeatures(prev => prev.map((feat, i) => i === idx ? { ...feat, enabled: newEnabled } : feat));

    const cfg = configMap.get(f.id);
    if (cfg) {
      try {
        await appConfigApi.update(cfg.id, {
          configKey: cfg.configKey,
          configValue: newEnabled ? 'true' : 'false',
          dataType: cfg.dataType,
          category: cfg.category,
          description: cfg.description,
        });
        showToast(`${f.name} ${newEnabled ? 'enabled' : 'disabled'}`);
      } catch (e: unknown) {
        // Revert on error
        setFeatures(prev => prev.map((feat, i) => i === idx ? { ...feat, enabled: !newEnabled } : feat));
        showToast('Failed to update feature flag');
      }
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'rgba(13,12,44,.4)' }}>Loading feature flags...</div>;
  }

  const stepCapabilities = features
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.type === 'step-capability');
  const standaloneFeatures = features
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.type === 'standalone');

  const renderRow = (f: FeatureFlagWithType, originalIndex: number) => (
    <div className="ff-row" key={f.id}>
      <div className="ff-icon">{f.icon}</div>
      <div className="ff-info">
        <div className="ff-name">{f.name}</div>
        <div className="ff-desc">{f.desc}</div>
      </div>
      <div className="ff-overrides">
        <span style={{ color: 'rgba(13,12,44,.2)' }}>—</span>
      </div>
      <label className="toggle">
        <input type="checkbox" checked={f.enabled} onChange={() => toggle(originalIndex)} />
        <span className="slider" />
      </label>
    </div>
  );

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{features.filter(f => f.enabled).length} enabled</span>
          <span style={{ color: 'rgba(13,12,44,.35)', fontSize: 13, marginLeft: 8 }}>of {features.length} features</span>
        </div>
      </div>

      {/* Step Capabilities */}
      {stepCapabilities.length > 0 && (
        <>
          <div className="ff-section-header">
            <h3>Step Capabilities</h3>
            <span className="ff-section-desc">These features gate workflow step types. When disabled, the step type is unavailable in the workflow builder.</span>
          </div>
          <div className="ff-grid" style={{ boxShadow: 'var(--shadow)', borderRadius: 'var(--radius)', marginBottom: 20 }}>
            {stepCapabilities.map(({ f, i }) => renderRow(f, i))}
          </div>
        </>
      )}

      {/* Standalone Features */}
      {standaloneFeatures.length > 0 && (
        <>
          <div className="ff-section-header">
            <h3>Standalone Features</h3>
            <span className="ff-section-desc">App-wide capabilities that are not tied to workflow steps.</span>
          </div>
          <div className="ff-grid" style={{ boxShadow: 'var(--shadow)', borderRadius: 'var(--radius)' }}>
            {standaloneFeatures.map(({ f, i }) => renderRow(f, i))}
          </div>
        </>
      )}

      {features.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(13,12,44,.3)' }}>No feature flags configured yet.</div>
      )}
    </>
  );
}
