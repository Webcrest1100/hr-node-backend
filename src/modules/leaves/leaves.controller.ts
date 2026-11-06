
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

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../users/schemas/users.schema.js';

import { LeavesService } from './leaves.service.js';
import { CreateLeavesDto } from './dto/create-leaves.dto.js';
import { UpdateLeavesDto, ReviewLeaveDto } from './dto/update-leaves.dto.js';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto.js';
import { AllocateLeaveBalanceDto } from './dto/allocate-leave-balance.dto.js';

type AuthRequest = {
  user: {
    id: string;
    role: string;
  };
};

@ApiTags('Leave Management & Approvals')
@ApiBearerAuth()
@Controller('leaves')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeavesController {
  constructor(
    private readonly leavesService: LeavesService,
  ) {}

  @Post('types')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create leave type' })
  createType(@Body() dto: CreateLeaveTypeDto) {
    return this.leavesService.createType(dto);
  }

  @Get('types')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'List leave types' })
  findTypes() {
    return this.leavesService.findTypes();
  }

  @Post('balances')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Allocate annual leave balance' })
  allocateBalance(@Body() dto: AllocateLeaveBalanceDto) {
    return this.leavesService.allocateBalance(dto);
  }

  @Get('balances/employee/:employeeId')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'View employee annual leave balances',
  })
  findEmployeeBalances(
    @Param('employeeId') employeeId: string,
  ) {
    return this.leavesService.findEmployeeBalances(
      employeeId,
    );
  }

  @Get('me/balances')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'View my leave balances' })
  findMineBalances(@Req() req: AuthRequest) {
    return this.leavesService.findMineBalances(
      req.user.id,
    );
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Submit leave request' })
  create(
    @Req() req: AuthRequest,
    @Body() dto: CreateLeavesDto,
  ) {
    return this.leavesService.create(
      req.user.id,
      dto,
    );
  }

  @Get('me')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'My leave request history' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  findMine(
    @Req() req: AuthRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe)
    limit: number,
  ) {
    return this.leavesService.findMine(
      req.user.id,
      page,
      limit,
    );
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'List employee leave requests' })
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
    return this.leavesService.findAll(
      page,
      limit,
      status,
    );
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get leave details' })
  findOne(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ) {
    return this.leavesService.findOne(
      id,
      req.user.id,
      req.user.role,
    );
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Update own pending leave' })
  update(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Body() dto: UpdateLeavesDto,
  ) {
    return this.leavesService.update(
      id,
      req.user.id,
      dto,
    );
  }

  @Patch(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Cancel own pending leave' })
  cancel(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ) {
    return this.leavesService.cancel(
      id,
      req.user.id,
    );
  }

  @Patch(':id/review')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Approve or reject leave' })
  review(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Body() dto: ReviewLeaveDto,
  ) {
    return this.leavesService.review(
      id,
      req.user.id,
      dto,
    );
  }
}
