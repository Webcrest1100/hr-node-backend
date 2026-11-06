
import {
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class CreateAttendanceDto {
  @ApiProperty({
    example: 24.8607,
    description: 'Employee GPS latitude',
  })
  @IsNumber()
  @IsLatitude()
  latitude!: number;

  @ApiProperty({
    example: 67.0011,
    description: 'Employee GPS longitude',
  })
  @IsNumber()
  @IsLongitude()
  longitude!: number;

  @ApiPropertyOptional({
    example: 'Started work at office',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
