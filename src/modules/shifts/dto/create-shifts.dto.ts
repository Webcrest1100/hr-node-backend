
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class CreateShiftsDto {
  @ApiProperty({
    example: 'Morning Shift',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 'MORNING',
  })
  @IsString()
  @Matches(/^[A-Za-z0-9-]{2,30}$/)
  code!: string;

  @ApiProperty({
    example: '09:00',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime!: string;

  @ApiProperty({
    example: '18:00',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime!: string;

  @ApiPropertyOptional({
    example: 'Asia/Karachi',
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({
    type: [Number],
    example: [1, 2, 3, 4, 5],
    description: '0=Sunday through 6=Saturday',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @IsIn([0, 1, 2, 3, 4, 5, 6], {
    each: true,
  })
  workingDays!: number[];

  @ApiPropertyOptional({
    example: 60,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600)
  breakMinutes?: number;

  @ApiPropertyOptional({
    example: 15,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  graceMinutes?: number;

  @ApiPropertyOptional({
    example: 'Standard office shift',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
