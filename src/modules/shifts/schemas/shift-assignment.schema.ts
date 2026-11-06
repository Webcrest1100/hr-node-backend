
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
import { Shift } from './shifts.schema.js';

export type ShiftAssignmentDocument =
  HydratedDocument<ShiftAssignment>;

@Schema({
  collection: 'shift_assignments',
  timestamps: true,
})
export class ShiftAssignment {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Employee.name,
    required: true,
    unique: true,
  })
  employeeId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Shift.name,
    required: true,
  })
  shiftId!: Types.ObjectId;

  @Prop({
    type: Date,
    default: Date.now,
  })
  assignedAt!: Date;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    default: null,
  })
  assignedBy!: Types.ObjectId | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ShiftAssignmentSchema =
  SchemaFactory.createForClass(ShiftAssignment);

ShiftAssignmentSchema.index({
  shiftId: 1,
});
