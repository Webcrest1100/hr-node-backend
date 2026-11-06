
import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';

import {
  Schema as MongoSchema,
  Types,
} from 'mongoose';

import type { HydratedDocument } from 'mongoose';

import { User } from '../../users/schemas/users.schema.js';

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  IN_REVIEW = 'in_review',
  BLOCKED = 'blocked',
  DONE = 'done',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Schema({ _id: false })
export class TaskComment {
  @Prop({
    type: MongoSchema.Types.ObjectId,
    required: true,
  })
  _id!: Types.ObjectId;

  @Prop({
    type: MongoSchema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  authorUserId!: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    trim: true,
    maxlength: 3000,
  })
  content!: string;

  @Prop({
    type: Date,
    default: Date.now,
  })
  createdAt!: Date;
}

export const TaskCommentSchema =
  SchemaFactory.createForClass(TaskComment);

@Schema({ _id: false })
export class TaskChecklistItem {
  @Prop({
    type: MongoSchema.Types.ObjectId,
    required: true,
  })
  _id!: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    trim: true,
    maxlength: 300,
  })
  title!: string;

  @Prop({
    type: Boolean,
    default: false,
  })
  isDone!: boolean;

  @Prop({
    type: Date,
    default: null,
  })
  completedAt!: Date | null;
}

export const TaskChecklistItemSchema =
  SchemaFactory.createForClass(TaskChecklistItem);

@Schema({ _id: false })
export class TaskProgressEntry {
  @Prop({
    type: MongoSchema.Types.ObjectId,
    required: true,
  })
  _id!: Types.ObjectId;

  @Prop({
    type: MongoSchema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  authorUserId!: Types.ObjectId;

  @Prop({
    type: Number,
    min: 0,
    max: 100,
    required: true,
  })
  progressPercent!: number;

  @Prop({
    type: String,
    trim: true,
    maxlength: 1000,
    default: '',
  })
  note!: string;

  @Prop({
    type: Date,
    default: Date.now,
  })
  createdAt!: Date;
}

export const TaskProgressEntrySchema =
  SchemaFactory.createForClass(TaskProgressEntry);

export type TaskDocument = HydratedDocument<Task>;

@Schema({
  collection: 'tasks',
  timestamps: true,
})
export class Task {
  @Prop({
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 200,
  })
  title!: string;

  @Prop({
    type: String,
    trim: true,
    maxlength: 10000,
    default: '',
  })
  description!: string;

  @Prop({
    type: MongoSchema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  createdBy!: Types.ObjectId;

  @Prop({
    type: [MongoSchema.Types.ObjectId],
    ref: User.name,
    default: [],
    required: true,
  })
  assigneeUserIds!: Types.ObjectId[];

  @Prop({
    type: String,
    enum: Object.values(TaskStatus),
    default: TaskStatus.TODO,
  })
  status!: TaskStatus;

  @Prop({
    type: String,
    enum: Object.values(TaskPriority),
    default: TaskPriority.MEDIUM,
  })
  priority!: TaskPriority;

  @Prop({
    type: Number,
    min: 0,
    default: 0,
  })
  position!: number;

  @Prop({
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  })
  progressPercent!: number;

  @Prop({
    type: String,
    default: null,
    match: /^\d{4}-\d{2}-\d{2}$/,
  })
  dueDate!: string | null;

  @Prop({
    type: [TaskCommentSchema],
    default: [],
  })
  comments!: TaskComment[];

  @Prop({
    type: [TaskChecklistItemSchema],
    default: [],
  })
  checklist!: TaskChecklistItem[];

  @Prop({
    type: [TaskProgressEntrySchema],
    default: [],
  })
  progressUpdates!: TaskProgressEntry[];

  @Prop({
    type: Date,
    default: null,
  })
  completedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const TaskSchema =
  SchemaFactory.createForClass(Task);

TaskSchema.index({
  status: 1,
  position: 1,
  createdAt: -1,
});

TaskSchema.index({
  assigneeUserIds: 1,
  status: 1,
});

TaskSchema.index({
  createdBy: 1,
  createdAt: -1,
});
