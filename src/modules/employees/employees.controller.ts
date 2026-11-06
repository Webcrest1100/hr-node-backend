
import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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

import {
  EmployeesService,
} from './employees.service.js';

import {
  CreateEmployeeDto,
} from './dto/create-employee.dto.js';

import {
  UpdateEmployeeDto,
} from './dto/update-employee.dto.js';

import {
  UpdateEmploymentStatusDto,
} from './dto/update-employment-status.dto.js';

@ApiTags('Employees Management')
@ApiBearerAuth()
@Controller('employees')
@UseGuards(
  JwtAuthGuard,
  RolesGuard,
)
export class EmployeesController {
  constructor(
    private readonly employeesService:
      EmployeesService,
  ) {}

  @Post()
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
  )
  @ApiOperation({
    summary: 'Create employee profile',
  })
  create(
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.employeesService.create(dto);
  }

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
  )
  @ApiOperation({
    summary: 'List employee profiles',
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
  ) {
    return this.employeesService.findAll(
      page,
      limit,
    );
  }

  @Get('me')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Get my employee profile',
  })
  findMine(
    @Req()
    request: {
      user: {
        id: string;
      };
    },
  ) {
    return this.employeesService.findMine(
      request.user.id,
    );
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
  )
  @ApiOperation({
    summary: 'Get employee profile by ID',
  })
  findOne(
    @Param('id') id: string,
  ) {
    return this.employeesService.findOne(
      id,
    );
  }

  @Patch(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
  )
  @ApiOperation({
    summary: 'Update employee profile',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(
      id,
      dto,
    );
  }

  @Patch(':id/status')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
  )
  @ApiOperation({
    summary: 'Update employment status',
  })
  updateStatus(
    @Param('id') id: string,

    @Body()
    dto: UpdateEmploymentStatusDto,
  ) {
    return this.employeesService.updateStatus(
      id,
      dto,
    );
  }
}
