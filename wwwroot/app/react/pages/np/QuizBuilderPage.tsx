import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QuizBuilder from './QuizBuilder';

// Mock document types for standalone quiz management
const QUIZ_DOC_TYPES = [
  { id: 1, name: 'Driver Safety Assessment' },
  { id: 2, name: 'Vehicle Inspection Quiz' },
  { id: 3, name: 'Compliance Knowledge Check' },
  { id: 4, name: 'New Starter Orientation' },
];

export default function QuizBuilderPage() {
  const navigate = useNavigate();
  const [selectedDocTypeId, setSelectedDocTypeId] = useState<number | null>(null);

  if (selectedDocTypeId !== null) {
    return (
      <QuizBuilder
        documentTypeId={selectedDocTypeId}
        onClose={() => setSelectedDocTypeId(null)}
      />
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-text-secondary hover:text-text-primary text-sm">← Back</button>
        <h1 className="text-2xl font-bold text-text-primary">Training Quizzes</h1>
      </div>
      <p className="text-text-secondary mb-6">Select a document type to build or edit its training quiz.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        {QUIZ_DOC_TYPES.map((dt) => (
          <button
            key={dt.id}
            onClick={() => setSelectedDocTypeId(dt.id)}
            className="flex flex-col gap-1 rounded-xl border border-border-default bg-bg-card p-5 text-left hover:border-brand-cyan hover:shadow-md transition-all group"
          >
            <span className="text-2xl">🎓</span>
            <h3 className="font-semibold text-text-primary group-hover:text-brand-cyan transition-colors">{dt.name}</h3>
            <p className="text-sm text-text-secondary">Build and manage assessment questions</p>
          </button>
        ))}
      </div>
    </div>
  );
}
