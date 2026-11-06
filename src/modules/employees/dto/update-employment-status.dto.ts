
import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import {
  EmploymentStatus,
} from '../schemas/employee.schema.js';

export class UpdateEmploymentStatusDto {
  @ApiProperty({
    enum: EmploymentStatus,
    example: EmploymentStatus.ON_LEAVE,
  })
  @IsEnum(EmploymentStatus)
  employmentStatus!: EmploymentStatus;
}
