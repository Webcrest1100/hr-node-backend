
import { IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignShiftDto {
  @ApiProperty({
    description: 'Employee profile MongoDB ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  employeeId!: string;

  @ApiProperty({
    description: 'Shift MongoDB ID',
    example: '507f191e810c19729de860ea',
  })
  @IsMongoId()
  shiftId!: string;
}
