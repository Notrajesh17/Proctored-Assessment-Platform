import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Assessment, AssessmentSchema } from './assessment.schema';
import { Question, QuestionSchema } from './question.schema';
import { Assignment, AssignmentSchema } from './assignment.schema';
import { Attempt, AttemptSchema } from '../attempts/attempt.schema';
import { AssessmentsService } from './assessments.service';
import { AssessmentsController } from './assessments.controller';
import { AttemptsModule } from '../attempts/attempts.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    AttemptsModule,
    UsersModule,
    MongooseModule.forFeature([
      { name: Assessment.name, schema: AssessmentSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: Assignment.name, schema: AssignmentSchema },
      { name: Attempt.name, schema: AttemptSchema },
    ]),
  ],
  providers: [AssessmentsService],
  controllers: [AssessmentsController],
  exports: [AssessmentsService, MongooseModule],
})
export class AssessmentsModule {}
