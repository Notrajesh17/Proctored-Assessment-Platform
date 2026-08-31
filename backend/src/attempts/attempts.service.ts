import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Attempt, AttemptDocument } from './attempt.schema';
import {
  ProctoringEvent,
  ProctoringEventDocument,
} from './proctoring-event.schema';
import {
  Assignment,
  AssignmentDocument,
} from '../assessments/assignment.schema';
import {
  Assessment,
  AssessmentDocument,
} from '../assessments/assessment.schema';
import { Question, QuestionDocument } from '../assessments/question.schema';
import type { AuthUser, ProctorEventType } from '../common/types';
import { remainingSeconds, scoreAttempt } from '../scoring/score';
import { SaveAnswerDto } from '../assessments/dto';

@Injectable()
export class AttemptsService {
  constructor(
    @InjectModel(Attempt.name) private attempts: Model<AttemptDocument>,
    @InjectModel(ProctoringEvent.name)
    private events: Model<ProctoringEventDocument>,
    @InjectModel(Assignment.name)
    private assignments: Model<AssignmentDocument>,
    @InjectModel(Assessment.name)
    private assessments: Model<AssessmentDocument>,
    @InjectModel(Question.name) private questions: Model<QuestionDocument>,
  ) {}

  async start(assignmentId: string, user: AuthUser) {
    const assignment = await this.assignments.findById(assignmentId).exec();
    if (!assignment) throw new NotFoundException('Assignment not found');
    if (String(assignment.candidateId) !== user.sub) {
      throw new ForbiddenException('This assessment is not assigned to you');
    }

    const existing = await this.attempts.findOne({ assignmentId }).exec();
    if (existing) {
      if (existing.status !== 'in_progress') {
        throw new ConflictException('You already submitted this assessment');
      }
      await this.expireIfNeeded(existing);
      return this.serializeAttempt(existing, user, true);
    }

    const assessment = await this.assessments
      .findById(assignment.assessmentId)
      .exec();
    if (!assessment) throw new NotFoundException('Assessment missing');
    if (assessment.deletingAt) {
      throw new ConflictException('This assessment is being deleted');
    }
    if (assessment.status !== 'published') {
      throw new ConflictException('This assessment is not available');
    }

    const startedAt = new Date();
    const expiresAt = new Date(
      startedAt.getTime() + assessment.durationMinutes * 60 * 1000,
    );

    let attempt: AttemptDocument;
    try {
      attempt = await this.attempts.create({
        assignmentId: assignment._id,
        assessmentId: assignment.assessmentId,
        candidateId: assignment.candidateId,
        startedAt,
        expiresAt,
        status: 'in_progress',
      });
    } catch (error: unknown) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const racedAttempt = await this.attempts.findOne({ assignmentId }).exec();
      if (!racedAttempt) throw error;
      if (racedAttempt.status !== 'in_progress') {
        throw new ConflictException('You already submitted this assessment');
      }
      attempt = racedAttempt;
    }

    await this.expireIfNeeded(attempt);
    return this.serializeAttempt(attempt, user, true);
  }

  async get(id: string, user: AuthUser) {
    const attempt = await this.loadOwned(id, user);
    await this.expireIfNeeded(attempt);
    return this.serializeAttempt(attempt, user, true);
  }

  async saveAnswers(id: string, answers: SaveAnswerDto[], user: AuthUser) {
    const attempt = await this.loadOwned(id, user);
    await this.expireIfNeeded(attempt);
    this.assertInProgress(attempt);

    const questions = await this.questions
      .find({ assessmentId: attempt.assessmentId })
      .lean()
      .exec();
    const questionMap = new Map(questions.map((q) => [String(q._id), q]));
    const normalizedAnswers: {
      questionId: Types.ObjectId;
      selectedOptionIds: string[];
      textAnswer: string;
      savedAt: Date;
    }[] = [];

    for (const incoming of answers) {
      const question = questionMap.get(incoming.questionId);
      if (!question) {
        throw new NotFoundException(
          'Question does not belong to this assessment',
        );
      }
      const selectedOptionIds = incoming.selectedOptionIds ?? [];
      if (new Set(selectedOptionIds).size !== selectedOptionIds.length) {
        throw new BadRequestException('Selected option ids must be unique');
      }
      if (question.type === 'short_answer' && selectedOptionIds.length > 0) {
        throw new BadRequestException(
          'Short answers cannot contain selected options',
        );
      }
      const validOptionIds = new Set(
        (question.options ?? []).map((option) => option.id),
      );
      if (selectedOptionIds.some((optionId) => !validOptionIds.has(optionId))) {
        throw new BadRequestException('Answer contains an invalid option');
      }
      if (question.type === 'single_choice' && selectedOptionIds.length > 1) {
        throw new BadRequestException(
          'Single choice accepts at most one option',
        );
      }
      if (
        question.type !== 'short_answer' &&
        (incoming.textAnswer ?? '').trim().length > 0
      ) {
        throw new BadRequestException('Choice answers cannot contain text');
      }
      normalizedAnswers.push({
        questionId: new Types.ObjectId(incoming.questionId),
        selectedOptionIds,
        textAnswer: incoming.textAnswer ?? '',
        savedAt: new Date(),
      });
    }

    for (let retry = 0; retry < 5; retry += 1) {
      const now = new Date();
      const current = await this.attempts
        .findOne({
          _id: attempt._id,
          status: 'in_progress',
          expiresAt: { $gt: now },
        })
        .exec();
      if (!current) {
        const latest = await this.attempts.findById(attempt._id).exec();
        if (latest) await this.expireIfNeeded(latest);
        throw new ConflictException('Attempt is already closed');
      }

      const nextAnswers = current.answers.map((answer) => ({
        questionId: answer.questionId,
        selectedOptionIds: answer.selectedOptionIds,
        textAnswer: answer.textAnswer,
        savedAt: answer.savedAt,
      }));
      for (const incoming of normalizedAnswers) {
        const index = nextAnswers.findIndex(
          (answer) => String(answer.questionId) === String(incoming.questionId),
        );
        if (index >= 0) nextAnswers[index] = incoming;
        else nextAnswers.push(incoming);
      }

      const version = (current as unknown as { __v: number }).__v ?? 0;
      const updated = await this.attempts
        .findOneAndUpdate(
          {
            _id: current._id,
            status: 'in_progress',
            expiresAt: { $gt: now },
            __v: version,
          },
          { $set: { answers: nextAnswers }, $inc: { __v: 1 } },
          { new: true },
        )
        .exec();
      if (updated) {
        return {
          savedAt: new Date(),
          remainingSeconds: remainingSeconds(updated.expiresAt),
        };
      }
    }

    throw new ConflictException('Answers changed concurrently; please retry');
  }

  async submit(id: string, user: AuthUser, auto = false) {
    const attempt = await this.loadOwned(id, user);
    await this.expireIfNeeded(attempt);
    if (attempt.status !== 'in_progress') {
      throw new ConflictException('Already submitted');
    }
    return this.finalize(attempt, auto ? 'auto_submitted' : 'submitted');
  }

  async recordEvent(
    id: string,
    type: ProctorEventType,
    user: AuthUser,
    meta?: Record<string, unknown>,
  ) {
    const attempt = await this.loadOwned(id, user);
    await this.expireIfNeeded(attempt);
    if (attempt.status !== 'in_progress') {
      return { recorded: false, remainingSeconds: 0, autoSubmitted: false };
    }

    await this.events.create({
      attemptId: attempt._id,
      type,
      occurredAt: new Date(),
      meta: meta ?? {},
    });

    const assessment = await this.assessments
      .findById(attempt.assessmentId)
      .exec();
    const countsTowardLimit =
      Boolean(assessment?.proctoring?.enabled) && type !== 'right_click';
    if (countsTowardLimit) {
      const counted = await this.attempts
        .findOneAndUpdate(
          {
            _id: attempt._id,
            status: 'in_progress',
            expiresAt: { $gt: new Date() },
          },
          { $inc: { violationCount: 1 } },
          { new: true },
        )
        .exec();
      if (!counted) {
        const latest = await this.attempts.findById(attempt._id).exec();
        if (latest) await this.expireIfNeeded(latest);
        return {
          recorded: true,
          violationCount: latest?.violationCount ?? attempt.violationCount,
          remainingSeconds: 0,
          autoSubmitted: latest?.status !== 'in_progress',
        };
      }
      Object.assign(attempt, counted.toObject());
    }

    const max = assessment?.proctoring?.maxViolations ?? 0;
    let autoSubmitted = false;
    if (
      assessment?.proctoring?.enabled &&
      max > 0 &&
      attempt.violationCount >= max
    ) {
      try {
        await this.finalize(attempt, 'auto_submitted');
      } catch (error) {
        if (!(error instanceof ConflictException)) throw error;
        const latest = await this.attempts.findById(attempt._id).exec();
        if (latest) Object.assign(attempt, latest.toObject());
      }
      autoSubmitted = true;
    }

    return {
      recorded: true,
      violationCount: attempt.violationCount,
      remainingSeconds: remainingSeconds(attempt.expiresAt),
      autoSubmitted,
    };
  }

  async timeline(id: string, user: AuthUser) {
    const attempt = await this.loadOwned(id, user);
    return this.events
      .find({ attemptId: attempt._id })
      .sort({ occurredAt: 1 })
      .lean()
      .exec();
  }

  async expireMatching(filter: FilterQuery<AttemptDocument>): Promise<void> {
    const expired = await this.attempts
      .find({
        ...filter,
        status: 'in_progress',
        expiresAt: { $lte: new Date() },
      })
      .exec();
    for (const attempt of expired) {
      await this.expireIfNeeded(attempt);
    }
  }

  async deleteForAssessment(assessmentId: string): Promise<void> {
    const attempts = await this.attempts
      .find({ assessmentId })
      .select('_id')
      .lean()
      .exec();
    await this.events.deleteMany({
      attemptId: { $in: attempts.map((attempt) => attempt._id) },
    });
    await this.attempts.deleteMany({ assessmentId });
  }

  private async expireIfNeeded(attempt: AttemptDocument) {
    if (
      attempt.status === 'in_progress' &&
      attempt.expiresAt.getTime() <= Date.now()
    ) {
      try {
        await this.finalize(attempt, 'auto_submitted');
      } catch (error) {
        if (!(error instanceof ConflictException)) throw error;
        const current = await this.attempts.findById(attempt._id).exec();
        if (current) Object.assign(attempt, current.toObject());
      }
    }
  }

  private async finalize(
    attempt: AttemptDocument,
    status: 'submitted' | 'auto_submitted',
  ) {
    const questions = await this.questions
      .find({ assessmentId: attempt.assessmentId })
      .lean()
      .exec();
    const assessment = await this.assessments
      .findById(attempt.assessmentId)
      .lean()
      .exec();

    let current = attempt;
    let targetStatus = status;
    for (let retry = 0; retry < 5; retry += 1) {
      const submittedAt = new Date();
      if (current.expiresAt <= submittedAt) targetStatus = 'auto_submitted';
      const result = scoreAttempt(
        questions.map((q) => ({
          id: String(q._id),
          type: q.type,
          points: q.points,
          correctOptionIds: q.correctOptionIds ?? [],
        })),
        current.answers.map((a) => ({
          questionId: String(a.questionId),
          selectedOptionIds: a.selectedOptionIds,
          textAnswer: a.textAnswer,
        })),
        assessment?.negativeMarking ?? { enabled: false, penalty: 0 },
      );
      const version = (current as unknown as { __v: number }).__v ?? 0;
      const claimed = await this.attempts
        .findOneAndUpdate(
          {
            _id: current._id,
            status: 'in_progress',
            __v: version,
            ...(targetStatus === 'submitted'
              ? { expiresAt: { $gt: submittedAt } }
              : {}),
          },
          {
            $set: {
              status: targetStatus,
              submittedAt,
              score: result.score,
              maxObjectiveScore: result.maxObjectiveScore,
            },
            $inc: { __v: 1 },
          },
          { new: true },
        )
        .exec();
      if (claimed) {
        Object.assign(attempt, claimed.toObject());
        return {
          id: String(claimed._id),
          status: claimed.status as 'submitted' | 'auto_submitted',
          score: claimed.score,
          maxObjectiveScore: claimed.maxObjectiveScore,
          submittedAt: claimed.submittedAt,
          breakdown: result.breakdown,
        };
      }

      const latest = await this.attempts.findById(current._id).exec();
      if (!latest || latest.status !== 'in_progress') {
        throw new ConflictException('Already submitted');
      }
      current = latest;
    }

    throw new ConflictException('Attempt changed concurrently; please retry');
  }

  private async loadOwned(id: string, user: AuthUser) {
    const attempt = await this.attempts.findById(id).exec();
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (user.role !== 'admin' && String(attempt.candidateId) !== user.sub) {
      throw new ForbiddenException('You cannot view this attempt');
    }
    return attempt;
  }

  private assertInProgress(attempt: AttemptDocument) {
    if (attempt.status !== 'in_progress') {
      throw new ConflictException('Attempt is already closed');
    }
  }

  private async serializeAttempt(
    attempt: AttemptDocument,
    user: AuthUser,
    includeQuestions: boolean,
  ) {
    const assessment = await this.assessments
      .findById(attempt.assessmentId)
      .lean()
      .exec();
    const questions = includeQuestions
      ? await this.questions
          .find({ assessmentId: attempt.assessmentId })
          .sort({ order: 1, createdAt: 1 })
          .lean()
          .exec()
      : [];

    const hideKey = user.role !== 'admin';
    const canViewAnswers =
      user.role === 'candidate' || attempt.status !== 'in_progress';
    const safeQuestions = questions.map((q) => ({
      id: String(q._id),
      type: q.type,
      prompt: q.prompt,
      options: q.options,
      points: q.points,
      order: q.order,
      ...(hideKey ? {} : { correctOptionIds: q.correctOptionIds }),
    }));

    return {
      id: String(attempt._id),
      assessmentId: String(attempt.assessmentId),
      assignmentId: String(attempt.assignmentId),
      candidateId: String(attempt.candidateId),
      title: assessment?.title,
      description: assessment?.description,
      durationMinutes: assessment?.durationMinutes,
      proctoring: assessment?.proctoring,
      negativeMarking: assessment?.negativeMarking,
      status: attempt.status,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      submittedAt: attempt.submittedAt,
      remainingSeconds: remainingSeconds(attempt.expiresAt),
      answers: canViewAnswers
        ? attempt.answers.map((a) => ({
            questionId: String(a.questionId),
            selectedOptionIds: a.selectedOptionIds,
            textAnswer: a.textAnswer,
            savedAt: a.savedAt,
          }))
        : [],
      score:
        attempt.status === 'in_progress' && hideKey ? undefined : attempt.score,
      maxObjectiveScore:
        attempt.status === 'in_progress' && hideKey
          ? undefined
          : attempt.maxObjectiveScore,
      violationCount: attempt.violationCount,
      questions: safeQuestions,
      serverNow: new Date(),
    };
  }
}
