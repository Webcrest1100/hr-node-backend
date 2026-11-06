
import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
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
  PayslipsService,
} from './payslips.service.js';

import {
  CreatePayslipsDto,
} from './dto/create-payslips.dto.js';

import {
  UpdatePayslipsDto,
} from './dto/update-payslips.dto.js';

type AuthRequest = {
  user: {
    id: string;
    role: string;
    email: string;
  };
};

@ApiTags('Payslips Management')
@ApiBearerAuth()
@Controller('payslips')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayslipsController {
  constructor(
    private readonly payslipsService: PayslipsService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Generate payslip from approved payroll',
  })
  create(
    @Req() request: AuthRequest,
    @Body() dto: CreatePayslipsDto,
  ) {
    return this.payslipsService.create(
      dto,
      request.user.id,
    );
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'List issued payslips',
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

    @Query('month')
    month?: string,
  ) {
    return this.payslipsService.findAll(
      page,
      limit,
      month,
    );
  }

  @Get('me')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Get my issued payslips',
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
    return this.payslipsService.findMine(
      request.user.id,
      page,
      limit,
    );
  }

  @Get(':id/pdf')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Download payslip PDF',
  })
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    description: 'Payslip PDF file',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async downloadPdf(
    @Param('id') id: string,
    @Req() request: AuthRequest,
  ) {
    const result = await this.payslipsService.downloadPdf(
      id,
      request.user.id,
      request.user.role,
    );

    return new StreamableFile(result.pdf, {
      type: 'application/pdf',
      disposition:
        `attachment; filename="${result.filename}"`,
      length: result.pdf.length,
    });
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Get payslip details',
  })
  findOne(
    @Param('id') id: string,
    @Req() request: AuthRequest,
  ) {
    return this.payslipsService.findOne(
      id,
      request.user.id,
      request.user.role,
    );
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update payslip internal notes only',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePayslipsDto,
  ) {
    return this.payslipsService.update(
      id,
      dto,
    );
  }
}
