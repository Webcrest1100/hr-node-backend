
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../modules/users/users.service.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }>();

    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Authentication required',
      );
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      throw new UnauthorizedException(
        'Invalid authentication token',
      );
    }

    let payload: { sub: string };

    try {
      payload = await this.jwtService.verifyAsync<{
        sub: string;
      }>(token, {
        secret: this.configService.getOrThrow<string>(
          'JWT_SECRET',
        ),
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired authentication token',
      );
    }

    if (!payload?.sub) {
      throw new UnauthorizedException(
        'Invalid token payload',
      );
    }

    const user = await this.usersService.findById(
      payload.sub,
    );

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Account not found or inactive',
      );
    }

    request.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    return true;
  }
}