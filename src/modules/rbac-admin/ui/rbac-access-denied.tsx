"use client";

import Link from "next/link";
import type { PermissionCheckResult } from "@/modules/authz/types";

export function RbacAccessDenied(props: { denied?: PermissionCheckResult | null; title?: string }) {
  const title = props.title ?? "Access denied";
  const msg = props.denied?.reasonMessage ?? "You do not have permission to open this governance console.";
  return (
    <div className="vc-card mx-auto max-w-xl">
      <h1 className="font-heading text-lg font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{msg}</p>
      {props.denied?.permissionKey ? (
        <p className="mt-2 font-mono text-xs text-slate-500">Permission: {props.denied.permissionKey}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/dashboard/desk" className="vc-btn-secondary">
          Back to Desk
        </Link>
        <Link href="/dashboard" className="vc-btn-primary">
          Dashboard overview
        </Link>
      </div>
    </div>
  );
}
