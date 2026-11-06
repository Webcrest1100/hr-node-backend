
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  Attendance,
  AttendanceSchema,
} from '../attendance/schemas/attendance.schema.js';

import {
  Employee,
  EmployeeSchema,
} from '../employees/schemas/employee.schema.js';

import {
  Leave,
  LeaveSchema,
} from '../leaves/schemas/leaves.schema.js';

import {
  Task,
  TaskSchema,
} from '../tasks/schemas/tasks.schema.js';

import {
  Payroll,
  PayrollSchema,
} from '../payroll/schemas/payroll.schema.js';

import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';

import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

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
        name: Leave.name,
        schema: LeaveSchema,
      },
      {
        name: Task.name,
        schema: TaskSchema,
      },
      {
        name: Payroll.name,
        schema: PayrollSchema,
      },
    ]),

    AuthModule,
    UsersModule,
  ],

  controllers: [
    ReportsController,
  ],

  providers: [
    ReportsService,
  ],

  exports: [
    ReportsService,
  ],
})
export class ReportsModule {}
