
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongoSchema, Types } from 'mongoose';
import type { HydratedDocument } from 'mongoose';

import { Employee } from '../../employees/schemas/employee.schema.js';

export type SalaryStructureDocument =
  HydratedDocument<SalaryStructure>;

@Schema({
  collection: 'salary_structures',
  timestamps: true,
})
export class SalaryStructure {
  @Prop({
    type: MongoSchema.Types.ObjectId,
    ref: Employee.name,
    required: true,
    unique: true,
  })
  employeeId!: Types.ObjectId;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  basicSalary!: number;

  @Prop({
    type: Number,
    default: 0,
    min: 0,
  })
  fixedAllowances!: number;

  @Prop({
    type: Number,
    default: 0,
    min: 0,
  })
  fixedDeductions!: number;

  @Prop({
    type: String,
    default: 'PKR',
    uppercase: true,
    match: /^[A-Z]{3}$/,
  })
  currency!: string;

  @Prop({
    type: Boolean,
    default: true,
  })
  isActive!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const SalaryStructureSchema =
  SchemaFactory.createForClass(SalaryStructure);
