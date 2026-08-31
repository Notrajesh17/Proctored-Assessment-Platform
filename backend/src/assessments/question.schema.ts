import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import type { QuestionType } from '../common/types';

@Schema({ _id: false })
export class QuestionOption {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  text: string;
}

@Schema({ timestamps: true })
export class Question {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Assessment',
    required: true,
    index: true,
  })
  assessmentId: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    enum: ['single_choice', 'multiple_choice', 'short_answer'],
  })
  type: QuestionType;

  @Prop({ required: true })
  prompt: string;

  @Prop({ type: [QuestionOption], default: [] })
  options: QuestionOption[];

  @Prop({ type: [String], default: [] })
  correctOptionIds: string[];

  @Prop({ required: true, min: 0 })
  points: number;

  @Prop({ default: 0 })
  order: number;
}

export type QuestionDocument = HydratedDocument<Question>;
export const QuestionSchema = SchemaFactory.createForClass(Question);
