
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Employee } from '../employees/schemas/employee.schema.js';
import { User } from '../users/schemas/users.schema.js';
import {
  Attendance,
  AttendanceStatus,
} from '../attendance/schemas/attendance.schema.js';
import {
  Leave,
  LeaveStatus,
} from '../leaves/schemas/leaves.schema.js';
import {
  Task,
  TaskStatus,
} from '../tasks/schemas/tasks.schema.js';
import {
  Payroll,
  PayrollStatus,
} from '../payroll/schemas/payroll.schema.js';
import {
  Notification,
} from '../notifications/schemas/notifications.schema.js';

import type {
  AttendanceTrendPoint,
  DashboardPeriod,
} from './schemas/dashboard.schema.js';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Employee.name)
    private readonly employeeModel: Model<Employee>,

    @InjectModel(User.name)
    private readonly userModel: Model<User>,

    @InjectModel(Attendance.name)
    private readonly attendanceModel: Model<Attendance>,

    @InjectModel(Leave.name)
    private readonly leaveModel: Model<Leave>,

    @InjectModel(Task.name)
    private readonly taskModel: Model<Task>,

    @InjectModel(Payroll.name)
    private readonly payrollModel: Model<Payroll>,

    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
  ) {}

  private objectId(id: string): Types.ObjectId {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      throw new BadRequestException('Invalid user ID');
    }

    return new Types.ObjectId(id);
  }

  private period(month?: string): DashboardPeriod {
    const selectedMonth =
      month ?? new Date().toISOString().slice(0, 7);

    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth)
    ) {
      throw new BadRequestException(
        'Month must use YYYY-MM format',
      );
    }

    const [year, monthNumber] =
      selectedMonth.split('-').map(Number);

    if (year < 2000 || year > 2100) {
      throw new BadRequestException(
        'Reporting year must be between 2000 and 2100',
      );
    }

    const lastDay = new Date(
      Date.UTC(year, monthNumber, 0),
    ).getUTCDate();

    return {
      month: selectedMonth,
      startDate: `${selectedMonth}-01`,
      endDate: `${selectedMonth}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  private dateFilter(period: DashboardPeriod) {
    return {
      $gte: period.startDate,
      $lte: period.endDate,
    };
  }

  private async taskCounts(
    filter: Record<string, unknown>,
  ) {
    const [
      total,
      todo,
      inProgress,
      inReview,
      blocked,
      done,
    ] = await Promise.all([
      this.taskModel.countDocuments(filter),
      this.taskModel.countDocuments({
        ...filter,
        status: TaskStatus.TODO,
      }),
      this.taskModel.countDocuments({
        ...filter,
        status: TaskStatus.IN_PROGRESS,
      }),
      this.taskModel.countDocuments({
        ...filter,
        status: TaskStatus.IN_REVIEW,
      }),
      this.taskModel.countDocuments({
        ...filter,
        status: TaskStatus.BLOCKED,
      }),
      this.taskModel.countDocuments({
        ...filter,
        status: TaskStatus.DONE,
      }),
    ]);

    return {
      total,
      todo,
      inProgress,
      inReview,
      blocked,
      done,
    };
  }

  private async attendanceCounts(
    filter: Record<string, unknown>,
  ) {
    const [
      totalRecords,
      lateRecords,
      completedRecords,
    ] = await Promise.all([
      this.attendanceModel.countDocuments(filter),
      this.attendanceModel.countDocuments({
        ...filter,
        status: AttendanceStatus.LATE,
      }),
      this.attendanceModel.countDocuments({
        ...filter,
        checkOutAt: { $ne: null },
      }),
    ]);

    return {
      totalRecords,
      lateRecords,
      completedRecords,
    };
  }

  private async leaveCounts(
    filter: Record<string, unknown>,
  ) {
    const [
      pending,
      approved,
      rejected,
    ] = await Promise.all([
      this.leaveModel.countDocuments({
        ...filter,
        status: LeaveStatus.PENDING,
      }),
      this.leaveModel.countDocuments({
        ...filter,
        status: LeaveStatus.APPROVED,
      }),
      this.leaveModel.countDocuments({
        ...filter,
        status: LeaveStatus.REJECTED,
      }),
    ]);

    return {
      pending,
      approved,
      rejected,
    };
  }

  async overview(month?: string) {
    const period = this.period(month);

    const attendanceFilter = {
      workDate: this.dateFilter(period),
    };

    const leaveFilter = {
      startDate: { $lte: period.endDate },
      endDate: { $gte: period.startDate },
    };

    const [
      totalEmployees,
      activeUsers,
      tasks,
      attendance,
      leaves,
      payrollRecords,
      pendingPayroll,
    ] = await Promise.all([
      this.employeeModel.countDocuments(),
      this.userModel.countDocuments({
        isActive: true,
      }),
      this.taskCounts({}),
      this.attendanceCounts(attendanceFilter),
      this.leaveCounts(leaveFilter),
      this.payrollModel.countDocuments({
        month: period.month,
      }),
      this.payrollModel.countDocuments({
        month: period.month,
        status: PayrollStatus.DRAFT,
      }),
    ]);

    return {
      message: 'Dashboard overview loaded',
      period,
      employees: {
        totalProfiles: totalEmployees,
        activeUserAccounts: activeUsers,
      },
      tasks,
      attendance,
      leaves,
      payroll: {
        totalRecords: payrollRecords,
        pendingApproval: pendingPayroll,
      },
    };
  }

  async mine(userId: string, month?: string) {
    const period = this.period(month);
    const userObjectId = this.objectId(userId);

    const employee = await this.employeeModel
      .findOne({ userId: userObjectId })
      .select('_id employeeCode designation')
      .lean();

    const taskFilter = {
      assigneeUserIds: userObjectId,
    };

    const unreadNotifications =
      await this.notificationModel.countDocuments({
        recipientUserId: userObjectId,
        isRead: false,
        isArchived: false,
      });

    const tasks = await this.taskCounts(taskFilter);

    // Admin accounts may exist without an employee profile.
    if (!employee) {
      return {
        message: 'Personal dashboard loaded',
        period,
        employeeProfile: null,
        tasks,
        notifications: {
          unread: unreadNotifications,
        },
        attendance: null,
        leaves: null,
        payroll: null,
      };
    }

    const attendanceFilter = {
      employeeId: employee._id,
      workDate: this.dateFilter(period),
    };

    const leaveFilter = {
      employeeId: employee._id,
      startDate: { $lte: period.endDate },
      endDate: { $gte: period.startDate },
    };

    const [
      attendance,
      leaves,
      payroll,
    ] = await Promise.all([
      this.attendanceCounts(attendanceFilter),
      this.leaveCounts(leaveFilter),
      this.payrollModel
        .findOne({
          employeeId: employee._id,
          month: period.month,
          status: {
            $in: [
              PayrollStatus.APPROVED,
              PayrollStatus.PAID,
            ],
          },
        })
        .select('month currency netSalary status')
        .lean(),
    ]);

    return {
      message: 'Personal dashboard loaded',
      period,
      employeeProfile: {
        id: String(employee._id),
        employeeCode: employee.employeeCode,
        designation: employee.designation,
      },
      tasks,
      attendance,
      leaves,
      payroll: payroll
        ? {
            month: payroll.month,
            currency: payroll.currency,
            netSalary: payroll.netSalary,
            status: payroll.status,
          }
        : null,
      notifications: {
        unread: unreadNotifications,
      },
    };
  }

  async attendanceTrends(month?: string) {
    const period = this.period(month);

    const records = await this.attendanceModel
      .aggregate<{
        _id: {
          date: string;
          status: string;
        };
        count: number;
      }>([
        {
          $match: {
            workDate: this.dateFilter(period),
          },
        },
        {
          $group: {
            _id: {
              date: '$workDate',
              status: '$status',
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: {
            '_id.date': 1,
          },
        },
      ]);

    const trends = new Map<
      string,
      AttendanceTrendPoint
    >();

    const start = new Date(
      `${period.startDate}T00:00:00.000Z`,
    );
    const end = new Date(
      `${period.endDate}T00:00:00.000Z`,
    );

    for (
      let timestamp = start.getTime();
      timestamp <= end.getTime();
      timestamp += 86400000
    ) {
      const date = new Date(timestamp)
        .toISOString()
        .slice(0, 10);

      trends.set(date, {
        date,
        total: 0,
        present: 0,
        late: 0,
      });
    }

    for (const record of records) {
      const point = trends.get(record._id.date);

      if (!point) {
        continue;
      }

      point.total += record.count;

      if (
        record._id.status ===
        AttendanceStatus.PRESENT
      ) {
        point.present += record.count;
      }

      if (
        record._id.status ===
        AttendanceStatus.LATE
      ) {
        point.late += record.count;
      }
    }

    return {
      period,
      data: [...trends.values()],
    };
  }
}
