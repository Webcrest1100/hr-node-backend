
import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../users/schemas/users.schema.js';

import { DashboardService } from './dashboard.service.js';
import { DashboardQueryDto } from './dto/create-dashboard.dto.js';
import { DashboardTrendQueryDto } from './dto/update-dashboard.dto.js';

@ApiTags('Dashboard Management')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
  ) {}

  @Get('overview')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Admin and HR dashboard overview',
  })
  overview(@Query() query: DashboardQueryDto) {
    return this.dashboardService.overview(query.month);
  }

  @Get('me')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Get my personal HR dashboard',
  })
  mine(
    @Req() req: { user: { id: string } },
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardService.mine(
      req.user.id,
      query.month,
    );
  }

  @Get('attendance-trends')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Daily attendance and lateness trends',
  })
  attendanceTrends(
    @Query() query: DashboardTrendQueryDto,
  ) {
    return this.dashboardService.attendanceTrends(
      query.month,
    );
  }
}
