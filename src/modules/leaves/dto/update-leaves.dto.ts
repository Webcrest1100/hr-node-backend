
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateLeavesDto {
  @ApiPropertyOptional({ example: '2026-12-11' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-13' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;

  @ApiPropertyOptional({
    example: 'Updated family event dates.',
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason?: string;
}

export enum LeaveDecision {
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export class ReviewLeaveDto {
  @ApiProperty({
    enum: LeaveDecision,
    example: LeaveDecision.APPROVED,
  })
  @IsEnum(LeaveDecision)
  decision!: LeaveDecision;

  @ApiPropertyOptional({
    example: 'Approved by HR.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;
}
