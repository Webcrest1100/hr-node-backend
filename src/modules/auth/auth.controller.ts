
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

import { UserRole } from '../users/schemas/users.schema.js';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface.js';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  // Public login
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login with email and password',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid email or password',
  })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // Admin, HR, Employee
  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Authenticated user details',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid JWT',
  })
  getProfile(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: 'Authenticated successfully',
      user,
    };
  }

  // Admin only
  @Get('admin-check')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify Admin access',
  })
  @ApiResponse({
    status: 403,
    description: 'Admin access required',
  })
  adminCheck(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: 'Admin access granted',
      user,
    };
  }

  // Admin and HR only
  @Get('staff-check')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify Admin or HR access',
  })
  @ApiResponse({
    status: 403,
    description: 'Admin or HR access required',
  })
  staffCheck(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: 'Staff access granted',
      user,
    };
  }
}
