
import {
  IsMongoId,
  IsNotEmpty,
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

export class CreateDepartmentsDto {
  @ApiProperty({
    example: 'Engineering',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 'ENG',
    description: 'Unique department code',
  })
  @IsString()
  @Matches(/^[a-zA-Z0-9-]{2,30}$/, {
    message:
      'Code must contain 2-30 letters, numbers or hyphens',
  })
  code!: string;

  @ApiPropertyOptional({
    example: 'Software development department',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Existing active user ID for department manager',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  managerUserId?: string | null;
}
