
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  Upload,
  UploadSchema,
} from './schemas/uploads.schema.js';

import {
  Task,
  TaskSchema,
} from '../tasks/schemas/tasks.schema.js';

import {
  AuthModule,
} from '../auth/auth.module.js';

import {
  UsersModule,
} from '../users/users.module.js';

import {
  UploadsController,
} from './uploads.controller.js';

import {
  UploadsService,
} from './uploads.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Upload.name,
        schema: UploadSchema,
      },
      {
        name: Task.name,
        schema: TaskSchema,
      },
    ]),

    AuthModule,
    UsersModule,
  ],

  controllers: [
    UploadsController,
  ],

  providers: [
    UploadsService,
  ],

  exports: [
    UploadsService,
  ],
})
export class UploadsModule {}
