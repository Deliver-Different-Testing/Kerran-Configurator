import { useState, useEffect } from 'react';
import { quizService } from '@/services/np_quizService';
import { documentTypeService } from '@/services/np_documentService';
import type { DocumentType, QuizDefinition } from '@/types';
import QuizPlayer from '@/pages/np/QuizPlayer';

interface TrainingModule {
  docType: DocumentType;
  quiz: QuizDefinition | null;
  passed: boolean;
  attemptCount: number;
  bestScore: number | null;
}

export default function CourierTraining({ courierId = 1 }: { courierId?: number }) {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<{ quizId: number; contentUrl?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadModules = async () => {
    setLoading(true);
    try {
      const allTypes = await documentTypeService.getAll();
      const trainingTypes = allTypes.filter(dt => dt.purpose === 'Training' && dt.active);
      const mods: TrainingModule[] = trainingTypes.map(dt => {
        const quiz = quizService.getQuizForDocType(dt.id);
        return {
          docType: dt,
          quiz,
          passed: quiz ? quizService.hasPassedQuiz(quiz.id, courierId) : false,
          attemptCount: quiz ? quizService.getAttemptCount(quiz.id, courierId) : 0,
          bestScore: quiz ? quizService.getBestScore(quiz.id, courierId) : null,
        };
      });
      setModules(mods);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadModules(); }, [courierId]);

  if (activeQuiz) {
    return (
      <QuizPlayer
        quizId={activeQuiz.quizId}
        courierId={courierId}
        contentUrl={activeQuiz.contentUrl}
        onComplete={() => { setActiveQuiz(null); loadModules(); }}
        onClose={() => { setActiveQuiz(null); loadModules(); }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-cyan" />
      </div>
    );
  }

  const completedCount = modules.filter(m => m.passed || (!m.quiz && !m.docType.contentUrl)).length;
  const totalCount = modules.length;

  return (
    <div className="space-y-4">
      {/* Header with progress */}
      <div>
        <h1 className="text-xl font-bold text-text-primary">Training</h1>
        <p className="text-xs text-text-secondary mt-0.5">Complete all required modules to stay compliant.</p>
        {totalCount > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
              <span>{completedCount} of {totalCount} complete</span>
              <span className="font-medium">{Math.round((completedCount / totalCount) * 100)}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#3bc7f4] rounded-full transition-all"
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {modules.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-8 text-center text-text-secondary">
          <div className="text-4xl mb-2">🎓</div>
          <p className="text-sm">No training modules assigned yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {modules.map(mod => (
            <div key={mod.docType.id} className="bg-white border border-border rounded-xl overflow-hidden">
              {/* Module header */}
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 ${
                    mod.passed ? 'bg-green-100' : mod.attemptCount > 0 ? 'bg-red-50' : 'bg-[#f4f2f1]'
                  }`}>
                    {mod.passed ? '✅' : mod.quiz ? '📝' : '📄'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-text-primary">{mod.docType.name}</h3>
                    {mod.docType.instructions && (
                      <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{mod.docType.instructions}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {mod.docType.estimatedMinutes && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-text-secondary">⏱ {mod.docType.estimatedMinutes} min</span>
                      )}
                      {mod.quiz && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
                          {mod.quiz.questions.length}Q · {mod.quiz.passMarkPercent}% to pass
                        </span>
                      )}
                      {mod.bestScore !== null && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          mod.passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                        }`}>
                          Best: {mod.bestScore}%
                        </span>
                      )}
                      {mod.attemptCount > 0 && !mod.passed && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                          {mod.attemptCount} attempt{mod.attemptCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action bar */}
              <div className="px-4 pb-4">
                {mod.quiz && !mod.passed && (
                  <button
                    onClick={() => setActiveQuiz({ quizId: mod.quiz!.id, contentUrl: mod.docType.contentUrl })}
                    className="w-full py-2.5 text-sm bg-[#3bc7f4] text-[#0d0c2c] font-semibold rounded-lg hover:shadow-cyan-glow transition-all"
                  >
                    {mod.attemptCount > 0 ? '🔄 Retake Quiz' : '▶ Start Quiz'}
                  </button>
                )}
                {mod.quiz && mod.passed && (
                  <div className="flex items-center gap-2 py-2 text-green-600">
                    <span className="text-lg">✅</span>
                    <span className="text-sm font-medium">Completed — {mod.bestScore}%</span>
                  </div>
                )}
                {!mod.quiz && mod.docType.contentUrl && (
                  <a href={mod.docType.contentUrl} target="_blank" rel="noopener noreferrer"
                    className="block w-full py-2.5 text-sm text-center border border-border rounded-lg font-medium text-text-primary hover:border-[#3bc7f4] transition-all">
                    📺 View Training Material
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
