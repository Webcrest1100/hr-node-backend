
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { Connection, ClientSession } from 'mongoose';

import { Employee } from '../employees/schemas/employee.schema.js';
import { Shift } from '../shifts/schemas/shifts.schema.js';
import { ShiftAssignment } from '../shifts/schemas/shift-assignment.schema.js';

import { Leave, LeaveStatus } from './schemas/leaves.schema.js';
import { LeaveType } from './schemas/leave-type.schema.js';
import { LeaveBalance } from './schemas/leave-balance.schema.js';

import { CreateLeavesDto } from './dto/create-leaves.dto.js';
import {
  LeaveDecision,
  ReviewLeaveDto,
  UpdateLeavesDto,
} from './dto/update-leaves.dto.js';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto.js';
import { AllocateLeaveBalanceDto } from './dto/allocate-leave-balance.dto.js';

@Injectable()
export class LeavesService {
  constructor(
    @InjectModel(Leave.name)
    private readonly leaveModel: Model<Leave>,

    @InjectModel(LeaveType.name)
    private readonly typeModel: Model<LeaveType>,

    @InjectModel(LeaveBalance.name)
    private readonly balanceModel: Model<LeaveBalance>,

    @InjectModel(Employee.name)
    private readonly employeeModel: Model<Employee>,

    @InjectModel(ShiftAssignment.name)
    private readonly assignmentModel: Model<ShiftAssignment>,

    @InjectModel(Shift.name)
    private readonly shiftModel: Model<Shift>,

    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  private oid(id: string): Types.ObjectId {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      throw new BadRequestException('Invalid MongoDB ID');
    }
    return new Types.ObjectId(id);
  }

  private databaseError(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      throw new ConflictException(
        'Duplicate leave type or yearly balance',
      );
    }
    throw error;
  }

  private parseDate(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(
        'Date must use YYYY-MM-DD format',
      );
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException('Invalid calendar date');
    }

    return date;
  }

  private async getEmployee(userId: string) {
    const employee = await this.employeeModel
      .findOne({ userId: this.oid(userId) })
      .lean();

    if (!employee) {
      throw new NotFoundException(
        'Employee profile not found for this account',
      );
    }

    return employee;
  }

  private async getShift(employeeId: Types.ObjectId) {
    const assignment = await this.assignmentModel
      .findOne({ employeeId })
      .lean();

    if (!assignment) {
      throw new BadRequestException(
        'Employee needs an assigned shift before requesting leave',
      );
    }

    const shift = await this.shiftModel
      .findById(assignment.shiftId)
      .lean();

    if (!shift || !shift.isActive) {
      throw new BadRequestException(
        'Assigned shift is missing or inactive',
      );
    }

    return shift;
  }

  private async calculateDays(
    employeeId: Types.ObjectId,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const start = this.parseDate(startDate);
    const end = this.parseDate(endDate);

    if (end.getTime() < start.getTime()) {
      throw new BadRequestException(
        'End date must be on or after start date',
      );
    }

    if (startDate.slice(0, 4) !== endDate.slice(0, 4)) {
      throw new BadRequestException(
        'Cross-year leave requests must be submitted separately',
      );
    }

    const calendarDays =
      Math.round(
        (end.getTime() - start.getTime()) / 86400000,
      ) + 1;

    if (calendarDays > 366) {
      throw new BadRequestException(
        'Leave range cannot exceed 366 days',
      );
    }

    const shift = await this.getShift(employeeId);
    const workingDays = new Set(shift.workingDays);

    let days = 0;

    for (
      let time = start.getTime();
      time <= end.getTime();
      time += 86400000
    ) {
      const day = new Date(time).getUTCDay();
      if (workingDays.has(day)) {
        days += 1;
      }
    }

    if (days === 0) {
      throw new BadRequestException(
        'Selected dates contain no scheduled working days',
      );
    }

    return days;
  }

  private async checkOverlap(
    employeeId: Types.ObjectId,
    startDate: string,
    endDate: string,
    excludeId?: Types.ObjectId,
    approvedOnly = false,
    session?: ClientSession,
  ) {
    const filter = {
      employeeId,
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
      status: {
        $in: approvedOnly
          ? [LeaveStatus.APPROVED]
          : [LeaveStatus.PENDING, LeaveStatus.APPROVED],
      },
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    };

    const query = this.leaveModel.exists(filter);

    if (session) {
      query.session(session);
    }

    if (await query) {
      throw new ConflictException(
        'Overlapping leave request already exists',
      );
    }
  }

  private async paginate(
    filter: Record<string, unknown>,
    page: number,
    limit: number,
  ) {
    if (
      !Number.isSafeInteger(page) ||
      !Number.isSafeInteger(limit) ||
      page < 1 ||
      limit < 1 ||
      limit > 100
    ) {
      throw new BadRequestException(
        'Page must be >= 1 and limit between 1 and 100',
      );
    }

    const [data, total] = await Promise.all([
      this.leaveModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      this.leaveModel.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async getLeave(id: string) {
    const leave = await this.leaveModel
      .findById(this.oid(id))
      .lean();

    if (!leave) {
      throw new NotFoundException('Leave request not found');
    }

    return leave;
  }

  async createType(dto: CreateLeaveTypeDto) {
    const name = dto.name.trim();
    const code = dto.code.trim().toUpperCase();

    if (name.length < 2) {
      throw new BadRequestException(
        'Leave type name is too short',
      );
    }

    try {
      const type = await this.typeModel.create({
        name,
        code,
        isPaid: dto.isPaid ?? true,
        isActive: true,
        description: dto.description?.trim() ?? '',
      });

      return {
        message: 'Leave type created successfully',
        leaveType: type,
      };
    } catch (error) {
      this.databaseError(error);
    }
  }

  async findTypes() {
    return {
      data: await this.typeModel
        .find()
        .sort({ name: 1 })
        .lean(),
    };
  }

  async allocateBalance(dto: AllocateLeaveBalanceDto) {
    const employeeId = this.oid(dto.employeeId);
    const leaveTypeId = this.oid(dto.leaveTypeId);

    const [employee, type] = await Promise.all([
      this.employeeModel.findById(employeeId).lean(),
      this.typeModel.findById(leaveTypeId).lean(),
    ]);

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (!type) {
      throw new NotFoundException('Leave type not found');
    }

    const filter = {
      employeeId,
      leaveTypeId,
      year: dto.year,
    };

    const existing = await this.balanceModel
      .findOne(filter)
      .lean();

    if (existing) {
      if (dto.allocated < existing.used) {
        throw new ConflictException(
          'Allocation cannot be less than used days',
        );
      }

      const updated = await this.balanceModel.findOneAndUpdate(
        {
          _id: existing._id,
          allocated: existing.allocated,
          used: existing.used,
        },
        {
          $set: {
            allocated: dto.allocated,
            remaining: dto.allocated - existing.used,
          },
        },
        {
          new: true,
          runValidators: true,
        },
      );

      if (!updated) {
        throw new ConflictException(
          'Balance changed concurrently; retry allocation',
        );
      }

      return {
        message: 'Leave balance updated successfully',
        balance: updated,
      };
    }

    try {
      const balance = await this.balanceModel.create({
        ...filter,
        allocated: dto.allocated,
        used: 0,
        remaining: dto.allocated,
      });

      return {
        message: 'Leave balance allocated successfully',
        balance,
      };
    } catch (error) {
      this.databaseError(error);
    }
  }

  async findEmployeeBalances(employeeId: string) {
    const id = this.oid(employeeId);

    if (!(await this.employeeModel.exists({ _id: id }))) {
      throw new NotFoundException('Employee not found');
    }

    return {
      data: await this.balanceModel
        .find({ employeeId: id })
        .populate('leaveTypeId', 'name code isPaid isActive')
        .sort({ year: -1 })
        .lean(),
    };
  }

  async findMineBalances(userId: string) {
    const employee = await this.getEmployee(userId);

    return this.findEmployeeBalances(String(employee._id));
  }

  async create(userId: string, dto: CreateLeavesDto) {
    const employee = await this.getEmployee(userId);
    const leaveTypeId = this.oid(dto.leaveTypeId);

    const type = await this.typeModel
      .findById(leaveTypeId)
      .lean();

    if (!type || !type.isActive) {
      throw new BadRequestException(
        'Leave type is unavailable',
      );
    }

    const days = await this.calculateDays(
      employee._id,
      dto.startDate,
      dto.endDate,
    );

    const balance = await this.balanceModel.findOne({
      employeeId: employee._id,
      leaveTypeId,
      year: Number(dto.startDate.slice(0, 4)),
    });

    if (!balance) {
      throw new BadRequestException(
        'Annual leave balance has not been allocated',
      );
    }

    if (balance.remaining < days) {
      throw new ConflictException(
        'Insufficient available leave balance',
      );
    }

    const reason = dto.reason.trim();

    if (reason.length < 10) {
      throw new BadRequestException(
        'Reason must be at least 10 characters',
      );
    }

    await this.checkOverlap(
      employee._id,
      dto.startDate,
      dto.endDate,
    );

    const leave = await this.leaveModel.create({
      employeeId: employee._id,
      leaveTypeId,
      requestedBy: this.oid(userId),
      startDate: dto.startDate,
      endDate: dto.endDate,
      days,
      reason,
      status: LeaveStatus.PENDING,
    });

    return {
      message: 'Leave request submitted successfully',
      leave,
    };
  }

  async findMine(
    userId: string,
    page = 1,
    limit = 10,
  ) {
    const employee = await this.getEmployee(userId);

    return this.paginate(
      { employeeId: employee._id },
      page,
      limit,
    );
  }

  async findAll(
    page = 1,
    limit = 10,
    status?: string,
  ) {
    if (
      status &&
      !Object.values(LeaveStatus).includes(
        status as LeaveStatus,
      )
    ) {
      throw new BadRequestException(
        'Invalid leave status',
      );
    }

    return this.paginate(
      status ? { status } : {},
      page,
      limit,
    );
  }

  async findOne(
    id: string,
    userId: string,
    role: string,
  ) {
    const leave = await this.getLeave(id);
    const isStaff = role === 'admin' || role === 'hr';

    if (
      !isStaff &&
      String(leave.requestedBy) !== userId
    ) {
      throw new ForbiddenException(
        'You cannot view another employee leave request',
      );
    }

    return { leave };
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateLeavesDto,
  ) {
    const leave = await this.getLeave(id);

    if (String(leave.requestedBy) !== userId) {
      throw new ForbiddenException(
        'Only the request owner may update it',
      );
    }

    if (leave.status !== LeaveStatus.PENDING) {
      throw new ConflictException(
        'Only pending requests can be updated',
      );
    }

    if (
      dto.startDate === undefined &&
      dto.endDate === undefined &&
      dto.reason === undefined
    ) {
      throw new BadRequestException(
        'Provide at least one field to update',
      );
    }

    const startDate = dto.startDate ?? leave.startDate;
    const endDate = dto.endDate ?? leave.endDate;

    const days = await this.calculateDays(
      leave.employeeId,
      startDate,
      endDate,
    );

    await this.checkOverlap(
      leave.employeeId,
      startDate,
      endDate,
      leave._id,
    );

    const balance = await this.balanceModel
      .findOne({
        employeeId: leave.employeeId,
        leaveTypeId: leave.leaveTypeId,
        year: Number(startDate.slice(0, 4)),
      })
      .lean();

    if (!balance || balance.remaining < days) {
      throw new ConflictException(
        'Insufficient allocated leave balance',
      );
    }

    const reason = dto.reason?.trim() ?? leave.reason;

    if (reason.length < 10) {
      throw new BadRequestException(
        'Reason must be at least 10 characters',
      );
    }

    const updated = await this.leaveModel.findOneAndUpdate(
      {
        _id: leave._id,
        status: LeaveStatus.PENDING,
        requestedBy: this.oid(userId),
      },
      {
        $set: {
          startDate,
          endDate,
          days,
          reason,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updated) {
      throw new ConflictException(
        'Leave is no longer pending',
      );
    }

    return {
      message: 'Leave request updated successfully',
      leave: updated,
    };
  }

  async cancel(id: string, userId: string) {
    const leave = await this.leaveModel.findOneAndUpdate(
      {
        _id: this.oid(id),
        requestedBy: this.oid(userId),
        status: LeaveStatus.PENDING,
      },
      {
        $set: {
          status: LeaveStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      },
      { new: true },
    );

    if (!leave) {
      throw new ConflictException(
        'Pending leave request not found or not owned by you',
      );
    }

    return {
      message: 'Leave request cancelled successfully',
      leave,
    };
  }

  async review(
    id: string,
    reviewerUserId: string,
    dto: ReviewLeaveDto,
  ) {
    const leaveId = this.oid(id);
    const reviewerId = this.oid(reviewerUserId);
    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        const leave = await this.leaveModel
          .findById(leaveId)
          .session(session);

        if (!leave) {
          throw new NotFoundException(
            'Leave request not found',
          );
        }

        if (leave.status !== LeaveStatus.PENDING) {
          throw new ConflictException(
            'Leave request already reviewed',
          );
        }

        if (
          String(leave.requestedBy) === reviewerUserId
        ) {
          throw new ForbiddenException(
            'You cannot review your own leave request',
          );
        }

        if (dto.decision === LeaveDecision.APPROVED) {
          await this.checkOverlap(
            leave.employeeId,
            leave.startDate,
            leave.endDate,
            leave._id,
            true,
            session,
          );

          const balanceResult =
            await this.balanceModel.updateOne(
              {
                employeeId: leave.employeeId,
                leaveTypeId: leave.leaveTypeId,
                year: Number(
                  leave.startDate.slice(0, 4),
                ),
                remaining: { $gte: leave.days },
              },
              {
                $inc: {
                  used: leave.days,
                  remaining: -leave.days,
                },
              },
              { session },
            );

          if (balanceResult.modifiedCount !== 1) {
            throw new ConflictException(
              'Insufficient leave balance or allocation missing',
            );
          }
        }

        const result = await this.leaveModel.updateOne(
          {
            _id: leaveId,
            status: LeaveStatus.PENDING,
          },
          {
            $set: {
              status:
                dto.decision === LeaveDecision.APPROVED
                  ? LeaveStatus.APPROVED
                  : LeaveStatus.REJECTED,
              reviewedBy: reviewerId,
              reviewedAt: new Date(),
              reviewNote:
                dto.reviewNote?.trim() ?? '',
            },
          },
          { session },
        );

        if (result.modifiedCount !== 1) {
          throw new ConflictException(
            'Leave review state changed',
          );
        }
      });
    } finally {
      await session.endSession();
    }

    return {
      message:
        dto.decision === LeaveDecision.APPROVED
          ? 'Leave approved successfully'
          : 'Leave rejected successfully',
      leave: await this.getLeave(id),
    };
  }
}
