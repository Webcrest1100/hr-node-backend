
import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateShiftStatusDto {
  @ApiProperty({
    example: false,
    description: 'true = active, false = inactive',
  })
  @IsBoolean()
  isActive!: boolean;
}
