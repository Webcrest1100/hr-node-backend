
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { UserRole } from '../../users/schemas/users.schema.js';

export class CreateUserDto {
  @ApiProperty({ example: 'Ali Ahmed' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({ example: 'ali@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'Use-a-unique-strong-password',
    minLength: 12,
  })
  @IsString()
  @MinLength(12)
  @MaxLength(72)
  password!: string;

  @ApiProperty({
    enum: [UserRole.HR, UserRole.EMPLOYEE],
    example: UserRole.EMPLOYEE,
  })
  @IsIn([UserRole.HR, UserRole.EMPLOYEE])
  role!: UserRole;
}
