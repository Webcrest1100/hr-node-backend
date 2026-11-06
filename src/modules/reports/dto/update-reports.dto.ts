
import {
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

import { ReportQueryDto } from './create-reports.dto.js';

export class ReportExportDto extends ReportQueryDto {
  @ApiPropertyOptional({
    example: 1000,
    description: 'Maximum records exported; max 2000',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  maxRows?: number;
}
