
import {
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class CreatePayrollDto {
  @ApiProperty({
    description: 'Employee profile ID, not User ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  employeeId!: string;

  @ApiProperty({
    example: '2026-11',
    description: 'Payroll month YYYY-MM',
  })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month!: string;

  @ApiPropertyOptional({ example: 2500 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000000000)
  additionalAllowances?: number;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000000000)
  additionalDeductions?: number;

  @ApiPropertyOptional({
    example: 'Monthly salary draft',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
