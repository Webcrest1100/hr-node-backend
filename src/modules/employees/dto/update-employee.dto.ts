
import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEmployeeDto {
  @ApiPropertyOptional({
    example: 'Senior Frontend Developer',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  designation?: string;

  @ApiPropertyOptional({
    example: 'Engineering',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @ApiPropertyOptional({
    example: '+923001234567',
  })
  @IsOptional()
  @IsString()
  @MaxLength(25)
  phone?: string;

  @ApiPropertyOptional({
    example: '2026-11-02',
  })
  @IsOptional()
  @IsDateString()
  joiningDate?: string;

  @ApiPropertyOptional({
    example: 'Promoted to senior developer',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
