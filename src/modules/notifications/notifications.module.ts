
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  Notification,
  NotificationSchema,
} from './schemas/notifications.schema.js';

import {
  User,
  UserSchema,
} from '../users/schemas/users.schema.js';

import {
  AuthModule,
} from '../auth/auth.module.js';

import {
  UsersModule,
} from '../users/users.module.js';

import {
  NotificationsController,
} from './notifications.controller.js';

import {
  NotificationsService,
} from './notifications.service.js';

import {
  NotificationGateway,
} from '../../integrations/notifications/notification.gateway.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Notification.name,
        schema: NotificationSchema,
      },
      {
        name: User.name,
        schema: UserSchema,
      },
    ]),

    AuthModule,
    UsersModule,
  ],

  controllers: [
    NotificationsController,
  ],

  providers: [
    NotificationsService,
    NotificationGateway,
  ],

  exports: [
    NotificationsService,
    NotificationGateway,
  ],
})
export class NotificationsModule {}
