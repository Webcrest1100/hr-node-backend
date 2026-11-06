
import {
  IsEnum,
  IsISO8601,
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

export class UpdateAttendanceCorrectionsDto {
  @ApiPropertyOptional({
    example: '2026-11-02T09:00:00+05:00',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  proposedCheckInAt?: string;

  @ApiPropertyOptional({
    example: '2026-11-02T18:00:00+05:00',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  proposedCheckOutAt?: string;

  @ApiPropertyOptional({
    example: 'The recorded time does not match my actual working hours.',
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason?: string;
}

export enum CorrectionDecision {
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export class ReviewAttendanceCorrectionDto {
  @ApiProperty({
    enum: CorrectionDecision,
    example: CorrectionDecision.APPROVED,
  })
  @IsEnum(CorrectionDecision)
  decision!: CorrectionDecision;

  @ApiPropertyOptional({
    example: 'Verified against shift and attendance records.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;
}
