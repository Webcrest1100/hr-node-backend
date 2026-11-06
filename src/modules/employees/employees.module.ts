
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  User,
  UserSchema,
} from '../users/schemas/users.schema.js';

import {
  Employee,
  EmployeeSchema,
} from './schemas/employee.schema.js';

import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';

import { EmployeesService } from './employees.service.js';
import { EmployeesController } from './employees.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Employee.name,
        schema: EmployeeSchema,
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
    EmployeesController,
  ],

  providers: [
    EmployeesService,
  ],

  exports: [
    EmployeesService,
  ],
})
export class EmployeesModule {}
