
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongoSchema, Types } from 'mongoose';
import type { HydratedDocument } from 'mongoose';

import { Employee } from '../../employees/schemas/employee.schema.js';
import { User } from '../../users/schemas/users.schema.js';

export enum PayrollStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
  PAID = 'paid',
}

export type PayrollDocument = HydratedDocument<Payroll>;

@Schema({
  collection: 'payroll',
  timestamps: true,
})
export class Payroll {
  @Prop({
    type: MongoSchema.Types.ObjectId,
    ref: Employee.name,
    required: true,
  })
  employeeId!: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    match: /^\d{4}-(0[1-9]|1[0-2])$/,
  })
  month!: string;

  @Prop({
    type: String,
    required: true,
    uppercase: true,
  })
  currency!: string;

  @Prop({ type: Number, required: true, min: 0 })
  basicSalary!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  allowances!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  deductions!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  additionalAllowances!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  additionalDeductions!: number;

  @Prop({ type: Number, required: true, min: 0 })
  grossSalary!: number;

  @Prop({ type: Number, required: true, min: 0 })
  totalDeductions!: number;

  @Prop({ type: Number, required: true, min: 0 })
  netSalary!: number;

  @Prop({
    type: String,
    enum: Object.values(PayrollStatus),
    default: PayrollStatus.DRAFT,
  })
  status!: PayrollStatus;

  @Prop({
    type: String,
    default: '',
    maxlength: 1000,
  })
  notes!: string;

  @Prop({
    type: MongoSchema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  createdBy!: Types.ObjectId;

  @Prop({
    type: MongoSchema.Types.ObjectId,
    ref: User.name,
    default: null,
  })
  approvedBy!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  approvedAt!: Date | null;

  @Prop({
    type: MongoSchema.Types.ObjectId,
    ref: User.name,
    default: null,
  })
  markedPaidBy!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  paidAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PayrollSchema =
  SchemaFactory.createForClass(Payroll);

PayrollSchema.index(
  { employeeId: 1, month: 1 },
  { unique: true },
);

PayrollSchema.index({
  month: -1,
  status: 1,
});
