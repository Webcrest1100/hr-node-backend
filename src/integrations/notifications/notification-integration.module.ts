
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';

import {
  Task,
  TaskSchema,
} from '../../modules/tasks/schemas/tasks.schema.js';

import {
  Leave,
  LeaveSchema,
} from '../../modules/leaves/schemas/leaves.schema.js';

import {
  AttendanceCorrection,
  AttendanceCorrectionSchema,
} from '../../modules/attendance-corrections/schemas/attendance-corrections.schema.js';

import {
  Payroll,
  PayrollSchema,
} from '../../modules/payroll/schemas/payroll.schema.js';

import {
  Employee,
  EmployeeSchema,
} from '../../modules/employees/schemas/employee.schema.js';

import {
  User,
  UserSchema,
} from '../../modules/users/schemas/users.schema.js';

import {
  NotificationsModule,
} from '../../modules/notifications/notifications.module.js';

import {
  NotificationEventsService,
} from './notification-events.service.js';

import {
  NotificationEventsInterceptor,
} from './notification-events.interceptor.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Task.name,
        schema: TaskSchema,
      },
      {
        name: Leave.name,
        schema: LeaveSchema,
      },
      {
        name: AttendanceCorrection.name,
        schema: AttendanceCorrectionSchema,
      },
      {
        name: Payroll.name,
        schema: PayrollSchema,
      },
      {
        name: Employee.name,
        schema: EmployeeSchema,
      },
      {
        name: User.name,
        schema: UserSchema,
      },
    ]),

    NotificationsModule,
  ],

  providers: [
    NotificationEventsService,
    NotificationEventsInterceptor,

    {
      provide: APP_INTERCEPTOR,
      useExisting: NotificationEventsInterceptor,
    },
  ],

  exports: [
    NotificationEventsService,
  ],
})
export class NotificationIntegrationModule {}
