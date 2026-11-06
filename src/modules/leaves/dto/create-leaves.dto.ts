
import {
  IsMongoId,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLeavesDto {
  @ApiProperty({
    description: 'Leave Type MongoDB ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  leaveTypeId!: string;

  @ApiProperty({ example: '2026-12-10' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate!: string;

  @ApiProperty({ example: '2026-12-12' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate!: string;

  @ApiProperty({
    example: 'I need leave for a family event.',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;
}
