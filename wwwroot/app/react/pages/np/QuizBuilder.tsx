import { useState, useEffect } from 'react';
import { quizService } from '@/services/np_quizService';
import type { QuizDefinition, QuizQuestion, QuizOption } from '@/types';
import QuizPlayer from './QuizPlayer';

let _localId = 5000;
function localId() { return _localId++; }

interface Props {
  documentTypeId: number;
  onClose: () => void;
}

export default function QuizBuilder({ documentTypeId, onClose }: Props) {
  const [quiz, setQuiz] = useState<QuizDefinition | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [passMarkPercent, setPassMarkPercent] = useState(80);
  const [maxAttempts, setMaxAttempts] = useState<number | null>(null);
  const [timeLimitEnabled, setTimeLimitEnabled] = useState(false);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(15);
  const [randomizeQuestions, setRandomizeQuestions] = useState(false);
  const [randomizeOptions, setRandomizeOptions] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [expandedExplanations, setExpandedExplanations] = useState<Set<number>>(new Set());

  useEffect(() => {
    const existing = quizService.getQuizForDocType(documentTypeId);
    if (existing) {
      setQuiz(existing);
      setTitle(existing.title);
      setDescription(existing.description);
      setPassMarkPercent(existing.passMarkPercent);
      setMaxAttempts(existing.maxAttempts);
      setTimeLimitEnabled(existing.timeLimitMinutes !== null);
      setTimeLimitMinutes(existing.timeLimitMinutes || 15);
      setRandomizeQuestions(existing.randomizeQuestions);
      setRandomizeOptions(existing.randomizeOptions);
      setQuestions([...existing.questions]);
    }
  }, [documentTypeId]);

  const updateQuestion = (idx: number, updates: Partial<QuizQuestion>) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...updates } : q));
  };

  const addQuestion = () => {
    const id = localId();
    setQuestions(prev => [...prev, {
      id,
      quizDefinitionId: quiz?.id || 0,
      questionText: '',
      questionType: 'multiple_choice',
      sortOrder: prev.length + 1,
      points: 1,
      active: true,
      options: [
        { id: localId(), questionId: id, optionText: '', isCorrect: false, sortOrder: 1 },
        { id: localId(), questionId: id, optionText: '', isCorrect: false, sortOrder: 2 },
      ],
    }]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, sortOrder: i + 1 })));
  };

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= questions.length) return;
    setQuestions(prev => {
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr.map((q, i) => ({ ...q, sortOrder: i + 1 }));
    });
  };

  const changeQuestionType = (idx: number, type: QuizQuestion['questionType']) => {
    const q = questions[idx];
    if (type === 'true_false') {
      updateQuestion(idx, {
        questionType: type,
        options: [
          { id: localId(), questionId: q.id, optionText: 'True', isCorrect: false, sortOrder: 1 },
          { id: localId(), questionId: q.id, optionText: 'False', isCorrect: false, sortOrder: 2 },
        ],
      });
    } else {
      updateQuestion(idx, { questionType: type });
    }
  };

  const updateOption = (qIdx: number, oIdx: number, updates: Partial<QuizOption>) => {
    setQuestions(prev => prev.map((q, qi) => {
      if (qi !== qIdx) return q;
      return { ...q, options: q.options.map((o, oi) => {
        if (oi !== oIdx) {
          // For MC/TF, uncheck others when setting one correct
          if (updates.isCorrect && q.questionType !== 'multi_select') return { ...o, isCorrect: false };
          return o;
        }
        return { ...o, ...updates };
      })};
    }));
  };

  const addOption = (qIdx: number) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      return { ...q, options: [...q.options, { id: localId(), questionId: q.id, optionText: '', isCorrect: false, sortOrder: q.options.length + 1 }] };
    }));
  };

  const removeOption = (qIdx: number, oIdx: number) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      return { ...q, options: q.options.filter((_, oi) => oi !== oIdx) };
    }));
  };

  const toggleExplanation = (qId: number) => {
    setExpandedExplanations(prev => {
      const next = new Set(prev);
      next.has(qId) ? next.delete(qId) : next.add(qId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      quizService.saveQuiz({
        ...(quiz ? { id: quiz.id } : {}),
        documentTypeId,
        title,
        description,
        passMarkPercent,
        maxAttempts,
        timeLimitMinutes: timeLimitEnabled ? timeLimitMinutes : null,
        randomizeQuestions,
        randomizeOptions,
        questions,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (previewing) {
    // Save temporarily for preview
    const tempQuiz = quizService.saveQuiz({
      ...(quiz ? { id: quiz.id } : {}),
      documentTypeId,
      title,
      description,
      passMarkPercent,
      maxAttempts,
      timeLimitMinutes: timeLimitEnabled ? timeLimitMinutes : null,
      randomizeQuestions,
      randomizeOptions,
      questions,
    });
    return (
      <QuizPlayer
        quizId={tempQuiz.id}
        courierId={0}
        preview
        onClose={() => setPreviewing(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[200]" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
        <div className="bg-white border-b border-border p-5 flex items-center justify-between shrink-0 rounded-t-xl">
          <h3 className="text-lg font-bold text-brand-dark">
            {quiz ? 'Edit Quiz' : 'Create Quiz'}
          </h3>
          <div className="flex gap-2">
            <button onClick={() => setPreviewing(true)} disabled={questions.length === 0}
              className="px-3 py-1.5 text-sm border border-border rounded-md hover:border-brand-cyan hover:text-brand-cyan transition-all disabled:opacity-40">
              👁 Preview
            </button>
            <button onClick={onClose} className="px-3 py-1.5 text-sm border border-border rounded-md hover:border-brand-cyan transition-all">Cancel</button>
            <button onClick={handleSave} disabled={saving || !title.trim() || questions.length === 0}
              className="px-4 py-1.5 text-sm bg-brand-cyan text-brand-dark font-medium rounded-md hover:shadow-cyan-glow disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Quiz'}
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Settings */}
          <div className="bg-[#f4f2f1] rounded-lg p-4 space-y-3">
            <div className="text-xs font-medium text-text-secondary uppercase tracking-wide">Quiz Settings</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-secondary block mb-1">Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm" placeholder="Quiz title" />
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1">Pass Mark: {passMarkPercent}%</label>
                <input type="range" min={50} max={100} step={5} value={passMarkPercent}
                  onChange={e => setPassMarkPercent(Number(e.target.value))}
                  className="w-full accent-[#3bc7f4]" />
              </div>
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm" rows={2} placeholder="Brief description..." />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-text-secondary block mb-1">Max Attempts</label>
                <input type="number" min={1} value={maxAttempts ?? ''} placeholder="Unlimited"
                  onChange={e => setMaxAttempts(e.target.value ? Number(e.target.value) : null)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm" />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer mt-4">
                <span role="switch" aria-checked={timeLimitEnabled} onClick={() => setTimeLimitEnabled(!timeLimitEnabled)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${timeLimitEnabled ? 'bg-[#3bc7f4]' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${timeLimitEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </span>
                Time Limit
              </label>
              {timeLimitEnabled && (
                <div>
                  <label className="text-xs text-text-secondary block mb-1">Minutes</label>
                  <input type="number" min={1} value={timeLimitMinutes}
                    onChange={e => setTimeLimitMinutes(Number(e.target.value))}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm" />
                </div>
              )}
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <span role="switch" aria-checked={randomizeQuestions} onClick={() => setRandomizeQuestions(!randomizeQuestions)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${randomizeQuestions ? 'bg-[#3bc7f4]' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${randomizeQuestions ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </span>
                Randomize Questions
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <span role="switch" aria-checked={randomizeOptions} onClick={() => setRandomizeOptions(!randomizeOptions)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${randomizeOptions ? 'bg-[#3bc7f4]' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${randomizeOptions ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </span>
                Randomize Options
              </label>
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-text-primary">Questions ({questions.length})</h4>
              <button onClick={addQuestion} className="text-sm text-brand-cyan font-medium hover:underline">+ Add Question</button>
            </div>

            {questions.map((q, qIdx) => (
              <div key={q.id} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-text-secondary bg-gray-100 px-2 py-0.5 rounded">Q{qIdx + 1}</span>
                    <select value={q.questionType} onChange={e => changeQuestionType(qIdx, e.target.value as QuizQuestion['questionType'])}
                      className="text-xs border border-border rounded px-2 py-1">
                      <option value="multiple_choice">Multiple Choice</option>
                      <option value="true_false">True / False</option>
                      <option value="multi_select">Multi-Select</option>
                    </select>
                    <span className="text-xs text-text-secondary">
                      Pts: <input type="number" min={1} value={q.points} onChange={e => updateQuestion(qIdx, { points: Number(e.target.value) })}
                        className="w-12 border border-border rounded px-1 py-0.5 text-xs" />
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveQuestion(qIdx, -1)} disabled={qIdx === 0}
                      className="text-xs px-1.5 py-0.5 border rounded hover:bg-gray-100 disabled:opacity-30">▲</button>
                    <button onClick={() => moveQuestion(qIdx, 1)} disabled={qIdx === questions.length - 1}
                      className="text-xs px-1.5 py-0.5 border rounded hover:bg-gray-100 disabled:opacity-30">▼</button>
                    <button onClick={() => removeQuestion(qIdx)}
                      className="text-xs text-red-500 hover:underline ml-2">Delete</button>
                  </div>
                </div>

                <textarea value={q.questionText} onChange={e => updateQuestion(qIdx, { questionText: e.target.value })}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm" rows={2} placeholder="Enter question text..." />

                {/* Options */}
                <div className="space-y-2 pl-4">
                  {q.options.map((opt, oIdx) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateOption(qIdx, oIdx, { isCorrect: q.questionType === 'multi_select' ? !opt.isCorrect : true })}
                        className={`w-5 h-5 shrink-0 border-2 flex items-center justify-center transition-colors ${
                          q.questionType === 'multi_select' ? 'rounded' : 'rounded-full'
                        } ${opt.isCorrect ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 hover:border-green-400'}`}
                        title={opt.isCorrect ? 'Correct answer' : 'Mark as correct'}
                      >
                        {opt.isCorrect && <span className="text-xs font-bold">✓</span>}
                      </button>
                      <input value={opt.optionText}
                        onChange={e => updateOption(qIdx, oIdx, { optionText: e.target.value })}
                        className="flex-1 border border-border rounded px-2 py-1.5 text-sm"
                        placeholder={`Option ${oIdx + 1}`}
                        disabled={q.questionType === 'true_false'}
                      />
                      {q.questionType !== 'true_false' && q.options.length > 2 && (
                        <button onClick={() => removeOption(qIdx, oIdx)} className="text-red-400 hover:text-red-600 text-sm">×</button>
                      )}
                    </div>
                  ))}
                  {q.questionType !== 'true_false' && (
                    <button onClick={() => addOption(qIdx)} className="text-xs text-brand-cyan hover:underline">+ Add Option</button>
                  )}
                </div>

                {/* Explanation */}
                <div>
                  <button onClick={() => toggleExplanation(q.id)} className="text-xs text-text-secondary hover:text-text-primary">
                    {expandedExplanations.has(q.id) ? '▼' : '▶'} Explanation
                  </button>
                  {expandedExplanations.has(q.id) && (
                    <textarea value={q.explanation || ''} onChange={e => updateQuestion(qIdx, { explanation: e.target.value })}
                      className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1" rows={2}
                      placeholder="Explain why this is the correct answer..." />
                  )}
                </div>
              </div>
            ))}

            {questions.length === 0 && (
              <div className="text-center py-8 text-text-secondary border-2 border-dashed border-border rounded-lg">
                <p className="text-lg mb-2">📝</p>
                <p className="text-sm">No questions yet. Click "Add Question" to get started.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
