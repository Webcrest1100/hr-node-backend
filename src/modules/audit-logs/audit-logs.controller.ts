
import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
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
  AuditLogsService,
} from './audit-logs.service.js';

import {
  AuditLogsQueryDto,
} from './dto/create-audit-logs.dto.js';

import {
  AuditLogsSummaryDto,
} from './dto/update-audit-logs.dto.js';

@ApiTags('Audit Logs & Activity Tracking')
@ApiBearerAuth()
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditLogsController {
  constructor(
    private readonly auditLogsService:
      AuditLogsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List system activity audit logs',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated audit history',
  })
  @ApiResponse({
    status: 403,
    description: 'Admin access required',
  })
  findAll(
    @Query() query: AuditLogsQueryDto,
  ) {
    return this.auditLogsService.findAll(
      query,
    );
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get audit activity statistics',
  })
  @ApiResponse({
    status: 200,
    description: 'Action-wise activity counts',
  })
  summary(
    @Query() query: AuditLogsSummaryDto,
  ) {
    return this.auditLogsService.summary(
      query,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get audit log details by ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit log details',
  })
  @ApiResponse({
    status: 404,
    description: 'Audit log not found',
  })
  findOne(
    @Param('id') id: string,
  ) {
    return this.auditLogsService.findOne(
      id,
    );
  }
}
