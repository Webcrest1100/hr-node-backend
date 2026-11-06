
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateUserStatusDto {
  @ApiProperty({
    example: false,
    description: 'true = active, false = inactive',
  })
  @IsBoolean()
  isActive!: boolean;
}
