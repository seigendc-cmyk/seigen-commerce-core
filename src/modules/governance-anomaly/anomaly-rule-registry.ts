export type AnomalySeverity = "info" | "warning" | "high" | "critical";

export type AnomalyRule = {
  code: string;
  title: string;
  severity: AnomalySeverity;
  /** threshold count within window */
  threshold: number;
  windowDays: number;
};

export const ANOMALY_RULES: AnomalyRule[] = [
  {
    code: "override.permanent_grants_concentrated",
    title: "Permanent grant overrides concentrated on one user",
    severity: "high",
    threshold: 3,
    windowDays: 30,
  },
  {
    code: "stepup.failed_supervisor_passcode",
    title: "Repeated failed supervisor passcode attempts",
    severity: "high",
    threshold: 5,
    windowDays: 7,
  },
  {
    code: "denial.repeated_critical",
    title: "Repeated denied attempts on critical permissions",
    severity: "warning",
    threshold: 8,
    windowDays: 7,
  },
];

