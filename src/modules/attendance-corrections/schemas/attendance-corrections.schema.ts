
import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';

import {
  Schema as MongooseSchema,
  Types,
} from 'mongoose';

import type { HydratedDocument } from 'mongoose';

import { Attendance } from '../../attendance/schemas/attendance.schema.js';
import { Employee } from '../../employees/schemas/employee.schema.js';
import { User } from '../../users/schemas/users.schema.js';

export enum CorrectionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export type AttendanceCorrectionDocument =
  HydratedDocument<AttendanceCorrection>;

@Schema({
  collection: 'attendance_corrections',
  timestamps: true,
})
export class AttendanceCorrection {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Attendance.name,
    required: true,
  })
  attendanceId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Employee.name,
    required: true,
  })
  employeeId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  requestedBy!: Types.ObjectId;

  @Prop({
    type: Date,
    required: true,
  })
  originalCheckInAt!: Date;

  @Prop({
    type: Date,
    required: true,
  })
  originalCheckOutAt!: Date;

  @Prop({
    type: Date,
    required: true,
  })
  proposedCheckInAt!: Date;

  @Prop({
    type: Date,
    required: true,
  })
  proposedCheckOutAt!: Date;

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
    enum: Object.values(CorrectionStatus),
    default: CorrectionStatus.PENDING,
    required: true,
  })
  status!: CorrectionStatus;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    default: null,
  })
  reviewedBy!: Types.ObjectId | null;

  @Prop({
    type: Date,
    default: null,
  })
  reviewedAt!: Date | null;

  @Prop({
    type: String,
    default: '',
    maxlength: 1000,
  })
  reviewNote!: string;

  @Prop({
    type: Date,
    default: null,
  })
  cancelledAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const AttendanceCorrectionSchema =
  SchemaFactory.createForClass(AttendanceCorrection);

// Ek attendance record ki sirf ek pending request.
AttendanceCorrectionSchema.index(
  { attendanceId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: CorrectionStatus.PENDING,
    },
  },
);

AttendanceCorrectionSchema.index({
  employeeId: 1,
  createdAt: -1,
});

AttendanceCorrectionSchema.index({
  status: 1,
  createdAt: -1,
});
