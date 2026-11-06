
import {
  IsString,
  MaxLength,
} from 'class-validator';

import {
  ApiProperty,
} from '@nestjs/swagger';

export class UpdateUploadsDto {
  @ApiProperty({
    example: 'Updated attachment description',
  })
  @IsString()
  @MaxLength(1000)
  description!: string;
}
