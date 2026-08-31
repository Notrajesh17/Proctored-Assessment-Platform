import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Assessment, AssessmentDocument } from './assessment.schema';
import { Question, QuestionDocument } from './question.schema';
import { Assignment, AssignmentDocument } from './assignment.schema';
import { Attempt, AttemptDocument } from '../attempts/attempt.schema';

import {
  AssignDto,
  CreateAssessmentDto,
  CreateQuestionDto,
  UpdateAssessmentDto,
} from './dto';

import type { AuthUser } from '../common/types';
import { AttemptsService } from '../attempts/attempts.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AssessmentsService {
  constructor(
    @InjectModel(Assessment.name)
    private assessments: Model<AssessmentDocument>,

    @InjectModel(Question.name)
    private questions: Model<QuestionDocument>,

    @InjectModel(Assignment.name)
    private assignments: Model<AssignmentDocument>,

    @InjectModel(Attempt.name)
    private attempts: Model<AttemptDocument>,
    private attemptsService: AttemptsService,
    private users: UsersService,
  ) {}

  create(dto: CreateAssessmentDto, user: AuthUser): Promise<any> {
    return this.assessments.create({
      ...dto,
      createdBy: new Types.ObjectId(user.sub),
    });
  }

  listForAdmin(): Promise<any[]> {
    return this.assessments.find().sort({ updatedAt: -1 }).lean().exec();
  }

  async get(id: string): Promise<any> {
    const assessment = await this.assessments.findById(id).lean().exec();

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const questions = await this.questions
      .find({ assessmentId: id })
      .sort({ order: 1, createdAt: 1 })
      .lean()
      .exec();
    const locked =
      Boolean(assessment.lockedAt) ||
      Boolean(await this.assignments.exists({ assessmentId: id }));

    return {
      ...assessment,
      locked,
      questions,
    };
  }

  async update(id: string, dto: UpdateAssessmentDto): Promise<any> {
    const existing = await this.ensureAssessment(id);
    if (dto.status === 'published') {
      const questionCount = await this.questions.countDocuments({
        assessmentId: id,
      });
      if (questionCount === 0) {
        throw new BadRequestException(
          'Add at least one question before publishing',
        );
      }
    }

    const scoringRelevantChange =
      (dto.durationMinutes !== undefined &&
        dto.durationMinutes !== existing.durationMinutes) ||
      (dto.status !== undefined && dto.status !== existing.status) ||
      this.hasNestedChanges(dto.negativeMarking, existing.negativeMarking) ||
      this.hasNestedChanges(dto.proctoring, existing.proctoring);
    if (scoringRelevantChange) {
      await this.ensureAssessmentEditable(id);
    }

    const updated = await this.assessments
      .findByIdAndUpdate(id, dto, { new: true })
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException('Assessment not found');
    }

    return updated;
  }

  async remove(id: string): Promise<{ ok: boolean }> {
    const existing = await this.assessments
      .findOneAndUpdate(
        { _id: id, deletingAt: { $exists: false } },
        { $set: { deletingAt: new Date() } },
        { new: true },
      )
      .exec();
    if (!existing) {
      const found = await this.assessments.exists({ _id: id });
      if (found) {
        throw new BadRequestException(
          'Assessment deletion is already in progress',
        );
      }
      throw new NotFoundException('Assessment not found');
    }

    try {
      await this.attemptsService.deleteForAssessment(id);
      await this.questions.deleteMany({ assessmentId: id });
      await this.assignments.deleteMany({ assessmentId: id });
      await this.assessments.deleteOne({ _id: id });
      return { ok: true };
    } catch (error) {
      await this.assessments.updateOne(
        { _id: id, deletingAt: existing.deletingAt },
        { $unset: { deletingAt: 1 } },
      );
      throw error;
    }
  }

  async addQuestion(
    assessmentId: string,
    dto: CreateQuestionDto,
  ): Promise<any> {
    await this.ensureAssessment(assessmentId);
    await this.ensureAssessmentEditable(assessmentId);

    this.validateQuestion(dto);

    const count = await this.questions.countDocuments({
      assessmentId,
    });

    const created = await this.questions.create({
      ...dto,
      assessmentId: new Types.ObjectId(assessmentId),
      order: dto.order ?? count,
      options: dto.options ?? [],
      correctOptionIds: dto.correctOptionIds ?? [],
    });
    const stillEditable = await this.assessments.exists({
      _id: assessmentId,
      lockedAt: { $exists: false },
      deletingAt: { $exists: false },
    });
    if (!stillEditable) {
      await created.deleteOne();
      throw new BadRequestException('This assessment is no longer editable');
    }
    return created;
  }

  async updateQuestion(
    questionId: string,
    dto: Partial<CreateQuestionDto>,
  ): Promise<any> {
    const existing = await this.questions.findById(questionId).exec();

    if (!existing) {
      throw new NotFoundException('Question not found');
    }
    await this.ensureAssessmentEditable(String(existing.assessmentId));

    const merged = {
      ...existing.toObject(),
      ...dto,
    };

    this.validateQuestion(merged);

    Object.assign(existing, dto);

    return existing.save();
  }

  async removeQuestion(questionId: string): Promise<{ ok: boolean }> {
    const existing = await this.questions.findById(questionId).exec();
    if (!existing) {
      throw new NotFoundException('Question not found');
    }
    await this.ensureAssessmentEditable(String(existing.assessmentId));
    await existing.deleteOne();

    return { ok: true };
  }

  async assign(
    assessmentId: string,
    dto: AssignDto,
    user: AuthUser,
  ): Promise<{ assigned: number }> {
    const assessment = await this.ensureAssessment(assessmentId);

    if (assessment.status !== 'published') {
      throw new BadRequestException('Publish the assessment before assigning');
    }

    const qCount = await this.questions.countDocuments({
      assessmentId,
    });

    if (qCount === 0) {
      throw new BadRequestException('Add at least one question first');
    }

    const uniqueCandidateIds = [
      ...new Set(
        dto.candidateIds.map((candidateId) =>
          new Types.ObjectId(candidateId).toHexString(),
        ),
      ),
    ];
    const candidates = await this.users.findCandidatesByIds(uniqueCandidateIds);
    if (candidates.length !== uniqueCandidateIds.length) {
      throw new BadRequestException(
        'Every assignee must be an existing candidate',
      );
    }

    const locked = await this.assessments
      .findOneAndUpdate(
        {
          _id: assessmentId,
          status: 'published',
          deletingAt: { $exists: false },
        },
        { $set: { lockedAt: assessment.lockedAt ?? new Date() } },
        { new: true },
      )
      .exec();
    if (!locked) {
      throw new BadRequestException(
        'Assessment is no longer available to assign',
      );
    }

    const created: AssignmentDocument[] = [];

    for (const candidateId of uniqueCandidateIds) {
      try {
        const row = await this.assignments.create({
          assessmentId: new Types.ObjectId(assessmentId),
          candidateId: new Types.ObjectId(candidateId),
          assignedBy: new Types.ObjectId(user.sub),
        });

        created.push(row);
      } catch (err: unknown) {
        const code = (err as { code?: number }).code;

        if (code === 11000) {
          continue;
        }

        throw err;
      }
    }

    return {
      assigned: created.length,
    };
  }

  async myAssignments(candidateId: string): Promise<any[]> {
    await this.attemptsService.expireMatching({ candidateId });
    const rows = await this.assignments
      .find({ candidateId })
      .populate('assessmentId')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const attemptMap = new Map<string, AttemptDocument>();

    const attempts = await this.attempts.find({ candidateId }).lean().exec();

    for (const a of attempts) {
      attemptMap.set(String(a.assignmentId), a as AttemptDocument);
    }

    return rows.flatMap((row) => {
      const assessment = row.assessmentId as unknown as {
        _id: Types.ObjectId;
        title: string;
        description: string;
        durationMinutes: number;
        status: string;
      };
      if (!assessment?._id) return [];

      const attempt = attemptMap.get(String(row._id));

      return [
        {
          id: String(row._id),
          assessmentId: String(assessment?._id ?? row.assessmentId),
          title: assessment?.title,
          description: assessment?.description,
          durationMinutes: assessment?.durationMinutes,
          assignedAt: (row as { createdAt?: Date }).createdAt,

          attempt: attempt
            ? {
                id: String(attempt._id),
                status: attempt.status,
                score: attempt.score,
                maxObjectiveScore: attempt.maxObjectiveScore,
                submittedAt: attempt.submittedAt,
              }
            : null,
        },
      ];
    });
  }

  async submissions(assessmentId: string): Promise<any[]> {
    await this.ensureAssessment(assessmentId);
    await this.attemptsService.expireMatching({ assessmentId });

    const rows = await this.attempts
      .find({ assessmentId })
      .populate('candidateId', 'name email')
      .sort({ submittedAt: -1, startedAt: -1 })
      .lean()
      .exec();
    return rows.map((row) =>
      row.status === 'in_progress' ? { ...row, answers: [] } : row,
    );
  }

  private async ensureAssessment(id: string): Promise<AssessmentDocument> {
    const assessment = await this.assessments.findById(id).exec();

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }
    if (assessment.deletingAt) {
      throw new BadRequestException('Assessment deletion is in progress');
    }

    return assessment;
  }

  private validateQuestion(dto: {
    type: string;
    options?: { id: string }[];
    correctOptionIds?: string[];
  }): void {
    if (dto.type === 'short_answer') {
      return;
    }

    const options = dto.options ?? [];

    if (options.length < 2) {
      throw new BadRequestException('Choice questions need at least 2 options');
    }

    const ids = dto.correctOptionIds ?? [];

    if (ids.length === 0) {
      throw new BadRequestException('Mark the correct option(s)');
    }
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Correct option ids must be unique');
    }

    if (dto.type === 'single_choice' && ids.length !== 1) {
      throw new BadRequestException('Single choice needs exactly one answer');
    }

    const optionIds = new Set(options.map((o) => o.id));

    if (optionIds.size !== options.length) {
      throw new BadRequestException('Option ids must be unique');
    }

    if (ids.some((id) => !optionIds.has(id))) {
      throw new BadRequestException('Correct option id does not exist');
    }
  }

  private async ensureAssessmentEditable(assessmentId: string): Promise<void> {
    const assessment = await this.ensureAssessment(assessmentId);
    if (assessment.lockedAt) {
      throw new BadRequestException(
        'This assessment is locked because it has already been assigned',
      );
    }
    const assigned = await this.assignments.exists({ assessmentId });
    if (assigned) {
      throw new BadRequestException(
        'This assessment is locked because it has already been assigned',
      );
    }
  }

  private hasNestedChanges(
    incoming: object | undefined,
    current: unknown,
  ): boolean {
    if (!incoming) return false;
    const currentRecord = current as Record<string, unknown> | undefined;
    return Object.entries(incoming).some(
      ([key, value]) => currentRecord?.[key] !== value,
    );
  }
}
