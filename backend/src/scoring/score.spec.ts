import { remainingSeconds, scoreAttempt } from './score';

const mcq = {
  id: 'q1',
  type: 'single_choice' as const,
  points: 4,
  correctOptionIds: ['b'],
};

const multi = {
  id: 'q2',
  type: 'multiple_choice' as const,
  points: 5,
  correctOptionIds: ['a', 'c'],
};

const short = {
  id: 'q3',
  type: 'short_answer' as const,
  points: 6,
  correctOptionIds: [],
};

describe('scoreAttempt', () => {
  it('awards full marks for exact matches and skips short answers', () => {
    const result = scoreAttempt(
      [mcq, multi, short],
      [
        { questionId: 'q1', selectedOptionIds: ['b'] },
        { questionId: 'q2', selectedOptionIds: ['c', 'a'] },
        { questionId: 'q3', textAnswer: 'whatever' },
      ],
      { enabled: false, penalty: 1 },
    );

    expect(result.score).toBe(9);
    expect(result.maxObjectiveScore).toBe(9);
    expect(
      result.breakdown.find((b) => b.questionId === 'q3')?.autoGraded,
    ).toBe(false);
  });

  it('does not award partial credit on multi-select', () => {
    const result = scoreAttempt(
      [multi],
      [{ questionId: 'q2', selectedOptionIds: ['a'] }],
      { enabled: false, penalty: 1 },
    );
    expect(result.score).toBe(0);
  });

  it('normalizes duplicate option ids when comparing answer sets', () => {
    const result = scoreAttempt(
      [multi],
      [{ questionId: 'q2', selectedOptionIds: ['a', 'c', 'c'] }],
      { enabled: false, penalty: 1 },
    );
    expect(result.score).toBe(5);
  });

  it('applies negative marking but never goes below zero', () => {
    const result = scoreAttempt(
      [mcq],
      [{ questionId: 'q1', selectedOptionIds: ['a'] }],
      { enabled: true, penalty: 2 },
    );
    expect(result.score).toBe(0);
  });

  it('does not penalize unanswered questions', () => {
    const result = scoreAttempt([mcq], [], {
      enabled: true,
      penalty: 2,
    });
    expect(result.score).toBe(0);
  });
});

describe('remainingSeconds', () => {
  it('returns 0 after expiry instead of a negative number', () => {
    const expires = new Date('2024-01-01T10:00:00Z');
    const now = new Date('2024-01-01T10:02:00Z');
    expect(remainingSeconds(expires, now)).toBe(0);
  });

  it('rounds down leftover millis', () => {
    const expires = new Date('2024-01-01T10:00:10.900Z');
    const now = new Date('2024-01-01T10:00:00.000Z');
    expect(remainingSeconds(expires, now)).toBe(10);
  });
});
