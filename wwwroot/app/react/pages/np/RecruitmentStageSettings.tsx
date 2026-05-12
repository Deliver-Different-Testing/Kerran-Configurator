import { useState } from 'react';
import { useRecruitmentSettings } from '@/hooks/useRecruitmentSettings';

export default function RecruitmentStageSettings() {
  const { stages, updateStage, deleteStage, seedDefaults } = useRecruitmentSettings();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const startEdit = (id: number, name: string, desc: string) => {
    setEditingId(id);
    setEditName(name);
    setEditDesc(desc || '');
  };

  const saveEdit = () => {
    if (editingId !== null) {
      updateStage(editingId, { stageName: editName, description: editDesc });
      setEditingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Recruitment Stages</h1>
          <p className="text-sm text-text-secondary mt-1">Configure the pipeline stages for courier recruitment</p>
        </div>
        <button
          onClick={seedDefaults}
          className="px-4 py-2 text-sm font-medium bg-white border border-border rounded-lg hover:bg-gray-50 text-text-secondary"
        >
          Reset to Defaults
        </button>
      </div>

      <div className="bg-white rounded-lg border border-border divide-y divide-border">
        {stages.map((stage) => (
          <div key={stage.id} className="p-4 flex items-center gap-4">
            <div className="w-8 text-center text-sm font-medium text-text-muted">{stage.sortOrder}</div>

            {editingId === stage.id ? (
              <div className="flex-1 space-y-2">
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-border rounded-lg"
                />
                <input
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  placeholder="Description"
                  className="w-full px-3 py-1.5 text-sm border border-border rounded-lg"
                />
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="px-3 py-1 text-xs font-medium bg-brand-cyan text-white rounded">Save</button>
                  <button onClick={() => setEditingId(null)} className="px-3 py-1 text-xs text-text-muted">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex-1">
                <div className="text-sm font-medium text-text-primary">{stage.stageName}</div>
                {stage.description && <div className="text-xs text-text-secondary">{stage.description}</div>}
              </div>
            )}

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={stage.enabled}
                  onChange={e => updateStage(stage.id, { enabled: e.target.checked })}
                  className="rounded border-border"
                />
                Enabled
              </label>
              <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={stage.mandatory}
                  onChange={e => updateStage(stage.id, { mandatory: e.target.checked })}
                  className="rounded border-border"
                />
                Required
              </label>
              {editingId !== stage.id && (
                <button
                  onClick={() => startEdit(stage.id, stage.stageName, stage.description || '')}
                  className="text-text-muted hover:text-text-primary"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => deleteStage(stage.id)}
                className="text-text-muted hover:text-red-500"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
