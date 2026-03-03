import { useState, useRef, useEffect, useCallback } from 'react';
import type { StageName, StagesMap, StageTask, StepContext, AppliesToScope, TaskConfig, WorkflowTemplateDto, AppConfigDto, ClientLookupDto, ServiceLookupDto } from '../types';
import { TASKS, TASK_MAP } from '../data/tasks';
import { PRESETS } from '../data/presets';
import { workflowApi, lookupApi, appConfigApi } from '../services/api';
import { buildIdMaps } from '../data/taskEventTypeMap';
import { TASK_TO_FEATURE_KEY } from '../data/featuresMeta';
import { detailsToStagesMap, stagesMapToDetails, buildStatusIdMap, countStageTasks } from '../services/transformers';
import type { ToastFn } from '../App';

const JOB_STAGES: StageName[] = ['Enroute to Pickup', 'Pickup', 'Enroute to Delivery', 'Delivery'];

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

const CAT_CLASS: Record<string, string> = {
  Verification: 'cat-verification',
  Capture: 'cat-capture',
  Confirmation: 'cat-confirmation',
  Communication: 'cat-communication',
};

function configSummary(t: StageTask): string {
  const c = t.config;
  switch (t.taskId) {
    case 'photo': return `${c.minPhotos ?? 1} photo min`;
    case 'age': return `Age ${c.minAge ?? 18}+`;
    case 'signature': return c.signerNameReq ? 'Name req' : '';
    case 'checkbox': return c.label ?? '';
    case 'geofence': return `${c.radius ?? 100}m`;
    case 'barcode': return c.mustMatch ? 'Must match' : '';
    case 'coldchain': return `${c.minTemp}–${c.maxTemp}°C`;
    case 'timestamp': return c.mode === 'auto' ? 'Auto' : 'Manual';
    default: return '';
  }
}

// ── SearchableSelect ──

interface SearchableSelectProps {
  value: number | null;
  onChange: (id: number | null) => void;
  onSearch: (q: string) => Promise<Array<{ id: number; name: string; code: string }>>;
  placeholder: string;
}

function SearchableSelect({ value, onChange, onSearch, placeholder }: SearchableSelectProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: number; name: string; code: string }>>([]);
  const [selectedLabel, setSelectedLabel] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Load initial results when opened
  useEffect(() => {
    if (open && results.length === 0 && !query) {
      setLoading(true);
      onSearch('').then(r => { setResults(r); setLoading(false); }).catch(() => setLoading(false));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const doSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await onSearch(q);
        setResults(r);
      } catch { /* ignore */ }
      setLoading(false);
    }, 300);
  }, [onSearch]);

  const handleInputChange = (val: string) => {
    setQuery(val);
    setOpen(true);
    doSearch(val);
  };

  const select = (item: { id: number; name: string; code: string }) => {
    onChange(item.id);
    setSelectedLabel(`${item.name} (${item.code})`);
    setQuery('');
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setSelectedLabel('');
    setQuery('');
    setResults([]);
  };

  if (value && selectedLabel) {
    return (
      <div className="searchable-select" ref={wrapRef}>
        <div className="ss-selected">
          <span>{selectedLabel}</span>
          <button className="ss-clear" onClick={clear}>×</button>
        </div>
      </div>
    );
  }

  return (
    <div className="searchable-select" ref={wrapRef}>
      <input
        className="input ss-input"
        placeholder={placeholder}
        value={query}
        onChange={e => handleInputChange(e.target.value)}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div className="ss-dropdown">
          {loading && <div className="ss-loading">Searching...</div>}
          {!loading && results.length === 0 && <div className="ss-empty">No results</div>}
          {!loading && results.map(r => (
            <div key={r.id} className="ss-item" onMouseDown={() => select(r)}>
              {r.name} <span style={{ color: 'rgba(13,12,44,.35)' }}>({r.code})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──

interface Props { showToast: ToastFn }

type ViewMode = 'list' | 'editor';

export default function WorkflowsTab({ showToast }: Props) {
  const [view, setView] = useState<ViewMode>('list');

  // Editor state
  const [currentPreset, setCurrentPreset] = useState('');
  const [stages, setStages] = useState<StagesMap>({});
  const [appliesTo, setAppliesTo] = useState<AppliesToScope>('default');
  const [libOpen, setLibOpen] = useState(true);
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [addMenuStage, setAddMenuStage] = useState<StageName | null>(null);
  const [dragOverStage, setDragOverStage] = useState<StageName | null>(null);

  // API state
  const [templates, setTemplates] = useState<WorkflowTemplateDto[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [services, setServices] = useState<ServiceLookupDto[]>([]);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [lookupsReady, setLookupsReady] = useState(false);
  const [lookupsError, setLookupsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  // Feature flag gating: set of disabled task IDs (feature OFF → task greyed out)
  const [gatedTaskIds, setGatedTaskIds] = useState<Set<string>>(new Set());

  const [confirmDialog, setConfirmDialog] = useState<ConfirmState | null>(null);

  const dragRef = useRef<{ fromStage: StageName; fromIdx: number } | null>(null);
  const dragLibRef = useRef<string | null>(null);
  const initialStagesRef = useRef<string>('{}');

  // Load lookups on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [servicesRes, lookupsRes, templatesRes, flagsRes] = await Promise.all([
          lookupApi.getServices(),
          workflowApi.getLookups(),
          workflowApi.getAll(),
          appConfigApi.search('feature'),
        ]);
        setServices(servicesRes.services || []);
        setTemplates(templatesRes.templates || []);

        // Build ID maps for task ↔ event type conversion
        const eventTypes = lookupsRes.eventTypes || [];
        const jobStatuses = lookupsRes.jobStatuses || [];
        buildIdMaps(eventTypes);
        buildStatusIdMap(jobStatuses);

        // Build gated task set from feature flags
        const flags: AppConfigDto[] = flagsRes.configs || [];
        const disabledKeys = new Set(
          flags
            .filter(f => f.configValue !== 'true')
            .map(f => f.configKey.startsWith('feature.') ? f.configKey.slice(8) : f.configKey)
        );
        const gated = new Set<string>();
        for (const [taskId, featureKey] of Object.entries(TASK_TO_FEATURE_KEY)) {
          if (disabledKeys.has(featureKey)) {
            gated.add(taskId);
          }
        }
        setGatedTaskIds(gated);
        if (gated.size > 0) {
          console.log('[WorkflowBuilder] Gated tasks (feature OFF):', [...gated]);
        }

        setLookupsReady(true);
      } catch (e) {
        console.error('Failed to load workflow data:', e);
        setLookupsError('Failed to load workflow data. Check console for details.');
      }
    }
    loadData();
  }, []);

  const reloadTemplates = useCallback(async () => {
    try {
      const res = await workflowApi.getAll();
      setTemplates(res.templates || []);
    } catch (e) {
      console.error('Failed to reload templates:', e);
    }
  }, []);

  const updateStages = useCallback((fn: (s: StagesMap) => StagesMap) => {
    setSaveError(null);
    setStages(prev => fn(JSON.parse(JSON.stringify(prev))));
  }, []);

  const addTask = useCallback((stage: StageName, taskId: string) => {
    if (gatedTaskIds.has(taskId)) return; // Feature flag is OFF
    const t = TASK_MAP.get(taskId);
    if (!t) return;
    updateStages(s => {
      if (!s[stage]) s[stage] = [];
      s[stage]!.push({ taskId, required: true, config: { ...t.config }, context: 'both' });
      return s;
    });
  }, [updateStages, gatedTaskIds]);

  const removeTask = useCallback((stage: StageName, idx: number) => {
    updateStages(s => {
      s[stage]?.splice(idx, 1);
      if (s[stage]?.length === 0) delete s[stage];
      return s;
    });
  }, [updateStages]);

  const toggleRequired = useCallback((stage: StageName, idx: number) => {
    updateStages(s => {
      const task = s[stage]?.[idx];
      if (task) task.required = !task.required;
      return s;
    });
  }, [updateStages]);

  const updateConfig = useCallback((stage: StageName, idx: number, prop: keyof TaskConfig, val: TaskConfig[keyof TaskConfig]) => {
    updateStages(s => {
      const task = s[stage]?.[idx];
      if (task) (task.config as Record<string, unknown>)[prop] = val;
      return s;
    });
  }, [updateStages]);

  const updateContext = useCallback((stage: StageName, idx: number, ctx: StepContext) => {
    updateStages(s => {
      const task = s[stage]?.[idx];
      if (task) task.context = ctx;
      return s;
    });
  }, [updateStages]);

  const loadPreset = useCallback((key: string) => {
    const doLoad = () => {
      setCurrentPreset(key);
      const newStages = JSON.parse(JSON.stringify(PRESETS[key].stages));
      setStages(newStages);
      setExpandedBlocks(new Set());
    };
    if (countStageTasks(stages) > 0) {
      setConfirmDialog({
        title: 'Replace Steps',
        message: 'This will replace all current steps with the selected preset.',
        confirmLabel: 'Replace',
        destructive: true,
        onConfirm: doLoad,
      });
    } else {
      doLoad();
    }
  }, [stages]);

  const loadTemplate = useCallback((t: WorkflowTemplateDto) => {
    if (!lookupsReady) return;
    const stagesMap = detailsToStagesMap(t.details);
    setStages(stagesMap);
    initialStagesRef.current = JSON.stringify(stagesMap);
    setEditingTemplateId(t.id);
    setTemplateName(t.name);
    setCurrentPreset('');
    setExpandedBlocks(new Set());
    if (t.clientId) {
      setAppliesTo(t.speedId ? 'both' : 'client');
      setSelectedClientId(t.clientId);
    } else if (t.speedId) {
      setAppliesTo('service');
    } else {
      setAppliesTo('default');
    }
    if (t.speedId) setSelectedServiceId(t.speedId);
    setView('editor');
  }, [lookupsReady]);

  const toggleBlock = useCallback((key: string) => {
    setExpandedBlocks(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  // Check if editor has unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    return JSON.stringify(stages) !== initialStagesRef.current;
  }, [stages]);

  // Navigate to editor for new workflow
  const onCreateNew = useCallback(() => {
    setStages({});
    initialStagesRef.current = '{}';
    setEditingTemplateId(null);
    setTemplateName('');
    setCurrentPreset('');
    setAppliesTo('default');
    setSelectedClientId(null);
    setSelectedServiceId(null);
    setExpandedBlocks(new Set());
    setView('editor');
  }, []);

  // Navigate back to list
  const onBack = useCallback(() => {
    if (hasUnsavedChanges()) {
      setConfirmDialog({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes that will be lost. Are you sure you want to go back?',
        confirmLabel: 'Discard',
        destructive: true,
        onConfirm: () => setView('list'),
      });
    } else {
      setView('list');
    }
  }, [hasUnsavedChanges]);

  // Delete a template
  const onDelete = useCallback((id: number, name: string) => {
    setConfirmDialog({
      title: 'Delete Workflow',
      message: `Are you sure you want to delete "${name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        setDeleting(id);
        try {
          await workflowApi.delete(id);
          showToast('Workflow deleted');
          await reloadTemplates();
        } catch (e) {
          console.error('Failed to delete workflow:', e);
          showToast('Failed to delete workflow');
        } finally {
          setDeleting(null);
        }
      },
    });
  }, [showToast, reloadTemplates]);

  // Client search handler for SearchableSelect
  const searchClients = useCallback(async (q: string) => {
    const res = await lookupApi.searchClients(q || undefined, 50);
    return (res.clients || []).map(c => ({ id: c.id, name: c.name, code: c.code }));
  }, []);

  // Save workflow with pre-save validation
  const saveWorkflow = useCallback(async () => {
    setSaveError(null);

    if (!lookupsReady) {
      setSaveError('Lookup data has not loaded. Try refreshing the page.');
      return;
    }

    // Pre-save validation with diagnostics
    const taskCount = countStageTasks(stages);
    const details = stagesMapToDetails(stages);

    console.log(`[Workflow Save] Tasks in stages: ${taskCount}, Mapped details: ${details.length}`);
    console.log('[Workflow Save] Stages:', JSON.stringify(stages, null, 2));

    if (taskCount > 0 && details.length === 0) {
      const msg = `Could not map any of the ${taskCount} task(s) to database event types. This usually means workflow event types are not seeded in the database (migration 010). Check the browser console for "[WorkflowMaps]" warnings.`;
      console.error('[Workflow Save] BLOCKED:', msg);
      setSaveError(msg);
      return;
    }

    if (taskCount > 0 && details.length < taskCount) {
      const dropped = taskCount - details.length;
      console.warn(`[Workflow Save] ${dropped} of ${taskCount} task(s) could not be mapped and will be dropped from the save`);
    }

    setSaving(true);
    try {
      const payload = {
        name: templateName || `Workflow ${new Date().toLocaleString()}`,
        description: undefined,
        clientId: (appliesTo === 'client' || appliesTo === 'both') ? selectedClientId : null,
        speedId: (appliesTo === 'service' || appliesTo === 'both') ? selectedServiceId : null,
        isActive: true,
        mirrorToAgentPortal: false,
        details,
      };

      console.log('[Workflow Save] Payload:', JSON.stringify(payload, null, 2));

      if (editingTemplateId) {
        await workflowApi.update(editingTemplateId, payload);
        showToast('Workflow updated');
      } else {
        await workflowApi.create(payload);
        showToast('Workflow created');
      }
      await reloadTemplates();
      initialStagesRef.current = JSON.stringify(stages);
      setView('list');
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error('[Workflow Save] API error:', e);
      setSaveError(`Save failed: ${errMsg}`);
    } finally {
      setSaving(false);
    }
  }, [stages, templateName, appliesTo, selectedClientId, selectedServiceId, editingTemplateId, lookupsReady, showToast, reloadTemplates]);

  // Drag handlers
  const onDragStartBlock = useCallback((stage: StageName, idx: number) => {
    dragRef.current = { fromStage: stage, fromIdx: idx };
    dragLibRef.current = null;
  }, []);

  const onDragStartLib = useCallback((taskId: string) => {
    dragLibRef.current = taskId;
    dragRef.current = null;
  }, []);

  const onDrop = useCallback((stage: StageName) => {
    setDragOverStage(null);
    if (dragLibRef.current) {
      addTask(stage, dragLibRef.current);
      dragLibRef.current = null;
    } else if (dragRef.current) {
      const { fromStage, fromIdx } = dragRef.current;
      updateStages(s => {
        const task = s[fromStage]?.splice(fromIdx, 1)?.[0];
        if (!task) return s;
        if (s[fromStage]?.length === 0) delete s[fromStage];
        if (!s[stage]) s[stage] = [];
        s[stage]!.push(task);
        return s;
      });
      dragRef.current = null;
    }
  }, [addTask, updateStages]);

  // Close add menu on outside click
  useEffect(() => {
    if (!addMenuStage) return;
    const handler = () => setAddMenuStage(null);
    setTimeout(() => document.addEventListener('click', handler, { once: true }), 0);
    return () => document.removeEventListener('click', handler);
  }, [addMenuStage]);

  const renderInlineConfig = (task: StageTask, stage: StageName, idx: number) => {
    const c = task.config;
    const upd = (prop: keyof TaskConfig, val: TaskConfig[keyof TaskConfig]) => updateConfig(stage, idx, prop, val);

    switch (task.taskId) {
      case 'photo':
        return (<>
          <CfgField label="Min photos"><input className="cfg-input" type="number" value={c.minPhotos ?? 1} min={1} max={10} onChange={e => upd('minPhotos', +e.target.value)} /></CfgField>
          <CfgField label="Max photos"><input className="cfg-input" type="number" value={c.maxPhotos ?? 5} min={1} max={20} onChange={e => upd('maxPhotos', +e.target.value)} /></CfgField>
        </>);
      case 'signature':
        return <CfgToggle label="Name required" checked={!!c.signerNameReq} onChange={v => upd('signerNameReq', v)} />;
      case 'checkbox':
        return <CfgField label="Label"><input className="cfg-input wide" value={c.label ?? ''} onChange={e => upd('label', e.target.value)} /></CfgField>;
      case 'age':
        return <CfgField label="Min age"><input className="cfg-input" type="number" value={c.minAge ?? 18} min={1} onChange={e => upd('minAge', +e.target.value)} /></CfgField>;
      case 'barcode':
        return <CfgToggle label="Must match job" checked={!!c.mustMatch} onChange={v => upd('mustMatch', v)} />;
      case 'geofence':
        return <CfgField label="Radius (m)"><input className="cfg-input" type="number" value={c.radius ?? 100} min={10} onChange={e => upd('radius', +e.target.value)} /></CfgField>;
      case 'timestamp':
        return <CfgField label="Mode"><select className="cfg-input" value={c.mode ?? 'auto'} onChange={e => upd('mode', e.target.value)}><option value="auto">auto</option><option value="manual">manual</option></select></CfgField>;
      case 'coldchain':
        return (<>
          <CfgField label="Min °C"><input className="cfg-input" type="number" value={c.minTemp ?? 0} onChange={e => upd('minTemp', +e.target.value)} /></CfgField>
          <CfgField label="Max °C"><input className="cfg-input" type="number" value={c.maxTemp ?? 8} onChange={e => upd('maxTemp', +e.target.value)} /></CfgField>
        </>);
      default:
        return <span style={{ color: 'rgba(13,12,44,.35)', fontSize: 11 }}>Click to configure</span>;
    }
  };

  // ── Confirm Dialog (shared across both views) ──
  const confirmDialogJsx = (
    <div className={`modal-overlay${confirmDialog ? ' show' : ''}`} onClick={e => { if (e.target === e.currentTarget) setConfirmDialog(null); }}>
      {confirmDialog && (
        <div className="modal" style={{ maxWidth: 400 }}>
          <h2>{confirmDialog.title}</h2>
          <div className="modal-sub">{confirmDialog.message}</div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setConfirmDialog(null)}>Cancel</button>
            <button
              className={`btn ${confirmDialog.destructive ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => { setConfirmDialog(null); confirmDialog.onConfirm(); }}
            >
              {confirmDialog.confirmLabel || 'Confirm'}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ══════════════════════════════════════════════
  // VIEW 1: Template List
  // ══════════════════════════════════════════════
  if (view === 'list') {
    return (
      <>
        {confirmDialogJsx}
        {lookupsError && (
          <div className="wf-error-banner">{lookupsError}</div>
        )}
        <div className="wf-list-header">
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Workflow Templates</h2>
            <span style={{ fontSize: 12, color: 'rgba(13,12,44,.4)' }}>{templates.length} template{templates.length !== 1 ? 's' : ''}</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={onCreateNew} disabled={!lookupsReady}>
            + Create New Workflow
          </button>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tmpl-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Applies To</th>
                <th>Steps</th>
                <th>Modified</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 500 }}>{t.name}</td>
                  <td>
                    <span className={`status-badge ${t.isActive ? 'status-active' : ''}`}>
                      {t.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ color: 'rgba(13,12,44,.4)' }}>
                    {t.scopeLabel}{t.clientName ? ` — ${t.clientName}` : ''}{t.speedName ? ` — ${t.speedName}` : ''}
                  </td>
                  <td>{t.stepCount}</td>
                  <td style={{ color: 'rgba(13,12,44,.35)', fontSize: 11 }}>
                    {t.lastModified ? new Date(t.lastModified).toLocaleDateString() : new Date(t.created).toLocaleDateString()}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        className="btn-icon"
                        title="Edit"
                        onClick={() => loadTemplate(t)}
                        disabled={!lookupsReady}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon"
                        title="Delete"
                        onClick={() => onDelete(t.id, t.name)}
                        disabled={deleting === t.id}
                        style={deleting === t.id ? { opacity: 0.5 } : {}}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'rgba(13,12,44,.3)', padding: 32 }}>
                    No saved templates yet. Click "Create New Workflow" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  // ══════════════════════════════════════════════
  // VIEW 2: Workflow Editor
  // ══════════════════════════════════════════════
  return (
    <>
      {confirmDialogJsx}
      {lookupsError && (
        <div className="wf-error-banner">{lookupsError}</div>
      )}

      {/* Editor header */}
      <div className="wf-editor-header">
        <button className="btn btn-secondary btn-sm" onClick={onBack}>
          ← Back
        </button>
        <label className="wf-name-group">
          <span className="wf-name-label">{editingTemplateId ? 'Editing' : 'New Workflow'}</span>
          <input
            className="wf-name-input"
            placeholder="Workflow name..."
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
          />
        </label>
        <button className="btn btn-primary btn-sm" onClick={saveWorkflow} disabled={saving || !lookupsReady}>
          {saving ? 'Saving...' : editingTemplateId ? 'Save Changes' : 'Create Workflow'}
        </button>
      </div>

      {/* Save error banner */}
      {saveError && (
        <div className="wf-error-banner">
          <div style={{ flex: 1 }}>{saveError}</div>
          <button className="ss-clear" onClick={() => setSaveError(null)} style={{ fontSize: 18, flexShrink: 0 }}>×</button>
        </div>
      )}

      {/* Scope / Filter bar */}
      <div className="filter-bar">
        <label>Workflow scope:</label>
        <select value={appliesTo} onChange={e => setAppliesTo(e.target.value as AppliesToScope)}>
          <option value="default">Default (all jobs)</option>
          <option value="client">Client override</option>
          <option value="service">Service type override</option>
          <option value="both">Client + Service type</option>
        </select>
        {(appliesTo === 'client' || appliesTo === 'both') && (
          <SearchableSelect
            value={selectedClientId}
            onChange={setSelectedClientId}
            onSearch={searchClients}
            placeholder="Search clients..."
          />
        )}
        {(appliesTo === 'service' || appliesTo === 'both') && (
          <select value={selectedServiceId ?? ''} onChange={e => setSelectedServiceId(e.target.value ? parseInt(e.target.value) : null)}>
            <option value="">Select service type...</option>
            {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
          </select>
        )}
        {appliesTo === 'default' && (
          <span style={{ fontSize: 12, color: 'rgba(13,12,44,.4)', marginLeft: 8 }}>
            This workflow applies to all jobs unless a more specific override exists
          </span>
        )}
      </div>

      {/* Preset bar */}
      <div className="preset-bar">
        <label>Presets:</label>
        {Object.entries(PRESETS).map(([key, preset]) => (
          <div
            key={key}
            className={`preset-chip${currentPreset === key ? ' active' : ''}`}
            onClick={() => loadPreset(key)}
          >
            {preset.name}
          </div>
        ))}
      </div>

      {/* Pipeline */}
      <div className="pipeline">
        {JOB_STAGES.map((stageName, si) => {
          const tasks = stages[stageName] ?? [];
          return (
            <PipelineFragment key={stageName} si={si} stagesLength={JOB_STAGES.length}>
              <div className="stage" data-stage={stageName}>
                <div className="stage-header">
                  <span className="stage-num">{si + 1}</span>
                  <h3>{stageName}</h3>
                </div>
                <div
                  className={`stage-body${dragOverStage === stageName ? ' drag-over' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragOverStage(stageName); }}
                  onDragLeave={() => setDragOverStage(null)}
                  onDrop={e => { e.preventDefault(); onDrop(stageName); }}
                >
                  {tasks.map((task, ti) => {
                    const taskDef = TASK_MAP.get(task.taskId);
                    if (!taskDef) return null;
                    const blockKey = `${stageName}-${ti}`;
                    const isExpanded = expandedBlocks.has(blockKey);
                    return (
                      <div
                        key={blockKey}
                        className={`task-block${isExpanded ? ' expanded' : ''}`}
                        draggable
                        onDragStart={() => onDragStartBlock(stageName, ti)}
                        onClick={() => toggleBlock(blockKey)}
                      >
                        <div className="tb-top">
                          <span className="tb-icon">{taskDef.icon}</span>
                          <span className="tb-name">{taskDef.name}</span>
                          <button className="tb-remove" onClick={e => { e.stopPropagation(); removeTask(stageName, ti); }}>×</button>
                        </div>
                        <div className="tb-meta">
                          <span
                            className={`tb-badge ${task.required ? 'required' : 'optional'}`}
                            onClick={e => { e.stopPropagation(); toggleRequired(stageName, ti); }}
                          >
                            {task.required ? 'Required' : 'Optional'}
                          </span>
                          <span className={`tb-context ctx-${task.context || 'both'}`}>
                            {task.context === 'app' ? 'App' : task.context === 'portal' ? 'Portal' : 'Both'}
                          </span>
                          <span style={{ fontSize: 10, color: 'rgba(13,12,44,.4)' }}>{configSummary(task)}</span>
                        </div>
                        <div className="tb-expand">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
                            <CfgField label="Context">
                              <select
                                className="cfg-input"
                                value={task.context || 'both'}
                                onChange={e => { e.stopPropagation(); updateContext(stageName, ti, e.target.value as StepContext); }}
                                onClick={e => e.stopPropagation()}
                              >
                                <option value="both">Both</option>
                                <option value="app">App only</option>
                                <option value="portal">Portal only</option>
                              </select>
                            </CfgField>
                            {renderInlineConfig(task, stageName, ti)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div
                  className="add-btn"
                  style={{ position: 'relative' }}
                  onClick={e => { e.stopPropagation(); setAddMenuStage(addMenuStage === stageName ? null : stageName); }}
                >
                  + Add Task
                  {addMenuStage === stageName && (
                    <div className="add-dropdown" style={{ display: 'block' }}>
                      {TASKS.map(t => {
                        const isGated = gatedTaskIds.has(t.id);
                        return (
                          <div
                            key={t.id}
                            className={`add-item${isGated ? ' gated' : ''}`}
                            onClick={e => { e.stopPropagation(); if (!isGated) { addTask(stageName, t.id); setAddMenuStage(null); } }}
                            title={isGated ? 'Feature disabled' : undefined}
                          >
                            {t.icon} {t.name}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              {si < JOB_STAGES.length - 1 && <div className="stage-arrow">→</div>}
            </PipelineFragment>
          );
        })}
      </div>

      {/* Task Library */}
      <div className="task-lib-panel">
        <div className="lib-header" onClick={() => setLibOpen(!libOpen)}>
          <h3>Available Task Library <span style={{ fontWeight: 400, fontSize: 12, color: 'rgba(13,12,44,.4)' }}>({TASKS.length} task types — drag into stages above)</span></h3>
          <span className={`chevron${libOpen ? ' open' : ''}`}>▼</span>
        </div>
        <div className={`task-lib-body${libOpen ? ' open' : ''}`}>
          <div className="lib-grid">
            {TASKS.map(t => {
              const isGated = gatedTaskIds.has(t.id);
              return (
                <div
                  key={t.id}
                  className={`lib-task${isGated ? ' gated' : ''}`}
                  draggable={!isGated}
                  onDragStart={() => !isGated && onDragStartLib(t.id)}
                  title={isGated ? 'This task type is disabled — enable its feature flag first' : t.desc}
                >
                  <span className="lt-icon">{t.icon}</span>
                  <div>
                    <div className="lt-name">{t.name}</div>
                    <div className="lt-desc">{t.desc}</div>
                    <span className={`lt-cat ${CAT_CLASS[t.cat] ?? ''}`}>{t.cat}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// Helper components
function PipelineFragment({ children }: { children: React.ReactNode; si: number; stagesLength: number }) {
  return <>{children}</>;
}

function CfgField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="cfg-field">
      <span>{label}</span>
      {children}
    </div>
  );
}

function CfgToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="cfg-field">
      <span>{label}</span>
      <div className="cfg-toggle-wrap">
        <label className="toggle" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
          <span className="slider" />
        </label>
      </div>
    </div>
  );
}
