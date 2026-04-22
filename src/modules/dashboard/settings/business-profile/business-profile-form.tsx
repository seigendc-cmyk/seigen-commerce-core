"use client";

import { useCallback, useMemo, useState } from "react";
import { readVendorCore, writeVendorCore } from "@/modules/dashboard/settings/vendor-core-storage";
import {
  assessBusinessDisplayName,
  type NameAssessment,
} from "@/modules/dashboard/settings/business-profile/business-name-rules";
import { ComplianceDocuments } from "@/modules/dashboard/settings/business-profile/compliance-documents";
import type { ComplianceDocSlot } from "@/modules/dashboard/settings/business-profile/compliance-documents";
import { PassportImageSlot } from "@/modules/dashboard/settings/staff/passport-image-slot";
import { SectorMultiCombo } from "@/modules/dashboard/settings/business-profile/sector-multi-combo";
import {
  getDefaultTimeZoneForLocale,
  listSortedTimeZoneIds,
} from "@/modules/dashboard/settings/business-profile/locale-default-timezone";
import { ALL_LOCALE_VALUES, DEFAULT_LOCALE_GROUPS } from "@/modules/dashboard/settings/business-profile/locale-options";
import { listSectorDefinitions } from "@/modules/inventory/sector-config/sector-registry";
import type { ProductSectorId } from "@/modules/inventory/types/sector";

const emptyComplianceDocs = (): Record<
  "taxClearance" | "companyRegistration" | "tradingLicense",
  ComplianceDocSlot
> => ({
  taxClearance: { file: null, showOnStorefront: false },
  companyRegistration: { file: null, showOnStorefront: false },
  tradingLicense: { file: null, showOnStorefront: false },
});

type AdditionalPartnerRow = {
  id: string;
  firstName: string;
  lastName: string;
  partnershipRole: string;
  email: string;
  phone: string;
  notes: string;
};

function newPartnerRow(): AdditionalPartnerRow {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ptr_${Date.now()}`,
    firstName: "",
    lastName: "",
    partnershipRole: "",
    email: "",
    phone: "",
    notes: "",
  };
}

type BusinessProfileCoreV1 = {
  schema: "seigen_vendor_business_profile_v1";
  legalName: string;
  tradingName: string;
  businessEmail: string;
  businessPhone: string;
  website: string;
  registeredAddress: string;
  locale: string;
  timezone: string;
  /** Optimized WebP data URL (or null). */
  vendorLogoWebp: string | null;
  /** Optimized WebP data URL (or null). */
  storefrontBannerWebp: string | null;
  /** Optional Telegram username or contact handle (no @ required). */
  telegramHandle: string;
};

const BUSINESS_PROFILE_KEY = "business_profile";

function readBusinessProfileDraft(): BusinessProfileCoreV1 {
  const fallback: BusinessProfileCoreV1 = {
    schema: "seigen_vendor_business_profile_v1",
    legalName: "",
    tradingName: "",
    businessEmail: "",
    businessPhone: "",
    website: "",
    registeredAddress: "",
    locale: "en-US",
    timezone: getDefaultTimeZoneForLocale("en-US"),
    vendorLogoWebp: null,
    storefrontBannerWebp: null,
    telegramHandle: "",
  };
  const stored = readVendorCore<BusinessProfileCoreV1 | null>(BUSINESS_PROFILE_KEY, null);
  if (!stored || stored.schema !== "seigen_vendor_business_profile_v1") return fallback;
  return { ...fallback, ...stored };
}

function NameFieldHint({
  assessment,
  verificationRequested,
  onRequestVerification,
  fieldLabel,
}: {
  assessment: NameAssessment;
  verificationRequested: boolean;
  onRequestVerification: () => void;
  fieldLabel: string;
}) {
  if (assessment === "empty" || assessment === "ok") return null;

  const isTaken = assessment === "taken";
  const isPublic = assessment === "public_organization";

  return (
    <div className="mt-2 space-y-2">
      {isTaken ? (
        <p className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-100">
          <span className="font-semibold">Possible duplicate.</span> This {fieldLabel.toLowerCase()} matches another
          registered vendor. You cannot use it unless seiGEN verifies your entitlement (e.g. same business,
          acquisition, or licensed franchise).
        </p>
      ) : null}
      {isPublic ? (
        <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
          <span className="font-semibold">Public organisation match.</span> This resembles a well-known corporate name.
          It cannot be used on the storefront unless your organisation is verified and authorised to trade under it.
        </p>
      ) : null}
      {!verificationRequested && (isTaken || isPublic) ? (
        <button
          type="button"
          onClick={onRequestVerification}
          className="text-xs font-semibold text-teal-600 hover:underline"
        >
          Request name verification
        </button>
      ) : null}
      {verificationRequested && (isTaken || isPublic) ? (
        <p className="text-xs text-emerald-300/90">
          Verification request recorded for this draft — compliance will contact you when backend workflow is
          connected.
        </p>
      ) : null}
    </div>
  );
}

export function BusinessProfileForm() {
  const stored = useMemo(() => readBusinessProfileDraft(), []);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [personalPhone, setPersonalPhone] = useState("");
  const [personalAlternatePhone, setPersonalAlternatePhone] = useState("");

  const [additionalPartners, setAdditionalPartners] = useState<AdditionalPartnerRow[]>([]);

  /** When `registered`, extra company reg / tax / license fields are shown. */
  const [businessType, setBusinessType] = useState<
    "registered" | "sole_trader" | "partnership" | "other"
  >("sole_trader");

  const [legalName, setLegalName] = useState(stored.legalName);
  const [tradingName, setTradingName] = useState(stored.tradingName);
  /** Used when business type is not registered (single reference line). */
  const [registrationId, setRegistrationId] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [vatRegistered, setVatRegistered] = useState(false);
  const [complianceNotes, setComplianceNotes] = useState("");

  const [companyRegistrationNumber, setCompanyRegistrationNumber] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [yearOfRegistration, setYearOfRegistration] = useState("");
  const [businessLicenseDetails, setBusinessLicenseDetails] = useState("");

  const [complianceDocs, setComplianceDocs] = useState(emptyComplianceDocs);

  /** Placeholder until verification workflow is backed by Supabase. */
  const [legalNameVerificationRequested, setLegalNameVerificationRequested] = useState(false);
  const [tradingNameVerificationRequested, setTradingNameVerificationRequested] = useState(false);

  const [businessEmail, setBusinessEmail] = useState(stored.businessEmail);
  const [businessPhone, setBusinessPhone] = useState(stored.businessPhone);
  const [website, setWebsite] = useState(stored.website);
  const [registeredAddress, setRegisteredAddress] = useState(stored.registeredAddress);

  const [locale, setLocale] = useState(stored.locale || "en-US");
  const [timezone, setTimezone] = useState(stored.timezone || getDefaultTimeZoneForLocale(stored.locale || "en-US"));

  const [vendorLogoWebp, setVendorLogoWebp] = useState<string | null>(stored.vendorLogoWebp ?? null);
  const [storefrontBannerWebp, setStorefrontBannerWebp] = useState<string | null>(stored.storefrontBannerWebp ?? null);
  const [telegramHandle, setTelegramHandle] = useState(stored.telegramHandle ?? "");

  const timeZoneIds = useMemo(() => listSortedTimeZoneIds(), []);
  const timezoneInList = timeZoneIds.includes(timezone);

  const [selectedSectors, setSelectedSectors] = useState<ProductSectorId[]>(["general_merchandise"]);

  const sectorCatalog = useMemo(() => listSectorDefinitions(), []);

  const legalNameAssessment = useMemo(() => assessBusinessDisplayName(legalName), [legalName]);
  const tradingNameAssessment = useMemo(() => assessBusinessDisplayName(tradingName), [tradingName]);

  const [savedHint, setSavedHint] = useState<string | null>(null);

  const updatePartner = useCallback((id: string, patch: Partial<Omit<AdditionalPartnerRow, "id">>) => {
    setAdditionalPartners((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const addPartner = useCallback(() => {
    setAdditionalPartners((rows) => [...rows, newPartnerRow()]);
  }, []);

  const removePartner = useCallback((id: string) => {
    setAdditionalPartners((rows) => rows.filter((r) => r.id !== id));
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: BusinessProfileCoreV1 = {
      schema: "seigen_vendor_business_profile_v1",
      legalName,
      tradingName,
      businessEmail,
      businessPhone,
      website,
      registeredAddress,
      locale,
      timezone,
      vendorLogoWebp,
      storefrontBannerWebp,
      telegramHandle: telegramHandle.trim().replace(/^@+/, ""),
    };
    writeVendorCore(BUSINESS_PROFILE_KEY, next);
    setSavedHint("Saved locally — used by offline catalogue export and receipts.");
    window.setTimeout(() => setSavedHint(null), 4000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="vendor-panel rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Branding (storefront)</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Logo and banner are embedded into exported offline catalogue packages (no network required).
        </p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <PassportImageSlot
            label="Vendor logo"
            description="Square/portrait works best. Optimized to WebP for offline export."
            value={vendorLogoWebp}
            onChange={setVendorLogoWebp}
          />
          <PassportImageSlot
            label="Storefront banner"
            description="Wide banner recommended. Optimized to WebP for offline export."
            value={storefrontBannerWebp}
            onChange={setStorefrontBannerWebp}
          />
          <div className="sm:col-span-2 max-w-md">
            <label className="block text-sm font-medium text-neutral-200" htmlFor="bp-telegram">
              Telegram contact (optional)
            </label>
            <input
              id="bp-telegram"
              value={telegramHandle}
              onChange={(e) => setTelegramHandle(e.target.value)}
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. seigencommerce (no @)"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Used as a contact link in exported catalogue pages when present.
            </p>
          </div>
        </div>
      </div>

      <div className="vendor-panel rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Personal details (vendor)</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Primary owner or administrator on the account — used for verification and notices. Partnerships can add
          other partners below once Business type is set to Partnership.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-neutral-200" htmlFor="bp-first">
              First name
            </label>
            <input
              id="bp-first"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="Given name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-200" htmlFor="bp-last">
              Last name
            </label>
            <input
              id="bp-last"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="Family name"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-neutral-200" htmlFor="bp-title">
              Role / job title
            </label>
            <input
              id="bp-title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. Owner, Operations manager"
            />
          </div>
        </div>

        <div className="mt-6 border-t border-white/10 pt-5">
          <h3 className="text-sm font-semibold text-white">Contact details</h3>
          <p className="mt-1 text-xs text-neutral-500">Direct ways to reach you for onboarding and account security.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-neutral-200" htmlFor="bp-personal-email">
                Personal email
              </label>
              <input
                id="bp-personal-email"
                type="email"
                value={personalEmail}
                onChange={(e) => setPersonalEmail(e.target.value)}
                autoComplete="email"
                className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                placeholder="name@yourmail.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-200" htmlFor="bp-personal-phone">
                Personal mobile
              </label>
              <input
                id="bp-personal-phone"
                type="tel"
                value={personalPhone}
                onChange={(e) => setPersonalPhone(e.target.value)}
                autoComplete="tel"
                className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                placeholder="Primary mobile"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-neutral-200" htmlFor="bp-personal-phone2">
                Alternate phone (optional)
              </label>
              <input
                id="bp-personal-phone2"
                type="tel"
                value={personalAlternatePhone}
                onChange={(e) => setPersonalAlternatePhone(e.target.value)}
                autoComplete="tel"
                className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                placeholder="Landline or second mobile"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="vendor-panel rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Business registration & compliance</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Legal identity and tax references as they should appear on filings and contracts. Registered names and trading
          names must be unique on the platform — you cannot reuse another vendor&apos;s name or a well-known public
          organisation name unless your account is verified.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 max-w-md">
            <label className="block text-sm font-medium text-neutral-200" htmlFor="bp-biz-type">
              Business type
            </label>
            <select
              id="bp-biz-type"
              value={businessType}
              onChange={(e) =>
                setBusinessType(e.target.value as "registered" | "sole_trader" | "partnership" | "other")
              }
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
            >
              <option value="registered">Registered legal entity</option>
              <option value="sole_trader">Sole proprietor / individual</option>
              <option value="partnership">Partnership</option>
              <option value="other">Other</option>
            </select>
            <p className="mt-1 text-xs text-neutral-500">
              If you operate as a registered company, choose Registered legal entity to capture registration and licence
              details.
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-neutral-200" htmlFor="bp-legal">
              Registered legal name
            </label>
            <input
              id="bp-legal"
              value={legalName}
              onChange={(e) => {
                setLegalName(e.target.value);
                setLegalNameVerificationRequested(false);
              }}
              autoComplete="organization"
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder={
                businessType === "registered"
                  ? "As on certificate of incorporation"
                  : "Legal or trading name as used on contracts"
              }
            />
            <NameFieldHint
              assessment={legalNameAssessment}
              verificationRequested={legalNameVerificationRequested}
              onRequestVerification={() => setLegalNameVerificationRequested(true)}
              fieldLabel="Legal name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-200" htmlFor="bp-trading">
              Trading / DBA name
            </label>
            <input
              id="bp-trading"
              value={tradingName}
              onChange={(e) => {
                setTradingName(e.target.value);
                setTradingNameVerificationRequested(false);
              }}
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="Public-facing name if different"
            />
            <NameFieldHint
              assessment={tradingNameAssessment}
              verificationRequested={tradingNameVerificationRequested}
              onRequestVerification={() => setTradingNameVerificationRequested(true)}
              fieldLabel="Trading name"
            />
          </div>
          {businessType !== "registered" ? (
            <div>
              <label className="block text-sm font-medium text-neutral-200" htmlFor="bp-reg">
                Tax / reference ID (optional)
              </label>
              <input
                id="bp-reg"
                value={registrationId}
                onChange={(e) => setRegistrationId(e.target.value)}
                className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                placeholder="EIN, VAT, local trader reference…"
              />
            </div>
          ) : null}
          <div className={businessType === "registered" ? "sm:col-span-2" : undefined}>
            <label className="block text-sm font-medium text-neutral-200" htmlFor="bp-jurisdiction">
              Jurisdiction of incorporation
            </label>
            <input
              id="bp-jurisdiction"
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. Delaware, USA · England & Wales"
            />
          </div>

          {businessType === "registered" ? (
            <div className="sm:col-span-2 rounded-xl border border-teal-500/25 bg-teal-600/5 p-4">
              <h3 className="text-sm font-semibold text-white">Registered entity details</h3>
              <p className="mt-1 text-xs text-neutral-400">
                Official numbers and licences for compliance, invoicing, and BI reporting.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-neutral-200" htmlFor="bp-co-reg">
                    Company registration number
                  </label>
                  <input
                    id="bp-co-reg"
                    value={companyRegistrationNumber}
                    onChange={(e) => setCompanyRegistrationNumber(e.target.value)}
                    className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                    placeholder="e.g. Companies House number, CIPC reg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-200" htmlFor="bp-tax-num">
                    Tax number
                  </label>
                  <input
                    id="bp-tax-num"
                    value={taxNumber}
                    onChange={(e) => setTaxNumber(e.target.value)}
                    className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                    placeholder="VAT / EIN / TIN as applicable"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-200" htmlFor="bp-year-reg">
                    Year of registration
                  </label>
                  <input
                    id="bp-year-reg"
                    type="number"
                    min={1800}
                    max={2100}
                    step={1}
                    value={yearOfRegistration}
                    onChange={(e) => setYearOfRegistration(e.target.value)}
                    className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                    placeholder="e.g. 2018"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-neutral-200" htmlFor="bp-license">
                    Business licence details
                  </label>
                  <textarea
                    id="bp-license"
                    value={businessLicenseDetails}
                    onChange={(e) => setBusinessLicenseDetails(e.target.value)}
                    rows={3}
                    className="vendor-field mt-1 w-full resize-y rounded-lg px-3 py-2 text-sm"
                    placeholder="Licence numbers, issuing authority, renewal dates, sector-specific permits…"
                  />
                </div>
              </div>

              <ComplianceDocuments
                docs={complianceDocs}
                onChange={(key, next) => setComplianceDocs((d) => ({ ...d, [key]: next }))}
              />
            </div>
          ) : null}
          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              id="bp-vat"
              type="checkbox"
              checked={vatRegistered}
              onChange={(e) => setVatRegistered(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-600 bg-neutral-800 text-teal-600 focus:ring-teal-500"
            />
            <label htmlFor="bp-vat" className="text-sm text-neutral-200">
              VAT / GST registered (where applicable)
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-neutral-200" htmlFor="bp-compliance">
              Compliance notes
            </label>
            <textarea
              id="bp-compliance"
              value={complianceNotes}
              onChange={(e) => setComplianceNotes(e.target.value)}
              rows={3}
              className="vendor-field mt-1 w-full resize-y rounded-lg px-3 py-2 text-sm"
              placeholder="Licenses, industry codes, or restrictions auditors should know about."
            />
          </div>
        </div>
      </div>

      {businessType === "partnership" ? (
        <div className="vendor-panel rounded-2xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Additional partners</h2>
              <p className="mt-1 text-sm text-neutral-400">
                The primary contact is captured above. Add each other partner&apos;s personal details and how to reach
                them — used for KYC and agreements.
              </p>
            </div>
            <button
              type="button"
              onClick={addPartner}
              className="shrink-0 rounded-lg border border-white/20 bg-neutral-800/80 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-700"
            >
              Add partner
            </button>
          </div>

          {additionalPartners.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-white/15 bg-neutral-900/30 px-4 py-6 text-center text-sm text-neutral-500">
              No additional partners yet — use Add partner to record names, roles, and contact details.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {additionalPartners.map((p, index) => (
                <div key={p.id} className="rounded-xl border border-white/10 bg-neutral-900/25 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Partner {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePartner(p.id)}
                      className="text-xs font-medium text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-neutral-400" htmlFor={`bp-pt-fn-${p.id}`}>
                        First name
                      </label>
                      <input
                        id={`bp-pt-fn-${p.id}`}
                        value={p.firstName}
                        onChange={(e) => updatePartner(p.id, { firstName: e.target.value })}
                        className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-400" htmlFor={`bp-pt-ln-${p.id}`}>
                        Last name
                      </label>
                      <input
                        id={`bp-pt-ln-${p.id}`}
                        value={p.lastName}
                        onChange={(e) => updatePartner(p.id, { lastName: e.target.value })}
                        className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-neutral-400" htmlFor={`bp-pt-role-${p.id}`}>
                        Partnership role
                      </label>
                      <input
                        id={`bp-pt-role-${p.id}`}
                        value={p.partnershipRole}
                        onChange={(e) => updatePartner(p.id, { partnershipRole: e.target.value })}
                        className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                        placeholder="e.g. General partner, Limited partner, Managing partner"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-400" htmlFor={`bp-pt-em-${p.id}`}>
                        Email
                      </label>
                      <input
                        id={`bp-pt-em-${p.id}`}
                        type="email"
                        value={p.email}
                        onChange={(e) => updatePartner(p.id, { email: e.target.value })}
                        className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-400" htmlFor={`bp-pt-ph-${p.id}`}>
                        Phone
                      </label>
                      <input
                        id={`bp-pt-ph-${p.id}`}
                        type="tel"
                        value={p.phone}
                        onChange={(e) => updatePartner(p.id, { phone: e.target.value })}
                        className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-neutral-400" htmlFor={`bp-pt-nt-${p.id}`}>
                        Notes (optional)
                      </label>
                      <textarea
                        id={`bp-pt-nt-${p.id}`}
                        value={p.notes}
                        onChange={(e) => updatePartner(p.id, { notes: e.target.value })}
                        rows={2}
                        className="vendor-field mt-1 w-full resize-y rounded-lg px-3 py-2 text-sm"
                        placeholder="ID reference, equity %, or other compliance notes"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div className="vendor-panel rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Business contact details</h2>
        <p className="mt-1 text-sm text-neutral-400">
          How customers and partners reach the business, and defaults for receipts and scheduling.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-neutral-200" htmlFor="bp-biz-email">
              Business email
            </label>
            <input
              id="bp-biz-email"
              type="email"
              value={businessEmail}
              onChange={(e) => setBusinessEmail(e.target.value)}
              autoComplete="email"
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="hello@yourbusiness.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-200" htmlFor="bp-biz-phone">
              Business phone
            </label>
            <input
              id="bp-biz-phone"
              type="tel"
              value={businessPhone}
              onChange={(e) => setBusinessPhone(e.target.value)}
              autoComplete="tel"
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="Main switchboard or store line"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-neutral-200" htmlFor="bp-web">
              Website
            </label>
            <input
              id="bp-web"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              autoComplete="url"
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="https://…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-200" htmlFor="bp-locale">
              Default locale
            </label>
            <select
              id="bp-locale"
              value={locale}
              onChange={(e) => {
                const next = e.target.value;
                setLocale(next);
                setTimezone(getDefaultTimeZoneForLocale(next));
              }}
              className="vendor-field mt-1 max-w-full rounded-lg px-3 py-2 text-sm"
            >
              {!ALL_LOCALE_VALUES.has(locale) ? (
                <option value={locale}>{locale} (custom)</option>
              ) : null}
              {DEFAULT_LOCALE_GROUPS.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-200" htmlFor="bp-tz">
              Default time zone
            </label>
            <select
              id="bp-tz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
            >
              {!timezoneInList ? (
                <option value={timezone}>{timezone} (custom)</option>
              ) : null}
              {timeZoneIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-500">
              Suggested automatically from default locale when you change it — adjust here if your operations use a
              different zone.
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-neutral-200" htmlFor="bp-addr">
              Registered office address
            </label>
            <textarea
              id="bp-addr"
              value={registeredAddress}
              onChange={(e) => setRegisteredAddress(e.target.value)}
              rows={3}
              className="vendor-field mt-1 w-full resize-y rounded-lg px-3 py-2 text-sm"
              placeholder="Street, city, region, postal code, country"
            />
          </div>
        </div>
      </div>

      <div className="vendor-panel rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Business sectors</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Search and add every sector you sell in. Each sector defines extra fields on the product form (aligned with
          the product_sectors catalog when Supabase is connected). Remove a sector with × on its chip.
        </p>
        <div className="mt-4">
          <label className="mb-2 block text-sm font-medium text-neutral-200">Sectors (combo)</label>
          <SectorMultiCombo sectors={sectorCatalog} value={selectedSectors} onChange={setSelectedSectors} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-95"
        >
          Save draft
        </button>
        {savedHint ? <p className="text-sm text-neutral-400">{savedHint}</p> : null}
      </div>
    </form>
  );
}
