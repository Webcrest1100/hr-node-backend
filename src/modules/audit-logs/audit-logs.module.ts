
import { Module } from '@nestjs/common';

import {
  APP_INTERCEPTOR,
} from '@nestjs/core';

import {
  MongooseModule,
} from '@nestjs/mongoose';

import {
  AuditLog,
  AuditLogSchema,
} from './schemas/audit-logs.schema.js';

import {
  AuthModule,
} from '../auth/auth.module.js';

import {
  UsersModule,
} from '../users/users.module.js';

import {
  AuditLogsController,
} from './audit-logs.controller.js';

import {
  AuditLogsService,
} from './audit-logs.service.js';

import {
  AuditLogsInterceptor,
} from './audit-logs.interceptor.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: AuditLog.name,
        schema: AuditLogSchema,
      },
    ]),

    AuthModule,
    UsersModule,
  ],

  controllers: [
    AuditLogsController,
  ],

  providers: [
    AuditLogsService,

    AuditLogsInterceptor,

    {
      provide: APP_INTERCEPTOR,
      useExisting: AuditLogsInterceptor,
    },
  ],

  exports: [
    AuditLogsService,
  ],
})
export class AuditLogsModule {}
