
import {
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

import { ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardQueryDto {
  @ApiPropertyOptional({
    example: '2026-11',
    description: 'Optional reporting month YYYY-MM',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month?: string;
}
