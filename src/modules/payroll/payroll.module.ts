
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  Payroll,
  PayrollSchema,
} from './schemas/payroll.schema.js';

import {
  SalaryStructure,
  SalaryStructureSchema,
} from './schemas/salary-structure.schema.js';

import {
  Employee,
  EmployeeSchema,
} from '../employees/schemas/employee.schema.js';

import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';

import { PayrollController } from './payroll.controller.js';
import { PayrollService } from './payroll.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Payroll.name,
        schema: PayrollSchema,
      },
      {
        name: SalaryStructure.name,
        schema: SalaryStructureSchema,
      },
      {
        name: Employee.name,
        schema: EmployeeSchema,
      },
    ]),

    AuthModule,
    UsersModule,
  ],

  controllers: [
    PayrollController,
  ],

  providers: [
    PayrollService,
  ],

  exports: [
    PayrollService,
  ],
})
export class PayrollModule {}
