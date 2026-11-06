
import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';

import type { HydratedDocument } from 'mongoose';

export type ShiftDocument = HydratedDocument<Shift>;

@Schema({
  collection: 'shifts',
  timestamps: true,
})
export class Shift {
  @Prop({
    required: true,
    trim: true,
    maxlength: 100,
  })
  name!: string;

  @Prop({
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  })
  code!: string;

  @Prop({
    required: true,
    match: /^([01]\d|2[0-3]):[0-5]\d$/,
  })
  startTime!: string;

  @Prop({
    required: true,
    match: /^([01]\d|2[0-3]):[0-5]\d$/,
  })
  endTime!: string;

  @Prop({
    required: true,
    default: 'Asia/Karachi',
  })
  timezone!: string;

  @Prop({
    type: [Number],
    required: true,
    default: [1, 2, 3, 4, 5],
  })
  workingDays!: number[];

  @Prop({
    type: Number,
    min: 0,
    max: 600,
    default: 60,
  })
  breakMinutes!: number;

  @Prop({
    type: Number,
    min: 0,
    max: 180,
    default: 15,
  })
  graceMinutes!: number;

  @Prop({
    type: Boolean,
    default: true,
  })
  isActive!: boolean;

  @Prop({
    type: String,
    trim: true,
    maxlength: 1000,
    default: '',
  })
  description!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ShiftSchema =
  SchemaFactory.createForClass(Shift);

ShiftSchema.index({
  isActive: 1,
  name: 1,
});
