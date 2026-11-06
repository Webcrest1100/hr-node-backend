
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

export class UpdateAttendanceDto {
  @ApiProperty({
    example: 24.8607,
    description: 'Employee checkout GPS latitude',
  })
  @IsNumber()
  @IsLatitude()
  latitude!: number;

  @ApiProperty({
    example: 67.0011,
    description: 'Employee checkout GPS longitude',
  })
  @IsNumber()
  @IsLongitude()
  longitude!: number;

  @ApiPropertyOptional({
    example: 'Completed work',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
