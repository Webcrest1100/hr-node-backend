
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import {
  User,
  UserSchema,
} from './schemas/users.schema.js';

import { UsersService } from './users.service.js';
import { UsersManagementService } from './users-management.service.js';
import { UsersController } from './users.controller.js';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
      },
    ]),
    ConfigModule,
    JwtModule.register({}),
  ],
  controllers: [
    UsersController,
  ],
  providers: [
    UsersService,
    UsersManagementService,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    UsersService,
    UsersManagementService,
  ],
})
export class UsersModule {}