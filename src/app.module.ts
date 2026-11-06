
import { Module } from '@nestjs/common';

import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config';

import {
  MongooseModule,
} from '@nestjs/mongoose';

import {
  AppController,
} from './app.controller.js';

import {
  AppService,
} from './app.service.js';

import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { EmployeesModule } from './modules/employees/employees.module.js';
import { DepartmentsModule } from './modules/departments/departments.module.js';
import { ShiftsModule } from './modules/shifts/shifts.module.js';
import { AttendanceModule } from './modules/attendance/attendance.module.js';
import { AttendanceCorrectionsModule } from './modules/attendance-corrections/attendance-corrections.module.js';
import { LeavesModule } from './modules/leaves/leaves.module.js';
import { PayrollModule } from './modules/payroll/payroll.module.js';
import { PayslipsModule } from './modules/payslips/payslips.module.js';
import { TasksModule } from './modules/tasks/tasks.module.js';
import { UploadsModule } from './modules/uploads/uploads.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module.js';

import {
  NotificationIntegrationModule,
} from './integrations/notifications/notification-integration.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>(
          'MONGODB_URI',
        ),
        serverSelectionTimeoutMS: 10000,
      }),
    }),

    AuthModule,
    UsersModule,
    EmployeesModule,
    DepartmentsModule,
    ShiftsModule,
    AttendanceModule,
    AttendanceCorrectionsModule,
    LeavesModule,
    PayrollModule,
    PayslipsModule,
    TasksModule,
    UploadsModule,
    NotificationsModule,
    DashboardModule,
    ReportsModule,
    AuditLogsModule,

    NotificationIntegrationModule,
  ],

  controllers: [
    AppController,
  ],

  providers: [
    AppService,
  ],
})
export class AppModule {}
