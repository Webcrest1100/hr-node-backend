
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

import {
  User,
  UserRole,
} from './schemas/users.schema.js';

import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';

@Injectable()
export class UsersManagementService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  private readonly publicFields =
    'fullName email role isActive lastLoginAt createdAt updatedAt';

  private validateId(id: string): void {
    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      throw new BadRequestException('Invalid user ID');
    }
  }

  private formatUser(user: unknown) {
    const data = user as Record<string, unknown>;

    return {
      id: String(data._id),
      fullName: data.fullName,
      email: data.email,
      role: data.role,
      isActive: data.isActive,
      lastLoginAt: data.lastLoginAt ?? null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  private handleDatabaseError(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      throw new ConflictException(
        'A user with this email already exists',
      );
    }

    throw error;
  }

  async create(dto: CreateUserDto) {
    const fullName = dto.fullName.trim();
    const email = dto.email.trim().toLowerCase();

    if (!fullName) {
      throw new BadRequestException(
        'Full name is required',
      );
    }

    if (Buffer.byteLength(dto.password, 'utf8') > 72) {
      throw new BadRequestException(
        'Password cannot exceed 72 bytes',
      );
    }

    const existing = await this.userModel.exists({
      email,
    });

    if (existing) {
      throw new ConflictException(
        'A user with this email already exists',
      );
    }

    const passwordHash = await bcrypt.hash(
      dto.password,
      12,
    );

    try {
      const user = await this.userModel.create({
        fullName,
        email,
        passwordHash,
        role: dto.role,
        isActive: true,
        lastLoginAt: null,
      });

      return {
        message: 'User created successfully',
        user: this.formatUser(user.toObject()),
      };
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async findAll(
    page = 1,
    limit = 10,
  ) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(
      100,
      Math.max(1, limit),
    );

    const skip = (safePage - 1) * safeLimit;

    const [users, total] = await Promise.all([
      this.userModel
        .find()
        .select(this.publicFields)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),

      this.userModel.countDocuments(),
    ]);

    return {
      data: users.map((user) =>
        this.formatUser(user),
      ),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async findOne(id: string) {
    this.validateId(id);

    const user = await this.userModel
      .findById(new Types.ObjectId(id))
      .select(this.publicFields)
      .lean();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      user: this.formatUser(user),
    };
  }

  async update(
    id: string,
    dto: UpdateUserDto,
  ) {
    this.validateId(id);

    const existing = await this.userModel
      .findById(id)
      .select('role')
      .lean();

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (
      existing.role === UserRole.ADMIN &&
      dto.role !== undefined
    ) {
      throw new ForbiddenException(
        'Admin role cannot be changed through this API',
      );
    }

    const updates: Record<string, unknown> = {};

    if (dto.fullName !== undefined) {
      const fullName = dto.fullName.trim();

      if (!fullName) {
        throw new BadRequestException(
          'Full name cannot be empty',
        );
      }

      updates.fullName = fullName;
    }

    if (dto.email !== undefined) {
      updates.email = dto.email.trim().toLowerCase();
    }

    if (dto.role !== undefined) {
      updates.role = dto.role;
    }

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException(
        'Provide at least one field to update',
      );
    }

    try {
      const user = await this.userModel
        .findByIdAndUpdate(
          id,
          { $set: updates },
          {
            new: true,
            runValidators: true,
          },
        )
        .select(this.publicFields)
        .lean();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        message: 'User updated successfully',
        user: this.formatUser(user),
      };
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async updateStatus(
    id: string,
    dto: UpdateUserStatusDto,
  ) {
    this.validateId(id);

    const existing = await this.userModel
      .findById(id)
      .select('role')
      .lean();

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    // Protect Admin accounts from accidental deactivation.
    if (existing.role === UserRole.ADMIN) {
      throw new ForbiddenException(
        'Admin account status cannot be changed through this API',
      );
    }

    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            isActive: dto.isActive,
          },
        },
        {
          new: true,
          runValidators: true,
        },
      )
      .select(this.publicFields)
      .lean();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      message: dto.isActive
        ? 'User activated successfully'
        : 'User deactivated successfully',
      user: this.formatUser(user),
    };
  }
}
