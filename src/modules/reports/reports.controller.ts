
import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  Param,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
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
  ReportsService,
} from './reports.service.js';

import {
  ReportQueryDto,
} from './dto/create-reports.dto.js';

import {
  ReportExportDto,
} from './dto/update-reports.dto.js';

import {
  ReportKind,
} from './schemas/reports.schema.js';

type AuthRequest = {
  user: {
    id: string;
    role: UserRole;
  };
};

@ApiTags('Reports Management')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly reportsService:
      ReportsService,
  ) {}

  @Get('attendance')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Get attendance report',
  })
  attendance(
    @Query() query: ReportQueryDto,
  ) {
    return this.reportsService.findReport(
      ReportKind.ATTENDANCE,
      query,
    );
  }

  @Get('leaves')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Get leave requests report',
  })
  leaves(
    @Query() query: ReportQueryDto,
  ) {
    return this.reportsService.findReport(
      ReportKind.LEAVES,
      query,
    );
  }

  @Get('tasks')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Get task progress report',
  })
  tasks(
    @Query() query: ReportQueryDto,
  ) {
    return this.reportsService.findReport(
      ReportKind.TASKS,
      query,
    );
  }

  @Get('payroll')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get monthly payroll report — Admin only',
  })
  payroll(
    @Query() query: ReportQueryDto,
  ) {
    return this.reportsService.findReport(
      ReportKind.PAYROLL,
      query,
    );
  }

  @Get(':kind/csv')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @ApiProduces('text/csv')
  @ApiOperation({
    summary:
      'Export report as CSV — payroll restricted to Admin',
  })
  async exportCsv(
    @Param('kind') kind: string,
    @Query() query: ReportExportDto,
    @Req() req: AuthRequest,
  ) {
    if (
      kind === ReportKind.PAYROLL &&
      req.user.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only Admin can export payroll CSV',
      );
    }

    const result = await this.reportsService.exportCsv(
      kind,
      query,
    );

    return new StreamableFile(result.buffer, {
      type: 'text/csv; charset=utf-8',
      disposition:
        `attachment; filename="${result.filename}"`,
      length: result.buffer.length,
    });
  }
}
