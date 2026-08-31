import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import type { AttemptStatus } from '../common/types';

@Schema({ _id: false })
export class SavedAnswer {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  questionId: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  selectedOptionIds: string[];

  @Prop({ default: '' })
  textAnswer: string;

  @Prop({ default: Date.now })
  savedAt: Date;
}

@Schema({ timestamps: true })
export class Attempt {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Assignment',
    required: true,
    unique: true,
  })
  assignmentId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Assessment',
    required: true,
  })
  assessmentId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  candidateId: Types.ObjectId;

  @Prop({ required: true })
  startedAt: Date;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop()
  submittedAt?: Date;

  @Prop({
    type: String,
    default: 'in_progress',
    enum: ['in_progress', 'submitted', 'auto_submitted'],
  })
  status: AttemptStatus;

  @Prop({ type: [SavedAnswer], default: [] })
  answers: SavedAnswer[];

  @Prop({ default: 0 })
  score: number;

  @Prop({ default: 0 })
  maxObjectiveScore: number;

  @Prop({ default: 0 })
  violationCount: number;
}

export type AttemptDocument = HydratedDocument<Attempt>;
export const AttemptSchema = SchemaFactory.createForClass(Attempt);
AttemptSchema.index({ assessmentId: 1, candidateId: 1 });
