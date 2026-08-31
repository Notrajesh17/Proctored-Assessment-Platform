import { AssessmentSchema } from '../assessments/assessment.schema';
import { AssignmentSchema } from '../assessments/assignment.schema';
import { QuestionSchema } from '../assessments/question.schema';
import { AttemptSchema, SavedAnswer } from '../attempts/attempt.schema';
import { ProctoringEventSchema } from '../attempts/proctoring-event.schema';

describe('Mongo ObjectId schema paths', () => {
  it.each([
    ['Assessment.createdBy', AssessmentSchema.path('createdBy')],
    ['Assignment.assessmentId', AssignmentSchema.path('assessmentId')],
    ['Assignment.candidateId', AssignmentSchema.path('candidateId')],
    ['Assignment.assignedBy', AssignmentSchema.path('assignedBy')],
    ['Question.assessmentId', QuestionSchema.path('assessmentId')],
    ['Attempt.assignmentId', AttemptSchema.path('assignmentId')],
    ['Attempt.assessmentId', AttemptSchema.path('assessmentId')],
    ['Attempt.candidateId', AttemptSchema.path('candidateId')],
    ['ProctoringEvent.attemptId', ProctoringEventSchema.path('attemptId')],
  ])('%s is cast as an ObjectId', (_name, path) => {
    expect((path as { instance: string }).instance).toBe('ObjectId');
  });

  it('casts saved answer question IDs as ObjectIds', () => {
    const answers = AttemptSchema.path('answers') as {
      schema: { path(name: keyof SavedAnswer): { instance: string } };
    };
    expect(answers.schema.path('questionId').instance).toBe('ObjectId');
  });
});
