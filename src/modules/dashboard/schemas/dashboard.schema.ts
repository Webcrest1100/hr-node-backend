
export interface DashboardPeriod {
  month: string;
  startDate: string;
  endDate: string;
}

export interface AttendanceTrendPoint {
  date: string;
  total: number;
  present: number;
  late: number;
}

export interface DashboardTaskStats {
  total: number;
  todo: number;
  inProgress: number;
  inReview: number;
  blocked: number;
  done: number;
}

export interface DashboardLeaveStats {
  pending: number;
  approved: number;
  rejected: number;
}

export interface DashboardAttendanceStats {
  totalRecords: number;
  lateRecords: number;
  completedRecords: number;
}
