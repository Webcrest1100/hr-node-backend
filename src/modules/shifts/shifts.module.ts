
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  Shift,
  ShiftSchema,
} from './schemas/shifts.schema.js';

import {
  ShiftAssignment,
  ShiftAssignmentSchema,
} from './schemas/shift-assignment.schema.js';

import {
  Employee,
  EmployeeSchema,
} from '../employees/schemas/employee.schema.js';

import {
  User,
  UserSchema,
} from '../users/schemas/users.schema.js';

import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';

import { ShiftsController } from './shifts.controller.js';
import { ShiftsService } from './shifts.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Shift.name,
        schema: ShiftSchema,
      },
      {
        name: ShiftAssignment.name,
        schema: ShiftAssignmentSchema,
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

    AuthModule,
    UsersModule,
  ],

  controllers: [
    ShiftsController,
  ],

  providers: [
    ShiftsService,
  ],

  exports: [
    ShiftsService,
  ],
})
export class ShiftsModule {}
