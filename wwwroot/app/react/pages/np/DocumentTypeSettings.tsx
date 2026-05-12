import { useState } from 'react';
import { useDocumentTypes } from '@/hooks/useDocuments';
import { documentTypeService } from '@/services/np_documentService';
import { quizService } from '@/services/np_quizService';
import type { DocumentType, DocumentCategory, DocumentAppliesTo, DocumentPurpose } from '@/types';
import QuizBuilder from './QuizBuilder';

const categories: DocumentCategory[] = ['Licensing', 'Insurance', 'Vehicle', 'Contract', 'Other'];
// Multi-select now handled inline in the modal
const purposeOptions: DocumentPurpose[] = ['Compliance', 'Training'];

function CategoryBadge({ category }: { category: DocumentCategory }) {
  const colors: Record<DocumentCategory, string> = {
    Licensing: 'bg-blue-50 text-blue-700 border-blue-200',
    Insurance: 'bg-purple-50 text-purple-700 border-purple-200',
    Vehicle: 'bg-green-50 text-green-700 border-green-200',
    Contract: 'bg-amber-50 text-amber-700 border-amber-200',
    Other: 'bg-gray-50 text-gray-600 border-gray-200',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-lg border ${colors[category]}`}>{category}</span>
  );
}

function PurposeBadge({ purpose }: { purpose: DocumentPurpose }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-lg border ${
      purpose === 'Compliance'
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : 'bg-purple-50 text-purple-700 border-purple-200'
    }`}>{purpose}</span>
  );
}

interface EditState {
  mode: 'create' | 'edit';
  id?: number;
  name: string;
  instructions: string;
  category: DocumentCategory;
  mandatory: boolean;
  hasExpiry: boolean;
  expiryWarningDays: number;
  blockOnExpiry: boolean;
  appliesTo: DocumentAppliesTo;
  sortOrder: number;
  purpose: DocumentPurpose;
  contentUrl: string;
  estimatedMinutes: number;
  quizRequired: boolean;
}

const emptyEdit: EditState = {
  mode: 'create',
  name: '',
  instructions: '',
  category: 'Other',
  mandatory: false,
  hasExpiry: false,
  expiryWarningDays: 30,
  blockOnExpiry: false,
  appliesTo: 'Both',
  sortOrder: 0,
  purpose: 'Compliance',
  contentUrl: '',
  estimatedMinutes: 0,
  quizRequired: false,
};

export default function DocumentTypeSettings() {
  const { types, loading, refresh } = useDocumentTypes();
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [quizBuilderDocTypeId, setQuizBuilderDocTypeId] = useState<number | null>(null);

  const handleEdit = (dt: DocumentType) => {
    setEditing({
      mode: 'edit',
      id: dt.id,
      name: dt.name,
      instructions: dt.instructions || '',
      category: dt.category,
      mandatory: dt.mandatory,
      hasExpiry: dt.hasExpiry,
      expiryWarningDays: dt.expiryWarningDays,
      blockOnExpiry: dt.blockOnExpiry,
      appliesTo: dt.appliesTo,
      sortOrder: dt.sortOrder,
      purpose: dt.purpose || 'Compliance',
      contentUrl: dt.contentUrl || '',
      estimatedMinutes: dt.estimatedMinutes || 0,
      quizRequired: dt.quizRequired ?? false,
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const payload: any = {
        name: editing.name,
        instructions: editing.instructions || undefined,
        category: editing.category,
        mandatory: editing.mandatory,
        hasExpiry: editing.hasExpiry,
        expiryWarningDays: editing.expiryWarningDays,
        blockOnExpiry: editing.blockOnExpiry,
        appliesTo: editing.appliesTo,
        sortOrder: editing.sortOrder,
        purpose: editing.purpose,
      };
      if (editing.purpose === 'Training') {
        payload.contentUrl = editing.contentUrl || undefined;
        payload.estimatedMinutes = editing.estimatedMinutes || undefined;
        payload.quizRequired = editing.quizRequired;
      } else {
        payload.quizRequired = false;
      }
      if (editing.mode === 'create') {
        await documentTypeService.create(payload);
      } else if (editing.id) {
        await documentTypeService.update(editing.id, payload);
      }
      setEditing(null);
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm('Deactivate this document type?')) return;
    await documentTypeService.deactivate(id);
    await refresh();
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await documentTypeService.seed();
      await refresh();
    } finally {
      setSeeding(false);
    }
  };

  const handleTemplateUpload = async (id: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png,.bmp,.docx';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      await documentTypeService.uploadTemplate(id, file);
      await refresh();
    };
    input.click();
  };

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">Compliance Documents</h2>
        <div className="flex gap-2">
          {types.length === 0 && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="bg-transparent border border-border text-text-primary px-4 py-2 rounded-md text-sm hover:border-brand-cyan hover:text-brand-cyan transition-all"
            >
              {seeding ? 'Seeding...' : 'Seed Defaults'}
            </button>
          )}
          <button
            onClick={() => setEditing({ ...emptyEdit })}
            className="bg-brand-cyan text-brand-dark border-none font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow"
          >
            + Add Document Type
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-text-secondary text-sm">Loading...</div>
      ) : (
        <div className="bg-white border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-light border-b border-border">
                <th className="text-left px-4 py-2.5 text-xs text-text-secondary uppercase tracking-wide font-medium">Order</th>
                <th className="text-left px-4 py-2.5 text-xs text-text-secondary uppercase tracking-wide font-medium">Name</th>
                <th className="text-left px-4 py-2.5 text-xs text-text-secondary uppercase tracking-wide font-medium">Purpose</th>
                <th className="text-left px-4 py-2.5 text-xs text-text-secondary uppercase tracking-wide font-medium">Category</th>
                <th className="text-center px-4 py-2.5 text-xs text-text-secondary uppercase tracking-wide font-medium">Required</th>
                <th className="text-center px-4 py-2.5 text-xs text-text-secondary uppercase tracking-wide font-medium">Has Expiry</th>
                <th className="text-center px-4 py-2.5 text-xs text-text-secondary uppercase tracking-wide font-medium">Block</th>
                <th className="text-left px-4 py-2.5 text-xs text-text-secondary uppercase tracking-wide font-medium">Applies To</th>
                <th className="text-center px-4 py-2.5 text-xs text-text-secondary uppercase tracking-wide font-medium">Template</th>
                <th className="text-center px-4 py-2.5 text-xs text-text-secondary uppercase tracking-wide font-medium">Quiz</th>
                <th className="text-right px-4 py-2.5 text-xs text-text-secondary uppercase tracking-wide font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {types.map((dt) => (
                <tr key={dt.id} className="border-b border-border last:border-b-0 hover:bg-surface-light/50">
                  <td className="px-4 py-2.5 text-text-secondary">{dt.sortOrder}</td>
                  <td className="px-4 py-2.5 font-medium text-brand-dark">
                    {dt.name}
                    {dt.instructions && (
                      <div className="text-xs text-text-secondary mt-0.5 truncate max-w-[200px]">{dt.instructions}</div>
                    )}
                    {dt.purpose === 'Training' && dt.estimatedMinutes && (
                      <div className="text-xs text-text-secondary mt-0.5">⏱ {dt.estimatedMinutes} min</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5"><PurposeBadge purpose={dt.purpose} /></td>
                  <td className="px-4 py-2.5"><CategoryBadge category={dt.category} /></td>
                  <td className="px-4 py-2.5 text-center">{dt.mandatory ? '✅' : '—'}</td>
                  <td className="px-4 py-2.5 text-center">{dt.hasExpiry ? `✅ ${dt.expiryWarningDays}d` : '—'}</td>
                  <td className="px-4 py-2.5 text-center">{dt.blockOnExpiry ? '🚫' : '—'}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{
                    dt.appliesTo === 'All' ? 'All' :
                    dt.appliesTo === 'Both' ? 'Applicant, Courier' :
                    dt.appliesTo === 'ActiveCourier' ? 'Active Courier' :
                    dt.appliesTo === 'NP' ? 'Network Partner' :
                    dt.appliesTo
                  }</td>
                  <td className="px-4 py-2.5 text-center">
                    {dt.hasTemplate ? (
                      <span className="text-green-600 cursor-pointer" title="Template available">📋</span>
                    ) : (
                      <button
                        onClick={() => handleTemplateUpload(dt.id)}
                        className="text-xs text-brand-cyan hover:underline"
                      >
                        Upload
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {dt.purpose === 'Training' ? (
                      dt.quizRequired ? (
                        (() => {
                          const quiz = quizService.getQuizForDocType(dt.id);
                          return quiz ? (
                            <span title={`Quiz: ${quiz.questions.length} questions`} className="cursor-help">📝</span>
                          ) : (
                            <span title="Quiz required but not yet created" className="text-amber-500 cursor-help">⚠️</span>
                          );
                        })()
                      ) : (
                        <span className="text-text-secondary" title="No quiz required">—</span>
                      )
                    ) : (
                      <span className="text-text-secondary">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex gap-1.5 justify-end">
                      <button
                        onClick={() => handleEdit(dt)}
                        className="text-xs text-brand-cyan hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeactivate(dt.id)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {types.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-text-secondary">
                    No document types configured. Click "Seed Defaults" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Quiz Builder Modal */}
      {quizBuilderDocTypeId !== null && (
        <QuizBuilder documentTypeId={quizBuilderDocTypeId} onClose={() => setQuizBuilderDocTypeId(null)} />
      )}

      {/* Create / Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-border">
              <h3 className="text-lg font-bold text-brand-dark">
                {editing.mode === 'create' ? 'New Document Type' : 'Edit Document Type'}
              </h3>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs text-text-secondary uppercase tracking-wide block mb-1">Name</label>
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  placeholder="e.g. Driver's License"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary uppercase tracking-wide block mb-1">Purpose</label>
                <div className="grid grid-cols-2 gap-2">
                  {purposeOptions.map(p => (
                    <button
                      key={p}
                      onClick={() => setEditing({ ...editing, purpose: p })}
                      className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                        editing.purpose === p
                          ? p === 'Compliance' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-purple-400 bg-purple-50 text-purple-700'
                          : 'border-border text-text-secondary hover:border-gray-300'
                      }`}
                    >
                      {p === 'Compliance' ? '📋 Compliance' : '🎓 Training'}
                      <div className="text-xs font-normal mt-1 text-text-secondary">
                        {p === 'Compliance' ? 'Licenses, insurance, etc.' : 'Materials to read/watch'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-text-secondary uppercase tracking-wide block mb-1">Instructions</label>
                <textarea
                  value={editing.instructions}
                  onChange={(e) => setEditing({ ...editing, instructions: e.target.value })}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Instructions shown to uploader"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-text-secondary uppercase tracking-wide block mb-1">Category</label>
                  <select
                    value={editing.category}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value as DocumentCategory })}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-text-secondary uppercase tracking-wide block mb-1">Applies To</label>
                  {(() => {
                    const options: { key: string; label: string }[] = [
                      { key: 'Applicant', label: 'Applicant' },
                      { key: 'ActiveCourier', label: 'Active Courier' },
                      { key: 'NP', label: 'Network Partner' },
                    ];
                    // Parse current value into selected set
                    const current = editing.appliesTo;
                    const selected = new Set<string>(
                      current === 'All' ? options.map(o => o.key) :
                      current === 'Both' ? ['Applicant', 'ActiveCourier'] :
                      [current]
                    );
                    const isAll = options.every(o => selected.has(o.key));

                    const toggle = (key: string) => {
                      const next = new Set(selected);
                      next.has(key) ? next.delete(key) : next.add(key);
                      if (next.size === 0) next.add(key); // must have at least one
                      // Convert back to appliesTo value
                      const allSelected = options.every(o => next.has(o.key));
                      if (allSelected) {
                        setEditing({ ...editing, appliesTo: 'All' as DocumentAppliesTo });
                      } else if (next.size === 2 && next.has('Applicant') && next.has('ActiveCourier')) {
                        setEditing({ ...editing, appliesTo: 'Both' as DocumentAppliesTo });
                      } else {
                        setEditing({ ...editing, appliesTo: [...next][0] as DocumentAppliesTo });
                      }
                    };

                    const toggleAll = () => {
                      if (isAll) {
                        setEditing({ ...editing, appliesTo: 'Applicant' as DocumentAppliesTo });
                      } else {
                        setEditing({ ...editing, appliesTo: 'All' as DocumentAppliesTo });
                      }
                    };

                    return (
                      <div className="space-y-1.5 border border-border rounded-md p-2.5">
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                          <input type="checkbox" checked={isAll} onChange={toggleAll} className="accent-[#3bc7f4] w-4 h-4" />
                          <span className={`font-medium ${isAll ? 'text-brand-cyan' : 'text-text-primary'}`}>All</span>
                        </label>
                        <div className="border-t border-border my-1" />
                        {options.map(o => (
                          <label key={o.key} className="flex items-center gap-2 cursor-pointer text-sm">
                            <input type="checkbox" checked={selected.has(o.key)} onChange={() => toggle(o.key)} className="accent-[#3bc7f4] w-4 h-4" />
                            <span>{o.label}</span>
                          </label>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Training-specific fields */}
              {editing.purpose === 'Training' && (
                <div className="border border-purple-200 bg-purple-50/50 rounded-lg p-3 space-y-3">
                  <div className="text-xs font-medium text-purple-700 uppercase tracking-wide">Training Material</div>
                  <div>
                    <label className="text-xs text-text-secondary block mb-1">Content URL</label>
                    <input
                      value={editing.contentUrl}
                      onChange={(e) => setEditing({ ...editing, contentUrl: e.target.value })}
                      className="w-full border border-border rounded-md px-3 py-2 text-sm"
                      placeholder="https://... (video or PDF link)"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary block mb-1">Estimated Minutes</label>
                    <input
                      type="number"
                      value={editing.estimatedMinutes}
                      onChange={(e) => setEditing({ ...editing, estimatedMinutes: Number(e.target.value) })}
                      className="w-full border border-border rounded-md px-3 py-2 text-sm"
                      placeholder="e.g. 15"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 accent-[#3bc7f4]" checked={editing.quizRequired}
                      onChange={(e) => setEditing({ ...editing, quizRequired: e.target.checked })} />
                    <span className="text-text-primary font-medium">Require Quiz</span>
                    <span className="text-xs text-text-secondary">— courier must pass quiz to complete training</span>
                  </label>
                  {/* Quiz Builder (only when quiz required and editing existing) */}
                  {editing.quizRequired && editing.mode === 'edit' && editing.id && (() => {
                    const existingQuiz = quizService.getQuizForDocType(editing.id);
                    const attemptCount = existingQuiz ? quizService.getAttempts(existingQuiz.id).length : 0;
                    return (
                      <div className="border-t border-purple-200 pt-3">
                        <div className="text-xs font-medium text-purple-700 uppercase tracking-wide mb-2">Quiz</div>
                        {existingQuiz ? (
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-text-primary">
                              <span className="font-medium">{existingQuiz.questions.length} questions</span>
                              <span className="text-text-secondary"> · Pass mark {existingQuiz.passMarkPercent}% · {attemptCount} attempts</span>
                            </div>
                            <button onClick={() => setQuizBuilderDocTypeId(editing.id!)}
                              className="text-sm text-brand-cyan font-medium hover:underline">Edit Quiz</button>
                          </div>
                        ) : (
                          <button onClick={() => setQuizBuilderDocTypeId(editing.id!)}
                            className="text-sm text-brand-cyan font-medium hover:underline">+ Create Quiz</button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-text-secondary uppercase tracking-wide block mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={editing.sortOrder}
                    onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-secondary uppercase tracking-wide block mb-1">Warning Days</label>
                  <input
                    type="number"
                    value={editing.expiryWarningDays}
                    onChange={(e) => setEditing({ ...editing, expiryWarningDays: Number(e.target.value) })}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                    disabled={!editing.hasExpiry}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer bg-gray-50 rounded-lg px-3 py-2.5 border border-border hover:border-brand-cyan transition">
                  <input type="checkbox" className="w-4 h-4 accent-[#3bc7f4]" checked={editing.mandatory} onChange={(e) => setEditing({ ...editing, mandatory: e.target.checked })} />
                  <span className="text-text-primary font-medium">Required</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer bg-gray-50 rounded-lg px-3 py-2.5 border border-border hover:border-brand-cyan transition">
                  <input type="checkbox" className="w-4 h-4 accent-[#3bc7f4]" checked={editing.hasExpiry} onChange={(e) => setEditing({ ...editing, hasExpiry: e.target.checked })} />
                  <span className="text-text-primary font-medium">Has Expiry</span>
                </label>
                <label className={`flex items-center gap-2 text-sm cursor-pointer bg-gray-50 rounded-lg px-3 py-2.5 border border-border hover:border-brand-cyan transition ${!editing.hasExpiry ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  <input type="checkbox" className="w-4 h-4 accent-[#3bc7f4]" checked={editing.blockOnExpiry} onChange={(e) => setEditing({ ...editing, blockOnExpiry: e.target.checked })} disabled={!editing.hasExpiry} />
                  <span className="text-text-primary font-medium">Block on Expiry</span>
                </label>
              </div>
            </div>
            <div className="p-5 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="bg-transparent border border-border text-text-primary px-4 py-2 rounded-md text-sm hover:border-brand-cyan hover:text-brand-cyan transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editing.name.trim()}
                className="bg-brand-cyan text-brand-dark font-medium px-4 py-2 rounded-md text-sm hover:shadow-cyan-glow disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
