import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Assignment {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Assessment',
    required: true,
  })
  assessmentId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  candidateId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  assignedBy: Types.ObjectId;
}

export type AssignmentDocument = HydratedDocument<Assignment>;
export const AssignmentSchema = SchemaFactory.createForClass(Assignment);
AssignmentSchema.index({ assessmentId: 1, candidateId: 1 }, { unique: true });
AssignmentSchema.index({ candidateId: 1 });
