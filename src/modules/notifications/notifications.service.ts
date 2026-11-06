
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Notification,
  NotificationEntityType,
  NotificationType,
} from './schemas/notifications.schema.js';

import {
  User,
  UserRole,
} from '../users/schemas/users.schema.js';

import {
  CreateNotificationsDto,
} from './dto/create-notifications.dto.js';

import {
  UpdateNotificationsDto,
} from './dto/update-notifications.dto.js';

import {
  NotificationGateway,
} from '../../integrations/notifications/notification.gateway.js';

type NotificationFilter = {
  recipientUserId?: Types.ObjectId;
  type?: NotificationType;
  isRead?: boolean;
  isArchived?: boolean;
};

export type NotificationEventInput = {
  recipientUserId: string;
  type: NotificationType;
  title: string;
  message: string;
  createdBy?: string;
  relatedEntityType?: NotificationEntityType;
  relatedEntityId?: string;
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel:
      Model<Notification>,

    @InjectModel(User.name)
    private readonly userModel: Model<User>,

    private readonly notificationGateway:
      NotificationGateway,
  ) {}

  private oid(id: string): Types.ObjectId {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      throw new BadRequestException(
        'Invalid MongoDB ID',
      );
    }

    return new Types.ObjectId(id);
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

  private normalizeText(
    value: string,
    min: number,
    max: number,
    field: string,
  ): string {
    const text = value.trim();

    if (
      text.length < min ||
      text.length > max
    ) {
      throw new BadRequestException(
        `${field} must contain ${min}-${max} characters`,
      );
    }

    return text;
  }

  private async verifyRecipient(
    recipientUserId: string,
  ): Promise<Types.ObjectId> {
    const userId = this.oid(
      recipientUserId,
    );

    const user = await this.userModel
      .findById(userId)
      .select('_id isActive')
      .lean();

    if (!user) {
      throw new NotFoundException(
        'Notification recipient not found',
      );
    }

    if (!user.isActive) {
      throw new BadRequestException(
        'Cannot notify an inactive account',
      );
    }

    return userId;
  }

  private async paginate(
    filter: NotificationFilter,
    page: number,
    limit: number,
  ) {
    this.validatePagination(page, limit);

    const [data, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      this.notificationModel.countDocuments(filter),
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

  /**
   * Trusted server-side notification creation.
   *
   * First persist to MongoDB, then emit to the
   * authenticated recipient's Socket.IO room.
   */
  async createForUser(
    input: NotificationEventInput,
  ) {
    const recipientUserId =
      await this.verifyRecipient(
        input.recipientUserId,
      );

    const title = this.normalizeText(
      input.title,
      3,
      200,
      'Title',
    );

    const message = this.normalizeText(
      input.message,
      3,
      2000,
      'Message',
    );

    if (
      !Object.values(NotificationType).includes(
        input.type,
      )
    ) {
      throw new BadRequestException(
        'Invalid notification type',
      );
    }

    if (
      Boolean(input.relatedEntityType) !==
      Boolean(input.relatedEntityId)
    ) {
      throw new BadRequestException(
        'Related entity type and ID must be provided together',
      );
    }

    if (
      input.relatedEntityType &&
      !Object.values(NotificationEntityType).includes(
        input.relatedEntityType,
      )
    ) {
      throw new BadRequestException(
        'Invalid related entity type',
      );
    }

    const notification =
      await this.notificationModel.create({
        recipientUserId,
        createdBy: input.createdBy
          ? this.oid(input.createdBy)
          : null,
        type: input.type,
        title,
        message,
        relatedEntityType:
          input.relatedEntityType ?? null,
        relatedEntityId: input.relatedEntityId
          ? this.oid(input.relatedEntityId)
          : null,
        isRead: false,
        readAt: null,
        isArchived: false,
        archivedAt: null,
      });

    // Real-time delivery is best-effort.
    // The saved MongoDB record remains the source of truth.
    this.notificationGateway.emitToUser(
      String(notification.recipientUserId),
      {
        id: String(notification._id),
        type: notification.type,
        title: notification.title,
        message: notification.message,
        relatedEntityType:
          notification.relatedEntityType ?? null,
        relatedEntityId:
          notification.relatedEntityId
            ? String(notification.relatedEntityId)
            : null,
        createdAt:
          notification.createdAt.toISOString(),
      },
    );

    return notification;
  }

  /**
   * Manual Admin/HR notifications.
   * Related entity links are reserved for
   * trusted backend integrations.
   */
  async create(
    dto: CreateNotificationsDto,
    actorUserId: string,
  ) {
    if (
      dto.relatedEntityId !== undefined ||
      dto.relatedEntityType !== undefined
    ) {
      throw new BadRequestException(
        'Related entity links are reserved for system-generated notifications',
      );
    }

    const notification = await this.createForUser({
      recipientUserId: dto.recipientUserId,
      type:
        dto.type ??
        NotificationType.GENERAL,
      title: dto.title,
      message: dto.message,
      createdBy: actorUserId,
    });

    return {
      message: 'Notification sent successfully',
      notification,
    };
  }

  async findMine(
    userId: string,
    page = 1,
    limit = 20,
    unreadOnly = false,
    includeArchived = false,
  ) {
    const filter: NotificationFilter = {
      recipientUserId: this.oid(userId),
    };

    if (unreadOnly) {
      filter.isRead = false;
    }

    if (!includeArchived) {
      filter.isArchived = false;
    }

    return this.paginate(
      filter,
      page,
      limit,
    );
  }

  async findAll(
    page = 1,
    limit = 20,
    type?: string,
  ) {
    const filter: NotificationFilter = {};

    if (type !== undefined) {
      if (
        !Object.values(NotificationType).includes(
          type as NotificationType,
        )
      ) {
        throw new BadRequestException(
          'Invalid notification type',
        );
      }

      filter.type = type as NotificationType;
    }

    return this.paginate(
      filter,
      page,
      limit,
    );
  }

  async unreadCount(userId: string) {
    const count =
      await this.notificationModel
        .countDocuments({
          recipientUserId:
            this.oid(userId),
          isRead: false,
          isArchived: false,
        });

    return {
      unreadCount: count,
    };
  }

  async findOne(
    id: string,
    actorUserId: string,
    actorRole: UserRole,
  ) {
    const filter =
      actorRole === UserRole.ADMIN
        ? {
            _id: this.oid(id),
          }
        : {
            _id: this.oid(id),
            recipientUserId:
              this.oid(actorUserId),
          };

    const notification =
      await this.notificationModel
        .findOne(filter)
        .lean();

    if (!notification) {
      throw new NotFoundException(
        'Notification not found or access denied',
      );
    }

    return {
      notification,
    };
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateNotificationsDto,
  ) {
    if (
      dto.isRead === undefined &&
      dto.isArchived === undefined
    ) {
      throw new BadRequestException(
        'Provide isRead or isArchived to update',
      );
    }

    const updates: {
      isRead?: boolean;
      readAt?: Date | null;
      isArchived?: boolean;
      archivedAt?: Date | null;
    } = {};

    if (dto.isRead !== undefined) {
      updates.isRead = dto.isRead;
      updates.readAt = dto.isRead
        ? new Date()
        : null;
    }

    if (dto.isArchived !== undefined) {
      updates.isArchived =
        dto.isArchived;
      updates.archivedAt =
        dto.isArchived
          ? new Date()
          : null;
    }

    const notification =
      await this.notificationModel
        .findOneAndUpdate(
          {
            _id: this.oid(id),
            recipientUserId:
              this.oid(userId),
          },
          {
            $set: updates,
          },
          {
            new: true,
            runValidators: true,
          },
        );

    if (!notification) {
      throw new NotFoundException(
        'Notification not found or access denied',
      );
    }

    return {
      message:
        'Notification updated successfully',
      notification,
    };
  }

  async markAllRead(userId: string) {
    const now = new Date();

    const result =
      await this.notificationModel
        .updateMany(
          {
            recipientUserId:
              this.oid(userId),
            isRead: false,
            isArchived: false,
          },
          {
            $set: {
              isRead: true,
              readAt: now,
            },
          },
        );

    return {
      message:
        'Notifications marked as read',
      updatedCount: result.modifiedCount,
    };
  }
}
