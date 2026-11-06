
import {
  Injectable,
  Logger,
} from '@nestjs/common';

import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';

import type { Observable } from 'rxjs';
import { tap } from 'rxjs';

import {
  IntegrationEvent,
  NotificationEventsService,
} from './notification-events.service.js';

type HttpRequest = {
  method?: string;
  originalUrl?: string;
  user?: {
    id?: string;
  };
};

type HttpResponse = {
  statusCode: number;
};

@Injectable()
export class NotificationEventsInterceptor
  implements NestInterceptor {
  private readonly logger = new Logger(
    NotificationEventsInterceptor.name,
  );

  constructor(
    private readonly eventsService:
      NotificationEventsService,
  ) {}

  private eventFromRoute(
    method: string,
    path: string,
  ): IntegrationEvent | null {
    if (
      method === 'POST' &&
      path === '/api/tasks'
    ) {
      return IntegrationEvent.TASK_CREATED;
    }

    if (
      method === 'PATCH' &&
      /^\/api\/tasks\/[0-9a-fA-F]{24}\/status$/.test(
        path,
      )
    ) {
      return IntegrationEvent.TASK_STATUS_CHANGED;
    }

    if (
      method === 'POST' &&
      path === '/api/leaves'
    ) {
      return IntegrationEvent.LEAVE_REQUESTED;
    }

    if (
      method === 'PATCH' &&
      /^\/api\/leaves\/[0-9a-fA-F]{24}\/review$/.test(
        path,
      )
    ) {
      return IntegrationEvent.LEAVE_REVIEWED;
    }

    if (
      method === 'PATCH' &&
      /^\/api\/attendance-corrections\/[0-9a-fA-F]{24}\/review$/.test(
        path,
      )
    ) {
      return IntegrationEvent.CORRECTION_REVIEWED;
    }

    if (
      method === 'PATCH' &&
      /^\/api\/payroll\/[0-9a-fA-F]{24}\/approve$/.test(
        path,
      )
    ) {
      return IntegrationEvent.PAYROLL_APPROVED;
    }

    return null;
  }

  private responseEntityId(
    result: unknown,
    event: IntegrationEvent,
  ): string | null {
    if (
      !result ||
      typeof result !== 'object'
    ) {
      return null;
    }

    const data = result as Record<string, unknown>;

    const key =
      event === IntegrationEvent.TASK_CREATED ||
      event === IntegrationEvent.TASK_STATUS_CHANGED
        ? 'task'
        : event === IntegrationEvent.LEAVE_REQUESTED ||
          event === IntegrationEvent.LEAVE_REVIEWED
          ? 'leave'
          : event === IntegrationEvent.CORRECTION_REVIEWED
            ? 'correction'
            : 'payroll';

    const entity = data[key];

    if (!entity || typeof entity !== 'object') {
      return null;
    }

    const record = entity as Record<string, unknown>;

    if (record._id == null) {
      return null;
    }

    const id = String(record._id);

    return /^[0-9a-fA-F]{24}$/.test(id)
      ? id
      : null;
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
      .getRequest<HttpRequest>();

    const response = context
      .switchToHttp()
      .getResponse<HttpResponse>();

    const method = (
      request.method ?? ''
    ).toUpperCase();

    const path = (
      request.originalUrl ?? ''
    ).split('?')[0].replace(/\/$/, '');

    const event = this.eventFromRoute(
      method,
      path,
    );

    if (!event) {
      return next.handle();
    }

    const actorUserId = request.user?.id;

    if (
      !actorUserId ||
      !/^[0-9a-fA-F]{24}$/.test(actorUserId)
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (result: unknown) => {
          if (
            response.statusCode < 200 ||
            response.statusCode > 299
          ) {
            return;
          }

          const entityId = this.responseEntityId(
            result,
            event,
          );

          if (!entityId) {
            this.logger.warn(
              `Notification skipped: entity ID missing for ${event}`,
            );
            return;
          }

          void this.eventsService
            .dispatch({
              event,
              entityId,
              actorUserId,
            })
            .catch((error: unknown) => {
              this.logger.error(
                `Notification event failed: ${event}`,
                error instanceof Error
                  ? error.message
                  : 'Unknown error',
              );
            });
        },
      }),
    );
  }
}
