
import { PartialType } from '@nestjs/swagger';
import { CreateShiftsDto } from './create-shifts.dto.js';

export class UpdateShiftsDto extends PartialType(
  CreateShiftsDto,
) {}
