
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  TaskPriority,
  TaskStatus,
} from '../schemas/tasks.schema.js';

export class UpdateTasksDto {
  @ApiPropertyOptional({
    example: 'Develop Complete HR Dashboard',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    example: 'Updated dashboard requirements.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['507f1f77bcf86cd799439011'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsMongoId({ each: true })
  assigneeUserIds?: string[];

  @ApiPropertyOptional({
    enum: TaskPriority,
  })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({
    example: '2026-12-15',
    nullable: true,
    description: 'Set null to remove due date',
  })
  @ValidateIf(
    (_object, value: unknown) =>
      value !== undefined && value !== null,
  )
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate?: string | null;
}

export class UpdateTaskStatusDto {
  @ApiProperty({
    enum: TaskStatus,
    example: TaskStatus.IN_PROGRESS,
  })
  @IsEnum(TaskStatus)
  status!: TaskStatus;
}

export class UpdateTaskPositionDto {
  @ApiProperty({
    example: 2,
    description: 'Ordering position within Kanban column',
  })
  @IsInt()
  @Min(0)
  @Max(1000000)
  position!: number;
}

export class AddTaskProgressDto {
  @ApiProperty({
    example: 60,
  })
  @IsInt()
  @Min(0)
  @Max(100)
  progressPercent!: number;

  @ApiPropertyOptional({
    example: 'Dashboard API integration completed.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class AddTaskCommentDto {
  @ApiProperty({
    example: 'Frontend work is completed. Please review.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  content!: string;
}

export class AddTaskChecklistDto {
  @ApiProperty({
    example: 'Connect dashboard API',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;
}

export class UpdateTaskChecklistDto {
  @ApiProperty({
    example: true,
  })
  @IsBoolean()
  isDone!: boolean;
}
