import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import type { ProctorEventType } from '../common/types';

@Schema({ timestamps: true })
export class ProctoringEvent {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Attempt',
    required: true,
    index: true,
  })
  attemptId: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    enum: [
      'tab_switch',
      'window_blur',
      'fullscreen_exit',
      'copy',
      'paste',
      'right_click',
    ],
  })
  type: ProctorEventType;

  @Prop({ default: Date.now })
  occurredAt: Date;

  @Prop({ type: Object, default: {} })
  meta: Record<string, unknown>;
}

export type ProctoringEventDocument = HydratedDocument<ProctoringEvent>;
export const ProctoringEventSchema =
  SchemaFactory.createForClass(ProctoringEvent);
