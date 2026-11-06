
import {
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateDepartmentsDto {
  @ApiPropertyOptional({
    example: 'Software Engineering',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    example: 'SWE',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9-]{2,30}$/)
  code?: string;

  @ApiPropertyOptional({
    example: 'Software and platform development',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'User ID, or null to remove manager',
  })
  @IsOptional()
  @IsMongoId()
  managerUserId?: string | null;
}
