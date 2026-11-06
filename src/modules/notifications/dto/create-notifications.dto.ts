
import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  NotificationType,
  NotificationEntityType,
} from '../schemas/notifications.schema.js';

export class CreateNotificationsDto {
  @ApiProperty({
    description: 'Recipient User ID, not Employee profile ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  recipientUserId!: string;

  @ApiPropertyOptional({
    enum: NotificationType,
    example: NotificationType.GENERAL,
  })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiProperty({
    example: 'New HR Announcement',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @ApiProperty({
    example: 'The HR team has shared an important update.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(2000)
  message!: string;

  @ApiPropertyOptional({
    enum: NotificationEntityType,
    description: 'Optional related module',
  })
  @IsOptional()
  @IsEnum(NotificationEntityType)
  relatedEntityType?: NotificationEntityType;

  @ApiPropertyOptional({
    description: 'Optional MongoDB ID of related entity',
    example: '507f191e810c19729de860ea',
  })
  @IsOptional()
  @IsMongoId()
  relatedEntityId?: string;
}
