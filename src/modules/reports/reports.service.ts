
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Attendance,
} from '../attendance/schemas/attendance.schema.js';

import {
  Employee,
} from '../employees/schemas/employee.schema.js';

import {
  Leave,
} from '../leaves/schemas/leaves.schema.js';

import {
  Task,
} from '../tasks/schemas/tasks.schema.js';

import {
  Payroll,
} from '../payroll/schemas/payroll.schema.js';

import {
  ReportKind,
} from './schemas/reports.schema.js';

import type {
  ReportPeriod,
  ReportRow,
} from './schemas/reports.schema.js';

import {
  ReportQueryDto,
} from './dto/create-reports.dto.js';

import {
  ReportExportDto,
} from './dto/update-reports.dto.js';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Attendance.name)
    private readonly attendanceModel: Model<Attendance>,

    @InjectModel(Leave.name)
    private readonly leaveModel: Model<Leave>,

    @InjectModel(Task.name)
    private readonly taskModel: Model<Task>,

    @InjectModel(Payroll.name)
    private readonly payrollModel: Model<Payroll>,

    @InjectModel(Employee.name)
    private readonly employeeModel: Model<Employee>,
  ) {}

  private oid(id: string): Types.ObjectId {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      throw new BadRequestException('Invalid MongoDB ID');
    }

    return new Types.ObjectId(id);
  }

  private validateDate(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(
        'Date must use YYYY-MM-DD',
      );
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException(
        'Invalid calendar date',
      );
    }

    return date;
  }

  private resolvePeriod(
    query: ReportQueryDto,
  ): ReportPeriod {
    const currentMonth =
      new Date().toISOString().slice(0, 7);

    const defaultFrom = `${currentMonth}-01`;

    const [year, month] =
      currentMonth.split('-').map(Number);

    const lastDay =
      new Date(Date.UTC(year, month, 0))
        .getUTCDate();

    const defaultTo =
      `${currentMonth}-${String(lastDay).padStart(2, '0')}`;

    const from = query.from ?? defaultFrom;
    const to = query.to ?? defaultTo;

    const start = this.validateDate(from);
    const end = this.validateDate(to);

    if (end.getTime() < start.getTime()) {
      throw new BadRequestException(
        'to must not be earlier than from',
      );
    }

    const durationDays =
      (end.getTime() - start.getTime()) / 86400000;

    if (durationDays > 366) {
      throw new BadRequestException(
        'Report range cannot exceed 367 calendar days',
      );
    }

    return { from, to };
  }

  private async resolveEmployee(
    employeeId?: string,
  ) {
    if (!employeeId) {
      return null;
    }

    const employee =
      await this.employeeModel
        .findById(this.oid(employeeId))
        .select('_id userId employeeCode')
        .lean();

    if (!employee) {
      throw new NotFoundException(
        'Employee profile not found',
      );
    }

    return employee;
  }

  private buildDateTimeRange(period: ReportPeriod) {
    const start = this.validateDate(period.from);

    const endExclusive = this.validateDate(period.to);
    endExclusive.setUTCDate(
      endExclusive.getUTCDate() + 1,
    );

    return {
      $gte: start,
      $lt: endExclusive,
    };
  }

  private validateKind(kind: string): ReportKind {
    if (
      !Object.values(ReportKind).includes(
        kind as ReportKind,
      )
    ) {
      throw new BadRequestException(
        'Unsupported report type',
      );
    }

    return kind as ReportKind;
  }

  private async reportSource(
    kind: ReportKind,
    query: ReportQueryDto,
  ) {
    const period = this.resolvePeriod(query);
    const employee = await this.resolveEmployee(
      query.employeeId,
    );

    let filter: Record<string, unknown> = {};

    switch (kind) {
      case ReportKind.ATTENDANCE:
        filter = {
          workDate: {
            $gte: period.from,
            $lte: period.to,
          },
          ...(employee
            ? { employeeId: employee._id }
            : {}),
        };
        return {
          period,
          employee,
          model: this.attendanceModel,
          filter,
        };

      case ReportKind.LEAVES:
        filter = {
          startDate: { $lte: period.to },
          endDate: { $gte: period.from },
          ...(employee
            ? { employeeId: employee._id }
            : {}),
        };
        return {
          period,
          employee,
          model: this.leaveModel,
          filter,
        };

      case ReportKind.TASKS:
        filter = {
          createdAt: this.buildDateTimeRange(period),
          ...(employee
            ? { assigneeUserIds: employee.userId }
            : {}),
        };
        return {
          period,
          employee,
          model: this.taskModel,
          filter,
        };

      case ReportKind.PAYROLL:
        filter = {
          month: {
            $gte: period.from.slice(0, 7),
            $lte: period.to.slice(0, 7),
          },
          ...(employee
            ? { employeeId: employee._id }
            : {}),
        };
        return {
          period,
          employee,
          model: this.payrollModel,
          filter,
        };
    }
  }

  private mapRecord(
    kind: ReportKind,
    raw: Record<string, any>,
  ): ReportRow {
    const employeeId = raw.employeeId
      ? String(raw.employeeId)
      : null;

    switch (kind) {
      case ReportKind.ATTENDANCE:
        return {
          id: String(raw._id),
          employeeId,
          workDate: raw.workDate,
          status: raw.status,
          checkInAt: raw.checkInAt
            ? new Date(raw.checkInAt).toISOString()
            : null,
          checkOutAt: raw.checkOutAt
            ? new Date(raw.checkOutAt).toISOString()
            : null,
          lateMinutes: raw.lateMinutes ?? 0,
          breakMinutes: raw.breakMinutes ?? 0,
          workedMinutes: raw.workedMinutes ?? 0,
        };

      case ReportKind.LEAVES:
        return {
          id: String(raw._id),
          employeeId,
          leaveTypeId: String(raw.leaveTypeId),
          startDate: raw.startDate,
          endDate: raw.endDate,
          days: raw.days,
          status: raw.status,
          reason: raw.reason,
          reviewedAt: raw.reviewedAt
            ? new Date(raw.reviewedAt).toISOString()
            : null,
        };

      case ReportKind.TASKS:
        return {
          id: String(raw._id),
          title: raw.title,
          status: raw.status,
          priority: raw.priority,
          progressPercent: raw.progressPercent ?? 0,
          assigneeUserIds: Array.isArray(
            raw.assigneeUserIds,
          )
            ? raw.assigneeUserIds.map(String).join('; ')
            : '',
          dueDate: raw.dueDate ?? null,
          createdAt: raw.createdAt
            ? new Date(raw.createdAt).toISOString()
            : null,
          completedAt: raw.completedAt
            ? new Date(raw.completedAt).toISOString()
            : null,
        };

      case ReportKind.PAYROLL:
        return {
          id: String(raw._id),
          employeeId,
          month: raw.month,
          currency: raw.currency,
          basicSalary: raw.basicSalary,
          allowances: raw.allowances,
          deductions: raw.deductions,
          additionalAllowances:
            raw.additionalAllowances ?? 0,
          additionalDeductions:
            raw.additionalDeductions ?? 0,
          grossSalary: raw.grossSalary,
          totalDeductions: raw.totalDeductions,
          netSalary: raw.netSalary,
          status: raw.status,
        };
    }
  }

  private async fetchRows(
    kind: ReportKind,
    query: ReportQueryDto,
    page: number,
    limit: number,
  ) {
    const source = await this.reportSource(
      kind,
      query,
    );

    const filter = source.filter;

    // Each model has the same supported read-only
    // methods, but their document shapes differ.
    let raw: Array<Record<string, any>> = [];
    let total = 0;

    switch (kind) {
      case ReportKind.ATTENDANCE:
        [raw, total] = await Promise.all([
          this.attendanceModel
            .find(filter)
            .sort({ workDate: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
          this.attendanceModel.countDocuments(filter),
        ]);
        break;

      case ReportKind.LEAVES:
        [raw, total] = await Promise.all([
          this.leaveModel
            .find(filter)
            .sort({ startDate: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
          this.leaveModel.countDocuments(filter),
        ]);
        break;

      case ReportKind.TASKS:
        [raw, total] = await Promise.all([
          this.taskModel
            .find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
          this.taskModel.countDocuments(filter),
        ]);
        break;

      case ReportKind.PAYROLL:
        [raw, total] = await Promise.all([
          this.payrollModel
            .find(filter)
            .sort({ month: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
          this.payrollModel.countDocuments(filter),
        ]);
        break;
    }

    return {
      data: raw.map((record) =>
        this.mapRecord(kind, record),
      ),
      period: source.period,
      total,
    };
  }

  async findReport(
    kindInput: string,
    query: ReportQueryDto,
  ) {
    const kind = this.validateKind(kindInput);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    if (
      !Number.isSafeInteger(page) ||
      !Number.isSafeInteger(limit) ||
      page < 1 ||
      limit < 1 ||
      limit > 100
    ) {
      throw new BadRequestException(
        'Invalid report pagination',
      );
    }

    const result = await this.fetchRows(
      kind,
      query,
      page,
      limit,
    );

    return {
      reportType: kind,
      period: result.period,
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  private csvCell(value: unknown): string {
    let text = value == null
      ? ''
      : String(value);

    // Protect CSV readers against spreadsheet formulas,
    // including values with leading whitespace.
    if (/^[\s\uFEFF]*[=+\-@]/u.test(text)) {
      text = `'${text}`;
    }

    return `"${text.replace(/"/g, '""')}"`;
  }

  private toCsv(
    kind: ReportKind,
    rows: ReportRow[],
  ): string {
    const columns: Record<ReportKind, string[]> = {
      [ReportKind.ATTENDANCE]: [
        'id',
        'employeeId',
        'workDate',
        'status',
        'checkInAt',
        'checkOutAt',
        'lateMinutes',
        'breakMinutes',
        'workedMinutes',
      ],
      [ReportKind.LEAVES]: [
        'id',
        'employeeId',
        'leaveTypeId',
        'startDate',
        'endDate',
        'days',
        'status',
        'reason',
        'reviewedAt',
      ],
      [ReportKind.TASKS]: [
        'id',
        'title',
        'status',
        'priority',
        'progressPercent',
        'assigneeUserIds',
        'dueDate',
        'createdAt',
        'completedAt',
      ],
      [ReportKind.PAYROLL]: [
        'id',
        'employeeId',
        'month',
        'currency',
        'basicSalary',
        'allowances',
        'deductions',
        'additionalAllowances',
        'additionalDeductions',
        'grossSalary',
        'totalDeductions',
        'netSalary',
        'status',
      ],
    };

    const fields = columns[kind];

    const lines = [
      fields.map((field) => this.csvCell(field)).join(','),
      ...rows.map((row) =>
        fields
          .map((field) => this.csvCell(row[field]))
          .join(','),
      ),
    ];

    return '\uFEFF' + lines.join('\r\n') + '\r\n';
  }

  async exportCsv(
    kindInput: string,
    query: ReportExportDto,
  ) {
    const kind = this.validateKind(kindInput);

    const maxRows = query.maxRows ?? 1000;

    if (
      !Number.isSafeInteger(maxRows) ||
      maxRows < 1 ||
      maxRows > 2000
    ) {
      throw new BadRequestException(
        'maxRows must be between 1 and 2000',
      );
    }

    const result = await this.fetchRows(
      kind,
      query,
      1,
      maxRows,
    );

    const filename =
      `${kind}-${result.period.from}-to-${result.period.to}.csv`;

    return {
      filename,
      buffer: Buffer.from(
        this.toCsv(kind, result.data),
        'utf8',
      ),
      exportedRows: result.data.length,
      totalMatchingRows: result.total,
    };
  }
}
