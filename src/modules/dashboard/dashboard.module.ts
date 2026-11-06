
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  Employee,
  EmployeeSchema,
} from '../employees/schemas/employee.schema.js';
import {
  User,
  UserSchema,
} from '../users/schemas/users.schema.js';
import {
  Attendance,
  AttendanceSchema,
} from '../attendance/schemas/attendance.schema.js';
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
import {
  Notification,
  NotificationSchema,
} from '../notifications/schemas/notifications.schema.js';

import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';

import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Employee.name, schema: EmployeeSchema },
      { name: User.name, schema: UserSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Leave.name, schema: LeaveSchema },
      { name: Task.name, schema: TaskSchema },
      { name: Payroll.name, schema: PayrollSchema },
      {
        name: Notification.name,
        schema: NotificationSchema,
      },
    ]),
    AuthModule,
    UsersModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
