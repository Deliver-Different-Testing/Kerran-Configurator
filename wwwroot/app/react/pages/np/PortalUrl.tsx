import { useState } from 'react';

// ═══════════════════════════════════════════════════════
// Courier Role Profiles — Configure roles, requirements, and compliance
// ═══════════════════════════════════════════════════════

interface RoleRequirement {
  id: number;
  name: string;
  type: 'document' | 'training';
  mandatory: boolean;
  description: string;
}

interface RoleProfile {
  id: string;
  name: string;
  icon: string;
  description: string;
  active: boolean;
  requirements: RoleRequirement[];
  complianceProfileId?: number;
}

const AVAILABLE_REQUIREMENTS: RoleRequirement[] = [
  // Documents
  { id: 1, name: "Driver's License", type: 'document', mandatory: true, description: 'Valid driver license with appropriate class' },
  { id: 2, name: 'Vehicle Registration', type: 'document', mandatory: true, description: 'Current vehicle registration' },
  { id: 3, name: 'Insurance Certificate', type: 'document', mandatory: true, description: 'Vehicle insurance with minimum coverage' },
  { id: 4, name: 'WOF / Vehicle Inspection', type: 'document', mandatory: true, description: 'Current warrant/inspection certificate' },
  { id: 5, name: 'Police Vetting', type: 'document', mandatory: false, description: 'Background check clearance' },
  { id: 6, name: 'DG Certificate', type: 'document', mandatory: false, description: 'Dangerous goods handling certification' },
  { id: 7, name: 'First Aid Certificate', type: 'document', mandatory: false, description: 'Current first aid certification' },
  { id: 8, name: 'Forklift License', type: 'document', mandatory: false, description: 'Forklift operation license' },
  // Training
  { id: 20, name: 'Health & Safety Induction', type: 'training', mandatory: true, description: 'Workplace health & safety training' },
  { id: 21, name: 'Cold Chain Training', type: 'training', mandatory: false, description: 'Temperature-controlled goods handling' },
  { id: 22, name: 'HIPAA / Privacy Training', type: 'training', mandatory: false, description: 'Medical privacy and data protection' },
  { id: 23, name: 'Cell & Gene Handling', type: 'training', mandatory: false, description: 'Specialist cell & gene therapy transport' },
  { id: 24, name: 'Temperature Monitoring', type: 'training', mandatory: false, description: 'Data logger and temperature monitoring procedures' },
  { id: 25, name: 'DG Awareness', type: 'training', mandatory: false, description: 'Dangerous goods awareness for drivers' },
  { id: 26, name: 'Customer Service Standards', type: 'training', mandatory: false, description: 'Professional conduct and service standards' },
  { id: 27, name: 'Vehicle Pre-Trip Inspection', type: 'training', mandatory: false, description: 'Daily vehicle inspection procedures' },
];

const INITIAL_ROLES: RoleProfile[] = [
  {
    id: 'general', name: 'Courier Driver', icon: '🚚', active: true,
    description: 'General delivery and courier services',
    requirements: AVAILABLE_REQUIREMENTS.filter(r => [1, 2, 3, 4, 20, 27].includes(r.id)),
  },
  {
    id: 'medical', name: 'Medical Courier', icon: '🏥', active: true,
    description: 'Healthcare and pharmaceutical delivery',
    requirements: AVAILABLE_REQUIREMENTS.filter(r => [1, 2, 3, 4, 5, 7, 20, 21, 22, 27].includes(r.id)),
  },
  {
    id: 'cellgene', name: 'Cell & Gene Specialist', icon: '🧬', active: true,
    description: 'Cell & gene therapy transport — highest compliance tier',
    requirements: AVAILABLE_REQUIREMENTS.filter(r => [1, 2, 3, 4, 5, 7, 20, 21, 22, 23, 24, 27].includes(r.id)),
  },
  {
    id: 'dg', name: 'Dangerous Goods Driver', icon: '⚠️', active: true,
    description: 'Hazardous materials transport',
    requirements: AVAILABLE_REQUIREMENTS.filter(r => [1, 2, 3, 4, 6, 20, 25, 27].includes(r.id)),
  },
  {
    id: 'freight', name: 'Freight Driver', icon: '📦', active: false,
    description: 'Large item and pallet delivery',
    requirements: AVAILABLE_REQUIREMENTS.filter(r => [1, 2, 3, 4, 8, 20, 27].includes(r.id)),
  },
  {
    id: 'express', name: 'Express Courier', icon: '⚡', active: true,
    description: 'Same-day and urgent deliveries',
    requirements: AVAILABLE_REQUIREMENTS.filter(r => [1, 2, 3, 4, 20, 26, 27].includes(r.id)),
  },
];

export default function PortalUrl() {
  const [roles, setRoles] = useState<RoleProfile[]>(INITIAL_ROLES);
  const [selectedRole, setSelectedRole] = useState<RoleProfile | null>(null);
  const [editingRole, setEditingRole] = useState<RoleProfile | null>(null);
  const [showAddReq, setShowAddReq] = useState(false);

  const handleToggleActive = (roleId: string) => {
    setRoles(prev => prev.map(r => r.id === roleId ? { ...r, active: !r.active } : r));
  };

  const handleSelectRole = (role: RoleProfile) => {
    setSelectedRole(role);
    setEditingRole(null);
    setShowAddReq(false);
  };

  const handleEditRole = (role: RoleProfile) => {
    setEditingRole({ ...role, requirements: [...role.requirements] });
    setShowAddReq(false);
  };

  const handleSaveRole = () => {
    if (!editingRole) return;
    setRoles(prev => prev.map(r => r.id === editingRole.id ? editingRole : r));
    setSelectedRole(editingRole);
    setEditingRole(null);
  };

  const handleRemoveRequirement = (reqId: number) => {
    if (!editingRole) return;
    setEditingRole({ ...editingRole, requirements: editingRole.requirements.filter(r => r.id !== reqId) });
  };

  const handleAddRequirement = (req: RoleRequirement) => {
    if (!editingRole) return;
    if (editingRole.requirements.some(r => r.id === req.id)) return;
    setEditingRole({ ...editingRole, requirements: [...editingRole.requirements, req] });
  };

  const handleToggleMandatory = (reqId: number) => {
    if (!editingRole) return;
    setEditingRole({
      ...editingRole,
      requirements: editingRole.requirements.map(r =>
        r.id === reqId ? { ...r, mandatory: !r.mandatory } : r
      ),
    });
  };

  const activeRole = editingRole || selectedRole;
  const availableToAdd = AVAILABLE_REQUIREMENTS.filter(
    ar => !editingRole?.requirements.some(r => r.id === ar.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Courier Role Profiles</h1>
        <p className="text-sm text-text-secondary mt-1">
          Define the roles available for courier recruitment. Each role specifies the documents and training required before a driver is eligible.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Role List ────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Roles</h2>
            <span className="text-xs text-text-secondary">{roles.filter(r => r.active).length} active</span>
          </div>

          {roles.map(role => (
            <button
              key={role.id}
              onClick={() => handleSelectRole(role)}
              className={`w-full text-left rounded-xl border p-4 transition-all ${
                activeRole?.id === role.id
                  ? 'border-accent bg-accent/5 ring-1 ring-accent/20'
                  : 'border-border-primary hover:border-accent/40 bg-surface-primary'
              } ${!role.active ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{role.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text-primary text-sm">{role.name}</span>
                    {!role.active && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-500 font-medium">Inactive</span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5 truncate">{role.description}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs font-medium text-text-secondary">
                    {role.requirements.filter(r => r.type === 'document').length} docs
                  </span>
                  <span className="text-xs font-medium text-text-secondary">
                    {role.requirements.filter(r => r.type === 'training').length} training
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* ── Right: Role Detail ─────────────────── */}
        <div className="lg:col-span-2">
          {!activeRole ? (
            <div className="bg-surface-primary border border-border-primary rounded-xl p-12 text-center">
              <span className="text-4xl">👈</span>
              <p className="text-text-secondary mt-3">Select a role to view its requirements</p>
            </div>
          ) : (
            <div className="bg-surface-primary border border-border-primary rounded-xl overflow-hidden">
              {/* Role Header */}
              <div className="px-6 py-4 border-b border-border-primary bg-surface-secondary/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{activeRole.icon}</span>
                    <div>
                      {editingRole ? (
                        <input
                          value={editingRole.name}
                          onChange={e => setEditingRole({ ...editingRole, name: e.target.value })}
                          className="text-lg font-bold text-text-primary bg-transparent border-b border-accent focus:outline-none"
                        />
                      ) : (
                        <h2 className="text-lg font-bold text-text-primary">{activeRole.name}</h2>
                      )}
                      {editingRole ? (
                        <input
                          value={editingRole.description}
                          onChange={e => setEditingRole({ ...editingRole, description: e.target.value })}
                          className="text-sm text-text-secondary bg-transparent border-b border-gray-300 focus:outline-none w-full mt-1"
                        />
                      ) : (
                        <p className="text-sm text-text-secondary">{activeRole.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingRole ? (
                      <>
                        <button onClick={handleSaveRole} className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/90">
                          Save
                        </button>
                        <button onClick={() => setEditingRole(null)} className="px-3 py-1.5 text-xs font-medium border border-border-primary text-text-secondary rounded-lg hover:bg-surface-secondary">
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleEditRole(activeRole)} className="px-3 py-1.5 text-xs font-medium bg-accent/10 text-accent rounded-lg hover:bg-accent/20">
                          Edit Requirements
                        </button>
                        <button
                          onClick={() => handleToggleActive(activeRole.id)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
                            activeRole.active
                              ? 'bg-green-50 text-green-700 hover:bg-green-100'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {activeRole.active ? '✓ Active' : 'Inactive'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Requirements */}
              <div className="p-6">
                {/* Documents Section */}
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span>📄</span> Document Requirements
                    <span className="text-[10px] bg-surface-secondary rounded-full px-2 py-0.5">
                      {activeRole.requirements.filter(r => r.type === 'document').length}
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {activeRole.requirements.filter(r => r.type === 'document').map(req => (
                      <div key={req.id} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border-primary bg-white">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-text-primary">{req.name}</span>
                            {req.mandatory ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">Required</span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Optional</span>
                            )}
                          </div>
                          <p className="text-xs text-text-secondary mt-0.5">{req.description}</p>
                        </div>
                        {editingRole && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleMandatory(req.id)}
                              className="text-[10px] px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
                              title="Toggle mandatory"
                            >
                              {req.mandatory ? 'Make Optional' : 'Make Required'}
                            </button>
                            <button
                              onClick={() => handleRemoveRequirement(req.id)}
                              className="text-red-400 hover:text-red-600 p-1"
                              title="Remove requirement"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {activeRole.requirements.filter(r => r.type === 'document').length === 0 && (
                      <p className="text-sm text-text-secondary italic px-4 py-3">No document requirements configured</p>
                    )}
                  </div>
                </div>

                {/* Training Section */}
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span>🎓</span> Training Requirements
                    <span className="text-[10px] bg-surface-secondary rounded-full px-2 py-0.5">
                      {activeRole.requirements.filter(r => r.type === 'training').length}
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {activeRole.requirements.filter(r => r.type === 'training').map(req => (
                      <div key={req.id} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border-primary bg-white">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-text-primary">{req.name}</span>
                            {req.mandatory ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">Required</span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Optional</span>
                            )}
                          </div>
                          <p className="text-xs text-text-secondary mt-0.5">{req.description}</p>
                        </div>
                        {editingRole && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleMandatory(req.id)}
                              className="text-[10px] px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
                            >
                              {req.mandatory ? 'Make Optional' : 'Make Required'}
                            </button>
                            <button
                              onClick={() => handleRemoveRequirement(req.id)}
                              className="text-red-400 hover:text-red-600 p-1"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {activeRole.requirements.filter(r => r.type === 'training').length === 0 && (
                      <p className="text-sm text-text-secondary italic px-4 py-3">No training requirements configured</p>
                    )}
                  </div>
                </div>

                {/* Add Requirement (edit mode) */}
                {editingRole && (
                  <div>
                    <button
                      onClick={() => setShowAddReq(!showAddReq)}
                      className="flex items-center gap-2 text-sm font-medium text-accent hover:text-accent/80"
                    >
                      <span className="text-lg">+</span> Add Requirement
                    </button>

                    {showAddReq && availableToAdd.length > 0 && (
                      <div className="mt-3 border border-border-primary rounded-xl overflow-hidden">
                        <div className="px-4 py-2 bg-surface-secondary/50 border-b border-border-primary">
                          <span className="text-xs font-semibold text-text-secondary uppercase">Available Requirements</span>
                        </div>
                        <div className="max-h-64 overflow-y-auto divide-y divide-border-primary">
                          {availableToAdd.map(req => (
                            <button
                              key={req.id}
                              onClick={() => handleAddRequirement(req)}
                              className="w-full text-left px-4 py-3 hover:bg-accent/5 flex items-center gap-3 transition-colors"
                            >
                              <span className="text-sm">{req.type === 'document' ? '📄' : '🎓'}</span>
                              <div className="flex-1">
                                <span className="text-sm font-medium text-text-primary">{req.name}</span>
                                <p className="text-xs text-text-secondary">{req.description}</p>
                              </div>
                              <span className="text-accent text-lg">+</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {showAddReq && availableToAdd.length === 0 && (
                      <p className="mt-3 text-sm text-text-secondary italic">All available requirements have been added to this role.</p>
                    )}
                  </div>
                )}

                {/* Summary Bar */}
                {!editingRole && (
                  <div className="mt-6 pt-4 border-t border-border-primary">
                    <div className="flex items-center gap-6 text-sm">
                      <div>
                        <span className="text-text-secondary">Total Requirements: </span>
                        <span className="font-semibold text-text-primary">{activeRole.requirements.length}</span>
                      </div>
                      <div>
                        <span className="text-text-secondary">Mandatory: </span>
                        <span className="font-semibold text-red-600">{activeRole.requirements.filter(r => r.mandatory).length}</span>
                      </div>
                      <div>
                        <span className="text-text-secondary">Optional: </span>
                        <span className="font-semibold text-text-primary">{activeRole.requirements.filter(r => !r.mandatory).length}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
