export type PreviousEmploymentRow = {
  id: string;
  employer: string;
  jobTitle: string;
  duties: string;
  startDate: string;
  endDate: string;
};

export function emptyEmploymentRow(id: string): PreviousEmploymentRow {
  return {
    id,
    employer: "",
    jobTitle: "",
    duties: "",
    startDate: "",
    endDate: "",
  };
}

export type StaffActivityRow = {
  id: string;
  occurredOn: string;
  category: string;
  description: string;
  resolution: string;
  followUp: string;
  recordedBy: string;
  notes: string;
};

export const STAFF_ACTIVITY_CATEGORIES = [
  { value: "", label: "Category…" },
  { value: "incident", label: "Incident / safety" },
  { value: "training", label: "Training" },
  { value: "performance", label: "Performance" },
  { value: "attendance", label: "Attendance" },
  { value: "disciplinary", label: "Disciplinary" },
  { value: "recognition", label: "Recognition" },
  { value: "other", label: "Other" },
] as const;

export function emptyActivityRow(id: string): StaffActivityRow {
  return {
    id,
    occurredOn: "",
    category: "",
    description: "",
    resolution: "",
    followUp: "",
    recordedBy: "",
    notes: "",
  };
}

export type StaffMember = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  employeeId: string;
  passportFrontWebp: string | null;
  passportBackWebp: string | null;
  email: string;
  phone: string;
  alternatePhone: string;
  contactAddress: string;
  /** Matches `ShopBranch.id` from vendor branches. */
  branchId: string;
  assignedRoleId: string;
  duties: string;
  previousJobs: PreviousEmploymentRow[];
  activityLog: StaffActivityRow[];
};

export function emptyStaffMember(staffId: string, branchId: string): StaffMember {
  return {
    id: staffId,
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    employeeId: "",
    passportFrontWebp: null,
    passportBackWebp: null,
    email: "",
    phone: "",
    alternatePhone: "",
    contactAddress: "",
    branchId,
    assignedRoleId: "",
    duties: "",
    previousJobs: [emptyEmploymentRow(`${staffId}-e0`)],
    activityLog: [emptyActivityRow(`${staffId}-a0`)],
  };
}

export function displayStaffSummary(m: StaffMember, index: number): string {
  const name = `${m.firstName} ${m.lastName}`.trim();
  if (name.length > 0) return name;
  return `New staff (${index + 1})`;
}
