
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  Payslip,
  PayslipSchema,
} from './schemas/payslips.schema.js';

import {
  Payroll,
  PayrollSchema,
} from '../payroll/schemas/payroll.schema.js';

import {
  Employee,
  EmployeeSchema,
} from '../employees/schemas/employee.schema.js';

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
  PayslipsController,
} from './payslips.controller.js';

import {
  PayslipsService,
} from './payslips.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Payslip.name,
        schema: PayslipSchema,
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

    AuthModule,
    UsersModule,
  ],

  controllers: [
    PayslipsController,
  ],

  providers: [
    PayslipsService,
  ],

  exports: [
    PayslipsService,
  ],
})
export class PayslipsModule {}
