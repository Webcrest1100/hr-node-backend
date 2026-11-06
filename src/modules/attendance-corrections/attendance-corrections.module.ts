
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  AttendanceCorrection,
  AttendanceCorrectionSchema,
} from './schemas/attendance-corrections.schema.js';

import {
  Attendance,
  AttendanceSchema,
} from '../attendance/schemas/attendance.schema.js';

import {
  Employee,
  EmployeeSchema,
} from '../employees/schemas/employee.schema.js';

import {
  Shift,
  ShiftSchema,
} from '../shifts/schemas/shifts.schema.js';

import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';

import {
  AttendanceCorrectionsController,
} from './attendance-corrections.controller.js';

import {
  AttendanceCorrectionsService,
} from './attendance-corrections.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: AttendanceCorrection.name,
        schema: AttendanceCorrectionSchema,
      },
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
    ]),

    AuthModule,
    UsersModule,
  ],

  controllers: [
    AttendanceCorrectionsController,
  ],

  providers: [
    AttendanceCorrectionsService,
  ],

  exports: [
    AttendanceCorrectionsService,
  ],
})
export class AttendanceCorrectionsModule {}
