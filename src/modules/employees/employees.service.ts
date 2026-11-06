
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import {
  Model,
  Types,
} from 'mongoose';

import {
  Employee,
} from './schemas/employee.schema.js';

import {
  User,
  UserRole,
} from '../users/schemas/users.schema.js';

import {
  CreateEmployeeDto,
} from './dto/create-employee.dto.js';

import {
  UpdateEmployeeDto,
} from './dto/update-employee.dto.js';

import {
  UpdateEmploymentStatusDto,
} from './dto/update-employment-status.dto.js';

@Injectable()
export class EmployeesService {
  constructor(
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

  private readonly userFields =
    'fullName email role isActive';

  private handleDatabaseError(
    error: unknown,
  ): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      throw new ConflictException(
        'Employee code or user profile already exists',
      );
    }

    throw error;
  }

  async create(dto: CreateEmployeeDto) {
    this.validateId(dto.userId);

    const employeeCode =
      dto.employeeCode.trim().toUpperCase();

    const designation =
      dto.designation.trim();

    if (!employeeCode || !designation) {
      throw new BadRequestException(
        'Employee code and designation are required',
      );
    }

    const user = await this.userModel
      .findById(dto.userId)
      .select('role isActive')
      .lean();

    if (!user) {
      throw new NotFoundException(
        'Linked user account not found',
      );
    }

    if (!user.isActive) {
      throw new BadRequestException(
        'Linked user account is inactive',
      );
    }

    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException(
        'Admin account cannot be linked through this API',
      );
    }

    const existing = await this.employeeModel.exists({
      $or: [
        {
          userId: new Types.ObjectId(dto.userId),
        },
        {
          employeeCode,
        },
      ],
    });

    if (existing) {
      throw new ConflictException(
        'Employee code or user profile already exists',
      );
    }

    try {
      const employee =
        await this.employeeModel.create({
          userId: new Types.ObjectId(dto.userId),
          employeeCode,
          designation,
          department: dto.department?.trim() ?? '',
          phone: dto.phone?.trim() ?? '',
          joiningDate: new Date(dto.joiningDate),
          notes: dto.notes?.trim() ?? '',
        });

      const result = await this.employeeModel
        .findById(employee._id)
        .select('-__v')
        .populate('userId', this.userFields)
        .lean();

      return {
        message: 'Employee profile created successfully',
        employee: result,
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

    const skip =
      (safePage - 1) * safeLimit;

    const [employees, total] =
      await Promise.all([
        this.employeeModel
          .find()
          .select('-__v')
          .populate(
            'userId',
            this.userFields,
          )
          .sort({
            createdAt: -1,
          })
          .skip(skip)
          .limit(safeLimit)
          .lean(),

        this.employeeModel.countDocuments(),
      ]);

    return {
      data: employees,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(
          total / safeLimit,
        ),
      },
    };
  }

  async findOne(id: string) {
    this.validateId(id);

    const employee =
      await this.employeeModel
        .findById(id)
        .select('-__v')
        .populate(
          'userId',
          this.userFields,
        )
        .lean();

    if (!employee) {
      throw new NotFoundException(
        'Employee profile not found',
      );
    }

    return {
      employee,
    };
  }

  async findMine(userId: string) {
    this.validateId(userId);

    const employee =
      await this.employeeModel
        .findOne({
          userId: new Types.ObjectId(
            userId,
          ),
        })
        .select('-__v')
        .populate(
          'userId',
          this.userFields,
        )
        .lean();

    if (!employee) {
      throw new NotFoundException(
        'No employee profile linked to your account',
      );
    }

    return {
      employee,
    };
  }

  async update(
    id: string,
    dto: UpdateEmployeeDto,
  ) {
    this.validateId(id);

    const updates: Record<
      string,
      unknown
    > = {};

    if (dto.designation !== undefined) {
      const designation =
        dto.designation.trim();

      if (!designation) {
        throw new BadRequestException(
          'Designation cannot be empty',
        );
      }

      updates.designation = designation;
    }

    if (dto.department !== undefined) {
      updates.department =
        dto.department.trim();
    }

    if (dto.phone !== undefined) {
      updates.phone =
        dto.phone.trim();
    }

    if (dto.joiningDate !== undefined) {
      updates.joiningDate =
        new Date(dto.joiningDate);
    }

    if (dto.notes !== undefined) {
      updates.notes =
        dto.notes.trim();
    }

    if (
      Object.keys(updates).length === 0
    ) {
      throw new BadRequestException(
        'Provide at least one field to update',
      );
    }

    const employee =
      await this.employeeModel
        .findByIdAndUpdate(
          id,
          {
            $set: updates,
          },
          {
            new: true,
            runValidators: true,
          },
        )
        .select('-__v')
        .populate(
          'userId',
          this.userFields,
        )
        .lean();

    if (!employee) {
      throw new NotFoundException(
        'Employee profile not found',
      );
    }

    return {
      message: 'Employee profile updated successfully',
      employee,
    };
  }

  async updateStatus(
    id: string,
    dto: UpdateEmploymentStatusDto,
  ) {
    this.validateId(id);

    const employee =
      await this.employeeModel
        .findByIdAndUpdate(
          id,
          {
            $set: {
              employmentStatus:
                dto.employmentStatus,
            },
          },
          {
            new: true,
            runValidators: true,
          },
        )
        .select('-__v')
        .populate(
          'userId',
          this.userFields,
        )
        .lean();

    if (!employee) {
      throw new NotFoundException(
        'Employee profile not found',
      );
    }

    return {
      message:
        'Employment status updated successfully',
      employee,
    };
  }
}
