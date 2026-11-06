
import {
  IsInt,
  IsMongoId,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AllocateLeaveBalanceDto {
  @ApiProperty({
    description: 'Employee profile ID, not User ID',
  })
  @IsMongoId()
  employeeId!: string;

  @ApiProperty({
    description: 'Leave Type ID',
  })
  @IsMongoId()
  leaveTypeId!: string;

  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @ApiProperty({
    example: 20,
    description: 'Total annual allocation, not additional days',
  })
  @IsInt()
  @Min(0)
  @Max(366)
  allocated!: number;
}
