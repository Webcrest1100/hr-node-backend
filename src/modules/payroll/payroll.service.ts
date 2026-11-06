
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
  Payroll,
  PayrollStatus,
} from './schemas/payroll.schema.js';

import {
  SalaryStructure,
} from './schemas/salary-structure.schema.js';

import {
  Employee,
} from '../employees/schemas/employee.schema.js';

import { CreatePayrollDto } from './dto/create-payroll.dto.js';
import { UpdatePayrollDto } from './dto/update-payroll.dto.js';
import { SalaryStructureDto } from './dto/salary-structure.dto.js';

type PayrollAmounts = {
  basicSalary: number;
  allowances: number;
  deductions: number;
  additionalAllowances: number;
  additionalDeductions: number;
};

@Injectable()
export class PayrollService {
  constructor(
    @InjectModel(Payroll.name)
    private readonly payrollModel: Model<Payroll>,

    @InjectModel(SalaryStructure.name)
    private readonly salaryModel: Model<SalaryStructure>,

    @InjectModel(Employee.name)
    private readonly employeeModel: Model<Employee>,
  ) {}

  private oid(id: string): Types.ObjectId {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      throw new BadRequestException('Invalid MongoDB ID');
    }

    return new Types.ObjectId(id);
  }

  private cents(value: number): number {
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      value > 1000000000
    ) {
      throw new BadRequestException(
        'Invalid monetary amount',
      );
    }

    const rounded = Math.round(value * 100);

    if (
      Math.abs(value * 100 - rounded) > 0.00001
    ) {
      throw new BadRequestException(
        'Monetary amounts support at most two decimals',
      );
    }

    return rounded;
  }

  private calculate(amounts: PayrollAmounts) {
    const grossCents =
      this.cents(amounts.basicSalary) +
      this.cents(amounts.allowances) +
      this.cents(amounts.additionalAllowances);

    const deductionCents =
      this.cents(amounts.deductions) +
      this.cents(amounts.additionalDeductions);

    const netCents = grossCents - deductionCents;

    if (netCents < 0) {
      throw new BadRequestException(
        'Total deductions cannot exceed gross salary',
      );
    }

    return {
      grossSalary: grossCents / 100,
      totalDeductions: deductionCents / 100,
      netSalary: netCents / 100,
    };
  }

  private databaseError(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      throw new ConflictException(
        'Salary structure or monthly payroll already exists',
      );
    }

    throw error;
  }

  private async getEmployee(employeeId: string) {
    const employee = await this.employeeModel
      .findById(this.oid(employeeId))
      .lean();

    if (!employee) {
      throw new NotFoundException(
        'Employee profile not found',
      );
    }

    return employee;
  }

  private async getPayroll(id: string) {
    const payroll = await this.payrollModel
      .findById(this.oid(id))
      .lean();

    if (!payroll) {
      throw new NotFoundException(
        'Payroll record not found',
      );
    }

    return payroll;
  }

  private checkMonth(month: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new BadRequestException(
        'Month must use YYYY-MM format',
      );
    }

    const year = Number(month.slice(0, 4));

    if (year < 2000 || year > 2100) {
      throw new BadRequestException(
        'Payroll year must be between 2000 and 2100',
      );
    }
  }

  async configureSalary(
    employeeId: string,
    dto: SalaryStructureDto,
  ) {
    const employee = await this.getEmployee(employeeId);

    const basicSalary = dto.basicSalary;
    const fixedAllowances = dto.fixedAllowances ?? 0;
    const fixedDeductions = dto.fixedDeductions ?? 0;

    this.calculate({
      basicSalary,
      allowances: fixedAllowances,
      deductions: fixedDeductions,
      additionalAllowances: 0,
      additionalDeductions: 0,
    });

    const currency = (dto.currency ?? 'PKR')
      .trim()
      .toUpperCase();

    try {
      const salary = await this.salaryModel
        .findOneAndUpdate(
          { employeeId: employee._id },
          {
            $set: {
              basicSalary,
              fixedAllowances,
              fixedDeductions,
              currency,
              isActive: dto.isActive ?? true,
            },
            $setOnInsert: {
              employeeId: employee._id,
            },
          },
          {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true,
          },
        );

      return {
        message: 'Salary structure saved successfully',
        salary,
      };
    } catch (error) {
      this.databaseError(error);
    }
  }

  async getSalary(employeeId: string) {
    const employee = await this.getEmployee(employeeId);

    const salary = await this.salaryModel
      .findOne({ employeeId: employee._id })
      .lean();

    if (!salary) {
      throw new NotFoundException(
        'Salary structure not configured',
      );
    }

    return { salary };
  }

  async create(
    dto: CreatePayrollDto,
    actorUserId: string,
  ) {
    this.checkMonth(dto.month);

    const employee = await this.getEmployee(
      dto.employeeId,
    );

    const salary = await this.salaryModel
      .findOne({
        employeeId: employee._id,
        isActive: true,
      })
      .lean();

    if (!salary) {
      throw new BadRequestException(
        'Employee has no active salary structure',
      );
    }

    const existing = await this.payrollModel.exists({
      employeeId: employee._id,
      month: dto.month,
    });

    if (existing) {
      throw new ConflictException(
        'Payroll already exists for this employee and month',
      );
    }

    const amounts: PayrollAmounts = {
      basicSalary: salary.basicSalary,
      allowances: salary.fixedAllowances,
      deductions: salary.fixedDeductions,
      additionalAllowances:
        dto.additionalAllowances ?? 0,
      additionalDeductions:
        dto.additionalDeductions ?? 0,
    };

    const totals = this.calculate(amounts);

    try {
      const payroll = await this.payrollModel.create({
        employeeId: employee._id,
        month: dto.month,
        currency: salary.currency,
        ...amounts,
        ...totals,
        status: PayrollStatus.DRAFT,
        notes: dto.notes?.trim() ?? '',
        createdBy: this.oid(actorUserId),
      });

      return {
        message: 'Payroll draft generated successfully',
        payroll,
      };
    } catch (error) {
      this.databaseError(error);
    }
  }

  async findAll(
    page = 1,
    limit = 10,
    month?: string,
    status?: string,
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

    if (month) {
      this.checkMonth(month);
    }

    if (
      status &&
      !Object.values(PayrollStatus).includes(
        status as PayrollStatus,
      )
    ) {
      throw new BadRequestException(
        'Invalid payroll status',
      );
    }

    const filter: {
      month?: string;
      status?: PayrollStatus;
    } = {};

    if (month) {
      filter.month = month;
    }

    if (status) {
      filter.status = status as PayrollStatus;
    }

    const [data, total] = await Promise.all([
      this.payrollModel
        .find(filter)
        .sort({
          month: -1,
          createdAt: -1,
        })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      this.payrollModel.countDocuments(filter),
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
    if (
      !Number.isSafeInteger(page) ||
      !Number.isSafeInteger(limit) ||
      page < 1 ||
      limit < 1 ||
      limit > 100
    ) {
      throw new BadRequestException(
        'Invalid pagination',
      );
    }

    const employee = await this.employeeModel
      .findOne({
        userId: this.oid(userId),
      })
      .lean();

    if (!employee) {
      throw new NotFoundException(
        'No employee profile linked to this account',
      );
    }

    const filter = {
      employeeId: employee._id,
      status: {
        $in: [
          PayrollStatus.APPROVED,
          PayrollStatus.PAID,
        ],
      },
    };

    const [data, total] = await Promise.all([
      this.payrollModel
        .find(filter)
        .sort({ month: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      this.payrollModel.countDocuments(filter),
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

  async findOne(id: string) {
    return {
      payroll: await this.getPayroll(id),
    };
  }

  async update(id: string, dto: UpdatePayrollDto) {
    const payroll = await this.getPayroll(id);

    if (payroll.status !== PayrollStatus.DRAFT) {
      throw new ConflictException(
        'Only draft payroll can be edited',
      );
    }

    if (
      dto.additionalAllowances === undefined &&
      dto.additionalDeductions === undefined &&
      dto.notes === undefined
    ) {
      throw new BadRequestException(
        'Provide at least one field to update',
      );
    }

    const amounts: PayrollAmounts = {
      basicSalary: payroll.basicSalary,
      allowances: payroll.allowances,
      deductions: payroll.deductions,
      additionalAllowances:
        dto.additionalAllowances ??
        payroll.additionalAllowances,
      additionalDeductions:
        dto.additionalDeductions ??
        payroll.additionalDeductions,
    };

    const totals = this.calculate(amounts);

    const updated = await this.payrollModel
      .findOneAndUpdate(
        {
          _id: payroll._id,
          status: PayrollStatus.DRAFT,
        },
        {
          $set: {
            additionalAllowances:
              amounts.additionalAllowances,
            additionalDeductions:
              amounts.additionalDeductions,
            ...totals,
            ...(dto.notes !== undefined
              ? { notes: dto.notes.trim() }
              : {}),
          },
        },
        {
          new: true,
          runValidators: true,
        },
      );

    if (!updated) {
      throw new ConflictException(
        'Payroll is no longer a draft',
      );
    }

    return {
      message: 'Payroll draft updated successfully',
      payroll: updated,
    };
  }

  async approve(id: string, actorUserId: string) {
    const payroll = await this.getPayroll(id);

    if (payroll.status !== PayrollStatus.DRAFT) {
      throw new ConflictException(
        'Only draft payroll can be approved',
      );
    }

    this.calculate({
      basicSalary: payroll.basicSalary,
      allowances: payroll.allowances,
      deductions: payroll.deductions,
      additionalAllowances:
        payroll.additionalAllowances,
      additionalDeductions:
        payroll.additionalDeductions,
    });

    const approved = await this.payrollModel
      .findOneAndUpdate(
        {
          _id: payroll._id,
          status: PayrollStatus.DRAFT,
        },
        {
          $set: {
            status: PayrollStatus.APPROVED,
            approvedBy: this.oid(actorUserId),
            approvedAt: new Date(),
          },
        },
        {
          new: true,
          runValidators: true,
        },
      );

    if (!approved) {
      throw new ConflictException(
        'Payroll state changed before approval',
      );
    }

    return {
      message: 'Payroll approved successfully',
      payroll: approved,
    };
  }

  async markPaid(id: string, actorUserId: string) {
    const payroll = await this.payrollModel
      .findOneAndUpdate(
        {
          _id: this.oid(id),
          status: PayrollStatus.APPROVED,
        },
        {
          $set: {
            status: PayrollStatus.PAID,
            paidAt: new Date(),
            markedPaidBy: this.oid(actorUserId),
          },
        },
        {
          new: true,
          runValidators: true,
        },
      );

    if (!payroll) {
      throw new ConflictException(
        'Only approved payroll can be marked paid',
      );
    }

    return {
      message: 'Payroll marked as paid successfully',
      payroll,
      paymentTransferred: false,
    };
  }
}
