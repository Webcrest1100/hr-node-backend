
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongoSchema, Types } from 'mongoose';
import type { HydratedDocument } from 'mongoose';

import { Employee } from '../../employees/schemas/employee.schema.js';
import { LeaveType } from './leave-type.schema.js';

export type LeaveBalanceDocument =
  HydratedDocument<LeaveBalance>;

@Schema({
  collection: 'leave_balances',
  timestamps: true,
})
export class LeaveBalance {
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
    type: Number,
    required: true,
    min: 2000,
    max: 2100,
  })
  year!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  allocated!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  used!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  remaining!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const LeaveBalanceSchema =
  SchemaFactory.createForClass(LeaveBalance);

LeaveBalanceSchema.index(
  { employeeId: 1, leaveTypeId: 1, year: 1 },
  { unique: true },
);
