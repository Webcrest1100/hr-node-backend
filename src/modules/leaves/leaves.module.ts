
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  Leave,
  LeaveSchema,
} from './schemas/leaves.schema.js';

import {
  LeaveType,
  LeaveTypeSchema,
} from './schemas/leave-type.schema.js';

import {
  LeaveBalance,
  LeaveBalanceSchema,
} from './schemas/leave-balance.schema.js';

import {
  Employee,
  EmployeeSchema,
} from '../employees/schemas/employee.schema.js';

import {
  Shift,
  ShiftSchema,
} from '../shifts/schemas/shifts.schema.js';

import {
  ShiftAssignment,
  ShiftAssignmentSchema,
} from '../shifts/schemas/shift-assignment.schema.js';

import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';

import { LeavesController } from './leaves.controller.js';
import { LeavesService } from './leaves.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Leave.name, schema: LeaveSchema },
      { name: LeaveType.name, schema: LeaveTypeSchema },
      { name: LeaveBalance.name, schema: LeaveBalanceSchema },
      { name: Employee.name, schema: EmployeeSchema },
      { name: Shift.name, schema: ShiftSchema },
      {
        name: ShiftAssignment.name,
        schema: ShiftAssignmentSchema,
      },
    ]),
    AuthModule,
    UsersModule,
  ],

  controllers: [LeavesController],

  providers: [LeavesService],

  exports: [LeavesService],
})
export class LeavesModule {}
