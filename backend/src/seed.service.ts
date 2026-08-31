import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './users/user.schema';
import {
  Assessment,
  AssessmentDocument,
} from './assessments/assessment.schema';
import { Question, QuestionDocument } from './assessments/question.schema';
import {
  Assignment,
  AssignmentDocument,
} from './assessments/assignment.schema';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly log = new Logger(SeedService.name);

  constructor(
    @InjectModel(User.name) private users: Model<UserDocument>,
    @InjectModel(Assessment.name)
    private assessments: Model<AssessmentDocument>,
    @InjectModel(Question.name) private questions: Model<QuestionDocument>,
    @InjectModel(Assignment.name)
    private assignments: Model<AssignmentDocument>,
  ) {}

  async onModuleInit() {
    if (process.env.SEED_ON_START !== 'true') return;
    const count = await this.users.countDocuments();
    if (count > 0) {
      this.log.log('DB already has users, skipping seed');
      return;
    }
    await this.run();
  }

  async run() {
    const passwordHash = await bcrypt.hash('Password1!', 10);

    const admin = await this.users.create({
      email: 'admin@assess.local',
      name: 'Priya Nair',
      role: 'admin',
      passwordHash,
    });

    const ravi = await this.users.create({
      email: 'ravi@assess.local',
      name: 'Ravi Mehta',
      role: 'candidate',
      passwordHash,
    });

    const anika = await this.users.create({
      email: 'anika@assess.local',
      name: 'Anika Sharma',
      role: 'candidate',
      passwordHash,
    });

    const paper = await this.assessments.create({
      title: 'JS Basics — screening',
      description:
        'Short screening paper. 15 minutes. Stay in fullscreen if you can; tab switches are logged.',
      durationMinutes: 15,
      createdBy: admin._id,
      status: 'published',
      negativeMarking: { enabled: true, penalty: 1 },
      proctoring: {
        enabled: true,
        maxViolations: 5,
        requireFullscreen: true,
      },
    });

    await this.questions.insertMany([
      {
        assessmentId: paper._id,
        type: 'single_choice',
        prompt: 'What does `const` prevent in JavaScript?',
        options: [
          { id: 'a', text: 'Mutating object properties' },
          { id: 'b', text: 'Reassigning the binding' },
          { id: 'c', text: 'Using the variable in a function' },
          { id: 'd', text: 'Hoisting' },
        ],
        correctOptionIds: ['b'],
        points: 2,
        order: 0,
      },
      {
        assessmentId: paper._id,
        type: 'multiple_choice',
        prompt: 'Which of these are falsy values? (select all)',
        options: [
          { id: 'a', text: '0' },
          { id: 'b', text: '[]' },
          { id: 'c', text: '""' },
          { id: 'd', text: '"false"' },
        ],
        correctOptionIds: ['a', 'c'],
        points: 3,
        order: 1,
      },
      {
        assessmentId: paper._id,
        type: 'single_choice',
        prompt: '`[].length` evaluates to?',
        options: [
          { id: 'a', text: 'undefined' },
          { id: 'b', text: 'null' },
          { id: 'c', text: '0' },
          { id: 'd', text: 'NaN' },
        ],
        correctOptionIds: ['c'],
        points: 2,
        order: 2,
      },
      {
        assessmentId: paper._id,
        type: 'short_answer',
        prompt:
          'In one or two sentences, when would you use `useEffect` cleanup?',
        options: [],
        correctOptionIds: [],
        points: 3,
        order: 3,
      },
    ]);

    await this.assignments.create({
      assessmentId: paper._id,
      candidateId: ravi._id,
      assignedBy: admin._id,
    });
    await this.assignments.create({
      assessmentId: paper._id,
      candidateId: anika._id,
      assignedBy: admin._id,
    });

    this.log.log('Seeded admin + 2 candidates + sample paper');
  }
}
