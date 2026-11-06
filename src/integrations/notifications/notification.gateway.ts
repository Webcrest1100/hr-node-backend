
import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import type {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';

import {
  JwtService,
} from '@nestjs/jwt';

import {
  ConfigService,
} from '@nestjs/config';

import {
  InjectModel,
} from '@nestjs/mongoose';

import {
  Model,
} from 'mongoose';

import {
  Server,
  Socket,
} from 'socket.io';

import {
  User,
} from '../../modules/users/schemas/users.schema.js';

export type RealtimeNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string;
};

type TokenPayload = {
  sub: string;
  exp: number;
};

type AuthenticatedSocket = Socket & {
  data: {
    userId?: string;
    tokenExpiresAt?: number;
  };
};

function allowedOrigins(): string[] {
  const configured =
    process.env.SOCKET_ALLOWED_ORIGINS ?? '';

  if (configured.trim()) {
    return configured
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  return [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];
}

@WebSocketGateway({
  namespace: '/notifications',
  transports: ['websocket', 'polling'],
  cors: {
    origin: allowedOrigins(),
    credentials: false,
  },
  allowRequest: (request, callback) => {
    const origin = request.headers.origin;

    // Requests without Origin may come from native
    // clients or server-side tools. JWT is still required.
    const isAllowed =
      !origin || allowedOrigins().includes(origin);

    callback(null, isAllowed);
  },
})
@Injectable()
export class NotificationGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect
{
  private readonly logger = new Logger(
    NotificationGateway.name,
  );

  @WebSocketServer()
  private server!: Server;

  private readonly connectionChecks =
    new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,

    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  private roomName(userId: string): string {
    return `user:${userId}`;
  }

  afterInit(server: Server): void {
    server.use(async (socket, next) => {
      try {
        const rawToken: unknown =
          socket.handshake.auth?.token;

        if (
          typeof rawToken !== 'string' ||
          rawToken.length === 0 ||
          rawToken.length > 8192
        ) {
          next(
            new Error('Authentication required'),
          );
          return;
        }

        const token = rawToken.startsWith('Bearer ')
          ? rawToken.slice(7).trim()
          : rawToken.trim();

        const payload =
          await this.jwtService.verifyAsync<TokenPayload>(
            token,
            {
              secret: this.configService
                .getOrThrow<string>('JWT_SECRET'),
              algorithms: ['HS256'],
            },
          );

        if (
          !/^[0-9a-fA-F]{24}$/.test(payload.sub) ||
          typeof payload.exp !== 'number' ||
          !Number.isFinite(payload.exp) ||
          payload.exp * 1000 <= Date.now()
        ) {
          next(
            new Error('Invalid authentication token'),
          );
          return;
        }

        const user = await this.userModel
          .findById(payload.sub)
          .select('_id isActive')
          .lean();

        if (!user || !user.isActive) {
          next(
            new Error('Account unavailable'),
          );
          return;
        }

        socket.data.userId = String(user._id);
        socket.data.tokenExpiresAt =
          payload.exp * 1000;

        next();
      } catch {
        next(
          new Error('Invalid or expired token'),
        );
      }
    });

    this.logger.log(
      'JWT-authenticated notification gateway initialized',
    );
  }

  handleConnection(client: AuthenticatedSocket): void {
    const userId = client.data.userId;
    const expiresAt = client.data.tokenExpiresAt;

    if (
      !userId ||
      !expiresAt ||
      expiresAt <= Date.now()
    ) {
      client.disconnect(true);
      return;
    }

    void client.join(this.roomName(userId));

    // Verify token expiry and account activity regularly.
    const interval = setInterval(() => {
      void this.verifyActiveConnection(client);
    }, 30000);

    interval.unref();

    this.connectionChecks.set(
      client.id,
      interval,
    );

    // Do not log JWT tokens or notification payloads.
    this.logger.debug(
      `Notification socket connected: ${client.id}`,
    );
  }

  private async verifyActiveConnection(
    client: AuthenticatedSocket,
  ): Promise<void> {
    try {
      if (!client.connected) {
        this.clearCheck(client.id);
        return;
      }

      const userId = client.data.userId;
      const expiresAt =
        client.data.tokenExpiresAt;

      if (
        !userId ||
        !expiresAt ||
        Date.now() >= expiresAt
      ) {
        client.disconnect(true);
        return;
      }

      const user = await this.userModel
        .findById(userId)
        .select('isActive')
        .lean();

      if (!user || !user.isActive) {
        client.disconnect(true);
      }
    } catch {
      // Fail closed if account verification fails.
      client.disconnect(true);
    }
  }

  private clearCheck(socketId: string): void {
    const interval =
      this.connectionChecks.get(socketId);

    if (interval) {
      clearInterval(interval);
      this.connectionChecks.delete(socketId);
    }
  }

  handleDisconnect(
    client: AuthenticatedSocket,
  ): void {
    this.clearCheck(client.id);
  }

  emitToUser(
    userId: string,
    notification: RealtimeNotification,
  ): void {
    if (
      !this.server ||
      !/^[0-9a-fA-F]{24}$/.test(userId)
    ) {
      return;
    }

    this.server
      .to(this.roomName(userId))
      .emit('notification:new', notification);
  }
}
