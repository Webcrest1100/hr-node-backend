
import {
  Injectable,
  Logger,
} from '@nestjs/common';

import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';

import type {
  Observable,
} from 'rxjs';

import { tap } from 'rxjs';

import {
  AuditAction,
} from './schemas/audit-logs.schema.js';

import {
  UserRole,
} from '../users/schemas/users.schema.js';

import {
  AuditLogsService,
} from './audit-logs.service.js';

type AuthenticatedActor = {
  id: string;
  role: UserRole;
};

type AuditHttpRequest = {
  method?: string;
  originalUrl?: string;
  baseUrl?: string;
  route?: {
    path?: string;
  };
  params?: Record<string, string>;
  user?: AuthenticatedActor;
};

type AuditHttpResponse = {
  statusCode: number;
};

@Injectable()
export class AuditLogsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(
    AuditLogsInterceptor.name,
  );

  constructor(
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private actionFromMethod(
    method: string,
  ): AuditAction | null {
    switch (method) {
      case 'POST':
        return AuditAction.CREATE;

      case 'PUT':
      case 'PATCH':
        return AuditAction.UPDATE;

      case 'DELETE':
        return AuditAction.DELETE;

      default:
        return null;
    }
  }

  private resourceFromUrl(url: string): string {
    const segments = url
      .split('?')[0]
      .split('/')
      .filter(Boolean);

    const first = segments[0] === 'api'
      ? segments[1]
      : segments[0];

    if (
      !first ||
      !/^[a-z][a-z0-9-]{0,99}$/.test(first)
    ) {
      return 'system';
    }

    return first;
  }

  private routeTemplate(
    request: AuditHttpRequest,
  ): string {
    const base = request.baseUrl ?? '';
    const route = request.route?.path;

    if (typeof route === 'string') {
      const combined = `${base}${route}`;

      return combined
        .replace(
          /[a-fA-F0-9]{24}/g,
          ':id',
        )
        .slice(0, 500);
    }

    // Query string is deliberately excluded.
    return (request.originalUrl ?? '')
      .split('?')[0]
      .replace(
        /[a-fA-F0-9]{24}/g,
        ':id',
      )
      .slice(0, 500);
  }

  private entityId(
    request: AuditHttpRequest,
  ): string | null {
    const params = request.params ?? {};

    const candidates = [
      params.id,
      params.taskId,
      params.employeeId,
      params.commentId,
      params.itemId,
    ];

    for (const candidate of candidates) {
      if (
        typeof candidate === 'string' &&
        /^[a-fA-F0-9]{24}$/.test(candidate)
      ) {
        return candidate;
      }
    }

    return null;
  }

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context
      .switchToHttp()
      .getRequest<AuditHttpRequest>();

    const response = context
      .switchToHttp()
      .getResponse<AuditHttpResponse>();

    const method = (
      request.method ?? ''
    ).toUpperCase();

    const action = this.actionFromMethod(
      method,
    );

    if (!action) {
      return next.handle();
    }

    const actor = request.user;

    // Unauthenticated requests are not logged here.
    // Never read tokens from request headers.
    if (
      !actor ||
      !/^[a-fA-F0-9]{24}$/.test(actor.id) ||
      !Object.values(UserRole).includes(actor.role)
    ) {
      return next.handle();
    }

    const resource = this.resourceFromUrl(
      request.originalUrl ?? '',
    );

    // Avoid recording audit-management activity
    // or creating any audit-log recursion.
    if (resource === 'audit-logs') {
      return next.handle();
    }

    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const statusCode = response.statusCode;

          if (
            statusCode < 200 ||
            statusCode > 299
          ) {
            return;
          }

          const supportedMethod =
            method as
              | 'POST'
              | 'PUT'
              | 'PATCH'
              | 'DELETE';

          // Best-effort logging. A logging failure
          // must not unexpectedly alter the
          // original API response.
          void this.auditLogsService
            .recordEvent({
              actorUserId: actor.id,
              actorRole: actor.role,
              action,
              method: supportedMethod,
              resource,
              route: this.routeTemplate(request),
              entityId: this.entityId(request),
              httpStatus: statusCode,
              durationMs: Date.now() - start,
            })
            .catch((error: unknown) => {
              this.logger.error(
                'Could not persist audit activity',
                error instanceof Error
                  ? error.stack
                  : String(error),
              );
            });
        },
      }),
    );
  }
}
