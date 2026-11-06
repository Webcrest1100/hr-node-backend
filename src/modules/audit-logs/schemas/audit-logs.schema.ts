
import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';

import {
  Schema as MongoSchema,
  Types,
} from 'mongoose';

import type {
  HydratedDocument,
} from 'mongoose';

import {
  User,
  UserRole,
} from '../../users/schemas/users.schema.js';

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
}

export type AuditLogDocument =
  HydratedDocument<AuditLog>;

@Schema({
  collection: 'audit_logs',
  timestamps: {
    createdAt: true,
    updatedAt: false,
  },
})
export class AuditLog {
  @Prop({
    type: MongoSchema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  actorUserId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(UserRole),
    required: true,
  })
  actorRole!: UserRole;

  @Prop({
    type: String,
    enum: Object.values(AuditAction),
    required: true,
  })
  action!: AuditAction;

  @Prop({
    type: String,
    enum: ['POST', 'PUT', 'PATCH', 'DELETE'],
    required: true,
  })
  method!: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  })
  resource!: string;

  @Prop({
    type: String,
    trim: true,
    maxlength: 500,
    required: true,
  })
  route!: string;

  @Prop({
    type: String,
    match: /^[a-fA-F0-9]{24}$/,
    default: null,
  })
  entityId!: string | null;

  @Prop({
    type: Number,
    required: true,
    min: 200,
    max: 299,
  })
  httpStatus!: number;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  durationMs!: number;

  @Prop({
    type: String,
    maxlength: 100,
    default: '',
  })
  description!: string;

  createdAt!: Date;
}

export const AuditLogSchema =
  SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({
  createdAt: -1,
});

AuditLogSchema.index({
  actorUserId: 1,
  createdAt: -1,
});

AuditLogSchema.index({
  action: 1,
  createdAt: -1,
});

AuditLogSchema.index({
  resource: 1,
  createdAt: -1,
});
