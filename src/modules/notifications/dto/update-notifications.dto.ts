
import {
  IsBoolean,
  IsOptional,
} from 'class-validator';

import {
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class UpdateNotificationsDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Mark notification as read or unread',
  })
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Archive or restore notification',
  })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
