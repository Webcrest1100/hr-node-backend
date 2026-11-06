
import {
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

import {
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class AuditLogsSummaryDto {
  @ApiPropertyOptional({
    description: 'Filter by user ID',
  })
  @IsOptional()
  @IsMongoId()
  actorUserId?: string;

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
