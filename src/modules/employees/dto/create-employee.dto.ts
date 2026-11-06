
import {
  IsDateString,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class CreateEmployeeDto {
  @ApiProperty({
    description: 'MongoDB ID of an existing user',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  userId!: string;

  @ApiProperty({
    example: 'WC-EMP-001',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(30)
  employeeCode!: string;

  @ApiProperty({
    example: 'Frontend Developer',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  designation!: string;

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

  @ApiProperty({
    example: '2026-11-02',
  })
  @IsDateString()
  joiningDate!: string;

  @ApiPropertyOptional({
    example: 'Employee joined the development team',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
