
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type LeaveTypeDocument = HydratedDocument<LeaveType>;

@Schema({
  collection: 'leave_types',
  timestamps: true,
})
export class LeaveType {
  @Prop({
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100,
  })
  name!: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    match: /^[A-Z0-9-]{2,30}$/,
  })
  code!: string;

  @Prop({
    type: Boolean,
    default: true,
  })
  isPaid!: boolean;

  @Prop({
    type: Boolean,
    default: true,
  })
  isActive!: boolean;

  @Prop({
    type: String,
    trim: true,
    maxlength: 500,
    default: '',
  })
  description!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const LeaveTypeSchema =
  SchemaFactory.createForClass(LeaveType);
