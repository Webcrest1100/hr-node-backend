
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongoSchema, Types } from 'mongoose';
import type { HydratedDocument } from 'mongoose';

import { Employee } from '../../employees/schemas/employee.schema.js';
import { User } from '../../users/schemas/users.schema.js';
import { LeaveType } from './leave-type.schema.js';

export enum LeaveStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export type LeaveDocument = HydratedDocument<Leave>;

@Schema({
  collection: 'leave_requests',
  timestamps: true,
})
export class Leave {
  @Prop({
    type: MongoSchema.Types.ObjectId,
    ref: Employee.name,
    required: true,
  })
  employeeId!: Types.ObjectId;

  @Prop({
    type: MongoSchema.Types.ObjectId,
    ref: LeaveType.name,
    required: true,
  })
  leaveTypeId!: Types.ObjectId;

  @Prop({
    type: MongoSchema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  requestedBy!: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/,
  })
  startDate!: string;

  @Prop({
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/,
  })
  endDate!: string;

  @Prop({
    type: Number,
    required: true,
    min: 1,
    max: 366,
  })
  days!: number;

  @Prop({
    type: String,
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 1000,
  })
  reason!: string;

  @Prop({
    type: String,
    enum: Object.values(LeaveStatus),
    default: LeaveStatus.PENDING,
    required: true,
  })
  status!: LeaveStatus;

  @Prop({
    type: MongoSchema.Types.ObjectId,
    ref: User.name,
    default: null,
  })
  reviewedBy!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  reviewedAt!: Date | null;

  @Prop({
    type: String,
    trim: true,
    maxlength: 1000,
    default: '',
  })
  reviewNote!: string;

  @Prop({ type: Date, default: null })
  cancelledAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const LeaveSchema = SchemaFactory.createForClass(Leave);

LeaveSchema.index({
  employeeId: 1,
  status: 1,
  startDate: 1,
  endDate: 1,
});

LeaveSchema.index({
  status: 1,
  createdAt: -1,
});
