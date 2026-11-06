
import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import {
  JwtAuthGuard,
} from '../../common/guards/jwt-auth.guard.js';

import {
  RolesGuard,
} from '../../common/guards/roles.guard.js';

import {
  Roles,
} from '../../common/decorators/roles.decorator.js';

import {
  UserRole,
} from '../users/schemas/users.schema.js';

import { PayrollService } from './payroll.service.js';
import { CreatePayrollDto } from './dto/create-payroll.dto.js';
import { UpdatePayrollDto } from './dto/update-payroll.dto.js';
import { SalaryStructureDto } from './dto/salary-structure.dto.js';

type AuthRequest = {
  user: {
    id: string;
    role: string;
  };
};

@ApiTags('Payroll & Salary Management')
@ApiBearerAuth()
@Controller('payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayrollController {
  constructor(
    private readonly payrollService: PayrollService,
  ) {}

  @Put('salaries/:employeeId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create or update employee salary structure',
  })
  configureSalary(
    @Param('employeeId') employeeId: string,
    @Body() dto: SalaryStructureDto,
  ) {
    return this.payrollService.configureSalary(
      employeeId,
      dto,
    );
  }

  @Get('salaries/:employeeId')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Get employee salary structure',
  })
  getSalary(
    @Param('employeeId') employeeId: string,
  ) {
    return this.payrollService.getSalary(employeeId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Generate monthly payroll draft',
  })
  create(
    @Req() req: AuthRequest,
    @Body() dto: CreatePayrollDto,
  ) {
    return this.payrollService.create(
      dto,
      req.user.id,
    );
  }

  @Get('me')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Get my approved payroll history',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 10,
  })
  findMine(
    @Req() req: AuthRequest,

    @Query(
      'page',
      new DefaultValuePipe(1),
      ParseIntPipe,
    )
    page: number,

    @Query(
      'limit',
      new DefaultValuePipe(10),
      ParseIntPipe,
    )
    limit: number,
  ) {
    return this.payrollService.findMine(
      req.user.id,
      page,
      limit,
    );
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'List monthly payroll records',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 10,
  })
  @ApiQuery({
    name: 'month',
    required: false,
    example: '2026-11',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['draft', 'approved', 'paid'],
  })
  findAll(
    @Query(
      'page',
      new DefaultValuePipe(1),
      ParseIntPipe,
    )
    page: number,

    @Query(
      'limit',
      new DefaultValuePipe(10),
      ParseIntPipe,
    )
    limit: number,

    @Query('month') month?: string,

    @Query('status') status?: string,
  ) {
    return this.payrollService.findAll(
      page,
      limit,
      month,
      status,
    );
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Get payroll details by ID',
  })
  findOne(@Param('id') id: string) {
    return this.payrollService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Update draft payroll adjustments',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePayrollDto,
  ) {
    return this.payrollService.update(id, dto);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Approve monthly payroll',
  })
  approve(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ) {
    return this.payrollService.approve(
      id,
      req.user.id,
    );
  }

  @Patch(':id/mark-paid')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Record payroll as paid; no bank transfer',
  })
  markPaid(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ) {
    return this.payrollService.markPaid(
      id,
      req.user.id,
    );
  }
}
