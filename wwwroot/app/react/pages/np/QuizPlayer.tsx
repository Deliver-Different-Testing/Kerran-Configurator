import { useState, useEffect, useRef, useCallback } from 'react';
import { quizService } from '@/services/np_quizService';
import type { QuizDefinition, QuizQuestion, QuizAttempt } from '@/types';

interface Props {
  quizId: number;
  courierId: number;
  preview?: boolean;
  contentUrl?: string;
  onComplete?: (attempt: QuizAttempt) => void;
  onClose: () => void;
}

function getVideoEmbed(url: string): { type: 'youtube' | 'loom' | 'vimeo' | 'link'; embedUrl: string } | null {
  if (!url) return null;
  // YouTube
  let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (m) return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${m[1]}` };
  // Loom
  m = url.match(/loom\.com\/share\/([\w]+)/);
  if (m) return { type: 'loom', embedUrl: `https://www.loom.com/embed/${m[1]}` };
  // Vimeo
  m = url.match(/vimeo\.com\/(\d+)/);
  if (m) return { type: 'vimeo', embedUrl: `https://player.vimeo.com/video/${m[1]}` };
  return { type: 'link', embedUrl: url };
}

export default function QuizPlayer({ quizId, courierId, preview, contentUrl, onComplete, onClose }: Props) {
  const [quiz, setQuiz] = useState<QuizDefinition | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Map<number, number[]>>(new Map());
  const [result, setResult] = useState<QuizAttempt | null>(null);
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const q = quizService.getQuizById(quizId);
    if (q) {
      setQuiz(q);
      let qs = q.questions.filter(qu => qu.active);
      if (q.randomizeQuestions) qs = shuffle(qs);
      if (q.randomizeOptions) qs = qs.map(qu => ({ ...qu, options: shuffle([...qu.options]) }));
      setQuestions(qs);
      if (q.timeLimitMinutes) setTimeLeft(q.timeLimitMinutes * 60);
    }
  }, [quizId]);

  const startQuiz = useCallback(() => {
    setStarted(true);
    startTimeRef.current = Date.now();
    if (quiz?.timeLimitMinutes) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev === null) return null;
          if (prev <= 1) { handleSubmit(); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
  }, [quiz]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const selectOption = (questionId: number, optionId: number, multiSelect: boolean) => {
    setAnswers(prev => {
      const next = new Map(prev);
      if (multiSelect) {
        const current = next.get(questionId) || [];
        next.set(questionId, current.includes(optionId) ? current.filter(id => id !== optionId) : [...current, optionId]);
      } else {
        next.set(questionId, [optionId]);
      }
      return next;
    });
  };

  const handleSubmit = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (preview) {
      // Score locally without saving
      const q = quiz!;
      let correct = 0;
      const total = questions.length;
      const answerList = questions.map(qu => {
        const selected = answers.get(qu.id) || [];
        const correctIds = qu.options.filter(o => o.isCorrect).map(o => o.id).sort();
        const isCorrect = correctIds.length === [...selected].sort().length && correctIds.every((v, i) => v === [...selected].sort()[i]);
        if (isCorrect) correct++;
        return { questionId: qu.id, selectedOptionIds: selected, isCorrect, id: 0, attemptId: 0 };
      });
      const score = Math.round((correct / total) * 100);
      setResult({
        id: 0, quizDefinitionId: quizId, courierId, startedAt: '', completedAt: '',
        score, passed: score >= q.passMarkPercent, totalQuestions: total, correctAnswers: correct,
        timeTakenSeconds: Math.floor((Date.now() - startTimeRef.current) / 1000),
        answers: answerList,
      });
      return;
    }

    const attemptAnswers = questions.map(q => ({
      questionId: q.id,
      selectedOptionIds: answers.get(q.id) || [],
    }));
    const attempt = quizService.submitAttempt(quizId, courierId, attemptAnswers);
    setResult(attempt);
    onComplete?.(attempt);
  };

  if (!quiz) return <div className="p-8 text-center text-text-secondary">Loading quiz...</div>;

  const currentQ = questions[currentIdx];
  const totalAttempts = preview ? 0 : quizService.getAttemptCount(quizId, courierId);
  const canRetake = !preview && result && !result.passed && (quiz.maxAttempts === null || totalAttempts < quiz.maxAttempts);

  const video = contentUrl ? getVideoEmbed(contentUrl) : null;

  // Result screen
  if (result) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-brand-dark">{quiz.title} — Results</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            {preview && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-2 text-sm mb-4">
                👁 This was a preview — no results saved.
              </div>
            )}

            {/* Score */}
            <div className={`text-center py-6 rounded-xl mb-6 ${result.passed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="text-5xl font-bold mb-2" style={{ color: result.passed ? '#22c55e' : '#ef4444' }}>
                {result.score}%
              </div>
              <div className="text-lg font-medium mb-1">
                {result.passed ? '✅ PASSED' : '❌ FAILED'}
              </div>
              <div className="text-sm text-text-secondary">
                {result.correctAnswers} of {result.totalQuestions} correct · Pass mark: {quiz.passMarkPercent}%
              </div>
              {result.timeTakenSeconds && (
                <div className="text-xs text-text-secondary mt-1">
                  Time: {Math.floor(result.timeTakenSeconds / 60)}m {result.timeTakenSeconds % 60}s
                </div>
              )}
            </div>

            {/* Per-question breakdown */}
            <div className="space-y-3">
              {questions.map((q, i) => {
                const answer = result.answers.find(a => a.questionId === q.id);
                const selectedIds = answer?.selectedOptionIds || [];
                return (
                  <div key={q.id} className={`border rounded-lg p-3 ${answer?.isCorrect ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
                    <div className="flex items-start gap-2 mb-2">
                      <span className={`text-sm font-bold ${answer?.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                        {answer?.isCorrect ? '✓' : '✗'} Q{i + 1}
                      </span>
                      <span className="text-sm text-text-primary">{q.questionText}</span>
                    </div>
                    <div className="pl-6 space-y-1">
                      {q.options.map(opt => {
                        const wasSelected = selectedIds.includes(opt.id);
                        const isCorrectOpt = opt.isCorrect;
                        let cls = 'text-sm ';
                        if (isCorrectOpt) cls += 'text-green-700 font-medium';
                        else if (wasSelected && !isCorrectOpt) cls += 'text-red-600 line-through';
                        else cls += 'text-text-secondary';
                        return (
                          <div key={opt.id} className={cls}>
                            {wasSelected ? '● ' : '○ '}{opt.optionText}
                            {isCorrectOpt && ' ✓'}
                          </div>
                        );
                      })}
                    </div>
                    {q.explanation && (
                      <div className="mt-2 ml-6 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800">
                        💡 {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              {canRetake && (
                <button onClick={() => { setResult(null); setAnswers(new Map()); setCurrentIdx(0); setStarted(false); if (quiz.timeLimitMinutes) setTimeLeft(quiz.timeLimitMinutes * 60); }}
                  className="px-4 py-2 text-sm bg-brand-cyan text-brand-dark font-medium rounded-md hover:shadow-cyan-glow">
                  Retake Quiz
                </button>
              )}
              <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-md hover:border-brand-cyan transition-all">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pre-start screen with video
  if (!started) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-brand-dark">{quiz.title}</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            {video && video.type !== 'link' && (
              <div className="mb-4">
                <div className="text-sm text-text-secondary mb-2">📹 Watch the video before starting the quiz</div>
                <div className="aspect-video rounded-lg overflow-hidden bg-black">
                  <iframe src={video.embedUrl} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                </div>
              </div>
            )}
            {video && video.type === 'link' && (
              <div className="mb-4 bg-gray-50 border border-border rounded-lg p-3">
                <a href={video.embedUrl} target="_blank" rel="noopener noreferrer" className="text-brand-cyan hover:underline text-sm">
                  📄 Open training material →
                </a>
              </div>
            )}

            <p className="text-sm text-text-secondary mb-4">{quiz.description}</p>

            <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
              <div className="bg-[#f4f2f1] rounded-lg p-3">
                <div className="text-text-secondary text-xs">Questions</div>
                <div className="font-bold">{questions.length}</div>
              </div>
              <div className="bg-[#f4f2f1] rounded-lg p-3">
                <div className="text-text-secondary text-xs">Pass Mark</div>
                <div className="font-bold">{quiz.passMarkPercent}%</div>
              </div>
              {quiz.timeLimitMinutes && (
                <div className="bg-[#f4f2f1] rounded-lg p-3">
                  <div className="text-text-secondary text-xs">Time Limit</div>
                  <div className="font-bold">{quiz.timeLimitMinutes} min</div>
                </div>
              )}
              {quiz.maxAttempts && (
                <div className="bg-[#f4f2f1] rounded-lg p-3">
                  <div className="text-text-secondary text-xs">Attempts</div>
                  <div className="font-bold">{totalAttempts} / {quiz.maxAttempts}</div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-md hover:border-brand-cyan transition-all">Cancel</button>
              <button onClick={startQuiz} className="px-6 py-2 text-sm bg-brand-cyan text-brand-dark font-medium rounded-md hover:shadow-cyan-glow">
                Start Quiz
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active quiz
  const selected = answers.get(currentQ.id) || [];
  const answeredCount = answers.size;
  const isMulti = currentQ.questionType === 'multi_select';
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const timerWarning = timeLeft !== null && timeLeft < 120;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border p-4 z-10">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-brand-dark">{quiz.title}</h3>
            {timeLeft !== null && (
              <span className={`text-sm font-mono font-bold px-2 py-1 rounded ${timerWarning ? 'bg-amber-100 text-amber-700 animate-pulse' : 'text-text-secondary'}`}>
                ⏱ {formatTime(timeLeft)}
              </span>
            )}
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${((currentIdx + 1) / questions.length) * 100}%`, backgroundColor: '#3bc7f4' }} />
            </div>
            <span className="text-xs text-text-secondary whitespace-nowrap">Q{currentIdx + 1} of {questions.length}</span>
          </div>
        </div>

        {/* Question */}
        <div className="p-6">
          <div className="mb-1 text-xs text-text-secondary uppercase tracking-wide">
            {currentQ.questionType === 'multi_select' ? 'Select all that apply' : currentQ.questionType === 'true_false' ? 'True or False' : 'Choose one'}
          </div>
          <p className="text-base font-medium text-text-primary mb-5">{currentQ.questionText}</p>

          <div className="space-y-2">
            {currentQ.options.map(opt => {
              const isSelected = selected.includes(opt.id);
              return (
                <button key={opt.id} onClick={() => selectOption(currentQ.id, opt.id, isMulti)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 text-sm transition-all ${
                    isSelected
                      ? 'border-[#3bc7f4] bg-[#3bc7f4]/10 text-brand-dark font-medium'
                      : 'border-border hover:border-gray-300 text-text-primary'
                  }`}>
                  <span className="mr-2">{isMulti ? (isSelected ? '☑' : '☐') : (isSelected ? '●' : '○')}</span>
                  {opt.optionText}
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="border-t border-border p-4 flex items-center justify-between">
          <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0}
            className="px-4 py-2 text-sm border border-border rounded-md hover:border-brand-cyan transition-all disabled:opacity-30">
            ← Previous
          </button>
          <span className="text-xs text-text-secondary">{answeredCount}/{questions.length} answered</span>
          {currentIdx < questions.length - 1 ? (
            <button onClick={() => setCurrentIdx(i => i + 1)}
              className="px-4 py-2 text-sm bg-brand-cyan text-brand-dark font-medium rounded-md hover:shadow-cyan-glow">
              Next →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={answeredCount < questions.length}
              className="px-4 py-2 text-sm bg-[#0d0c2c] text-white font-medium rounded-md hover:bg-[#1a1940] disabled:opacity-50">
              Submit Quiz
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
