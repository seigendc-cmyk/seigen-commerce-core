"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import { BusinessProfileForm } from "@/modules/dashboard/settings/business-profile/business-profile-form";
import { BranchesSettingsForm } from "@/modules/dashboard/settings/branches/branches-settings-form";
import { RolesPermissionsForm } from "@/modules/dashboard/settings/roles/roles-permissions-form";
import { StaffSettingsForm } from "@/modules/dashboard/settings/staff/staff-settings-form";
import { IdeliverSettingsForm } from "@/modules/dashboard/settings/ideliver/ideliver-settings-form";
import { CurrencySettingsForm } from "@/modules/dashboard/settings/currency/currency-settings-form";
import { DevicesSettingsForm } from "@/modules/dashboard/settings/devices/devices-settings-form";
import { TerminalSettingsForm } from "@/modules/dashboard/settings/terminal/terminal-settings-form";
import { BanksSettingsForm } from "@/modules/dashboard/settings/banks/banks-settings-form";
import { CoaSettingsForm } from "@/modules/dashboard/settings/coa/coa-settings-form";
import { ReportWriterSettingsForm } from "@/modules/dashboard/settings/report-writer/report-writer-settings-form";
import { BillingSettingsForm } from "@/modules/dashboard/settings/billing/billing-settings-form";
import { BankAccountsSettingsForm } from "@/modules/dashboard/settings/bank-accounts/bank-accounts-settings-form";
import { CashBookSettingsForm } from "@/modules/dashboard/settings/cash-book/cash-book-settings-form";
import { TaxSettingsForm } from "@/modules/dashboard/settings/tax/tax-settings-form";
import {
  normalizeVendorSettingsTab,
  VENDOR_SETTINGS_DEFAULT_TAB,
  VENDOR_SETTINGS_PANEL_COPY,
  VENDOR_SETTINGS_TABS,
  type VendorSettingsTabId,
} from "@/modules/dashboard/settings/vendor-settings-nav";

export type { VendorSettingsTabId } from "@/modules/dashboard/settings/vendor-settings-nav";

function SettingsDetailPanel({ tabId }: { tabId: VendorSettingsTabId }) {
  const copy = VENDOR_SETTINGS_PANEL_COPY[tabId];
  return (
    <section className="vc-card-accent-indigo">
      <h2 className="font-heading text-base font-semibold text-slate-900">{copy.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{copy.lead}</p>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-600">
        {copy.pillars.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-5 text-xs text-slate-500">
        Detailed screens will connect to your workspace as each area is turned on.
      </p>
    </section>
  );
}

export function VendorSettingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = useMemo(() => normalizeVendorSettingsTab(searchParams.get("tab")), [searchParams]);

  function selectTab(id: VendorSettingsTabId) {
    const params = new URLSearchParams(searchParams.toString());
    if (id === VENDOR_SETTINGS_DEFAULT_TAB) {
      params.delete("tab");
    } else {
      params.set("tab", id);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <>
        <DashboardTopBar
          title="Settings"
          subtitle="Manage your business details, people, branches, money, and devices in one place."
        />
        <div className="flex-1 space-y-6 px-4 py-6 sm:px-6">
          <div className="-mx-1 overflow-x-auto pb-1">
            <div className="flex min-w-min flex-wrap gap-2 px-1">
              {VENDOR_SETTINGS_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  title={t.hint}
                  onClick={() => selectTab(t.id)}
                  className={
                    tab === t.id
                      ? "vendor-seg-tab vendor-seg-tab-compact vendor-seg-tab-active shrink-0"
                      : "vendor-seg-tab vendor-seg-tab-compact vendor-seg-tab-inactive shrink-0"
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {tab === "business-profile" ? (
            <BusinessProfileForm />
          ) : tab === "staff" ? (
            <StaffSettingsForm />
          ) : tab === "roles-permissions" ? (
            <RolesPermissionsForm />
          ) : tab === "branches" ? (
            <BranchesSettingsForm />
          ) : tab === "ideliver" ? (
            <IdeliverSettingsForm />
          ) : tab === "currency" ? (
            <CurrencySettingsForm />
          ) : tab === "devices" ? (
            <DevicesSettingsForm />
          ) : tab === "terminal" ? (
            <TerminalSettingsForm />
          ) : tab === "banks" ? (
            <BanksSettingsForm />
          ) : tab === "cash-book" ? (
            <CashBookSettingsForm />
          ) : tab === "bank-accounts" ? (
            <BankAccountsSettingsForm />
          ) : tab === "coa" ? (
            <CoaSettingsForm />
          ) : tab === "tax" ? (
            <TaxSettingsForm />
          ) : tab === "report-writer" ? (
            <ReportWriterSettingsForm />
          ) : tab === "billing" ? (
            <BillingSettingsForm />
          ) : (
            <SettingsDetailPanel tabId={tab} />
          )}
        </div>
    </>
  );
}
