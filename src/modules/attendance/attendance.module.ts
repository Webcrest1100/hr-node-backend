
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  Attendance,
  AttendanceSchema,
} from './schemas/attendance.schema.js';

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

import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Attendance.name,
        schema: AttendanceSchema,
      },
      {
        name: Employee.name,
        schema: EmployeeSchema,
      },
      {
        name: Shift.name,
        schema: ShiftSchema,
      },
      {
        name: ShiftAssignment.name,
        schema: ShiftAssignmentSchema,
      },
    ]),

    AuthModule,
    UsersModule,
  ],

  controllers: [
    AttendanceController,
  ],

  providers: [
    AttendanceService,
  ],

  exports: [
    AttendanceService,
  ],
})
export class AttendanceModule {}
