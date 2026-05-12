import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { complianceProfileService } from '@/services/np_complianceProfileService';
import { documentTypeService } from '@/services/np_documentService';
import type { ComplianceProfile, ComplianceRequirement, DocumentType } from '@/types';

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
        checked ? 'bg-[#3bc7f4]' : 'bg-gray-300'
      }`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function ProfileCard({ profile, eligibleCount, onClick, onDuplicate }: { profile: ComplianceProfile; eligibleCount: number; onClick: () => void; onDuplicate: () => void }) {
  const complianceReqs = profile.requirements.filter(r => r.purpose === 'Compliance');
  const trainingReqs = profile.requirements.filter(r => r.purpose === 'Training');

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-border rounded-lg p-5 hover:shadow-md transition-shadow"
      style={{ borderLeftWidth: 4, borderLeftColor: profile.isDefault ? '#3bc7f4' : '#d1d5db' }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-text-primary">{profile.name}</h3>
          {profile.isDefault && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3bc7f4]/20 text-[#3bc7f4] font-bold uppercase">Default</span>
          )}
          {!profile.active && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 font-bold uppercase">Inactive</span>
          )}
        </div>
        <span
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          className="text-xs text-text-muted hover:text-[#3bc7f4] cursor-pointer transition-colors"
          title="Duplicate profile"
        >📋 Copy</span>
      </div>
      <p className="text-xs text-text-secondary mb-3">{profile.description}</p>
      {(profile.clientNames?.length || profile.clientName) && (
        <div className="text-xs text-text-secondary mb-2 flex items-center gap-1 flex-wrap">
          <span className="font-medium">{(profile.clientNames?.length || 0) > 1 ? 'Clients:' : 'Client:'}</span>
          {(profile.clientNames || (profile.clientName ? [profile.clientName] : [])).map(c => (
            <span key={c} className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px]">{c}</span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#3bc7f4]" />
          <span>{complianceReqs.length} Compliance</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-purple-400" />
          <span>{trainingReqs.length} Training</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <span className="font-bold text-green-600">{eligibleCount}</span>
          <span className="text-text-muted">drivers eligible</span>
        </div>
      </div>
    </button>
  );
}

function RequirementSearch({ docTypes, onAdd, onNavigateToNew }: {
  docTypes: DocumentType[];
  onAdd: (dt: DocumentType) => void;
  onNavigateToNew: () => void;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = docTypes.filter(dt =>
    dt.name.toLowerCase().includes(search.toLowerCase()) ||
    dt.purpose.toLowerCase().includes(search.toLowerCase()) ||
    dt.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="relative mt-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Search compliance documents to add..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#3bc7f4]/50"
          />
        </div>
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filtered.length > 0 ? filtered.map(dt => (
            <button
              key={dt.id}
              onClick={() => { onAdd(dt); setSearch(''); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 hover:bg-[#f4f2f1] flex items-center gap-2 transition-colors"
            >
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${dt.purpose === 'Training' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                {dt.purpose}
              </span>
              <span className="text-sm flex-1">{dt.name}</span>
              <span className="text-[10px] text-text-muted">{dt.category}</span>
            </button>
          )) : (
            <div className="px-4 py-3 text-sm text-text-secondary">
              {search ? `No documents matching "${search}"` : 'No more documents available'}
            </div>
          )}
          <button
            onClick={() => { setOpen(false); onNavigateToNew(); }}
            className="w-full text-left px-4 py-2.5 border-t border-border hover:bg-[#3bc7f4]/5 flex items-center gap-2 text-[#3bc7f4] font-medium text-sm transition-colors"
          >
            <span className="text-lg">+</span> Create New Compliance Document...
          </button>
        </div>
      )}
    </div>
  );
}

function ProfileModal({ profile, docTypes, onSave, onClose, onDuplicate }: {
  profile: ComplianceProfile | null;
  docTypes: DocumentType[];
  onSave: (data: Partial<ComplianceProfile>) => void;
  onClose: () => void;
  onDuplicate?: () => void;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.name || '');
  const [description, setDescription] = useState(profile?.description || '');
  const [isDefault, setIsDefault] = useState(profile?.isDefault || false);
  const [clients, setClients] = useState<string[]>(profile?.clientNames || (profile?.clientName ? [profile.clientName] : []));
  const [clientInput, setClientInput] = useState('');
  const [active, setActive] = useState(profile?.active ?? true);
  const [requirements, setRequirements] = useState<ComplianceRequirement[]>(profile?.requirements || []);

  // Mock client list — in production would come from API
  const availableClients = ['Stryker', 'Fisher & Paykel Healthcare', 'Auckland DHB', 'Roche Diagnostics', 'Cell & Gene Logistics', 'NZ Blood Service', 'Medtronic', 'Baxter Healthcare', 'DHL Supply Chain'];
  const filteredClients = availableClients.filter(c =>
    c.toLowerCase().includes(clientInput.toLowerCase()) && !clients.includes(c)
  );
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientRef.current && !clientRef.current.contains(e.target as Node)) setShowClientDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addClient = (c: string) => {
    if (!clients.includes(c)) setClients(prev => [...prev, c]);
    setClientInput('');
    setShowClientDropdown(false);
  };

  const removeClient = (c: string) => {
    setClients(prev => prev.filter(x => x !== c));
  };

  const addRequirement = (dt: DocumentType) => {
    if (requirements.some(r => r.documentTypeId === dt.id)) return;
    setRequirements(prev => [...prev, {
      id: Date.now(),
      profileId: profile?.id || 0,
      documentTypeId: dt.id,
      documentTypeName: dt.name,
      purpose: dt.purpose,
      mandatory: true,
      sortOrder: prev.length + 1,
    }]);
  };

  const removeRequirement = (docTypeId: number) => {
    setRequirements(prev => prev.filter(r => r.documentTypeId !== docTypeId));
  };

  const toggleMandatory = (docTypeId: number) => {
    setRequirements(prev => prev.map(r => r.documentTypeId === docTypeId ? { ...r, mandatory: !r.mandatory } : r));
  };

  const moveReq = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= requirements.length) return;
    const copy = [...requirements];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    copy.forEach((r, i) => r.sortOrder = i + 1);
    setRequirements(copy);
  };

  const availableDocs = docTypes.filter(dt => !requirements.some(r => r.documentTypeId === dt.id));

  return (
    <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold">{profile ? 'Edit Profile' : 'New Compliance Profile'}</h2>
          {profile && onDuplicate && (
            <button
              onClick={onDuplicate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-text-secondary hover:bg-[#3bc7f4]/10 hover:text-[#3bc7f4] hover:border-[#3bc7f4]/30 transition-all"
            >
              📋 Duplicate Profile
            </button>
          )}
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-text-secondary uppercase tracking-wide">Profile Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg" placeholder="e.g. Medical Courier" />
          </div>
          <div>
            <label className="text-xs text-text-secondary uppercase tracking-wide">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg" placeholder="What is this profile for?" />
          </div>
          {/* Clients */}
          <div>
            <label className="text-xs text-text-secondary uppercase tracking-wide mb-1 block">Clients (optional — leave empty for general profile)</label>
            {clients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {clients.map(c => (
                  <span key={c} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#3bc7f4]/15 text-[#0d0c2c] border border-[#3bc7f4]/30">
                    {c}
                    <button onClick={() => removeClient(c)} className="text-red-400 hover:text-red-600 ml-0.5">✕</button>
                  </span>
                ))}
              </div>
            )}
            <div ref={clientRef} className="relative">
              <input
                value={clientInput}
                onChange={e => { setClientInput(e.target.value); setShowClientDropdown(true); }}
                onFocus={() => setShowClientDropdown(true)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && clientInput.trim()) {
                    e.preventDefault();
                    addClient(clientInput.trim());
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg"
                placeholder="Search or type a client name and press Enter..."
              />
              {showClientDropdown && (clientInput || filteredClients.length > 0) && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredClients.map(c => (
                    <button key={c} onClick={() => addClient(c)} className="w-full text-left px-4 py-2 text-sm hover:bg-[#f4f2f1] transition-colors">
                      {c}
                    </button>
                  ))}
                  {clientInput.trim() && !availableClients.some(c => c.toLowerCase() === clientInput.trim().toLowerCase()) && (
                    <button
                      onClick={() => addClient(clientInput.trim())}
                      className="w-full text-left px-4 py-2 text-sm border-t border-border text-[#3bc7f4] font-medium hover:bg-[#3bc7f4]/5"
                    >
                      + Add "{clientInput.trim()}" as new client
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <ToggleSwitch checked={isDefault} onChange={setIsDefault} />
              <span className="text-sm">Default</span>
            </div>
            <div className="flex items-center gap-2">
              <ToggleSwitch checked={active} onChange={setActive} />
              <span className="text-sm">Active</span>
            </div>
          </div>

          {/* Requirements */}
          <div>
            <label className="text-xs text-text-secondary uppercase tracking-wide mb-2 block">Requirements</label>
            {requirements.length === 0 && <p className="text-xs text-text-muted italic py-4">No requirements added yet — search below to add compliance documents</p>}
            <div className="space-y-1">
              {requirements.map((req, idx) => (
                <div key={req.documentTypeId} className="flex items-center gap-2 bg-[#f4f2f1] rounded px-3 py-2">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveReq(idx, -1)} className="text-text-muted hover:text-text-primary text-xs leading-none" disabled={idx === 0}>▲</button>
                    <button onClick={() => moveReq(idx, 1)} className="text-text-muted hover:text-text-primary text-xs leading-none" disabled={idx === requirements.length - 1}>▼</button>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${req.purpose === 'Training' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                    {req.purpose}
                  </span>
                  <span className="text-sm flex-1">{req.documentTypeName}</span>
                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                    <input type="checkbox" checked={req.mandatory} onChange={() => toggleMandatory(req.documentTypeId)} className="rounded border-border text-[#3bc7f4]" />
                    Required
                  </label>
                  <button onClick={() => removeRequirement(req.documentTypeId)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                </div>
              ))}
            </div>
            <RequirementSearch
              docTypes={availableDocs}
              onAdd={addRequirement}
              onNavigateToNew={() => { onClose(); navigate('/settings/document-types'); }}
            />
          </div>
        </div>
        <div className="p-6 border-t border-border flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => onSave({ name, description, isDefault, clientNames: clients.length > 0 ? clients : undefined, clientName: clients[0] || undefined, active, requirements, tenantId: 1 })}
            disabled={!name.trim()}
            className="px-4 py-2 text-sm bg-[#3bc7f4] text-[#0d0c2c] font-medium rounded-lg hover:shadow-cyan-glow disabled:opacity-50"
          >
            {profile ? 'Save Changes' : 'Create Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ComplianceProfiles() {
  const [profiles, setProfiles] = useState<ComplianceProfile[]>([]);
  const [editingProfile, setEditingProfile] = useState<ComplianceProfile | null | 'new' | 'duplicate'>(null);
  const [duplicateSource, setDuplicateSource] = useState<Partial<ComplianceProfile> | null>(null);
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);

  useEffect(() => {
    setProfiles(complianceProfileService.getAll());
    setDocTypes(documentTypeService.getAll());
  }, []);

  const eligibleCounts = profiles.reduce((acc, p) => {
    acc[p.id] = complianceProfileService.getEligibleDriverCount(p.id);
    return acc;
  }, {} as Record<number, number>);

  const handleSave = (data: Partial<ComplianceProfile>) => {
    if (editingProfile === 'new' || editingProfile === 'duplicate') {
      complianceProfileService.create(data as Omit<ComplianceProfile, 'id' | 'createdDate'>);
    } else if (editingProfile && typeof editingProfile === 'object') {
      complianceProfileService.update(editingProfile.id, data);
    }
    setProfiles(complianceProfileService.getAll());
    setEditingProfile(null);
  };

  const handleDuplicate = (profile: ComplianceProfile) => {
    // Pre-populate modal with copied data but treat as new
    setDuplicateSource({
      ...profile,
      name: `${profile.name} (Copy)`,
      isDefault: false,
      clientName: undefined,
    });
    setEditingProfile('duplicate');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Compliance Profiles</h1>
          <p className="text-sm text-text-secondary mt-1">Define reusable sets of requirements for driver eligibility</p>
        </div>
        <button
          onClick={() => setEditingProfile('new')}
          className="bg-[#3bc7f4] text-[#0d0c2c] font-medium px-4 py-2 rounded-lg text-sm hover:shadow-cyan-glow"
        >
          + Add Profile
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-border p-4">
          <div className="text-2xl font-bold text-text-primary">{profiles.filter(p => p.active).length}</div>
          <div className="text-xs text-text-secondary">Active Profiles</div>
        </div>
        <div className="bg-white rounded-lg border border-border p-4">
          <div className="text-2xl font-bold text-[#3bc7f4]">{profiles.reduce((sum, p) => sum + p.requirements.length, 0)}</div>
          <div className="text-xs text-text-secondary">Total Requirements</div>
        </div>
        <div className="bg-white rounded-lg border border-border p-4">
          <div className="text-2xl font-bold text-green-600">{Object.values(eligibleCounts).reduce((a, b) => a + b, 0)}</div>
          <div className="text-xs text-text-secondary">Total Eligible Assignments</div>
        </div>
      </div>

      {/* Profile Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map(p => (
          <ProfileCard key={p.id} profile={p} eligibleCount={eligibleCounts[p.id] || 0} onClick={() => setEditingProfile(p)} onDuplicate={() => handleDuplicate(p)} />
        ))}
      </div>

      {editingProfile && (
        <ProfileModal
          profile={editingProfile === 'new' ? null : editingProfile === 'duplicate' ? (duplicateSource as ComplianceProfile) : editingProfile}
          docTypes={docTypes}
          onSave={handleSave}
          onClose={() => { setEditingProfile(null); setDuplicateSource(null); }}
          onDuplicate={editingProfile !== 'new' && editingProfile !== 'duplicate' && typeof editingProfile === 'object' ? () => handleDuplicate(editingProfile) : undefined}
        />
      )}
    </div>
  );
}
