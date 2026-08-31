import type { QuestionType } from '../common/types';

export interface ScoreQuestion {
  id: string;
  type: QuestionType;
  points: number;
  correctOptionIds: string[];
}

export interface ScoreAnswer {
  questionId: string;
  selectedOptionIds?: string[];
  textAnswer?: string;
}

export interface NegativeMarking {
  enabled: boolean;
  penalty: number;
}

export interface ScoreResult {
  score: number;
  maxObjectiveScore: number;
  breakdown: Array<{
    questionId: string;
    awarded: number | null;
    max: number;
    autoGraded: boolean;
  }>;
}

function sameSet(a: string[], b: string[]) {
  const left = new Set(a);
  const right = new Set(b);
  if (left.size !== right.size) return false;
  return [...right].every((id) => left.has(id));
}

export function remainingSeconds(expiresAt: Date, now = new Date()) {
  return Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
}

export function scoreAttempt(
  questions: ScoreQuestion[],
  answers: ScoreAnswer[],
  negative: NegativeMarking,
): ScoreResult {
  const byQuestion = new Map(answers.map((a) => [a.questionId, a]));
  let score = 0;
  let maxObjectiveScore = 0;
  const breakdown: ScoreResult['breakdown'] = [];

  for (const q of questions) {
    const ans = byQuestion.get(q.id);

    if (q.type === 'short_answer') {
      breakdown.push({
        questionId: q.id,
        awarded: null,
        max: q.points,
        autoGraded: false,
      });
      continue;
    }

    maxObjectiveScore += q.points;
    const selected = ans?.selectedOptionIds ?? [];
    const answered = selected.length > 0;
    const correct = sameSet(selected, q.correctOptionIds);

    let awarded = 0;
    if (correct) {
      awarded = q.points;
    } else if (answered && negative.enabled) {
      awarded = -Math.abs(negative.penalty);
    }

    score += awarded;
    breakdown.push({
      questionId: q.id,
      awarded,
      max: q.points,
      autoGraded: true,
    });
  }

  // Don't let negative marking drag the paper below zero.
  if (score < 0) score = 0;

  return { score, maxObjectiveScore, breakdown };
}
