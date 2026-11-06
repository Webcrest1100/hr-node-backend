
import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';

import {
  Schema as MongoSchema,
  Types,
} from 'mongoose';

import type { HydratedDocument } from 'mongoose';

import { Task } from '../../tasks/schemas/tasks.schema.js';
import { User } from '../../users/schemas/users.schema.js';

export type UploadDocument = HydratedDocument<Upload>;

@Schema({
  collection: 'uploads',
  timestamps: true,
})
export class Upload {
  @Prop({
    type: MongoSchema.Types.ObjectId,
    ref: Task.name,
    required: true,
    index: true,
  })
  taskId!: Types.ObjectId;

  @Prop({
    type: MongoSchema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  uploadedBy!: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    maxlength: 255,
  })
  originalName!: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
  })
  storageKey!: string;

  @Prop({
    type: String,
    required: true,
  })
  mimeType!: string;

  @Prop({
    type: Number,
    required: true,
    min: 1,
    max: 10485760,
  })
  sizeBytes!: number;

  @Prop({
    type: String,
    required: true,
    match: /^[a-f0-9]{64}$/,
  })
  sha256!: string;

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

export const UploadSchema =
  SchemaFactory.createForClass(Upload);

UploadSchema.index({
  taskId: 1,
  createdAt: -1,
});

UploadSchema.index({
  uploadedBy: 1,
  createdAt: -1,
});
