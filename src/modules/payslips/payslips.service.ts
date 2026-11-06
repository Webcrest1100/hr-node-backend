
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import PDFDocument from 'pdfkit';

import {
  Payroll,
  PayrollStatus,
} from '../payroll/schemas/payroll.schema.js';

import {
  Employee,
} from '../employees/schemas/employee.schema.js';

import {
  User,
} from '../users/schemas/users.schema.js';

import {
  Payslip,
} from './schemas/payslips.schema.js';

import {
  CreatePayslipsDto,
} from './dto/create-payslips.dto.js';

import {
  UpdatePayslipsDto,
} from './dto/update-payslips.dto.js';

@Injectable()
export class PayslipsService {
  constructor(
    @InjectModel(Payslip.name)
    private readonly payslipModel: Model<Payslip>,

    @InjectModel(Payroll.name)
    private readonly payrollModel: Model<Payroll>,

    @InjectModel(Employee.name)
    private readonly employeeModel: Model<Employee>,

    @InjectModel(User.name)
    private readonly userModel: Model<User>,
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
        'Payslip already exists for this payroll or employee month',
      );
    }

    throw error;
  }

  private validatePagination(page: number, limit: number) {
    if (
      !Number.isSafeInteger(page) ||
      !Number.isSafeInteger(limit) ||
      page < 1 ||
      limit < 1 ||
      limit > 100
    ) {
      throw new BadRequestException(
        'Page must be >= 1 and limit must be between 1 and 100',
      );
    }
  }

  private validateMonth(month: string) {
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
      Number(month.slice(0, 4)) < 2000 ||
      Number(month.slice(0, 4)) > 2100
    ) {
      throw new BadRequestException(
        'Month must be YYYY-MM, with year between 2000 and 2100',
      );
    }
  }

  private async getPayslip(id: string) {
    const payslip = await this.payslipModel
      .findById(this.oid(id))
      .lean();

    if (!payslip) {
      throw new NotFoundException(
        'Payslip not found',
      );
    }

    return payslip;
  }

  private async getAuthorizedPayslip(
    id: string,
    userId: string,
    role: string,
  ) {
    const payslip = await this.getPayslip(id);

    const isStaff =
      role === 'admin' ||
      role === 'hr';

    if (!isStaff) {
      const employee = await this.employeeModel.exists({
        _id: payslip.employeeId,
        userId: this.oid(userId),
      });

      if (!employee) {
        throw new ForbiddenException(
          'You cannot access another employee payslip',
        );
      }
    }

    return payslip;
  }

  async create(
    dto: CreatePayslipsDto,
    issuedByUserId: string,
  ) {
    const payroll = await this.payrollModel
      .findById(this.oid(dto.payrollId))
      .lean();

    if (!payroll) {
      throw new NotFoundException(
        'Payroll record not found',
      );
    }

    if (
      payroll.status !== PayrollStatus.APPROVED &&
      payroll.status !== PayrollStatus.PAID
    ) {
      throw new ConflictException(
        'Only approved or paid payroll can have a payslip',
      );
    }

    const employee = await this.employeeModel
      .findById(payroll.employeeId)
      .lean();

    if (!employee) {
      throw new NotFoundException(
        'Employee profile not found',
      );
    }

    const user = await this.userModel
      .findById(employee.userId)
      .select('fullName')
      .lean();

    if (!user) {
      throw new NotFoundException(
        'Linked user account not found',
      );
    }

    const employeeName = user.fullName.trim();

    if (!employeeName) {
      throw new BadRequestException(
        'Employee name is missing',
      );
    }

    try {
      const payslip = await this.payslipModel.create({
        payrollId: payroll._id,
        employeeId: employee._id,
        month: payroll.month,
        employeeCode: employee.employeeCode,
        employeeName,
        currency: payroll.currency,
        basicSalary: payroll.basicSalary,
        allowances: payroll.allowances,
        deductions: payroll.deductions,
        additionalAllowances:
          payroll.additionalAllowances,
        additionalDeductions:
          payroll.additionalDeductions,
        grossSalary: payroll.grossSalary,
        totalDeductions: payroll.totalDeductions,
        netSalary: payroll.netSalary,
        payrollStatusAtIssue: payroll.status,
        issuedBy: this.oid(issuedByUserId),
        issuedAt: new Date(),
        notes: dto.notes?.trim() ?? '',
      });

      return {
        message: 'Payslip generated successfully',
        payslip,
      };
    } catch (error) {
      this.databaseError(error);
    }
  }

  async findAll(
    page = 1,
    limit = 10,
    month?: string,
  ) {
    this.validatePagination(page, limit);

    if (month !== undefined) {
      this.validateMonth(month);
    }

    const filter: { month?: string } = {};

    if (month !== undefined) {
      filter.month = month;
    }

    const [data, total] = await Promise.all([
      this.payslipModel
        .find(filter)
        .sort({
          month: -1,
          issuedAt: -1,
        })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      this.payslipModel.countDocuments(filter),
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
    this.validatePagination(page, limit);

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
    };

    const [data, total] = await Promise.all([
      this.payslipModel
        .find(filter)
        .sort({
          month: -1,
          issuedAt: -1,
        })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      this.payslipModel.countDocuments(filter),
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

  async findOne(
    id: string,
    userId: string,
    role: string,
  ) {
    return {
      payslip: await this.getAuthorizedPayslip(
        id,
        userId,
        role,
      ),
    };
  }

  async update(
    id: string,
    dto: UpdatePayslipsDto,
  ) {
    const payslip = await this.payslipModel
      .findByIdAndUpdate(
        this.oid(id),
        {
          $set: {
            notes: dto.notes.trim(),
          },
        },
        {
          new: true,
          runValidators: true,
        },
      );

    if (!payslip) {
      throw new NotFoundException(
        'Payslip not found',
      );
    }

    return {
      message: 'Payslip notes updated successfully',
      payslip,
    };
  }

  private formatMoney(
    value: number,
    currency: string,
  ): string {
    return `${currency} ${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  private pdfRow(
    document: PDFKit.PDFDocument,
    label: string,
    value: string,
  ) {
    const y = document.y;

    document
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#374151')
      .text(label, 50, y, {
        width: 275,
      });

    document
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#111827')
      .text(value, 330, y, {
        width: 210,
        align: 'right',
      });

    document.y = y + 27;
  }

  private async renderPdf(
    payslip: Payslip,
  ): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const document = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Payslip ${payslip.month}`,
          Author: 'Web Crest HR Backend',
          Subject: 'Employee salary payslip',
        },
      });

      const chunks: Buffer[] = [];

      document.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      document.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      document.on('error', reject);

      try {
        const currency = payslip.currency;

        document
          .font('Helvetica-Bold')
          .fontSize(21)
          .fillColor('#111827')
          .text('WEB CREST', {
            align: 'center',
          });

        document.moveDown(0.35);

        document
          .font('Helvetica')
          .fontSize(11)
          .fillColor('#6B7280')
          .text('EMPLOYEE PAYSLIP', {
            align: 'center',
          });

        document.moveDown(1.2);

        document
          .moveTo(50, document.y)
          .lineTo(545, document.y)
          .strokeColor('#D1D5DB')
          .stroke();

        document.moveDown(1.2);

        this.pdfRow(
          document,
          'Employee Name',
          payslip.employeeName,
        );

        this.pdfRow(
          document,
          'Employee Code',
          payslip.employeeCode,
        );

        this.pdfRow(
          document,
          'Salary Month',
          payslip.month,
        );

        this.pdfRow(
          document,
          'Issue Date',
          new Date(payslip.issuedAt)
            .toISOString()
            .slice(0, 10),
        );

        this.pdfRow(
          document,
          'Payroll Status at Issue',
          payslip.payrollStatusAtIssue.toUpperCase(),
        );

        document.moveDown(1);

        document
          .font('Helvetica-Bold')
          .fontSize(13)
          .fillColor('#111827')
          .text('EARNINGS');

        document.moveDown(0.8);

        this.pdfRow(
          document,
          'Basic Salary',
          this.formatMoney(
            payslip.basicSalary,
            currency,
          ),
        );

        this.pdfRow(
          document,
          'Fixed Allowances',
          this.formatMoney(
            payslip.allowances,
            currency,
          ),
        );

        this.pdfRow(
          document,
          'Additional Allowances',
          this.formatMoney(
            payslip.additionalAllowances,
            currency,
          ),
        );

        this.pdfRow(
          document,
          'Gross Salary',
          this.formatMoney(
            payslip.grossSalary,
            currency,
          ),
        );

        document.moveDown(1);

        document
          .font('Helvetica-Bold')
          .fontSize(13)
          .fillColor('#111827')
          .text('DEDUCTIONS');

        document.moveDown(0.8);

        this.pdfRow(
          document,
          'Fixed Deductions',
          this.formatMoney(
            payslip.deductions,
            currency,
          ),
        );

        this.pdfRow(
          document,
          'Additional Deductions',
          this.formatMoney(
            payslip.additionalDeductions,
            currency,
          ),
        );

        this.pdfRow(
          document,
          'Total Deductions',
          this.formatMoney(
            payslip.totalDeductions,
            currency,
          ),
        );

        document.moveDown(0.8);

        document
          .moveTo(50, document.y)
          .lineTo(545, document.y)
          .strokeColor('#D1D5DB')
          .stroke();

        document.moveDown(0.9);

        document
          .font('Helvetica-Bold')
          .fontSize(15)
          .fillColor('#111827');

        this.pdfRow(
          document,
          'NET SALARY',
          this.formatMoney(
            payslip.netSalary,
            currency,
          ),
        );

        document.moveDown(1.2);

        document
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#6B7280')
          .text(
            'This document is generated from the HR payroll record. ' +
              'Payroll status at issue does not independently confirm bank transfer.',
            {
              align: 'center',
            },
          );

        document.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  async downloadPdf(
    id: string,
    userId: string,
    role: string,
  ) {
    const payslip = await this.getAuthorizedPayslip(
      id,
      userId,
      role,
    );

    const filenameCode = payslip.employeeCode
      .replace(/[^A-Za-z0-9_-]/g, '_');

    const filename =
      `payslip-${filenameCode}-${payslip.month}.pdf`;

    const pdf = await this.renderPdf(payslip);

    return {
      filename,
      pdf,
    };
  }
}
