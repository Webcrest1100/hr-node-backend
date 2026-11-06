
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

import { Type } from 'class-transformer';

import {
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  AuditAction,
} from '../schemas/audit-logs.schema.js';

export class AuditLogsQueryDto {
  @ApiPropertyOptional({
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'User ID whose activity is requested',
  })
  @IsOptional()
  @IsMongoId()
  actorUserId?: string;

  @ApiPropertyOptional({
    enum: AuditAction,
  })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @ApiPropertyOptional({
    example: 'tasks',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9-]{0,99}$/)
  resource?: string;

  @ApiPropertyOptional({
    example: '2026-11-01',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({
    example: '2026-11-30',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}
