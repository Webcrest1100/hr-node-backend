
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

import { UserRole } from '../../users/schemas/users.schema.js';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Ali Ahmed' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({ example: 'ali@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    enum: [UserRole.HR, UserRole.EMPLOYEE],
  })
  @IsOptional()
  @IsIn([UserRole.HR, UserRole.EMPLOYEE])
  role?: UserRole;
}
