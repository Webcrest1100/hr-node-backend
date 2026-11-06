
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Attendance,
  AttendanceStatus,
} from './schemas/attendance.schema.js';

import {
  Employee,
  EmploymentStatus,
} from '../employees/schemas/employee.schema.js';

import { Shift } from '../shifts/schemas/shifts.schema.js';
import { ShiftAssignment } from '../shifts/schemas/shift-assignment.schema.js';

import { CreateAttendanceDto } from './dto/create-attendance.dto.js';
import { UpdateAttendanceDto } from './dto/update-attendance.dto.js';

type Coordinates = {
  latitude: number;
  longitude: number;
};

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance.name)
    private readonly attendanceModel: Model<Attendance>,

    @InjectModel(Employee.name)
    private readonly employeeModel: Model<Employee>,

    @InjectModel(Shift.name)
    private readonly shiftModel: Model<Shift>,

    @InjectModel(ShiftAssignment.name)
    private readonly assignmentModel: Model<ShiftAssignment>,

    private readonly configService: ConfigService,
  ) {}

  private validateId(id: string): void {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      throw new BadRequestException('Invalid MongoDB ID');
    }
  }

  private getOfficeConfig() {
    const latitude = Number(
      this.configService.get<string>('OFFICE_LATITUDE'),
    );

    const longitude = Number(
      this.configService.get<string>('OFFICE_LONGITUDE'),
    );

    const radius = Number(
      this.configService.get<string>(
        'OFFICE_RADIUS_METERS',
        '1000',
      ),
    );

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(radius) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180 ||
      radius <= 0 ||
      !this.configService.get<string>('OFFICE_LATITUDE') ||
      !this.configService.get<string>('OFFICE_LONGITUDE')
    ) {
      throw new ServiceUnavailableException(
        'Office GPS configuration is missing or invalid',
      );
    }

    return { latitude, longitude, radius };
  }

  private distanceMeters(
    from: Coordinates,
    to: Coordinates,
  ): number {
    const rad = (degrees: number) =>
      (degrees * Math.PI) / 180;

    const latDiff = rad(to.latitude - from.latitude);
    const lonDiff = rad(to.longitude - from.longitude);

    const a =
      Math.sin(latDiff / 2) ** 2 +
      Math.cos(rad(from.latitude)) *
        Math.cos(rad(to.latitude)) *
        Math.sin(lonDiff / 2) ** 2;

    const safeA = Math.min(1, Math.max(0, a));

    return (
      6371000 *
      2 *
      Math.atan2(
        Math.sqrt(safeA),
        Math.sqrt(1 - safeA),
      )
    );
  }

  private validateOfficeLocation(
    coordinates: Coordinates,
  ) {
    const office = this.getOfficeConfig();

    const distance = this.distanceMeters(
      coordinates,
      office,
    );

    if (distance > office.radius) {
      throw new ForbiddenException(
        'Attendance location is outside the permitted office radius',
      );
    }

    return {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      distanceMeters: Math.round(distance),
    };
  }

  private localParts(date: Date, timezone: string) {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });

    const values: Record<string, string> = {};

    for (const part of formatter.formatToParts(date)) {
      if (part.type !== 'literal') {
        values[part.type] = part.value;
      }
    }

    const year = values.year;
    const month = values.month;
    const day = values.day;

    return {
      date: `${year}-${month}-${day}`,
      minutes:
        Number(values.hour) * 60 +
        Number(values.minute),
    };
  }

  private previousDate(date: string): string {
    const previous = new Date(`${date}T00:00:00.000Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);

    return previous.toISOString().slice(0, 10);
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private calculateSchedule(
    now: Date,
    shift: Shift,
  ) {
    const local = this.localParts(
      now,
      shift.timezone,
    );

    const start = this.timeToMinutes(shift.startTime);
    const end = this.timeToMinutes(shift.endTime);
    const overnight = end < start;

    let workDate = local.date;
    let checkInMinute = local.minutes;

    if (overnight && local.minutes < end) {
      workDate = this.previousDate(local.date);
      checkInMinute += 1440;
    }

    const grace = shift.graceMinutes ?? 0;

    const lateMinutes = Math.max(
      0,
      checkInMinute - start - grace,
    );

    return {
      workDate,
      lateMinutes,
      status:
        lateMinutes > 0
          ? AttendanceStatus.LATE
          : AttendanceStatus.PRESENT,
    };
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

  private async getEmployeeAndShift(userId: string) {
    const employee = await this.getEmployee(userId);

    if (
      employee.employmentStatus ===
        EmploymentStatus.RESIGNED ||
      employee.employmentStatus ===
        EmploymentStatus.TERMINATED
    ) {
      throw new ForbiddenException(
        'Former employees cannot record attendance',
      );
    }

    const assignment = await this.assignmentModel
      .findOne({
        employeeId: employee._id,
      })
      .lean();

    if (!assignment) {
      throw new BadRequestException(
        'Employee has no assigned shift',
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

    return { employee, shift };
  }

  private handleDatabaseError(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      throw new ConflictException(
        'Attendance already exists for this work date',
      );
    }

    throw error;
  }

  async checkIn(
    userId: string,
    dto: CreateAttendanceDto,
  ) {
    const location = this.validateOfficeLocation(dto);
    const { employee, shift } =
      await this.getEmployeeAndShift(userId);

    const now = new Date();

    const alreadyOpen = await this.attendanceModel.exists({
      employeeId: employee._id,
      checkOutAt: null,
    });

    if (alreadyOpen) {
      throw new ConflictException(
        'Complete the previous attendance checkout first',
      );
    }

    const schedule = this.calculateSchedule(now, shift);

    try {
      const record = await this.attendanceModel.create({
        employeeId: employee._id,
        shiftId: shift._id,
        workDate: schedule.workDate,
        timezone: shift.timezone,
        scheduledStartTime: shift.startTime,
        checkInAt: now,
        checkOutAt: null,
        checkInLocation: location,
        checkOutLocation: null,
        breaks: [],
        isOnBreak: false,
        lateMinutes: schedule.lateMinutes,
        breakMinutes: 0,
        workedMinutes: 0,
        status: schedule.status,
        notes: dto.notes?.trim() ?? '',
      });

      return {
        message: 'Check-in successful',
        attendance: record,
      };
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async startBreak(userId: string) {
    const employee = await this.getEmployee(userId);
    const now = new Date();

    const attendance = await this.attendanceModel
      .findOneAndUpdate(
        {
          employeeId: employee._id,
          checkOutAt: null,
          isOnBreak: false,
        },
        {
          $set: { isOnBreak: true },
          $push: {
            breaks: {
              startAt: now,
              endAt: null,
            },
          },
        },
        { new: true },
      );

    if (!attendance) {
      throw new ConflictException(
        'No active attendance or break already started',
      );
    }

    return {
      message: 'Break started successfully',
      attendance,
    };
  }

  async endBreak(userId: string) {
    const employee = await this.getEmployee(userId);
    const now = new Date();

    const attendance = await this.attendanceModel
      .findOneAndUpdate(
        {
          employeeId: employee._id,
          checkOutAt: null,
          isOnBreak: true,
          breaks: {
            $elemMatch: {
              endAt: null,
            },
          },
        },
        {
          $set: {
            isOnBreak: false,
            'breaks.$.endAt': now,
          },
        },
        { new: true },
      );

    if (!attendance) {
      throw new ConflictException(
        'No active break found',
      );
    }

    return {
      message: 'Break ended successfully',
      attendance,
    };
  }

  async checkOut(
    userId: string,
    dto: UpdateAttendanceDto,
  ) {
    const location = this.validateOfficeLocation(dto);
    const employee = await this.getEmployee(userId);

    const current = await this.attendanceModel
      .findOne({
        employeeId: employee._id,
        checkOutAt: null,
      })
      .lean();

    if (!current) {
      throw new ConflictException(
        'No active attendance to check out',
      );
    }

    if (current.isOnBreak) {
      throw new ConflictException(
        'End your current break before checkout',
      );
    }

    const now = new Date();

    const totalMinutes = Math.max(
      0,
      Math.floor(
        (now.getTime() -
          new Date(current.checkInAt).getTime()) /
          60000,
      ),
    );

    let breakMinutes = 0;

    for (const entry of current.breaks) {
      if (!entry.endAt) {
        throw new ConflictException(
          'An unfinished break exists',
        );
      }

      breakMinutes += Math.max(
        0,
        (new Date(entry.endAt).getTime() -
          new Date(entry.startAt).getTime()) /
          60000,
      );
    }

    const roundedBreakMinutes = Math.floor(breakMinutes);

    const attendance = await this.attendanceModel
      .findOneAndUpdate(
        {
          _id: current._id,
          checkOutAt: null,
          isOnBreak: false,
        },
        {
          $set: {
            checkOutAt: now,
            checkOutLocation: location,
            breakMinutes: roundedBreakMinutes,
            workedMinutes: Math.max(
              0,
              totalMinutes - roundedBreakMinutes,
            ),
            ...(dto.notes !== undefined
              ? { notes: dto.notes.trim() }
              : {}),
          },
        },
        { new: true },
      );

    if (!attendance) {
      throw new ConflictException(
        'Attendance changed; please retry',
      );
    }

    return {
      message: 'Check-out successful',
      attendance,
    };
  }

  async findMineToday(userId: string) {
    const employee = await this.getEmployee(userId);

    // Open overnight attendance takes priority.
    const open = await this.attendanceModel
      .findOne({
        employeeId: employee._id,
        checkOutAt: null,
      })
      .lean();

    if (open) {
      return { attendance: open };
    }

    const assignment = await this.assignmentModel
      .findOne({
        employeeId: employee._id,
      })
      .lean();

    const shift = assignment
      ? await this.shiftModel.findById(
          assignment.shiftId,
        ).lean()
      : null;

    const timezone = shift?.timezone ?? 'Asia/Karachi';
    const today = this.localParts(
      new Date(),
      timezone,
    ).date;

    const attendance = await this.attendanceModel
      .findOne({
        employeeId: employee._id,
        workDate: today,
      })
      .lean();

    return {
      attendance: attendance ?? null,
    };
  }

  async findMineHistory(
    userId: string,
    page = 1,
    limit = 10,
  ) {
    const employee = await this.getEmployee(userId);

    return this.getPaginated(
      { employeeId: employee._id },
      page,
      limit,
    );
  }

  private async getPaginated(
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
      this.attendanceModel
        .find(filter)
        .sort({
          workDate: -1,
          checkInAt: -1,
        })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      this.attendanceModel.countDocuments(filter),
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

  async findAll(page = 1, limit = 10) {
    return this.getPaginated({}, page, limit);
  }

  async findOne(id: string) {
    this.validateId(id);

    const attendance = await this.attendanceModel
      .findById(id)
      .lean();

    if (!attendance) {
      throw new NotFoundException(
        'Attendance record not found',
      );
    }

    return { attendance };
  }
}
