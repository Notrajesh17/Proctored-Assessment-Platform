import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AssessmentsModule } from './assessments/assessments.module';
import { AttemptsModule } from './attempts/attempts.module';
import { SeedService } from './seed.service';
import { User, UserSchema } from './users/user.schema';
import { Assessment, AssessmentSchema } from './assessments/assessment.schema';
import { Question, QuestionSchema } from './assessments/question.schema';
import { Assignment, AssignmentSchema } from './assessments/assignment.schema';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri:
          config.get<string>('MONGODB_URI') ||
          'mongodb://localhost:27017/proctor_assess',
      }),
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Assessment.name, schema: AssessmentSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: Assignment.name, schema: AssignmentSchema },
    ]),
    CommonModule,
    AuthModule,
    UsersModule,
    AssessmentsModule,
    AttemptsModule,
  ],
  providers: [SeedService],
})
export class AppModule {}
