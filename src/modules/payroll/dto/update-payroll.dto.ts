
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePayrollDto {
  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000000000)
  additionalAllowances?: number;

  @ApiPropertyOptional({ example: 2000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000000000)
  additionalDeductions?: number;

  @ApiPropertyOptional({
    example: 'Adjusted monthly payroll',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
