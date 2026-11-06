
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

import { Employee } from '../../employees/schemas/employee.schema.js';
import { Shift } from '../../shifts/schemas/shifts.schema.js';

export enum AttendanceStatus {
  PRESENT = 'present',
  LATE = 'late',
}

@Schema({
  _id: false,
})
export class AttendanceLocation {
  @Prop({
    type: Number,
    required: true,
  })
  latitude!: number;

  @Prop({
    type: Number,
    required: true,
  })
  longitude!: number;

  @Prop({
    type: Number,
    required: true,
  })
  distanceMeters!: number;
}

export const AttendanceLocationSchema =
  SchemaFactory.createForClass(AttendanceLocation);

@Schema({
  _id: false,
})
export class AttendanceBreak {
  @Prop({
    type: Date,
    required: true,
  })
  startAt!: Date;

  @Prop({
    type: Date,
    default: null,
  })
  endAt!: Date | null;
}

export const AttendanceBreakSchema =
  SchemaFactory.createForClass(AttendanceBreak);

export type AttendanceDocument =
  HydratedDocument<Attendance>;

@Schema({
  collection: 'attendance',
  timestamps: true,
})
export class Attendance {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Employee.name,
    required: true,
  })
  employeeId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Shift.name,
    required: true,
  })
  shiftId!: Types.ObjectId;

  @Prop({
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/,
  })
  workDate!: string;

  @Prop({
    required: true,
    default: 'Asia/Karachi',
  })
  timezone!: string;

  @Prop({
    required: true,
  })
  scheduledStartTime!: string;

  @Prop({
    type: Date,
    required: true,
  })
  checkInAt!: Date;

  @Prop({
    type: Date,
    default: null,
  })
  checkOutAt!: Date | null;

  @Prop({
    type: AttendanceLocationSchema,
    required: true,
  })
  checkInLocation!: AttendanceLocation;

  @Prop({
    type: AttendanceLocationSchema,
    default: null,
  })
  checkOutLocation!: AttendanceLocation | null;

  @Prop({
    type: [AttendanceBreakSchema],
    default: [],
  })
  breaks!: AttendanceBreak[];

  @Prop({
    type: Boolean,
    default: false,
  })
  isOnBreak!: boolean;

  @Prop({
    type: Number,
    min: 0,
    default: 0,
  })
  lateMinutes!: number;

  @Prop({
    type: Number,
    min: 0,
    default: 0,
  })
  breakMinutes!: number;

  @Prop({
    type: Number,
    min: 0,
    default: 0,
  })
  workedMinutes!: number;

  @Prop({
    type: String,
    enum: Object.values(AttendanceStatus),
    default: AttendanceStatus.PRESENT,
  })
  status!: AttendanceStatus;

  @Prop({
    type: String,
    default: '',
    maxlength: 1000,
  })
  notes!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const AttendanceSchema =
  SchemaFactory.createForClass(Attendance);

AttendanceSchema.index(
  {
    employeeId: 1,
    workDate: 1,
  },
  {
    unique: true,
  },
);

AttendanceSchema.index({
  workDate: -1,
  employeeId: 1,
});

AttendanceSchema.index({
  checkInAt: -1,
});
