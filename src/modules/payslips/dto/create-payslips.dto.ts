
import {
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class CreatePayslipsDto {
  @ApiProperty({
    description: 'Approved or paid Payroll record ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  payrollId!: string;

  @ApiPropertyOptional({
    example: 'November 2026 salary payslip',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
