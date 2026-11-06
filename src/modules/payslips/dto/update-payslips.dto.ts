
import {
  IsString,
  MaxLength,
} from 'class-validator';

import {
  ApiProperty,
} from '@nestjs/swagger';

export class UpdatePayslipsDto {
  @ApiProperty({
    example: 'Verified by payroll administrator',
  })
  @IsString()
  @MaxLength(1000)
  notes!: string;
}
