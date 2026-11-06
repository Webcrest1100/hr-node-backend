
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Department } from './schemas/departments.schema.js';
import { Employee } from '../employees/schemas/employee.schema.js';
import { User } from '../users/schemas/users.schema.js';

import { CreateDepartmentsDto } from './dto/create-departments.dto.js';
import { UpdateDepartmentsDto } from './dto/update-departments.dto.js';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectModel(Department.name)
    private readonly departmentModel: Model<Department>,

    @InjectModel(Employee.name)
    private readonly employeeModel: Model<Employee>,

    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  private validateId(id: string): void {
    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      throw new BadRequestException(
        'Invalid MongoDB ID',
      );
    }
  }

  private normalizeName(name: string): string {
    return name.trim().replace(/\s+/g, ' ');
  }

  private nameKey(name: string): string {
    return this.normalizeName(name).toLowerCase();
  }

  private handleDatabaseError(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      throw new ConflictException(
        'Department name or code already exists',
      );
    }

    throw error;
  }

  private async verifyManager(
    managerUserId: string,
  ): Promise<Types.ObjectId> {
    this.validateId(managerUserId);

    const manager = await this.userModel
      .findById(managerUserId)
      .select('isActive')
      .lean();

    if (!manager) {
      throw new NotFoundException(
        'Department manager user not found',
      );
    }

    if (!manager.isActive) {
      throw new BadRequestException(
        'Department manager account is inactive',
      );
    }

    return new Types.ObjectId(managerUserId);
  }

  private async serialize(department: Department | Record<string, any>) {
    const data = department as Record<string, any>;

    const employeeCount = await this.employeeModel
      .countDocuments({
        department: data.name,
      });

    let manager = null;

    if (data.managerUserId) {
      const managerUser = await this.userModel
        .findById(data.managerUserId)
        .select('fullName email role isActive')
        .lean();

      if (managerUser) {
        manager = {
          id: String(managerUser._id),
          fullName: managerUser.fullName,
          email: managerUser.email,
          role: managerUser.role,
          isActive: managerUser.isActive,
        };
      }
    }

    return {
      id: String(data._id),
      name: data.name,
      code: data.code,
      description: data.description,
      managerUserId: data.managerUserId
        ? String(data.managerUserId)
        : null,
      manager,
      employeeCount,
      isActive: data.isActive,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  async create(dto: CreateDepartmentsDto) {
    const name = this.normalizeName(dto.name);
    const code = dto.code.trim().toUpperCase();

    if (name.length < 2) {
      throw new BadRequestException(
        'Department name must contain at least 2 characters',
      );
    }

    const managerUserId = dto.managerUserId
      ? await this.verifyManager(dto.managerUserId)
      : null;

    try {
      const department = await this.departmentModel.create({
        name,
        nameKey: this.nameKey(name),
        code,
        description: dto.description?.trim() ?? '',
        managerUserId,
        isActive: true,
      });

      return {
        message: 'Department created successfully',
        department: await this.serialize(
          department.toObject(),
        ),
      };
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async findAll(page = 1, limit = 10) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(
      100,
      Math.max(1, limit),
    );

    const [departments, total] = await Promise.all([
      this.departmentModel
        .find()
        .sort({ name: 1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean(),

      this.departmentModel.countDocuments(),
    ]);

    const data = await Promise.all(
      departments.map((department) =>
        this.serialize(department),
      ),
    );

    return {
      data,
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

    const department = await this.departmentModel
      .findById(id)
      .lean();

    if (!department) {
      throw new NotFoundException(
        'Department not found',
      );
    }

    return {
      department: await this.serialize(department),
    };
  }

  async update(
    id: string,
    dto: UpdateDepartmentsDto,
  ) {
    this.validateId(id);

    const existing = await this.departmentModel
      .findById(id)
      .lean();

    if (!existing) {
      throw new NotFoundException(
        'Department not found',
      );
    }

    const updates: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      const name = this.normalizeName(dto.name);

      if (name.length < 2) {
        throw new BadRequestException(
          'Department name must contain at least 2 characters',
        );
      }

      if (name !== existing.name) {
        const assigned = await this.employeeModel.exists({
          department: existing.name,
        });

        if (assigned) {
          throw new ConflictException(
            'Cannot rename department while employees are assigned to it',
          );
        }
      }

      updates.name = name;
      updates.nameKey = this.nameKey(name);
    }

    if (dto.code !== undefined) {
      updates.code = dto.code.trim().toUpperCase();
    }

    if (dto.description !== undefined) {
      updates.description = dto.description.trim();
    }

    if (dto.managerUserId !== undefined) {
      updates.managerUserId = dto.managerUserId
        ? await this.verifyManager(dto.managerUserId)
        : null;
    }

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException(
        'Provide at least one field to update',
      );
    }

    try {
      const department = await this.departmentModel
        .findByIdAndUpdate(
          id,
          { $set: updates },
          {
            new: true,
            runValidators: true,
          },
        )
        .lean();

      if (!department) {
        throw new NotFoundException(
          'Department not found',
        );
      }

      return {
        message: 'Department updated successfully',
        department: await this.serialize(department),
      };
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async updateStatus(
    id: string,
    isActive: boolean,
  ) {
    this.validateId(id);

    const existing = await this.departmentModel
      .findById(id)
      .lean();

    if (!existing) {
      throw new NotFoundException(
        'Department not found',
      );
    }

    if (!isActive && existing.isActive) {
      const assigned = await this.employeeModel.exists({
        department: existing.name,
      });

      if (assigned) {
        throw new ConflictException(
          'Reassign department employees before deactivation',
        );
      }
    }

    const department = await this.departmentModel
      .findByIdAndUpdate(
        id,
        { $set: { isActive } },
        {
          new: true,
          runValidators: true,
        },
      )
      .lean();

    if (!department) {
      throw new NotFoundException(
        'Department not found',
      );
    }

    return {
      message: isActive
        ? 'Department activated successfully'
        : 'Department deactivated successfully',
      department: await this.serialize(department),
    };
  }
}
