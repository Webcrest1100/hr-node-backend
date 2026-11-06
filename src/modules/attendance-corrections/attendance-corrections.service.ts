import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model, Types } from 'mongoose';

import {
  Attendance,
  AttendanceStatus,
} from '../attendance/schemas/attendance.schema.js';

import {
  Employee,
} from '../employees/schemas/employee.schema.js';

import {
  Shift,
} from '../shifts/schemas/shifts.schema.js';

import {
  AttendanceCorrection,
  CorrectionStatus,
} from './schemas/attendance-corrections.schema.js';

import {
  CreateAttendanceCorrectionsDto,
} from './dto/create-attendance-corrections.dto.js';

import {
  CorrectionDecision,
  ReviewAttendanceCorrectionDto,
  UpdateAttendanceCorrectionsDto,
} from './dto/update-attendance-corrections.dto.js';

type CorrectionFilter = {
  employeeId?: Types.ObjectId;
  status?: CorrectionStatus;
};

type CheckTimes = {
  checkInAt: Date;
  checkOutAt: Date;
};

type BreakEntry = {
  startAt: Date;
  endAt: Date | null;
};

@Injectable()
export class AttendanceCorrectionsService {
  constructor(
    @InjectModel(AttendanceCorrection.name)
    private readonly correctionModel:
      Model<AttendanceCorrection>,

    @InjectModel(Attendance.name)
    private readonly attendanceModel: Model<Attendance>,

    @InjectModel(Employee.name)
    private readonly employeeModel: Model<Employee>,

    @InjectModel(Shift.name)
    private readonly shiftModel: Model<Shift>,
  ) { }

  private validateId(id: string) {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      throw new BadRequestException('Invalid MongoDB ID');
    }
  }

  private handleDatabaseError(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      throw new ConflictException(
        'A pending correction already exists for this attendance',
      );
    }

    throw error;
  }

  private async getEmployee(userId: string) {
    this.validateId(userId);

    const employee = await this.employeeModel
      .findOne({
        userId: new Types.ObjectId(userId),
      })
      .lean();

    if (!employee) {
      throw new NotFoundException(
        'Employee profile not found for this account',
      );
    }

    return employee;
  }

  private validateTimes(
    times: CheckTimes,
    breaks: BreakEntry[],
  ) {
    const start = times.checkInAt.getTime();
    const end = times.checkOutAt.getTime();

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end <= start
    ) {
      throw new BadRequestException(
        'Checkout must be later than check-in',
      );
    }

    const duration = end - start;

    if (duration > 36 * 60 * 60 * 1000) {
      throw new BadRequestException(
        'Attendance duration cannot exceed 36 hours',
      );
    }

    let totalBreakMs = 0;

    for (const entry of breaks) {
      if (!entry.endAt) {
        throw new ConflictException(
          'Complete all attendance breaks before requesting correction',
        );
      }

      const breakStart = new Date(entry.startAt).getTime();
      const breakEnd = new Date(entry.endAt).getTime();

      if (
        !Number.isFinite(breakStart) ||
        !Number.isFinite(breakEnd) ||
        breakStart < start ||
        breakEnd > end ||
        breakEnd <= breakStart
      ) {
        throw new BadRequestException(
          'Corrected times must include all recorded breaks',
        );
      }

      totalBreakMs += breakEnd - breakStart;
    }

    if (totalBreakMs > duration) {
      throw new BadRequestException(
        'Total breaks exceed attendance duration',
      );
    }

    const totalMinutes = Math.floor(duration / 60000);
    const breakMinutes = Math.floor(totalBreakMs / 60000);

    return {
      breakMinutes,
      workedMinutes: Math.max(
        0,
        totalMinutes - breakMinutes,
      ),
    };
  }

  private localClock(date: Date, timezone: string) {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });

    const parts: Record<string, string> = {};

    for (const part of formatter.formatToParts(date)) {
      if (part.type !== 'literal') {
        parts[part.type] = part.value;
      }
    }

    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      minutes:
        Number(parts.hour) * 60 +
        Number(parts.minute),
    };
  }

  private calculateLate(
    checkInAt: Date,
    workDate: string,
    timezone: string,
    scheduledStartTime: string,
    graceMinutes: number,
    scheduledEndTime: string,
  ) {
    const local = this.localClock(
      checkInAt,
      timezone,
    );

    const [startHour, startMinute] =
      scheduledStartTime.split(':').map(Number);

    const [endHour, endMinute] =
      scheduledEndTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    const nextDate = new Date(
      `${workDate}T00:00:00.000Z`,
    );

    nextDate.setUTCDate(nextDate.getUTCDate() + 1);

    const nextDateText = nextDate
      .toISOString()
      .slice(0, 10);

    const overnight = endMinutes < startMinutes;

    let checkInMinute = local.minutes;

    if (local.date === workDate) {
      // Normal attendance work date.
    } else if (
      overnight &&
      local.date === nextDateText &&
      local.minutes <= endMinutes
    ) {
      checkInMinute += 1440;
    } else {
      throw new BadRequestException(
        'Corrected check-in is outside the attendance work date',
      );
    }

    const lateMinutes = Math.max(
      0,
      checkInMinute - startMinutes - graceMinutes,
    );

    return {
      lateMinutes,
      status:
        lateMinutes > 0
          ? AttendanceStatus.LATE
          : AttendanceStatus.PRESENT,
    };
  }

  private async getAttendanceForEmployee(
    attendanceId: string,
    employeeId: Types.ObjectId,
  ) {
    this.validateId(attendanceId);

    const attendance = await this.attendanceModel
      .findOne({
        _id: new Types.ObjectId(attendanceId),
        employeeId,
      })
      .lean();

    if (!attendance) {
      throw new NotFoundException(
        'Attendance record not found for this employee',
      );
    }

    if (!attendance.checkOutAt || attendance.isOnBreak) {
      throw new ConflictException(
        'Only completed attendance can be corrected',
      );
    }

    return attendance;
  }

  async create(
    userId: string,
    dto: CreateAttendanceCorrectionsDto,
  ) {
    if (
      dto.proposedCheckInAt === undefined &&
      dto.proposedCheckOutAt === undefined
    ) {
      throw new BadRequestException(
        'Provide a corrected check-in or checkout time',
      );
    }

    const employee = await this.getEmployee(userId);

    const attendance =
      await this.getAttendanceForEmployee(
        dto.attendanceId,
        employee._id,
      );

    const proposedCheckInAt = dto.proposedCheckInAt
      ? new Date(dto.proposedCheckInAt)
      : new Date(attendance.checkInAt);

    const proposedCheckOutAt = dto.proposedCheckOutAt
      ? new Date(dto.proposedCheckOutAt)
      : new Date(attendance.checkOutAt!);

    this.validateTimes(
      {
        checkInAt: proposedCheckInAt,
        checkOutAt: proposedCheckOutAt,
      },
      attendance.breaks,
    );

    if (
      proposedCheckInAt.getTime() ===
      new Date(attendance.checkInAt).getTime() &&
      proposedCheckOutAt.getTime() ===
      new Date(attendance.checkOutAt!).getTime()
    ) {
      throw new BadRequestException(
        'Corrected times must differ from recorded times',
      );
    }

    const reason = dto.reason.trim();

    if (reason.length < 10) {
      throw new BadRequestException(
        'Reason must contain at least 10 characters',
      );
    }

    try {
      const correction = await this.correctionModel.create({
        attendanceId: attendance._id,
        employeeId: employee._id,
        requestedBy: new Types.ObjectId(userId),

        originalCheckInAt: attendance.checkInAt,
        originalCheckOutAt: new Date(attendance.checkOutAt!),

        proposedCheckInAt,
        proposedCheckOutAt,

        reason,
        status: CorrectionStatus.PENDING,
      });

      return {
        message: 'Attendance correction requested successfully',
        correction,
      };
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  private async paginate(
    filter: CorrectionFilter,
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
      this.correctionModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      this.correctionModel.countDocuments(filter),
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
      !Object.values(CorrectionStatus).includes(
        status as CorrectionStatus,
      )
    ) {
      throw new BadRequestException(
        'Invalid correction status',
      );
    }

    const filter: CorrectionFilter =
      status
        ? { status: status as CorrectionStatus }
        : {};

    return this.paginate(filter, page, limit);
  }

  private async getCorrectionOrFail(id: string) {
    this.validateId(id);

    const correction = await this.correctionModel
      .findById(id)
      .lean();

    if (!correction) {
      throw new NotFoundException(
        'Attendance correction not found',
      );
    }

    return correction;
  }

  async findOne(
    id: string,
    userId: string,
    role: string,
  ) {
    const correction = await this.getCorrectionOrFail(id);

    const isStaff =
      role === 'admin' || role === 'hr';

    if (
      !isStaff &&
      String(correction.requestedBy) !== userId
    ) {
      throw new ForbiddenException(
        'You cannot access another employee correction',
      );
    }

    return { correction };
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateAttendanceCorrectionsDto,
  ) {
    const correction = await this.getCorrectionOrFail(id);

    if (String(correction.requestedBy) !== userId) {
      throw new ForbiddenException(
        'Only request owner can update it',
      );
    }

    if (correction.status !== CorrectionStatus.PENDING) {
      throw new ConflictException(
        'Only pending corrections can be updated',
      );
    }

    const updates: Record<string, unknown> = {};

    if (dto.proposedCheckInAt !== undefined) {
      updates.proposedCheckInAt =
        new Date(dto.proposedCheckInAt);
    }

    if (dto.proposedCheckOutAt !== undefined) {
      updates.proposedCheckOutAt =
        new Date(dto.proposedCheckOutAt);
    }

    if (dto.reason !== undefined) {
      const reason = dto.reason.trim();

      if (reason.length < 10) {
        throw new BadRequestException(
          'Reason must contain at least 10 characters',
        );
      }

      updates.reason = reason;
    }

    if (!Object.keys(updates).length) {
      throw new BadRequestException(
        'Provide at least one field to update',
      );
    }

    const attendance = await this.attendanceModel
      .findById(correction.attendanceId)
      .lean();

    if (!attendance || !attendance.checkOutAt) {
      throw new ConflictException(
        'Original attendance is unavailable',
      );
    }

    this.validateTimes(
      {
        checkInAt:
          (updates.proposedCheckInAt as Date | undefined) ??
          correction.proposedCheckInAt,
        checkOutAt:
          (updates.proposedCheckOutAt as Date | undefined) ??
          correction.proposedCheckOutAt,
      },
      attendance.breaks,
    );

    const updated = await this.correctionModel
      .findOneAndUpdate(
        {
          _id: correction._id,
          status: CorrectionStatus.PENDING,
        },
        { $set: updates },
        {
          new: true,
          runValidators: true,
        },
      );

    if (!updated) {
      throw new ConflictException(
        'Correction is no longer pending',
      );
    }

    return {
      message: 'Correction request updated successfully',
      correction: updated,
    };
  }

  async cancel(id: string, userId: string) {
    this.validateId(id);

    const correction = await this.correctionModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          requestedBy: new Types.ObjectId(userId),
          status: CorrectionStatus.PENDING,
        },
        {
          $set: {
            status: CorrectionStatus.CANCELLED,
            cancelledAt: new Date(),
          },
        },
        { new: true },
      );

    if (!correction) {
      throw new ConflictException(
        'Pending correction not found or not owned by you',
      );
    }

    return {
      message: 'Correction request cancelled',
      correction,
    };
  }

  async review(
    id: string,
    reviewerUserId: string,
    dto: ReviewAttendanceCorrectionDto,
  ) {
    this.validateId(id);
    this.validateId(reviewerUserId);

    const session = await this.correctionModel
      .db.startSession();

    try {
      await session.withTransaction(async () => {
        const correction = await this.correctionModel
          .findById(id)
          .session(session);

        if (!correction) {
          throw new NotFoundException(
            'Attendance correction not found',
          );
        }

        if (correction.status !== CorrectionStatus.PENDING) {
          throw new ConflictException(
            'Correction has already been reviewed',
          );
        }

        if (
          String(correction.requestedBy) === reviewerUserId
        ) {
          throw new ForbiddenException(
            'You cannot review your own correction',
          );
        }

        if (dto.decision === CorrectionDecision.APPROVED) {
          const attendance = await this.attendanceModel
            .findById(correction.attendanceId)
            .session(session);

          if (!attendance || !attendance.checkOutAt) {
            throw new ConflictException(
              'Original attendance is unavailable',
            );
          }

          if (attendance.isOnBreak) {
            throw new ConflictException(
              'Cannot approve while attendance is on break',
            );
          }

          if (
            attendance.checkInAt.getTime() !==
            correction.originalCheckInAt.getTime() ||
            attendance.checkOutAt.getTime() !==
            correction.originalCheckOutAt.getTime()
          ) {
            throw new ConflictException(
              'Attendance changed after correction request',
            );
          }

          const minutes = this.validateTimes(
            {
              checkInAt: correction.proposedCheckInAt,
              checkOutAt: correction.proposedCheckOutAt,
            },
            attendance.breaks,
          );

          const shift = await this.shiftModel
            .findById(attendance.shiftId)
            .session(session);

          if (!shift) {
            throw new ConflictException(
              'Original shift not found',
            );
          }

          const late = this.calculateLate(
            correction.proposedCheckInAt,
            attendance.workDate,
            attendance.timezone,
            attendance.scheduledStartTime,
            shift.graceMinutes,
            shift.endTime,
          );

          const updatedAttendance =
            await this.attendanceModel.findOneAndUpdate(
              {
                _id: attendance._id,
                checkInAt: correction.originalCheckInAt,
                checkOutAt: correction.originalCheckOutAt,
                isOnBreak: false,
              },
              {
                $set: {
                  checkInAt: correction.proposedCheckInAt,
                  checkOutAt: correction.proposedCheckOutAt,
                  breakMinutes: minutes.breakMinutes,
                  workedMinutes: minutes.workedMinutes,
                  lateMinutes: late.lateMinutes,
                  status: late.status,
                },
              },
              {
                session,
                new: true,
                runValidators: true,
              },
            );

          if (!updatedAttendance) {
            throw new ConflictException(
              'Attendance changed during review',
            );
          }
        }

        const reviewed = await this.correctionModel
          .findOneAndUpdate(
            {
              _id: correction._id,
              status: CorrectionStatus.PENDING,
            },
            {
              $set: {
                status:
                  dto.decision === CorrectionDecision.APPROVED
                    ? CorrectionStatus.APPROVED
                    : CorrectionStatus.REJECTED,
                reviewedBy: new Types.ObjectId(reviewerUserId),
                reviewedAt: new Date(),
                reviewNote: dto.reviewNote?.trim() ?? '',
              },
            },
            {
              session,
              new: true,
              runValidators: true,
            },
          );

        if (!reviewed) {
          throw new ConflictException(
            'Correction status changed during review',
          );
        }
      });
    } finally {
      await session.endSession();
    }

    const correction = await this.getCorrectionOrFail(id);

    return {
      message:
        dto.decision === CorrectionDecision.APPROVED
          ? 'Attendance correction approved successfully'
          : 'Attendance correction rejected successfully',
      correction,
    };
  }
}
