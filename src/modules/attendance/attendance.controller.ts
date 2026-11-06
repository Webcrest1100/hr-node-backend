import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
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

import { AttendanceService } from './attendance.service.js';
import { CreateAttendanceDto } from './dto/create-attendance.dto.js';
import { UpdateAttendanceDto } from './dto/update-attendance.dto.js';

type AuthRequest = {
  user: {
    id: string;
    email: string;
    role: string;
  };
};

@ApiTags('Attendance Management')
@ApiBearerAuth()
@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
  ) {}

  @Post('check-in')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'GPS-based employee check-in',
  })
  checkIn(
    @Req() request: AuthRequest,
    @Body() dto: CreateAttendanceDto,
  ) {
    return this.attendanceService.checkIn(
      request.user.id,
      dto,
    );
  }

  @Post('check-out')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'GPS-based employee check-out',
  })
  checkOut(
    @Req() request: AuthRequest,
    @Body() dto: UpdateAttendanceDto,
  ) {
    return this.attendanceService.checkOut(
      request.user.id,
      dto,
    );
  }

  @Post('break/start')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Start attendance break',
  })
  startBreak(@Req() request: AuthRequest) {
    return this.attendanceService.startBreak(
      request.user.id,
    );
  }

  @Post('break/end')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'End attendance break',
  })
  endBreak(@Req() request: AuthRequest) {
    return this.attendanceService.endBreak(
      request.user.id,
    );
  }

  @Get('me/today')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Get my current attendance',
  })
  findMineToday(@Req() request: AuthRequest) {
    return this.attendanceService.findMineToday(
      request.user.id,
    );
  }

  @Get('me/history')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Get my attendance history',
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
  findMineHistory(
    @Req() request: AuthRequest,

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
    return this.attendanceService.findMineHistory(
      request.user.id,
      page,
      limit,
    );
  }

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
  )
  @ApiOperation({
    summary: 'List all attendance records',
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
    return this.attendanceService.findAll(
      page,
      limit,
    );
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
  )
  @ApiOperation({
    summary: 'Get attendance record by ID',
  })
  findOne(@Param('id') id: string) {
    return this.attendanceService.findOne(id);
  }
}
