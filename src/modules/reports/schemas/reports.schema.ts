
export enum ReportKind {
  ATTENDANCE = 'attendance',
  LEAVES = 'leaves',
  TASKS = 'tasks',
  PAYROLL = 'payroll',
}

export interface ReportPeriod {
  from: string;
  to: string;
}

export type ReportValue =
  string | number | boolean | null;

export type ReportRow = Record<string, ReportValue>;
