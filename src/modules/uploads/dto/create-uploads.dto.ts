
import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class CreateUploadsDto {
  @ApiPropertyOptional({
    example: 'Dashboard design reference',
    description: 'Optional attachment description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
