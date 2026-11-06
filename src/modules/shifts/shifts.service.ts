
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Shift } from './schemas/shifts.schema.js';
import { ShiftAssignment } from './schemas/shift-assignment.schema.js';
import {
  Employee,
  EmploymentStatus,
} from '../employees/schemas/employee.schema.js';
import { User } from '../users/schemas/users.schema.js';

import { CreateShiftsDto } from './dto/create-shifts.dto.js';
import { UpdateShiftsDto } from './dto/update-shifts.dto.js';
import { AssignShiftDto } from './dto/assign-shift.dto.js';

type ShiftValues = {
  startTime: string;
  endTime: string;
  breakMinutes: number;
  timezone: string;
};

@Injectable()
export class ShiftsService {
  constructor(
    @InjectModel(Shift.name)
    private readonly shiftModel: Model<Shift>,

    @InjectModel(ShiftAssignment.name)
    private readonly assignmentModel: Model<ShiftAssignment>,

    @InjectModel(Employee.name)
    private readonly employeeModel: Model<Employee>,

    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  private validateId(id: string): void {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      throw new BadRequestException('Invalid MongoDB ID');
    }
  }

  private toMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private getDuration(values: ShiftValues) {
    const start = this.toMinutes(values.startTime);
    const end = this.toMinutes(values.endTime);

    if (start === end) {
      throw new BadRequestException(
        'Start and end time cannot be equal',
      );
    }

    const overnight = end < start;
    const durationMinutes =
      (end - start + 1440) % 1440;

    if (
      values.breakMinutes < 0 ||
      values.breakMinutes >= durationMinutes
    ) {
      throw new BadRequestException(
        'Break must be shorter than shift duration',
      );
    }

    return {
      overnight,
      durationMinutes,
      workingMinutes:
        durationMinutes - values.breakMinutes,
    };
  }

  private validateTimezone(timezone: string): void {
    try {
      new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
      });
    } catch {
      throw new BadRequestException(
        'Invalid IANA timezone',
      );
    }
  }

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  private validateShiftValues(values: ShiftValues) {
    this.validateTimezone(values.timezone);
    return this.getDuration(values);
  }

  private publicShift(shift: Record<string, any>) {
    const duration = this.getDuration({
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakMinutes: shift.breakMinutes,
      timezone: shift.timezone,
    });

    return {
      id: String(shift._id),
      name: shift.name,
      code: shift.code,
      startTime: shift.startTime,
      endTime: shift.endTime,
      timezone: shift.timezone,
      workingDays: shift.workingDays,
      breakMinutes: shift.breakMinutes,
      graceMinutes: shift.graceMinutes,
      description: shift.description,
      isActive: shift.isActive,
      ...duration,
      createdAt: shift.createdAt,
      updatedAt: shift.updatedAt,
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
        'Shift code or employee assignment already exists',
      );
    }

    throw error;
  }

  private async getShiftOrFail(id: string) {
    this.validateId(id);

    const shift = await this.shiftModel.findById(id).lean();

    if (!shift) {
      throw new NotFoundException('Shift not found');
    }

    return shift;
  }

  async create(dto: CreateShiftsDto) {
    const name = dto.name.trim();
    const code = this.normalizeCode(dto.code);
    const timezone = dto.timezone ?? 'Asia/Karachi';
    const breakMinutes = dto.breakMinutes ?? 60;

    if (name.length < 2) {
      throw new BadRequestException(
        'Shift name must contain at least 2 characters',
      );
    }

    this.validateShiftValues({
      startTime: dto.startTime,
      endTime: dto.endTime,
      breakMinutes,
      timezone,
    });

    try {
      const shift = await this.shiftModel.create({
        name,
        code,
        startTime: dto.startTime,
        endTime: dto.endTime,
        timezone,
        workingDays: [...dto.workingDays].sort(),
        breakMinutes,
        graceMinutes: dto.graceMinutes ?? 15,
        description: dto.description?.trim() ?? '',
        isActive: true,
      });

      return {
        message: 'Shift created successfully',
        shift: this.publicShift(shift.toObject()),
      };
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async findAll(page = 1, limit = 10) {
    if (page < 1 || limit < 1 || limit > 100) {
      throw new BadRequestException(
        'Page must be >= 1 and limit between 1 and 100',
      );
    }

    const [shifts, total] = await Promise.all([
      this.shiftModel
        .find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.shiftModel.countDocuments(),
    ]);

    return {
      data: shifts.map((shift) => this.publicShift(shift)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const shift = await this.getShiftOrFail(id);

    const assignedEmployees =
      await this.assignmentModel.countDocuments({
        shiftId: shift._id,
      });

    return {
      shift: {
        ...this.publicShift(shift),
        assignedEmployees,
      },
    };
  }

  async update(id: string, dto: UpdateShiftsDto) {
    const existing = await this.getShiftOrFail(id);

    const updates: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();

      if (name.length < 2) {
        throw new BadRequestException(
          'Shift name must contain at least 2 characters',
        );
      }

      updates.name = name;
    }

    if (dto.code !== undefined) {
      updates.code = this.normalizeCode(dto.code);
    }

    if (dto.startTime !== undefined) {
      updates.startTime = dto.startTime;
    }

    if (dto.endTime !== undefined) {
      updates.endTime = dto.endTime;
    }

    if (dto.timezone !== undefined) {
      updates.timezone = dto.timezone;
    }

    if (dto.workingDays !== undefined) {
      updates.workingDays = [...dto.workingDays].sort();
    }

    if (dto.breakMinutes !== undefined) {
      updates.breakMinutes = dto.breakMinutes;
    }

    if (dto.graceMinutes !== undefined) {
      updates.graceMinutes = dto.graceMinutes;
    }

    if (dto.description !== undefined) {
      updates.description = dto.description.trim();
    }

    if (!Object.keys(updates).length) {
      throw new BadRequestException(
        'Provide at least one field',
      );
    }

    this.validateShiftValues({
      startTime:
        (updates.startTime as string | undefined) ??
        existing.startTime,
      endTime:
        (updates.endTime as string | undefined) ??
        existing.endTime,
      breakMinutes:
        (updates.breakMinutes as number | undefined) ??
        existing.breakMinutes,
      timezone:
        (updates.timezone as string | undefined) ??
        existing.timezone,
    });

    try {
      const shift = await this.shiftModel
        .findByIdAndUpdate(
          id,
          { $set: updates },
          { new: true, runValidators: true },
        )
        .lean();

      if (!shift) {
        throw new NotFoundException('Shift not found');
      }

      return {
        message: 'Shift updated successfully',
        shift: this.publicShift(shift),
      };
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async updateStatus(id: string, isActive: boolean) {
    const existing = await this.getShiftOrFail(id);

    if (!isActive && existing.isActive) {
      const assignment = await this.assignmentModel.exists({
        shiftId: existing._id,
      });

      if (assignment) {
        throw new ConflictException(
          'Remove employee assignments before deactivating shift',
        );
      }
    }

    const shift = await this.shiftModel
      .findByIdAndUpdate(
        id,
        { $set: { isActive } },
        { new: true, runValidators: true },
      )
      .lean();

    if (!shift) {
      throw new NotFoundException('Shift not found');
    }

    return {
      message: isActive
        ? 'Shift activated successfully'
        : 'Shift deactivated successfully',
      shift: this.publicShift(shift),
    };
  }

  private async getAssignmentForEmployee(
    employeeId: string,
  ) {
    this.validateId(employeeId);

    const employee = await this.employeeModel
      .findById(employeeId)
      .lean();

    if (!employee) {
      throw new NotFoundException(
        'Employee profile not found',
      );
    }

    const assignment = await this.assignmentModel
      .findOne({ employeeId: employee._id })
      .lean();

    if (!assignment) {
      throw new NotFoundException(
        'No shift assigned to this employee',
      );
    }

    const shift = await this.shiftModel
      .findById(assignment.shiftId)
      .lean();

    if (!shift) {
      throw new NotFoundException(
        'Assigned shift no longer exists',
      );
    }

    return {
      assignmentId: String(assignment._id),
      employeeId: String(employee._id),
      shiftId: String(shift._id),
      assignedAt: assignment.assignedAt,
      assignedBy: assignment.assignedBy
        ? String(assignment.assignedBy)
        : null,
      shift: this.publicShift(shift),
    };
  }

  async assign(
    dto: AssignShiftDto,
    actorUserId: string,
  ) {
    this.validateId(dto.employeeId);
    this.validateId(dto.shiftId);
    this.validateId(actorUserId);

    const [employee, shift] = await Promise.all([
      this.employeeModel.findById(dto.employeeId).lean(),
      this.shiftModel.findById(dto.shiftId).lean(),
    ]);

    if (!employee) {
      throw new NotFoundException(
        'Employee profile not found',
      );
    }

    if (!shift) {
      throw new NotFoundException('Shift not found');
    }

    if (!shift.isActive) {
      throw new BadRequestException(
        'Cannot assign an inactive shift',
      );
    }

    if (
      employee.employmentStatus === EmploymentStatus.RESIGNED ||
      employee.employmentStatus === EmploymentStatus.TERMINATED
    ) {
      throw new BadRequestException(
        'Cannot assign a shift to a former employee',
      );
    }

    const user = await this.userModel
      .findById(employee.userId)
      .select('isActive')
      .lean();

    if (!user?.isActive) {
      throw new BadRequestException(
        'Employee login account is inactive',
      );
    }

    const employeeObjectId = new Types.ObjectId(
      dto.employeeId,
    );

    const shiftObjectId = new Types.ObjectId(
      dto.shiftId,
    );

    try {
      await this.assignmentModel.findOneAndUpdate(
        { employeeId: employeeObjectId },
        {
          $set: {
            shiftId: shiftObjectId,
            assignedAt: new Date(),
            assignedBy: new Types.ObjectId(actorUserId),
          },
          $setOnInsert: {
            employeeId: employeeObjectId,
          },
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
        },
      );
    } catch (error) {
      this.handleDatabaseError(error);
    }

    return {
      message: 'Shift assigned successfully',
      assignment: await this.getAssignmentForEmployee(
        dto.employeeId,
      ),
    };
  }

  async findEmployeeAssignment(employeeId: string) {
    return {
      assignment: await this.getAssignmentForEmployee(
        employeeId,
      ),
    };
  }

  async findMine(userId: string) {
    this.validateId(userId);

    const employee = await this.employeeModel
      .findOne({
        userId: new Types.ObjectId(userId),
      })
      .lean();

    if (!employee) {
      throw new NotFoundException(
        'No employee profile linked to your account',
      );
    }

    return {
      assignment: await this.getAssignmentForEmployee(
        String(employee._id),
      ),
    };
  }

  async removeAssignment(employeeId: string) {
    this.validateId(employeeId);

    const assignment = await this.assignmentModel
      .findOneAndDelete({
        employeeId: new Types.ObjectId(employeeId),
      })
      .lean();

    if (!assignment) {
      throw new NotFoundException(
        'No shift assignment found',
      );
    }

    return {
      message: 'Shift assignment removed successfully',
      employeeId,
    };
  }
}
