
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  Task,
  TaskSchema,
} from './schemas/tasks.schema.js';

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
  TasksController,
} from './tasks.controller.js';

import {
  TasksService,
} from './tasks.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Task.name,
        schema: TaskSchema,
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
    TasksController,
  ],

  providers: [
    TasksService,
  ],

  exports: [
    TasksService,
  ],
})
export class TasksModule {}
