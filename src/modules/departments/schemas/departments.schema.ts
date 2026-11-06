
import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../../users/schemas/users.schema.js';

export type DepartmentDocument = HydratedDocument<Department>;

@Schema({
  collection: 'departments',
  timestamps: true,
})
export class Department {
  @Prop({
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  })
  name!: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    select: false,
  })
  nameKey!: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: 30,
  })
  code!: string;

  @Prop({
    type: String,
    default: '',
    maxlength: 1000,
  })
  description!: string;

  @Prop({
    type: Types.ObjectId,
    ref: User.name,
    default: null,
  })
  managerUserId!: Types.ObjectId | null;

  @Prop({
    type: Boolean,
    default: true,
  })
  isActive!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const DepartmentSchema =
  SchemaFactory.createForClass(Department);

DepartmentSchema.index({
  isActive: 1,
  name: 1,
});
