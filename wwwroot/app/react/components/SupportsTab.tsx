import { useState, useRef, useCallback, useEffect } from 'react';
import type { SupportType } from '../types';
import { eventTypeApi } from '../services/api';
import { SUPPORTS_META, SUPPORT_CATEGORIES } from '../data/supportsMeta';
import type { ToastFn } from '../App';

interface Props { showToast: ToastFn }

interface SupportWithCategory extends SupportType {
  category: string;
  phase: string;
  eventCode: string;
  mappingId: number;
}

function eventTypeToSupport(
  et: { eventTypeId: number; eventTypeName: string; mappingId: number; sequence: number; isActive: boolean; kind?: string; url?: string | null; displayName?: string | null; description?: string | null; icon?: string | null; color?: string | null },
  order: number
): SupportWithCategory {
  const meta = SUPPORTS_META[et.eventTypeName];
  return {
    id: String(et.eventTypeId),
    icon: et.icon || meta?.icon || '📋',
    color: et.color || meta?.color || '#3bc7f4',
    name: et.displayName || et.eventTypeName,
    desc: et.description || meta?.description || '',
    enabled: et.isActive,
    order,
    kind: (et.kind === 'link' ? 'link' : 'form') as 'form' | 'link',
    url: et.url || undefined,
    category: meta?.category || 'Other',
    phase: meta?.phase || 'both',
    eventCode: meta?.eventCode || '',
    mappingId: et.mappingId,
  };
}

interface AddModalState {
  open: boolean;
  availableTypes: Array<{ id: number; name: string }>;
  loading: boolean;
}

interface EditModalState {
  open: boolean;
  support: SupportWithCategory | null;
  kind: 'form' | 'link';
  url: string;
  displayName: string;
  description: string;
  icon: string;
  color: string;
}

export default function SupportsTab({ showToast }: Props) {
  const [supports, setSupports] = useState<SupportWithCategory[]>([]);
  const [mappings, setMappings] = useState<Array<{ eventTypeId: number; mappingId: number }>>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [addModal, setAddModal] = useState<AddModalState>({ open: false, availableTypes: [], loading: false });
  const [addSearch, setAddSearch] = useState('');
  const [supportGroupId, setSupportGroupId] = useState<number | null>(null);
  const defaultEditModal: EditModalState = { open: false, support: null, kind: 'form', url: '', displayName: '', description: '', icon: '', color: '#3bc7f4' };
  const [editModal, setEditModal] = useState<EditModalState>(defaultEditModal);
  const [editSaving, setEditSaving] = useState(false);
  const dragIdx = useRef<number | null>(null);

  const loadSupports = useCallback(async () => {
    try {
      setLoading(true);
      // Single call to get all event types in the "App Support" group
      const res = await eventTypeApi.getByGroup('App Support');
      const groupMappings = res.mappings || [];

      const supportItems: SupportWithCategory[] = [];
      const mappingList: Array<{ eventTypeId: number; mappingId: number }> = [];

      for (const m of groupMappings) {
        supportItems.push(
          eventTypeToSupport(
            {
              eventTypeId: m.eventTypeId,
              eventTypeName: m.eventTypeName,
              mappingId: m.id,
              sequence: m.sequence,
              isActive: m.isActive,
              kind: m.kind,
              url: m.url,
              displayName: m.displayName,
              description: m.description,
              icon: m.icon,
              color: m.color,
            },
            m.sequence
          )
        );
        mappingList.push({ eventTypeId: m.eventTypeId, mappingId: m.id });
      }

      // Capture the group ID from the first mapping
      if (groupMappings.length > 0) {
        setSupportGroupId(groupMappings[0].eventTypeGroupId);
      }

      supportItems.sort((a, b) => a.order - b.order);
      setSupports(supportItems.map((s, i) => ({ ...s, order: i + 1 })));
      setMappings(mappingList);
    } catch (e: unknown) {
      console.error('Failed to load supports:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSupports(); }, [loadSupports]);

  const reindex = (arr: SupportWithCategory[]) => arr.map((s, i) => ({ ...s, order: i + 1 }));

  const filtered = supports.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.desc.toLowerCase().includes(search.toLowerCase())
  );

  const toggleEnabled = useCallback(async (realIdx: number) => {
    const s = supports[realIdx];
    const m = mappings.find(m => String(m.eventTypeId) === s.id);
    if (!m || !supportGroupId) return;

    const newEnabled = !s.enabled;
    setSupports(prev => prev.map((item, i) => i === realIdx ? { ...item, enabled: newEnabled } : item));

    try {
      if (newEnabled) {
        await eventTypeApi.addEventTypeGroup(parseInt(s.id), { eventTypeGroupId: supportGroupId, sequence: s.order });
      } else {
        await eventTypeApi.deleteEventTypeGroup(parseInt(s.id), m.mappingId);
      }
      showToast(`${s.name} ${newEnabled ? 'enabled' : 'disabled'}`);
    } catch {
      setSupports(prev => prev.map((item, i) => i === realIdx ? { ...item, enabled: !newEnabled } : item));
      showToast('Failed to update support type');
    }
  }, [supports, mappings, supportGroupId, showToast]);

  const removeSupport = useCallback(async (realIdx: number) => {
    const s = supports[realIdx];
    const m = mappings.find(m => String(m.eventTypeId) === s.id);
    if (m) {
      try {
        await eventTypeApi.deleteEventTypeGroup(parseInt(s.id), m.mappingId);
      } catch {
        showToast('Failed to remove support type');
        return;
      }
    }
    setSupports(prev => reindex(prev.filter((_, i) => i !== realIdx)));
    showToast('Support type removed');
  }, [supports, mappings, showToast]);

  const onDrop = useCallback((toIdx: number) => {
    if (dragIdx.current === null || dragIdx.current === toIdx) return;
    setSupports(prev => {
      const arr = [...prev];
      const [item] = arr.splice(dragIdx.current!, 1);
      arr.splice(toIdx, 0, item);
      return reindex(arr);
    });
    dragIdx.current = null;
  }, []);

  // Open add modal — load all event types not already in supports list
  const openAddModal = useCallback(async () => {
    setAddModal({ open: true, availableTypes: [], loading: true });
    setAddSearch('');
    try {
      const res = await eventTypeApi.getAll();
      const allTypes: Array<{ id: number; name: string }> = res.eventTypes || [];
      const existingIds = new Set(supports.map(s => s.id));
      const available = allTypes.filter(t => !existingIds.has(String(t.id)));
      setAddModal({ open: true, availableTypes: available, loading: false });
    } catch {
      setAddModal({ open: true, availableTypes: [], loading: false });
      showToast('Failed to load event types');
    }
  }, [supports, showToast]);

  // Add an event type to the "App Support" group
  const addSupportType = useCallback(async (eventTypeId: number, eventTypeName: string) => {
    if (!supportGroupId) {
      showToast('Support group not found — cannot add');
      return;
    }
    const meta = SUPPORTS_META[eventTypeName];
    const isLink = meta?.category === 'External Links';
    try {
      const nextSeq = supports.length + 1;
      await eventTypeApi.addEventTypeGroup(eventTypeId, {
        eventTypeGroupId: supportGroupId,
        sequence: nextSeq,
        kind: isLink ? 'link' : 'form',
      });
      showToast('Support type added');
      setAddModal({ open: false, availableTypes: [], loading: false });
      await loadSupports();
      // If it's a link type, immediately open the edit modal so the user can set the URL
      if (isLink) {
        setTimeout(() => {
          setSupports(prev => {
            const added = prev.find(s => s.id === String(eventTypeId));
            if (added) setEditModal({ open: true, support: added, kind: 'link', url: '', displayName: '', description: meta?.description || '', icon: meta?.icon || '🔗', color: meta?.color || '#2563eb' });
            return prev;
          });
        }, 500);
      }
    } catch {
      showToast('Failed to add support type');
    }
  }, [supports, supportGroupId, showToast, loadSupports]);

  const openEditModal = useCallback((s: SupportWithCategory) => {
    setEditModal({ open: true, support: s, kind: s.kind, url: s.url || '', displayName: s.name, description: s.desc, icon: s.icon, color: s.color });
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editModal.support || !supportGroupId) return;
    const s = editModal.support;
    if (editModal.kind === 'link' && !editModal.url.startsWith('https://')) {
      showToast('URL must start with https://');
      return;
    }
    setEditSaving(true);
    try {
      await eventTypeApi.addEventTypeGroup(parseInt(s.id), {
        eventTypeGroupId: supportGroupId,
        sequence: s.order,
        kind: editModal.kind,
        url: editModal.kind === 'link' ? editModal.url : undefined,
        displayName: editModal.displayName || undefined,
        description: editModal.description || undefined,
        icon: editModal.icon || undefined,
        color: editModal.color || undefined,
      });
      showToast('Support type updated');
      setEditModal(defaultEditModal);
      await loadSupports();
    } catch {
      showToast('Failed to update support type');
    } finally {
      setEditSaving(false);
    }
  }, [editModal, supportGroupId, showToast, loadSupports]);

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  // Group by category
  const grouped = new Map<string, { items: SupportWithCategory[]; indices: number[] }>();
  for (const cat of SUPPORT_CATEGORIES) {
    grouped.set(cat, { items: [], indices: [] });
  }
  for (const s of filtered) {
    const realIdx = supports.indexOf(s);
    const cat = s.category;
    if (!grouped.has(cat)) grouped.set(cat, { items: [], indices: [] });
    grouped.get(cat)!.items.push(s);
    grouped.get(cat)!.indices.push(realIdx);
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'rgba(13,12,44,.4)' }}>Loading support types...</div>;
  }

  const enabledCount = supports.filter(s => s.enabled).length;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 16 }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{enabledCount} active</span>
          <span style={{ color: 'rgba(13,12,44,.35)', fontSize: 13, marginLeft: 8 }}>of {supports.length} support types</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, maxWidth: 500 }}>
          <div style={{ flex: 1 }}>
            <input className="input" placeholder="Search supports..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', paddingLeft: 12 }} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAddModal}>+ Add Support Type</button>
        </div>
      </div>

      {supports.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(13,12,44,.3)' }}>
          No support types configured. Run migration 014 to seed the default support types.
        </div>
      )}

      {/* Add Support Type Modal */}
      <div className={`modal-overlay${addModal.open ? ' show' : ''}`} onClick={e => { if (e.target === e.currentTarget) setAddModal({ open: false, availableTypes: [], loading: false }); }}>
        {addModal.open && (
          <div className="modal">
            <h2>Add Support Type</h2>
            <div className="modal-sub">
              Select an existing event type to add to the support menu. Only event types not already in the support list are shown.
            </div>
            <div className="field">
              <input
                placeholder="Search event types..."
                value={addSearch}
                onChange={e => setAddSearch(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid rgba(13,12,44,.12)', borderRadius: 'var(--radius)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
              />
            </div>
            {addModal.loading ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'rgba(13,12,44,.4)' }}>Loading...</div>
            ) : (
              <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {addModal.availableTypes
                  .filter(t => !addSearch || t.name.toLowerCase().includes(addSearch.toLowerCase()))
                  .map(t => {
                    const meta = SUPPORTS_META[t.name];
                    return (
                      <div
                        key={t.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 6, cursor: 'pointer', transition: 'background .1s' }}
                        className="ss-item"
                        onClick={() => addSupportType(t.id, t.name)}
                      >
                        <span style={{ fontSize: 16 }}>{meta?.icon || '📋'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{t.name}</div>
                          {meta?.description && <div style={{ fontSize: 11, color: 'rgba(13,12,44,.4)' }}>{meta.description}</div>}
                        </div>
                      </div>
                    );
                  })}
                {addModal.availableTypes.filter(t => !addSearch || t.name.toLowerCase().includes(addSearch.toLowerCase())).length === 0 && (
                  <div style={{ textAlign: 'center', padding: 20, color: 'rgba(13,12,44,.3)', fontSize: 13 }}>
                    {addSearch ? 'No matching event types found' : 'All event types are already added'}
                  </div>
                )}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setAddModal({ open: false, availableTypes: [], loading: false })}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Support Type Modal */}
      <div className={`modal-overlay${editModal.open ? ' show' : ''}`} onClick={e => { if (e.target === e.currentTarget) setEditModal(defaultEditModal); }}>
        {editModal.open && editModal.support && (
          <div className="modal">
            <h2>Edit Support Type</h2>
            <div className="modal-sub">Configure support type for couriers in DF Drive</div>
            <div className="field">
              <label>Icon (emoji)</label>
              <input
                value={editModal.icon}
                onChange={e => setEditModal(prev => ({ ...prev, icon: e.target.value }))}
                style={{ width: 80, padding: '9px 12px', border: '1px solid rgba(13,12,44,.12)', borderRadius: 'var(--radius)', fontSize: 18, fontFamily: 'inherit', outline: 'none', textAlign: 'center' }}
              />
            </div>
            <div className="field">
              <label>Name</label>
              <input
                placeholder="e.g. H&S Hazard Form"
                value={editModal.displayName}
                onChange={e => setEditModal(prev => ({ ...prev, displayName: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid rgba(13,12,44,.12)', borderRadius: 'var(--radius)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
              />
            </div>
            <div className="field">
              <label>Description</label>
              <input
                placeholder="Short description"
                value={editModal.description}
                onChange={e => setEditModal(prev => ({ ...prev, description: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid rgba(13,12,44,.12)', borderRadius: 'var(--radius)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
              />
            </div>
            <div className="field">
              <label>Type</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  style={{ flex: 1, padding: '10px', border: `2px solid ${editModal.kind === 'form' ? 'var(--cyan)' : 'rgba(13,12,44,.12)'}`, borderRadius: 10, background: editModal.kind === 'form' ? 'rgba(59,199,244,.06)' : 'var(--white)', cursor: 'pointer', textAlign: 'center', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', color: 'var(--ink)' }}
                  onClick={() => setEditModal(prev => ({ ...prev, kind: 'form' }))}
                >
                  <span style={{ fontSize: 20, display: 'block', marginBottom: 4 }}>📋</span>
                  In-App Form
                </button>
                <button
                  type="button"
                  style={{ flex: 1, padding: '10px', border: `2px solid ${editModal.kind === 'link' ? 'var(--cyan)' : 'rgba(13,12,44,.12)'}`, borderRadius: 10, background: editModal.kind === 'link' ? 'rgba(59,199,244,.06)' : 'var(--white)', cursor: 'pointer', textAlign: 'center', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', color: 'var(--ink)' }}
                  onClick={() => setEditModal(prev => ({ ...prev, kind: 'link' }))}
                >
                  <span style={{ fontSize: 20, display: 'block', marginBottom: 4 }}>🔗</span>
                  External Link
                </button>
              </div>
            </div>
            {editModal.kind === 'link' && (
              <div className="field">
                <label>URL</label>
                <input
                  placeholder="https://forms.example.com/hazard-report"
                  value={editModal.url}
                  onChange={e => setEditModal(prev => ({ ...prev, url: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid rgba(13,12,44,.12)', borderRadius: 'var(--radius)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                />
                <div style={{ fontSize: 10, color: 'rgba(13,12,44,.35)', marginTop: 3 }}>Must start with https://. Opens in the courier's browser when tapped.</div>
              </div>
            )}
            <div className="field">
              <label>Colour</label>
              <input
                type="color"
                value={editModal.color}
                onChange={e => setEditModal(prev => ({ ...prev, color: e.target.value }))}
                style={{ width: 60, height: 36, padding: 2, border: '1px solid rgba(13,12,44,.12)', borderRadius: 6, cursor: 'pointer' }}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEditModal(defaultEditModal)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={editSaving}>{editSaving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        )}
      </div>

      {[...grouped.entries()].map(([category, { items, indices }]) => {
        if (items.length === 0) return null;
        const isCollapsed = collapsedCategories.has(category);
        const catEnabled = items.filter(s => s.enabled).length;

        return (
          <div key={category} className="sup-category" style={{ marginBottom: 16 }}>
            <div
              className="sup-category-header"
              onClick={() => toggleCategory(category)}
            >
              <span className={`nav-chevron${isCollapsed ? '' : ' open'}`} style={{ fontSize: 10, marginRight: 8 }}>▸</span>
              <h3 style={{ fontSize: 13, fontWeight: 700, flex: 1, margin: 0 }}>{category}</h3>
              <span style={{ fontSize: 11, color: 'rgba(13,12,44,.35)', marginRight: 8 }}>
                {catEnabled}/{items.length} active
              </span>
            </div>
            {!isCollapsed && (
              <div className="supports-list" style={{ marginTop: 6 }}>
                {items.map((s, localIdx) => {
                  const realIdx = indices[localIdx];
                  return (
                    <div
                      key={s.id}
                      className="support-card"
                      draggable
                      onDragStart={() => { dragIdx.current = realIdx; }}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => onDrop(realIdx)}
                      style={!s.enabled ? { opacity: 0.55 } : undefined}
                    >
                      <span className="support-drag">⠿</span>
                      <div className="support-icon-wrap" style={{ background: `${s.color}15` }}>
                        <span>{s.icon}</span>
                      </div>
                      <div className="support-info">
                        <div className="s-name">
                          {s.name}
                          {s.kind === 'link'
                            ? <span style={{ fontSize: 9, fontWeight: 700, background: '#eff6ff', color: '#2563eb', padding: '1px 6px', borderRadius: 4, marginLeft: 6 }}>🔗 LINK</span>
                            : <span style={{ fontSize: 9, fontWeight: 700, background: '#f0fdf4', color: '#16a34a', padding: '1px 6px', borderRadius: 4, marginLeft: 6 }}>📋 FORM</span>
                          }
                        </div>
                        <div className="s-desc">{s.desc}</div>
                        {s.kind === 'link' && s.url && (
                          <div style={{ fontSize: 10, color: '#2563eb', marginTop: 2, wordBreak: 'break-all' }}>{s.url}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, minWidth: 80 }}>
                        <span className={`sup-phase sup-phase-${s.phase}`}>
                          {s.phase === 'pickup' ? 'Pickup' : s.phase === 'delivery' ? 'Delivery' : 'Both'}
                        </span>
                        {s.eventCode && (
                          <span style={{ fontSize: 9, color: 'rgba(13,12,44,.25)', fontFamily: 'monospace' }}>{s.eventCode}</span>
                        )}
                      </div>
                      <div className="support-actions">
                        <label className="toggle">
                          <input type="checkbox" checked={s.enabled} onChange={() => toggleEnabled(realIdx)} />
                          <span className="slider" />
                        </label>
                        <button className="btn-icon" onClick={() => openEditModal(s)} title="Edit">✏️</button>
                        <button className="btn-icon" onClick={() => removeSupport(realIdx)} title="Remove from tenant">🗑️</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
