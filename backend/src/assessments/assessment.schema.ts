import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ _id: false })
export class NegativeMarkingConfig {
  @Prop({ default: false })
  enabled: boolean;

  @Prop({ default: 1 })
  penalty: number;
}

@Schema({ _id: false })
export class ProctoringConfig {
  @Prop({ default: true })
  enabled: boolean;

  // 0 = no auto-submit on violations
  @Prop({ default: 5 })
  maxViolations: number;

  @Prop({ default: true })
  requireFullscreen: boolean;
}

@Schema({ timestamps: true })
export class Assessment {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ required: true, min: 1 })
  durationMinutes: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: String, default: 'draft', enum: ['draft', 'published'] })
  status: 'draft' | 'published';

  @Prop({ type: NegativeMarkingConfig, default: () => ({}) })
  negativeMarking: NegativeMarkingConfig;

  @Prop({ type: ProctoringConfig, default: () => ({}) })
  proctoring: ProctoringConfig;

  @Prop()
  lockedAt?: Date;

  @Prop()
  deletingAt?: Date;
}

export type AssessmentDocument = HydratedDocument<Assessment>;
export const AssessmentSchema = SchemaFactory.createForClass(Assessment);
