
import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseBoolPipe,
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
  NotificationType,
} from './schemas/notifications.schema.js';

import {
  NotificationsService,
} from './notifications.service.js';

import {
  CreateNotificationsDto,
} from './dto/create-notifications.dto.js';

import {
  UpdateNotificationsDto,
} from './dto/update-notifications.dto.js';

type AuthRequest = {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
};

@ApiTags('Notifications Management')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService:
      NotificationsService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Send notification to a user',
  })
  create(
    @Body() dto: CreateNotificationsDto,
    @Req() req: AuthRequest,
  ) {
    return this.notificationsService.create(
      dto,
      req.user.id,
    );
  }

  @Get('me/unread-count')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Get my unread notification count',
  })
  unreadCount(@Req() req: AuthRequest) {
    return this.notificationsService.unreadCount(
      req.user.id,
    );
  }

  @Patch('me/read-all')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Mark all my active notifications as read',
  })
  markAllRead(@Req() req: AuthRequest) {
    return this.notificationsService.markAllRead(
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
    summary: 'List my notifications',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 20,
  })
  @ApiQuery({
    name: 'unreadOnly',
    required: false,
    type: Boolean,
    example: false,
  })
  @ApiQuery({
    name: 'includeArchived',
    required: false,
    type: Boolean,
    example: false,
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
      new DefaultValuePipe(20),
      ParseIntPipe,
    )
    limit: number,

    @Query(
      'unreadOnly',
      new DefaultValuePipe(false),
      ParseBoolPipe,
    )
    unreadOnly: boolean,

    @Query(
      'includeArchived',
      new DefaultValuePipe(false),
      ParseBoolPipe,
    )
    includeArchived: boolean,
  ) {
    return this.notificationsService.findMine(
      req.user.id,
      page,
      limit,
      unreadOnly,
      includeArchived,
    );
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Admin list of notifications',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 20,
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: NotificationType,
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
      new DefaultValuePipe(20),
      ParseIntPipe,
    )
    limit: number,

    @Query('type')
    type?: string,
  ) {
    return this.notificationsService.findAll(
      page,
      limit,
      type,
    );
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Get authorized notification details',
  })
  findOne(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ) {
    return this.notificationsService.findOne(
      id,
      req.user.id,
      req.user.role,
    );
  }

  @Patch(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Update own notification read/archive status',
  })
  update(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Body() dto: UpdateNotificationsDto,
  ) {
    return this.notificationsService.update(
      id,
      req.user.id,
      dto,
    );
  }
}
