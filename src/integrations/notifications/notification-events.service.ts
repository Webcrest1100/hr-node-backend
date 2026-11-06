
import {
  Injectable,
  Logger,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Task,
} from '../../modules/tasks/schemas/tasks.schema.js';

import {
  Leave,
  LeaveStatus,
} from '../../modules/leaves/schemas/leaves.schema.js';

import {
  AttendanceCorrection,
  CorrectionStatus,
} from '../../modules/attendance-corrections/schemas/attendance-corrections.schema.js';

import {
  Payroll,
  PayrollStatus,
} from '../../modules/payroll/schemas/payroll.schema.js';

import {
  Employee,
} from '../../modules/employees/schemas/employee.schema.js';

import {
  User,
  UserRole,
} from '../../modules/users/schemas/users.schema.js';

import {
  NotificationType,
  NotificationEntityType,
} from '../../modules/notifications/schemas/notifications.schema.js';

import {
  NotificationsService,
} from '../../modules/notifications/notifications.service.js';

export enum IntegrationEvent {
  TASK_CREATED = 'task.created',
  TASK_STATUS_CHANGED = 'task.status_changed',
  LEAVE_REQUESTED = 'leave.requested',
  LEAVE_REVIEWED = 'leave.reviewed',
  CORRECTION_REVIEWED = 'correction.reviewed',
  PAYROLL_APPROVED = 'payroll.approved',
}

export type NotificationEvent = {
  event: IntegrationEvent;
  entityId: string;
  actorUserId: string;
};

@Injectable()
export class NotificationEventsService {
  private readonly logger = new Logger(
    NotificationEventsService.name,
  );

  constructor(
    @InjectModel(Task.name)
    private readonly taskModel: Model<Task>,

    @InjectModel(Leave.name)
    private readonly leaveModel: Model<Leave>,

    @InjectModel(AttendanceCorrection.name)
    private readonly correctionModel:
      Model<AttendanceCorrection>,

    @InjectModel(Payroll.name)
    private readonly payrollModel: Model<Payroll>,

    @InjectModel(Employee.name)
    private readonly employeeModel: Model<Employee>,

    @InjectModel(User.name)
    private readonly userModel: Model<User>,

    private readonly notificationsService:
      NotificationsService,
  ) {}

  private objectId(
    value: string,
  ): Types.ObjectId | null {
    if (!/^[0-9a-fA-F]{24}$/.test(value)) {
      return null;
    }

    return new Types.ObjectId(value);
  }

  private async activeStaffIds(): Promise<string[]> {
    const users = await this.userModel
      .find({
        isActive: true,
        role: {
          $in: [
            UserRole.ADMIN,
            UserRole.HR,
          ],
        },
      })
      .select('_id')
      .lean();

    return users.map((user) =>
      String(user._id),
    );
  }

  private async employeeUserId(
    employeeId: Types.ObjectId,
  ): Promise<string | null> {
    const employee = await this.employeeModel
      .findById(employeeId)
      .select('userId')
      .lean();

    return employee?.userId
      ? String(employee.userId)
      : null;
  }

  private async send(
    recipients: string[],
    data: {
      type: NotificationType;
      title: string;
      message: string;
      entityType: NotificationEntityType;
      entityId: string;
    },
    actorUserId: string,
  ): Promise<void> {
    const uniqueRecipients = [
      ...new Set(recipients),
    ].filter((id) =>
      /^[0-9a-fA-F]{24}$/.test(id) &&
      id !== actorUserId,
    );

    for (const recipientUserId of uniqueRecipients) {
      try {
        await this.notificationsService.createForUser({
          recipientUserId,
          type: data.type,
          title: data.title,
          message: data.message,
          relatedEntityType: data.entityType,
          relatedEntityId: data.entityId,
          createdBy: actorUserId,
        });
      } catch (error) {
        this.logger.error(
          `Notification delivery failed for event ${data.entityType}`,
          error instanceof Error
            ? error.message
            : 'Unknown error',
        );
      }
    }
  }

  private async taskEvent(
    event: NotificationEvent,
  ): Promise<void> {
    const id = this.objectId(event.entityId);

    if (!id) {
      return;
    }

    const task = await this.taskModel
      .findById(id)
      .select('assigneeUserIds status')
      .lean();

    if (!task) {
      return;
    }

    const isCreated =
      event.event === IntegrationEvent.TASK_CREATED;

    await this.send(
      task.assigneeUserIds.map(String),
      {
        type: NotificationType.TASK,
        title: isCreated
          ? 'New task assigned'
          : 'Task status updated',
        message: isCreated
          ? 'A new task has been assigned to you.'
          : `An assigned task is now ${task.status}.`,
        entityType: NotificationEntityType.TASK,
        entityId: String(task._id),
      },
      event.actorUserId,
    );
  }

  private async leaveRequested(
    event: NotificationEvent,
  ): Promise<void> {
    const id = this.objectId(event.entityId);

    if (!id) {
      return;
    }

    const leave = await this.leaveModel
      .findById(id)
      .select('status requestedBy')
      .lean();

    if (!leave || leave.status !== LeaveStatus.PENDING) {
      return;
    }

    const staffIds = await this.activeStaffIds();

    await this.send(
      staffIds,
      {
        type: NotificationType.LEAVE,
        title: 'New leave request',
        message:
          'An employee has submitted a leave request for review.',
        entityType: NotificationEntityType.LEAVE,
        entityId: String(leave._id),
      },
      event.actorUserId,
    );
  }

  private async leaveReviewed(
    event: NotificationEvent,
  ): Promise<void> {
    const id = this.objectId(event.entityId);

    if (!id) {
      return;
    }

    const leave = await this.leaveModel
      .findById(id)
      .select('status requestedBy')
      .lean();

    if (
      !leave ||
      ![
        LeaveStatus.APPROVED,
        LeaveStatus.REJECTED,
      ].includes(leave.status)
    ) {
      return;
    }

    await this.send(
      [String(leave.requestedBy)],
      {
        type: NotificationType.LEAVE,
        title: 'Leave request reviewed',
        message:
          `Your leave request has been ${leave.status}.`,
        entityType: NotificationEntityType.LEAVE,
        entityId: String(leave._id),
      },
      event.actorUserId,
    );
  }

  private async correctionReviewed(
    event: NotificationEvent,
  ): Promise<void> {
    const id = this.objectId(event.entityId);

    if (!id) {
      return;
    }

    const correction = await this.correctionModel
      .findById(id)
      .select('status requestedBy')
      .lean();

    if (
      !correction ||
      ![
        CorrectionStatus.APPROVED,
        CorrectionStatus.REJECTED,
      ].includes(correction.status)
    ) {
      return;
    }

    await this.send(
      [String(correction.requestedBy)],
      {
        type: NotificationType.ATTENDANCE,
        title: 'Attendance correction reviewed',
        message:
          `Your attendance correction was ${correction.status}.`,
        entityType: NotificationEntityType.ATTENDANCE,
        entityId: String(correction._id),
      },
      event.actorUserId,
    );
  }

  private async payrollApproved(
    event: NotificationEvent,
  ): Promise<void> {
    const id = this.objectId(event.entityId);

    if (!id) {
      return;
    }

    const payroll = await this.payrollModel
      .findById(id)
      .select('employeeId status month')
      .lean();

    if (
      !payroll ||
      payroll.status !== PayrollStatus.APPROVED
    ) {
      return;
    }

    const recipientUserId =
      await this.employeeUserId(
        payroll.employeeId,
      );

    if (!recipientUserId) {
      return;
    }

    await this.send(
      [recipientUserId],
      {
        type: NotificationType.PAYROLL,
        title: 'Monthly payroll approved',
        message:
          `Your payroll for ${payroll.month} has been approved.`,
        entityType: NotificationEntityType.PAYROLL,
        entityId: String(payroll._id),
      },
      event.actorUserId,
    );
  }

  async dispatch(
    event: NotificationEvent,
  ): Promise<void> {
    switch (event.event) {
      case IntegrationEvent.TASK_CREATED:
      case IntegrationEvent.TASK_STATUS_CHANGED:
        await this.taskEvent(event);
        break;

      case IntegrationEvent.LEAVE_REQUESTED:
        await this.leaveRequested(event);
        break;

      case IntegrationEvent.LEAVE_REVIEWED:
        await this.leaveReviewed(event);
        break;

      case IntegrationEvent.CORRECTION_REVIEWED:
        await this.correctionReviewed(event);
        break;

      case IntegrationEvent.PAYROLL_APPROVED:
        await this.payrollApproved(event);
        break;
    }
  }
}
