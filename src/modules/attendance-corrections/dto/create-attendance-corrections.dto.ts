
import {
  IsISO8601,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class CreateAttendanceCorrectionsDto {
  @ApiProperty({
    description: 'Existing attendance record ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  attendanceId!: string;

  @ApiPropertyOptional({
    example: '2026-11-02T09:00:00+05:00',
    description: 'Correct check-in time with timezone',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  proposedCheckInAt?: string;

  @ApiPropertyOptional({
    example: '2026-11-02T18:00:00+05:00',
    description: 'Correct checkout time with timezone',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  proposedCheckOutAt?: string;

  @ApiProperty({
    example: 'I checked in on time but the recorded time is incorrect.',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;
}
