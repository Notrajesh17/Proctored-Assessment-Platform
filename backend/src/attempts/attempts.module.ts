import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Attempt, AttemptSchema } from './attempt.schema';
import {
  ProctoringEvent,
  ProctoringEventSchema,
} from './proctoring-event.schema';
import { Assignment, AssignmentSchema } from '../assessments/assignment.schema';
import { Assessment, AssessmentSchema } from '../assessments/assessment.schema';
import { Question, QuestionSchema } from '../assessments/question.schema';
import { AttemptsService } from './attempts.service';
import { AttemptsController } from './attempts.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Attempt.name, schema: AttemptSchema },
      { name: ProctoringEvent.name, schema: ProctoringEventSchema },
      { name: Assignment.name, schema: AssignmentSchema },
      { name: Assessment.name, schema: AssessmentSchema },
      { name: Question.name, schema: QuestionSchema },
    ]),
  ],
  providers: [AttemptsService],
  controllers: [AttemptsController],
  exports: [AttemptsService],
})
export class AttemptsModule {}
