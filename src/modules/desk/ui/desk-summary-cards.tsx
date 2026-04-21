"use client";

import type { DeskNotification } from "@/modules/desk/types/desk-notification";
import type { ApprovalRequest } from "@/modules/desk/types/approval";

function Card({
  title,
  value,
  sub,
  valueTone,
}: {
  title: string;
  value: string;
  sub: string;
  valueTone: "teal" | "slate" | "risk";
}) {
  const tone =
    valueTone === "teal"
      ? "text-teal-700"
      : valueTone === "risk"
        ? "text-red-600"
        : "text-slate-900";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-vc-card">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className={`mt-2 font-heading text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  );
}

export function DeskSummaryCards({
  approvals,
  notifications,
  escalations,
}: {
  approvals: ApprovalRequest[];
  notifications: DeskNotification[];
  escalations: ApprovalRequest[];
}) {
  const critical = notifications.filter((n) => n.severity === "critical" || n.severity === "urgent").length;
  const pending = approvals.filter(
    (a) => a.status === "pending" || a.status === "escalated" || a.status === "partially_approved",
  ).length;
  const esc = escalations.length;
  const riskCount = critical + esc;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card title="Pending approvals" value={String(pending)} sub="Items waiting for decision" valueTone="teal" />
      <Card title="Need attention" value={String(notifications.length)} sub="Active notifications on your desk" valueTone="teal" />
      <Card
        title="Critical / escalations"
        value={String(riskCount)}
        sub="Urgent signals & overdue items"
        valueTone={riskCount > 0 ? "risk" : "slate"}
      />
    </div>
  );
}
