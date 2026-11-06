
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
  AttendanceCorrectionsService,
} from './attendance-corrections.service.js';

import {
  CreateAttendanceCorrectionsDto,
} from './dto/create-attendance-corrections.dto.js';

import {
  UpdateAttendanceCorrectionsDto,
  ReviewAttendanceCorrectionDto,
} from './dto/update-attendance-corrections.dto.js';

type AuthRequest = {
  user: {
    id: string;
    email: string;
    role: string;
  };
};

@ApiTags('Attendance Corrections Management')
@ApiBearerAuth()
@Controller('attendance-corrections')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceCorrectionsController {
  constructor(
    private readonly correctionsService:
      AttendanceCorrectionsService,
  ) {}

  @Post()
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Request correction for own attendance',
  })
  create(
    @Req() request: AuthRequest,
    @Body() dto: CreateAttendanceCorrectionsDto,
  ) {
    return this.correctionsService.create(
      request.user.id,
      dto,
    );
  }

  @Get('me')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'List my attendance correction requests',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  findMine(
    @Req() request: AuthRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe)
    limit: number,
  ) {
    return this.correctionsService.findMine(
      request.user.id,
      page,
      limit,
    );
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'List attendance corrections for review',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
  })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe)
    limit: number,
    @Query('status') status?: string,
  ) {
    return this.correctionsService.findAll(
      page,
      limit,
      status,
    );
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Get attendance correction details',
  })
  findOne(
    @Param('id') id: string,
    @Req() request: AuthRequest,
  ) {
    return this.correctionsService.findOne(
      id,
      request.user.id,
      request.user.role,
    );
  }

  @Patch(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Update own pending correction request',
  })
  update(
    @Param('id') id: string,
    @Req() request: AuthRequest,
    @Body() dto: UpdateAttendanceCorrectionsDto,
  ) {
    return this.correctionsService.update(
      id,
      request.user.id,
      dto,
    );
  }

  @Patch(':id/review')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Approve or reject attendance correction',
  })
  review(
    @Param('id') id: string,
    @Req() request: AuthRequest,
    @Body() dto: ReviewAttendanceCorrectionDto,
  ) {
    return this.correctionsService.review(
      id,
      request.user.id,
      dto,
    );
  }

  @Patch(':id/cancel')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Cancel own pending correction request',
  })
  cancel(
    @Param('id') id: string,
    @Req() request: AuthRequest,
  ) {
    return this.correctionsService.cancel(
      id,
      request.user.id,
    );
  }
}
