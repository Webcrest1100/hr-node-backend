
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Task,
  TaskPriority,
  TaskStatus,
} from './schemas/tasks.schema.js';

import { User, UserRole } from '../users/schemas/users.schema.js';

import { CreateTasksDto } from './dto/create-tasks.dto.js';

import {
  UpdateTasksDto,
  UpdateTaskStatusDto,
  UpdateTaskPositionDto,
  AddTaskProgressDto,
  AddTaskCommentDto,
  AddTaskChecklistDto,
  UpdateTaskChecklistDto,
} from './dto/update-tasks.dto.js';

export type TaskActor = {
  id: string;
  role: UserRole;
};

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name)
    private readonly taskModel: Model<Task>,

    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  private oid(value: string): Types.ObjectId {
    if (!/^[0-9a-fA-F]{24}$/.test(value)) {
      throw new BadRequestException('Invalid MongoDB ID');
    }

    return new Types.ObjectId(value);
  }

  private isStaff(actor: TaskActor): boolean {
    return (
      actor.role === UserRole.ADMIN ||
      actor.role === UserRole.HR
    );
  }

  private validatePagination(
    page: number,
    limit: number,
  ): void {
    if (
      !Number.isSafeInteger(page) ||
      !Number.isSafeInteger(limit) ||
      page < 1 ||
      limit < 1 ||
      limit > 100
    ) {
      throw new BadRequestException(
        'Page must be >= 1 and limit between 1 and 100',
      );
    }
  }

  private validateDate(date: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException(
        'Date must use YYYY-MM-DD',
      );
    }

    const parsed = new Date(
      `${date}T00:00:00.000Z`,
    );

    if (
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date
    ) {
      throw new BadRequestException(
        'Invalid calendar date',
      );
    }
  }

  private normalizeTitle(
    title: string,
    minLength: number,
  ): string {
    const normalized = title.trim();

    if (normalized.length < minLength) {
      throw new BadRequestException(
        `Text must contain at least ${minLength} characters`,
      );
    }

    return normalized;
  }

  private async validateAssignees(
    userIds: string[],
  ): Promise<Types.ObjectId[]> {
    if (
      !Array.isArray(userIds) ||
      userIds.length < 1 ||
      userIds.length > 20
    ) {
      throw new BadRequestException(
        'Assign between 1 and 20 users',
      );
    }

    const normalized = userIds.map((id) =>
      this.oid(id),
    );

    const unique = new Set(
      normalized.map((id) => id.toString()),
    );

    if (unique.size !== normalized.length) {
      throw new BadRequestException(
        'Duplicate assignee IDs are not allowed',
      );
    }

    const users = await this.userModel
      .find({
        _id: { $in: normalized },
        isActive: true,
      })
      .select('_id')
      .lean();

    if (users.length !== normalized.length) {
      throw new BadRequestException(
        'All assignees must be existing active users',
      );
    }

    return normalized;
  }

  private accessFilter(
    taskId: string,
    actor: TaskActor,
  ) {
    const filter: {
      _id: Types.ObjectId;
      assigneeUserIds?: Types.ObjectId;
    } = {
      _id: this.oid(taskId),
    };

    if (!this.isStaff(actor)) {
      filter.assigneeUserIds = this.oid(actor.id);
    }

    return filter;
  }

  private async accessibleTask(
    taskId: string,
    actor: TaskActor,
  ) {
    const task = await this.taskModel
      .findOne(this.accessFilter(taskId, actor))
      .lean();

    if (!task) {
      throw new NotFoundException(
        'Task not found or access denied',
      );
    }

    return task;
  }

  async create(
    dto: CreateTasksDto,
    actor: TaskActor,
  ) {
    if (!this.isStaff(actor)) {
      throw new ForbiddenException(
        'Only Admin or HR can create tasks',
      );
    }

    const assigneeUserIds =
      await this.validateAssignees(
        dto.assigneeUserIds,
      );

    const title = this.normalizeTitle(dto.title, 3);

    if (dto.dueDate !== undefined) {
      this.validateDate(dto.dueDate);
    }

    const task = await this.taskModel.create({
      title,
      description: dto.description?.trim() ?? '',
      createdBy: this.oid(actor.id),
      assigneeUserIds,
      status: TaskStatus.TODO,
      priority: dto.priority ?? TaskPriority.MEDIUM,
      position: dto.position ?? 0,
      progressPercent: 0,
      dueDate: dto.dueDate ?? null,
      comments: [],
      checklist: [],
      progressUpdates: [],
      completedAt: null,
    });

    return {
      message: 'Task created successfully',
      task,
    };
  }

  private async paginate(
    filter: Record<string, unknown>,
    page: number,
    limit: number,
  ) {
    this.validatePagination(page, limit);

    const [data, total] = await Promise.all([
      this.taskModel
        .find(filter)
        .sort({
          status: 1,
          position: 1,
          createdAt: -1,
        })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      this.taskModel.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findAll(
    actor: TaskActor,
    page = 1,
    limit = 10,
    status?: string,
    priority?: string,
  ) {
    if (
      status &&
      !Object.values(TaskStatus).includes(
        status as TaskStatus,
      )
    ) {
      throw new BadRequestException(
        'Invalid task status',
      );
    }

    if (
      priority &&
      !Object.values(TaskPriority).includes(
        priority as TaskPriority,
      )
    ) {
      throw new BadRequestException(
        'Invalid task priority',
      );
    }

    const filter: Record<string, unknown> = {};

    if (!this.isStaff(actor)) {
      filter.assigneeUserIds = this.oid(actor.id);
    }

    if (status) {
      filter.status = status;
    }

    if (priority) {
      filter.priority = priority;
    }

    return this.paginate(filter, page, limit);
  }

  async findMine(
    userId: string,
    page = 1,
    limit = 10,
  ) {
    return this.paginate(
      { assigneeUserIds: this.oid(userId) },
      page,
      limit,
    );
  }

  async findOne(
    taskId: string,
    actor: TaskActor,
  ) {
    return {
      task: await this.accessibleTask(taskId, actor),
    };
  }

  async update(
    taskId: string,
    dto: UpdateTasksDto,
    actor: TaskActor,
  ) {
    if (!this.isStaff(actor)) {
      throw new ForbiddenException(
        'Only Admin or HR can update task details',
      );
    }

    await this.accessibleTask(taskId, actor);

    const updates: Record<string, unknown> = {};

    if (dto.title !== undefined) {
      updates.title = this.normalizeTitle(
        dto.title,
        3,
      );
    }

    if (dto.description !== undefined) {
      updates.description = dto.description.trim();
    }

    if (dto.assigneeUserIds !== undefined) {
      updates.assigneeUserIds =
        await this.validateAssignees(
          dto.assigneeUserIds,
        );
    }

    if (dto.priority !== undefined) {
      updates.priority = dto.priority;
    }

    if (dto.dueDate !== undefined) {
      if (dto.dueDate !== null) {
        this.validateDate(dto.dueDate);
      }

      updates.dueDate = dto.dueDate;
    }

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException(
        'Provide at least one field to update',
      );
    }

    const task = await this.taskModel
      .findByIdAndUpdate(
        this.oid(taskId),
        { $set: updates },
        {
          new: true,
          runValidators: true,
        },
      );

    if (!task) {
      throw new NotFoundException(
        'Task not found',
      );
    }

    return {
      message: 'Task updated successfully',
      task,
    };
  }

  async updateStatus(
    taskId: string,
    dto: UpdateTaskStatusDto,
    actor: TaskActor,
  ) {
    await this.accessibleTask(taskId, actor);

    const completed =
      dto.status === TaskStatus.DONE;

    const updates: Record<string, unknown> = {
      status: dto.status,
      completedAt: completed ? new Date() : null,
    };

    if (completed) {
      updates.progressPercent = 100;
    }

    const task = await this.taskModel
      .findOneAndUpdate(
        this.accessFilter(taskId, actor),
        { $set: updates },
        {
          new: true,
          runValidators: true,
        },
      );

    if (!task) {
      throw new ConflictException(
        'Task access or assignment changed',
      );
    }

    return {
      message: 'Task status updated successfully',
      task,
    };
  }

  async updatePosition(
    taskId: string,
    dto: UpdateTaskPositionDto,
    actor: TaskActor,
  ) {
    if (!this.isStaff(actor)) {
      throw new ForbiddenException(
        'Only Admin or HR can reorder tasks',
      );
    }

    const task = await this.taskModel
      .findByIdAndUpdate(
        this.oid(taskId),
        {
          $set: {
            position: dto.position,
          },
        },
        {
          new: true,
          runValidators: true,
        },
      );

    if (!task) {
      throw new NotFoundException(
        'Task not found',
      );
    }

    return {
      message: 'Task position updated successfully',
      task,
    };
  }

  async addProgress(
    taskId: string,
    dto: AddTaskProgressDto,
    actor: TaskActor,
  ) {
    const existing = await this.accessibleTask(
      taskId,
      actor,
    );

    if (
      existing.status === TaskStatus.DONE &&
      dto.progressPercent < 100
    ) {
      throw new ConflictException(
        'Reopen the task before reducing progress',
      );
    }

    const note = dto.note?.trim() ?? '';

    const now = new Date();

    const updates: Record<string, unknown> = {
      progressPercent: dto.progressPercent,
    };

    if (dto.progressPercent === 100) {
      updates.status = TaskStatus.DONE;
      updates.completedAt = now;
    }

    const task = await this.taskModel
      .findOneAndUpdate(
        this.accessFilter(taskId, actor),
        {
          $set: updates,
          $push: {
            progressUpdates: {
              _id: new Types.ObjectId(),
              authorUserId: this.oid(actor.id),
              progressPercent: dto.progressPercent,
              note,
              createdAt: now,
            },
          },
        },
        {
          new: true,
          runValidators: true,
        },
      );

    if (!task) {
      throw new ConflictException(
        'Task access or assignment changed',
      );
    }

    return {
      message: 'Task progress updated successfully',
      task,
    };
  }

  async addComment(
    taskId: string,
    dto: AddTaskCommentDto,
    actor: TaskActor,
  ) {
    const content = this.normalizeTitle(
      dto.content,
      1,
    );

    const commentId = new Types.ObjectId();

    const task = await this.taskModel
      .findOneAndUpdate(
        this.accessFilter(taskId, actor),
        {
          $push: {
            comments: {
              _id: commentId,
              authorUserId: this.oid(actor.id),
              content,
              createdAt: new Date(),
            },
          },
        },
        {
          new: true,
          runValidators: true,
        },
      );

    if (!task) {
      throw new NotFoundException(
        'Task not found or access denied',
      );
    }

    return {
      message: 'Comment added successfully',
      commentId: String(commentId),
      task,
    };
  }

  async removeComment(
    taskId: string,
    commentId: string,
    actor: TaskActor,
  ) {
    const task = await this.accessibleTask(
      taskId,
      actor,
    );

    const commentObjectId = this.oid(commentId);

    const comment = task.comments.find(
      (item) =>
        String(item._id) === String(commentObjectId),
    );

    if (!comment) {
      throw new NotFoundException(
        'Task comment not found',
      );
    }

    if (
      !this.isStaff(actor) &&
      String(comment.authorUserId) !== actor.id
    ) {
      throw new ForbiddenException(
        'You can only delete your own comments',
      );
    }

    const taskUpdated = await this.taskModel
      .findOneAndUpdate(
        this.accessFilter(taskId, actor),
        {
          $pull: {
            comments: {
              _id: commentObjectId,
              ...(!this.isStaff(actor)
                ? { authorUserId: this.oid(actor.id) }
                : {}),
            },
          },
        },
        {
          new: true,
          runValidators: true,
        },
      );

    if (!taskUpdated) {
      throw new ConflictException(
        'Task access changed',
      );
    }

    return {
      message: 'Comment removal processed',
      task: taskUpdated,
    };
  }

  async addChecklistItem(
    taskId: string,
    dto: AddTaskChecklistDto,
    actor: TaskActor,
  ) {
    const title = this.normalizeTitle(
      dto.title,
      1,
    );

    const itemId = new Types.ObjectId();

    const task = await this.taskModel
      .findOneAndUpdate(
        this.accessFilter(taskId, actor),
        {
          $push: {
            checklist: {
              _id: itemId,
              title,
              isDone: false,
              completedAt: null,
            },
          },
        },
        {
          new: true,
          runValidators: true,
        },
      );

    if (!task) {
      throw new NotFoundException(
        'Task not found or access denied',
      );
    }

    return {
      message: 'Checklist item created successfully',
      itemId: String(itemId),
      task,
    };
  }

  async updateChecklistItem(
    taskId: string,
    itemId: string,
    dto: UpdateTaskChecklistDto,
    actor: TaskActor,
  ) {
    const task = await this.taskModel
      .findOneAndUpdate(
        {
          ...this.accessFilter(taskId, actor),
          'checklist._id': this.oid(itemId),
        },
        {
          $set: {
            'checklist.$.isDone': dto.isDone,
            'checklist.$.completedAt':
              dto.isDone ? new Date() : null,
          },
        },
        {
          new: true,
          runValidators: true,
        },
      );

    if (!task) {
      throw new NotFoundException(
        'Task or checklist item not found',
      );
    }

    return {
      message: 'Checklist item updated successfully',
      task,
    };
  }

  async removeChecklistItem(
    taskId: string,
    itemId: string,
    actor: TaskActor,
  ) {
    if (!this.isStaff(actor)) {
      throw new ForbiddenException(
        'Only Admin or HR can remove checklist items',
      );
    }

    const itemObjectId = this.oid(itemId);

    const task = await this.taskModel
      .findOneAndUpdate(
        {
          _id: this.oid(taskId),
          'checklist._id': itemObjectId,
        },
        {
          $pull: {
            checklist: {
              _id: itemObjectId,
            },
          },
        },
        {
          new: true,
          runValidators: true,
        },
      );

    if (!task) {
      throw new NotFoundException(
        'Task or checklist item not found',
      );
    }

    return {
      message: 'Checklist item removed successfully',
      task,
    };
  }
}
