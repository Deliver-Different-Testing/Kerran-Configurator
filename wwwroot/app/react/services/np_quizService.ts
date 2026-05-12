// Phase 3 stub: see np_dashboardService.ts for the conversion pattern.
import type { QuizDefinition, QuizAttempt } from '@/types';

export const quizService = {
  getQuizForDocType(_documentTypeId: number): QuizDefinition | null {
    return null;
  },

  getQuizById(_quizId: number): QuizDefinition | null {
    return null;
  },

  getAllQuizzes(): QuizDefinition[] {
    return [];
  },

  saveQuiz(_quiz: Partial<QuizDefinition> & { documentTypeId: number; title: string }): QuizDefinition {
    throw new Error('saveQuiz() not yet wired to backend');
  },

  deleteQuiz(_id: number): void {
    /* no-op stub */
  },

  getAttempts(_quizId: number, _courierId?: number): QuizAttempt[] {
    return [];
  },

  submitAttempt(
    _quizId: number,
    _courierId: number,
    _answers: { questionId: number; selectedOptionIds: number[] }[]
  ): QuizAttempt {
    throw new Error('submitAttempt() not yet wired to backend');
  },

  hasPassedQuiz(_quizId: number, _courierId: number): boolean {
    return false;
  },

  getAttemptCount(_quizId: number, _courierId: number): number {
    return 0;
  },

  getBestScore(_quizId: number, _courierId: number): number | null {
    return null;
  },

  getStats(): { totalItems: number; completionRate: number; averageScore: number } {
    return { totalItems: 0, completionRate: 0, averageScore: 0 };
  },
};
