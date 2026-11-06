
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

export enum NotificationType {
  GENERAL = 'general',
  TASK = 'task',
  LEAVE = 'leave',
  ATTENDANCE = 'attendance',
  PAYROLL = 'payroll',
  SYSTEM = 'system',
}

export enum NotificationEntityType {
  TASK = 'task',
  LEAVE = 'leave',
  ATTENDANCE = 'attendance',
  PAYROLL = 'payroll',
}

export type NotificationDocument =
  HydratedDocument<Notification>;

@Schema({
  collection: 'notifications',
  timestamps: true,
})
export class Notification {
  @Prop({
    type: MongoSchema.Types.ObjectId,
    ref: User.name,
    required: true,
    index: true,
  })
  recipientUserId!: Types.ObjectId;

  @Prop({
    type: MongoSchema.Types.ObjectId,
    ref: User.name,
    default: null,
  })
  createdBy!: Types.ObjectId | null;

  @Prop({
    type: String,
    enum: Object.values(NotificationType),
    required: true,
    default: NotificationType.GENERAL,
  })
  type!: NotificationType;

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
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 2000,
  })
  message!: string;

  @Prop({
    type: String,
    enum: Object.values(NotificationEntityType),
    default: null,
  })
  relatedEntityType!: NotificationEntityType | null;

  @Prop({
    type: MongoSchema.Types.ObjectId,
    default: null,
  })
  relatedEntityId!: Types.ObjectId | null;

  @Prop({
    type: Boolean,
    default: false,
  })
  isRead!: boolean;

  @Prop({
    type: Date,
    default: null,
  })
  readAt!: Date | null;

  @Prop({
    type: Boolean,
    default: false,
  })
  isArchived!: boolean;

  @Prop({
    type: Date,
    default: null,
  })
  archivedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const NotificationSchema =
  SchemaFactory.createForClass(Notification);

NotificationSchema.index({
  recipientUserId: 1,
  isArchived: 1,
  createdAt: -1,
});

NotificationSchema.index({
  recipientUserId: 1,
  isRead: 1,
  isArchived: 1,
});

NotificationSchema.index({
  type: 1,
  createdAt: -1,
});
