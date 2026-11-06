
import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { User } from '../../users/schemas/users.schema.js';

export enum EmploymentStatus {
  ACTIVE = 'active',
  ON_LEAVE = 'on_leave',
  PROBATION = 'probation',
  RESIGNED = 'resigned',
  TERMINATED = 'terminated',
}

export type EmployeeDocument = HydratedDocument<Employee>;

@Schema({
  collection: 'employees',
  timestamps: true,
})
export class Employee {
  @Prop({
    type: Types.ObjectId,
    ref: User.name,
    required: true,
    unique: true,
  })
  userId!: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
  })
  employeeCode!: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  designation!: string;

  @Prop({
    type: String,
    default: '',
    trim: true,
  })
  department!: string;

  @Prop({
    type: String,
    default: '',
    trim: true,
  })
  phone!: string;

  @Prop({
    type: Date,
    required: true,
  })
  joiningDate!: Date;

  @Prop({
    type: String,
    enum: Object.values(EmploymentStatus),
    default: EmploymentStatus.ACTIVE,
  })
  employmentStatus!: EmploymentStatus;

  @Prop({
    type: String,
    default: '',
    trim: true,
  })
  notes!: string;
}

export const EmployeeSchema =
  SchemaFactory.createForClass(Employee);

EmployeeSchema.index({
  department: 1,
  employmentStatus: 1,
});
