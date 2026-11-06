
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  AuditAction,
  AuditLog,
} from './schemas/audit-logs.schema.js';

import {
  UserRole,
} from '../users/schemas/users.schema.js';

import {
  AuditLogsQueryDto,
} from './dto/create-audit-logs.dto.js';

import {
  AuditLogsSummaryDto,
} from './dto/update-audit-logs.dto.js';

export type AuditEventInput = {
  actorUserId: string;
  actorRole: UserRole;
  action: AuditAction;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  resource: string;
  route: string;
  entityId?: string | null;
  httpStatus: number;
  durationMs: number;
};

type AuditFilter = {
  actorUserId?: Types.ObjectId;
  action?: AuditAction;
  resource?: string;
  createdAt?: {
    $gte?: Date;
    $lt?: Date;
  };
};

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditModel: Model<AuditLog>,
  ) {}

  private oid(id: string): Types.ObjectId {
    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      throw new BadRequestException(
        'Invalid MongoDB ID',
      );
    }

    return new Types.ObjectId(id);
  }

  private parseDate(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(
        'Date must use YYYY-MM-DD format',
      );
    }

    const date = new Date(
      `${value}T00:00:00.000Z`,
    );

    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException(
        'Invalid calendar date',
      );
    }

    return date;
  }

  private dateRange(from?: string, to?: string) {
    const start = from
      ? this.parseDate(from)
      : undefined;

    const end = to
      ? this.parseDate(to)
      : undefined;

    if (
      start &&
      end &&
      start.getTime() > end.getTime()
    ) {
      throw new BadRequestException(
        'Start date cannot be after end date',
      );
    }

    if (!start && !end) {
      return undefined;
    }

    const range: {
      $gte?: Date;
      $lt?: Date;
    } = {};

    if (start) {
      range.$gte = start;
    }

    if (end) {
      const exclusive = new Date(end);
      exclusive.setUTCDate(
        exclusive.getUTCDate() + 1,
      );

      range.$lt = exclusive;
    }

    return range;
  }

  private buildFilter(input: {
    actorUserId?: string;
    action?: AuditAction;
    resource?: string;
    from?: string;
    to?: string;
  }): AuditFilter {
    const filter: AuditFilter = {};

    if (input.actorUserId) {
      filter.actorUserId = this.oid(
        input.actorUserId,
      );
    }

    if (input.action) {
      if (
        !Object.values(AuditAction).includes(
          input.action,
        )
      ) {
        throw new BadRequestException(
          'Invalid audit action',
        );
      }

      filter.action = input.action;
    }

    if (input.resource) {
      if (
        !/^[a-z][a-z0-9-]{0,99}$/.test(
          input.resource,
        )
      ) {
        throw new BadRequestException(
          'Invalid resource name',
        );
      }

      filter.resource = input.resource;
    }

    const range = this.dateRange(
      input.from,
      input.to,
    );

    if (range) {
      filter.createdAt = range;
    }

    return filter;
  }

  /**
   * Trusted server-side method.
   * Do not expose through a public POST endpoint.
   */
  async recordEvent(
    input: AuditEventInput,
  ): Promise<void> {
    if (
      !Object.values(AuditAction).includes(
        input.action,
      )
    ) {
      throw new BadRequestException(
        'Invalid audit action',
      );
    }

    if (
      !Object.values(UserRole).includes(
        input.actorRole,
      )
    ) {
      throw new BadRequestException(
        'Invalid audit user role',
      );
    }

    if (
      !['POST', 'PUT', 'PATCH', 'DELETE'].includes(
        input.method,
      )
    ) {
      throw new BadRequestException(
        'Unsupported audit HTTP method',
      );
    }

    if (
      !Number.isInteger(input.httpStatus) ||
      input.httpStatus < 200 ||
      input.httpStatus > 299
    ) {
      throw new BadRequestException(
        'Only successful operations can be recorded here',
      );
    }

    const resource = input.resource.trim();

    if (
      !/^[a-z][a-z0-9-]{0,99}$/.test(resource)
    ) {
      throw new BadRequestException(
        'Invalid audit resource',
      );
    }

    const entityId = input.entityId
      ? String(this.oid(input.entityId))
      : null;

    const durationMs = Math.max(
      0,
      Math.round(input.durationMs),
    );

    if (!Number.isSafeInteger(durationMs)) {
      throw new BadRequestException(
        'Invalid request duration',
      );
    }

    await this.auditModel.create({
      actorUserId: this.oid(input.actorUserId),
      actorRole: input.actorRole,
      action: input.action,
      method: input.method,
      resource,
      route: input.route.slice(0, 500),
      entityId,
      httpStatus: input.httpStatus,
      durationMs,
      description:
        `${input.method} ${resource}`.slice(0, 100),
    });
  }

  async findAll(query: AuditLogsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    if (
      !Number.isSafeInteger(page) ||
      !Number.isSafeInteger(limit) ||
      page < 1 ||
      limit < 1 ||
      limit > 100
    ) {
      throw new BadRequestException(
        'Invalid pagination parameters',
      );
    }

    const filter = this.buildFilter(query);

    const [data, total] = await Promise.all([
      this.auditModel
        .find(filter)
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      this.auditModel.countDocuments(filter),
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

  async summary(query: AuditLogsSummaryDto) {
    const filter = this.buildFilter(query);

    const [
      total,
      created,
      updated,
      deleted,
    ] = await Promise.all([
      this.auditModel.countDocuments(filter),

      this.auditModel.countDocuments({
        ...filter,
        action: AuditAction.CREATE,
      }),

      this.auditModel.countDocuments({
        ...filter,
        action: AuditAction.UPDATE,
      }),

      this.auditModel.countDocuments({
        ...filter,
        action: AuditAction.DELETE,
      }),
    ]);

    return {
      totalActivities: total,
      byAction: {
        create: created,
        update: updated,
        delete: deleted,
      },
      filters: {
        actorUserId: query.actorUserId ?? null,
        from: query.from ?? null,
        to: query.to ?? null,
      },
    };
  }

  async findOne(id: string) {
    const auditLog = await this.auditModel
      .findById(this.oid(id))
      .lean();

    if (!auditLog) {
      throw new NotFoundException(
        'Audit log not found',
      );
    }

    return { auditLog };
  }
}
