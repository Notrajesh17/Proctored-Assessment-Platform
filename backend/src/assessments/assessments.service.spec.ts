import { BadRequestException } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';

describe('AssessmentsService question validation', () => {
  const service = new AssessmentsService(
    undefined!,
    undefined!,
    undefined!,
    undefined!,
    undefined!,
    undefined!,
  );
  const validate = (question: {
    type: string;
    options?: { id: string }[];
    correctOptionIds?: string[];
  }) =>
    (
      service as unknown as {
        validateQuestion(value: typeof question): void;
      }
    ).validateQuestion(question);

  it('accepts valid single, multiple, and short-answer questions', () => {
    expect(() =>
      validate({
        type: 'single_choice',
        options: [{ id: 'a' }, { id: 'b' }],
        correctOptionIds: ['a'],
      }),
    ).not.toThrow();
    expect(() =>
      validate({
        type: 'multiple_choice',
        options: [{ id: 'a' }, { id: 'b' }],
        correctOptionIds: ['a', 'b'],
      }),
    ).not.toThrow();
    expect(() => validate({ type: 'short_answer' })).not.toThrow();
  });

  it('rejects duplicate option identifiers', () => {
    expect(() =>
      validate({
        type: 'single_choice',
        options: [{ id: 'a' }, { id: 'a' }],
        correctOptionIds: ['a'],
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects duplicate correct option identifiers', () => {
    expect(() =>
      validate({
        type: 'multiple_choice',
        options: [{ id: 'a' }, { id: 'b' }],
        correctOptionIds: ['a', 'a'],
      }),
    ).toThrow('Correct option ids must be unique');
  });

  it('rejects invalid answer keys', () => {
    expect(() =>
      validate({
        type: 'single_choice',
        options: [{ id: 'a' }, { id: 'b' }],
        correctOptionIds: ['missing'],
      }),
    ).toThrow('Correct option id does not exist');
  });
});
