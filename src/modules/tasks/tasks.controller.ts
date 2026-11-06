
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
  TasksService,
} from './tasks.service.js';

import type {
  TaskActor,
} from './tasks.service.js';

import {
  CreateTasksDto,
} from './dto/create-tasks.dto.js';

import {
  UpdateTasksDto,
  UpdateTaskStatusDto,
  UpdateTaskPositionDto,
  AddTaskProgressDto,
  AddTaskCommentDto,
  AddTaskChecklistDto,
  UpdateTaskChecklistDto,
} from './dto/update-tasks.dto.js';

type AuthRequest = {
  user: TaskActor;
};

@ApiTags('Tasks Management')
@ApiBearerAuth()
@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Create and assign a task',
  })
  create(
    @Req() req: AuthRequest,
    @Body() dto: CreateTasksDto,
  ) {
    return this.tasksService.create(
      dto,
      req.user,
    );
  }

  @Get('me')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Get my assigned tasks',
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
    @Req() req: AuthRequest,
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
    return this.tasksService.findMine(
      req.user.id,
      page,
      limit,
    );
  }

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'List tasks with Kanban filters',
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
    name: 'status',
    required: false,
    enum: [
      'todo',
      'in_progress',
      'in_review',
      'blocked',
      'done',
    ],
  })
  @ApiQuery({
    name: 'priority',
    required: false,
    enum: [
      'low',
      'medium',
      'high',
      'urgent',
    ],
  })
  findAll(
    @Req() req: AuthRequest,

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

    @Query('status')
    status?: string,

    @Query('priority')
    priority?: string,
  ) {
    return this.tasksService.findAll(
      req.user,
      page,
      limit,
      status,
      priority,
    );
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Get task details with comments and checklist',
  })
  findOne(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ) {
    return this.tasksService.findOne(
      id,
      req.user,
    );
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Update task details and assignments',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTasksDto,
    @Req() req: AuthRequest,
  ) {
    return this.tasksService.update(
      id,
      dto,
      req.user,
    );
  }

  @Patch(':id/status')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Move task to another Kanban status',
  })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTaskStatusDto,
    @Req() req: AuthRequest,
  ) {
    return this.tasksService.updateStatus(
      id,
      dto,
      req.user,
    );
  }

  @Patch(':id/position')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Update task drag/drop position',
  })
  updatePosition(
    @Param('id') id: string,
    @Body() dto: UpdateTaskPositionDto,
    @Req() req: AuthRequest,
  ) {
    return this.tasksService.updatePosition(
      id,
      dto,
      req.user,
    );
  }

  @Post(':id/progress')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Add task progress and progress note',
  })
  addProgress(
    @Param('id') id: string,
    @Body() dto: AddTaskProgressDto,
    @Req() req: AuthRequest,
  ) {
    return this.tasksService.addProgress(
      id,
      dto,
      req.user,
    );
  }

  @Post(':id/comments')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Add task comment',
  })
  addComment(
    @Param('id') id: string,
    @Body() dto: AddTaskCommentDto,
    @Req() req: AuthRequest,
  ) {
    return this.tasksService.addComment(
      id,
      dto,
      req.user,
    );
  }

  @Delete(':id/comments/:commentId')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Delete permitted task comment',
  })
  removeComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Req() req: AuthRequest,
  ) {
    return this.tasksService.removeComment(
      id,
      commentId,
      req.user,
    );
  }

  @Post(':id/checklist')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Add task checklist item',
  })
  addChecklistItem(
    @Param('id') id: string,
    @Body() dto: AddTaskChecklistDto,
    @Req() req: AuthRequest,
  ) {
    return this.tasksService.addChecklistItem(
      id,
      dto,
      req.user,
    );
  }

  @Patch(':id/checklist/:itemId')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Complete or uncomplete checklist item',
  })
  updateChecklistItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateTaskChecklistDto,
    @Req() req: AuthRequest,
  ) {
    return this.tasksService.updateChecklistItem(
      id,
      itemId,
      dto,
      req.user,
    );
  }

  @Delete(':id/checklist/:itemId')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Remove task checklist item',
  })
  removeChecklistItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Req() req: AuthRequest,
  ) {
    return this.tasksService.removeChecklistItem(
      id,
      itemId,
      req.user,
    );
  }
}
