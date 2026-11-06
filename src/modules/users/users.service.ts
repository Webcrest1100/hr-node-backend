
import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  User,
  UserDocument,
  UserRole,
} from './schemas/users.schema.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.trim().toLowerCase() })
      .select('+passwordHash')
      .exec();
  }

  async findById(id: string): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('User not found');
    }

    const user = await this.userModel.findById(id).exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async create(data: {
    fullName: string;
    email: string;
    passwordHash: string;
    role?: UserRole;
  }): Promise<UserDocument> {
    const email = data.email.trim().toLowerCase();

    const existing = await this.userModel.exists({ email });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    try {
      return await this.userModel.create({
        fullName: data.fullName.trim(),
        email,
        passwordHash: data.passwordHash,
        role: data.role ?? UserRole.EMPLOYEE,
        isActive: true,
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        throw new ConflictException('Email already registered');
      }

      throw error;
    }
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: id },
      { $set: { lastLoginAt: new Date() } },
    ).exec();
  }
}
