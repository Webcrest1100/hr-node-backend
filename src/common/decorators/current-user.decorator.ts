
import {
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../interfaces/jwt-payload.interface.js';

export const CurrentUser = createParamDecorator(
  (
    data: keyof AuthenticatedUser | undefined,
    context: ExecutionContext,
  ) => {
    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();

    const user = request.user;

    if (!user) return undefined;

    return data ? user[data] : user;
  },
);
