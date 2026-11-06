
import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
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

import { ShiftsService } from './shifts.service.js';
import { CreateShiftsDto } from './dto/create-shifts.dto.js';
import { UpdateShiftsDto } from './dto/update-shifts.dto.js';
import { AssignShiftDto } from './dto/assign-shift.dto.js';
import { UpdateShiftStatusDto } from './dto/update-shift-status.dto.js';

@ApiTags('Shifts Management')
@ApiBearerAuth()
@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShiftsController {
  constructor(
    private readonly shiftsService: ShiftsService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Create a work shift' })
  create(@Body() dto: CreateShiftsDto) {
    return this.shiftsService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'List shifts' })
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
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,

    @Query('limit', new DefaultValuePipe(10), ParseIntPipe)
    limit: number,
  ) {
    return this.shiftsService.findAll(page, limit);
  }

  @Get('me')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Get my assigned shift',
  })
  findMine(
    @Req()
    request: {
      user: { id: string };
    },
  ) {
    return this.shiftsService.findMine(
      request.user.id,
    );
  }

  @Post('assignments')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Assign or reassign employee shift',
  })
  assign(
    @Body() dto: AssignShiftDto,
    @Req() request: { user: { id: string } },
  ) {
    return this.shiftsService.assign(
      dto,
      request.user.id,
    );
  }

  @Get('assignments/employee/:employeeId')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Get employee shift assignment',
  })
  findEmployeeAssignment(
    @Param('employeeId') employeeId: string,
  ) {
    return this.shiftsService.findEmployeeAssignment(
      employeeId,
    );
  }

  @Delete('assignments/employee/:employeeId')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Remove employee shift assignment',
  })
  removeAssignment(
    @Param('employeeId') employeeId: string,
  ) {
    return this.shiftsService.removeAssignment(
      employeeId,
    );
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Get shift details',
  })
  findOne(@Param('id') id: string) {
    return this.shiftsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Update shift details',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateShiftsDto,
  ) {
    return this.shiftsService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Activate or deactivate shift',
  })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateShiftStatusDto,
  ) {
    return this.shiftsService.updateStatus(
      id,
      dto.isActive,
    );
  }
}
