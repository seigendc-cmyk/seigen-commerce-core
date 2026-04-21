"use client";

import { useMemo, useState } from "react";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import { WindowControls } from "@/components/ui/window-controls";
import {
  createConsignmentAgreementDoc,
  type ConsignmentAgreementDocument,
} from "@/modules/consignment/services/consignment-agreement-docs";
import { submitConsignmentAgreementForApprovalViaDesk } from "@/modules/consignment/services/consignment-approval-queue";
import {
  downloadConsignmentAgreementPdf,
  openConsignmentAgreementPrintWindow,
  shareConsignmentAgreementPdf,
} from "@/modules/consignment/services/consignment-agreement-report";
import { emitConsignmentAgreementApprovalRequestedBrainEvent } from "@/modules/brain/brain-actions";
import { getActiveStaffId } from "@/modules/desk/services/sysadmin-bootstrap";

function todayYmd(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function baseClausesSnapshot(): string {
  return `1. Purpose of agreement
This agreement is entered into between the Principal Vendor and the Consignment Agent for the purpose of allowing the Agent to sell approved stock on behalf of the Vendor from an assigned stall or selling point. The Agent shall manage day-to-day stall operations, while stock control, master records, pricing governance, reporting visibility, and settlement oversight remain connected to the Vendor’s core seiGEN Commerce database.

2. Parties
The agreement identifies both parties with sufficient legal and contact details (including guarantor/next of kin where necessary).

3. Nature of relationship
The Agent is a consignment selling partner and is not the owner of the stock. Stock remains the property of the Vendor until sold and settled. This agreement does not create employment, partnership equity, or ownership rights unless separately stated in writing.

4. System and database governance (seiGEN Commerce)
All consignment stock issued to the Agent shall be recorded inside the Vendor’s official seiGEN Commerce database. Product master data, pricing rules, stock codes, settlement records, approvals, and reporting remain governed by the Vendor’s system. System records (issue notes, stock movement, sales, returns, damages, shortages, settlements, approvals, and user logs) are the primary operational record for this relationship.

5. Scope of agent authority
The Agent may receive stock, display and sell approved products, collect payments, record sales, process returns per approved rules, request replenishment, and submit settlements. The Agent must not transfer stock without approval, change cost values, apply unapproved discounts, sell outside approved rules, or operate outside the approved stall location without written consent.

6. Stock ownership and custody
All stock issued remains the property of the Vendor until sold and properly settled. The Agent is custodian of stock in the stall and must protect and handle stock responsibly. Risk allocation for theft, spoilage, breakage, expiry, fire, negligence, and unexplained shortages applies as per this agreement; negligence-related losses may be charged to the Agent. Force majeure must be documented and investigated.

7. Stock issue procedure
Stock shall be regarded as officially received only when it appears on a valid issue document or approved seiGEN Commerce stock issue record, including reference number, date, issuing branch/warehouse, SKU/stock code, description, quantity, valuation basis, selling basis, and receiving confirmation.

8. Pricing rules
Selling prices are governed by Vendor pricing rules and system controls. Unauthorized price overrides or discounting constitute a breach. Price overrides are logged and may be reviewed.

9. Commission / margin / earnings model
The Agent earns commission/margin only on successfully sold and settled stock, after approved returns/reversals and deduction of liabilities attributable to the Agent (including shortages where applicable).

10. Settlement terms
No settlement is final until stock, cash, returns, and adjustments are reconciled against official seiGEN Commerce records. Settlement statements and system reports are used for reconciliation and dispute resolution.

11. Returns, damages, shortages
Returns/damages/shortages must be recorded with supporting evidence (photos/notes/approvals) where applicable. Unexplained shortages may be charged to the Agent according to the agreement.

12. Stall operations and autonomy
The Agent manages daily stall operations with operational independence; however, all stock, records, settlements, and accountability remain governed through the Vendor’s core seiGEN Commerce database. For stock visibility, reconciliation, reporting, and audit purposes, the stall operates as a branch-like unit without transferring ownership of stock or core business records to the Agent.

13. Staff and access control
If the Agent appoints assistants, access accounts and approvals must follow system policy; the Agent remains responsible for assistants’ conduct.

14. Audit and inspection rights
The Vendor may inspect stock, review cash records, perform surprise counts, review system logs, and suspend stock issues during investigations. Refusal to cooperate is a serious breach.

15. Reporting obligations
The Agent shall provide regular reporting (daily sales/cash where required, weekly stock reviews, incident reports for damages/shortages, and relevant market feedback).

16. Technology and record validity
Digital records captured in seiGEN Commerce form part of the official business record and may be relied upon to resolve disputes. Printed copies may support, but system logs remain authoritative unless proven otherwise.

17. Confidentiality and business protection
The Agent shall not disclose supplier terms, valuations, margin rules, customer records, reports, credentials, or internal methods, and shall not unfairly compete using copied vendor data during the agreement.

18. Territory and exclusivity
Territory/exclusivity, if any, is defined in the commercial terms of this agreement.

19. Term and renewal
The contract start date, probation/review (if any), and renewal conditions are defined in the commercial terms.

20. Breach and remedies
Late remittance, shortages, unauthorized discounts, side-selling, false reporting, fraud, refusal of audit, and misuse of system access constitute breach and may result in warning, suspension, stock freeze, withholding commission, recovery actions, termination, and legal action.

21. Security deposit / guarantee
Where applicable, a security deposit or guarantor may be required and is defined in the commercial terms.

22. Termination
Termination may be by notice or for cause (including immediate termination for fraud). Unsold stock must be returned, final stock count performed, and final settlement completed. Termination does not cancel outstanding liabilities arising before termination.

23. Dispute resolution
Disputes follow reconciliation first, written notice, joint review of records, management meeting, mediation if needed, and court jurisdiction per governing law clause.

24. Governing law
Governing law and jurisdiction are defined in the commercial terms.

25. Signatures
This agreement is executed by both parties and witnessed as required.`;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "date";
  className?: string;
}) {
  return (
    <label className={"block text-xs text-slate-600 " + className}>
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <input
        type={type}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <label className={"block text-xs text-slate-600 " + className}>
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <textarea
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
        value={value}
        placeholder={placeholder}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function ConsignmentAgreementModal({
  open,
  principalBranchId,
  premiumPercentDefault,
  agentNameDefault,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  principalBranchId: string;
  premiumPercentDefault: number;
  agentNameDefault: string;
  onClose: () => void;
  onSubmitted: (requestId: string) => void;
}) {
  const branches = useMemo(() => InventoryRepo.listBranches(), []);
  const principal = InventoryRepo.getBranch(principalBranchId) ?? InventoryRepo.getDefaultBranch();

  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);

  const [agreementTitle, setAgreementTitle] = useState("Consignment Agreement (seiGEN Commerce)");
  const [vendorLegalName, setVendorLegalName] = useState("");
  const [vendorTradingName, setVendorTradingName] = useState("");
  const [vendorRegistration, setVendorRegistration] = useState("");
  const [vendorAddress, setVendorAddress] = useState("");
  const [vendorPostalAddress, setVendorPostalAddress] = useState("");
  const [vendorContactPerson, setVendorContactPerson] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [vendorEmail, setVendorEmail] = useState("");

  const [agentLegalName, setAgentLegalName] = useState(agentNameDefault || "");
  const [agentTradingName, setAgentTradingName] = useState("");
  const [agentNationalIdOrReg, setAgentNationalIdOrReg] = useState("");
  const [stallLocation, setStallLocation] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [guarantorName, setGuarantorName] = useState("");
  const [guarantorPhone, setGuarantorPhone] = useState("");

  const [selectedPrincipalBranchId, setSelectedPrincipalBranchId] = useState(principal.id);
  const [premiumPercent, setPremiumPercent] = useState(String(premiumPercentDefault || 20));

  const [commissionModel, setCommissionModel] = useState("Fixed commission percentage on settled sales");
  const [commissionRateText, setCommissionRateText] = useState("X% on successfully sold and settled stock (after approved returns/reversals and liabilities).");
  const [settlementFrequency, setSettlementFrequency] = useState("Weekly (every Friday)");
  const [settlementMethod, setSettlementMethod] = useState("Cash / Transfer / Wallet / Mobile money (as agreed)");
  const [territoryExclusivity, setTerritoryExclusivity] = useState("Non-exclusive unless stated; limited to the approved stall location.");
  const [termAndRenewal, setTermAndRenewal] = useState("Initial probation 60 days; renewable upon performance review.");
  const [securityDepositText, setSecurityDepositText] = useState("Security deposit / guarantor required where applicable (amount and terms agreed).");
  const [governingLaw, setGoverningLaw] = useState("Applicable laws and courts of the Vendor’s operating country / jurisdiction.");

  const [signedAtPlace, setSignedAtPlace] = useState("");
  const [signedAtDate, setSignedAtDate] = useState(todayYmd());
  const [principalSignName, setPrincipalSignName] = useState("");
  const [agentSignName, setAgentSignName] = useState(agentNameDefault || "");
  const [witness1Name, setWitness1Name] = useState("");
  const [witness2Name, setWitness2Name] = useState("");

  const [clauses, setClauses] = useState(baseClausesSnapshot());
  const [accept, setAccept] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const docDraft: ConsignmentAgreementDocument = useMemo(
    () => ({
      id: "draft",
      createdAt: new Date().toISOString(),
      agreementTitle,
      vendorLegalName,
      vendorTradingName,
      vendorRegistration,
      vendorAddress,
      vendorPostalAddress,
      vendorContactPerson,
      vendorPhone,
      vendorEmail,
      agentLegalName,
      agentTradingName,
      agentNationalIdOrReg,
      stallLocation,
      agentPhone,
      agentEmail,
      guarantorOrNextOfKinName: guarantorName,
      guarantorOrNextOfKinPhone: guarantorPhone,
      premiumPercent: Number(premiumPercent) || 0,
      commissionModel,
      commissionRateText,
      settlementFrequency,
      settlementMethod,
      territoryExclusivity,
      termAndRenewal,
      governingLawAndJurisdiction: governingLaw,
      securityDepositText,
      signedAtPlace,
      signedAtDate,
      principalSignName,
      agentSignName,
      witness1Name,
      witness2Name,
      clausesSnapshot: clauses,
    }),
    [
      agreementTitle,
      vendorLegalName,
      vendorTradingName,
      vendorRegistration,
      vendorAddress,
      vendorPostalAddress,
      vendorContactPerson,
      vendorPhone,
      vendorEmail,
      agentLegalName,
      agentTradingName,
      agentNationalIdOrReg,
      stallLocation,
      agentPhone,
      agentEmail,
      guarantorName,
      guarantorPhone,
      premiumPercent,
      commissionModel,
      commissionRateText,
      settlementFrequency,
      settlementMethod,
      territoryExclusivity,
      termAndRenewal,
      governingLaw,
      securityDepositText,
      signedAtPlace,
      signedAtDate,
      principalSignName,
      agentSignName,
      witness1Name,
      witness2Name,
      clauses,
    ],
  );

  if (!open) return null;

  async function onPrint() {
    openConsignmentAgreementPrintWindow(docDraft);
  }

  async function onDownload() {
    await downloadConsignmentAgreementPdf(docDraft);
  }

  async function onShare() {
    await shareConsignmentAgreementPdf(docDraft);
  }

  function restore() {
    setMinimized(false);
    setMaximized(false);
  }

  function close() {
    setStatus(null);
    setAccept(false);
    onClose();
  }

  function create() {
    setStatus(null);
    if (!accept) {
      setStatus("Please confirm acceptance of the agreement terms before creating.");
      return;
    }
    if (!agentEmail.trim()) {
      setStatus("Please enter the Agent email (required for Supabase login access after approval).");
      return;
    }
    const prem = Number(premiumPercent);
    const doc = createConsignmentAgreementDoc({
      ...docDraft,
      id: undefined,
      createdAt: undefined,
      premiumPercent: Number.isFinite(prem) ? prem : 0,
    });
    const req = submitConsignmentAgreementForApprovalViaDesk({
      documentId: doc.id,
      principalBranchId: selectedPrincipalBranchId,
      agentName: agentLegalName || agentNameDefault || "Agent",
      agentEmail: agentEmail,
      premiumPercent: Number.isFinite(prem) ? prem : 0,
      submittedByLabel: vendorContactPerson || principalSignName || "Staff",
      initiatedByStaffId: getActiveStaffId() ?? "preset-sysadmin-staff",
    });
    void emitConsignmentAgreementApprovalRequestedBrainEvent({
      requestId: req.id,
      documentId: req.documentId,
      agentName: req.agentName,
      agentEmail: req.agentEmail,
      principalBranchId: req.principalBranchId,
      premiumPercent: req.premiumPercent,
      correlationId: req.id,
    });
    setStatus("Submitted for approval. No operational changes have been applied yet.");
    onSubmitted(req.id);
    window.setTimeout(() => close(), 350);
  }

  const shellClass = maximized ? "w-[96vw] max-w-[96vw] h-[94vh]" : "w-[min(96vw,56rem)]";
  const contentHeight = maximized ? "h-[calc(94vh-64px)]" : "max-h-[84vh]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 py-4">
      <div className={"rounded-2xl border border-slate-200 bg-white shadow-2xl " + shellClass}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">Consignment Agreement</div>
            <div className="mt-0.5 text-xs text-slate-600">
              A4 contract form · Stored in seiGEN Commerce · Printable & shareable PDF
            </div>
          </div>
          <WindowControls
            minimized={minimized}
            maximized={maximized}
            onMinimize={() => setMinimized(true)}
            onMaximize={() => setMaximized(true)}
            onRestore={restore}
            onClose={close}
          />
        </div>

        {minimized ? (
          <div className="px-5 py-4 text-sm text-slate-700">
            This form is minimized. Click Restore to continue.
          </div>
        ) : (
          <div className={"overflow-auto px-5 py-5 " + contentHeight}>
            {status ? (
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{status}</div>
            ) : null}

            <div className="mx-auto w-full max-w-[794px] rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-base font-semibold text-slate-900">{agreementTitle}</div>
                  <div className="text-xs text-slate-600">
                    Principal branch: <span className="font-medium text-slate-800">{principal.name}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    onClick={onPrint}
                  >
                    Print
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    onClick={onDownload}
                  >
                    Download PDF
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                    onClick={onShare}
                  >
                    Share PDF
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Field label="Agreement title" value={agreementTitle} onChange={setAgreementTitle} />
                <label className="block text-xs text-slate-600">
                  <span className="mb-1 block font-medium text-slate-700">Principal branch (creates relationship)</span>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                    value={selectedPrincipalBranchId}
                    onChange={(e) => setSelectedPrincipalBranchId(e.target.value)}
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-900">Principal Vendor details</div>
                  <div className="mt-3 grid gap-3">
                    <Field label="Full legal name" value={vendorLegalName} onChange={setVendorLegalName} />
                    <Field label="Trading name" value={vendorTradingName} onChange={setVendorTradingName} />
                    <Field label="Registration details (if any)" value={vendorRegistration} onChange={setVendorRegistration} />
                    <TextArea label="Physical address" value={vendorAddress} onChange={setVendorAddress} rows={2} />
                    <TextArea label="Postal address" value={vendorPostalAddress} onChange={setVendorPostalAddress} rows={2} />
                    <Field label="Contact person" value={vendorContactPerson} onChange={setVendorContactPerson} />
                    <Field label="Phone" value={vendorPhone} onChange={setVendorPhone} type="tel" />
                    <Field label="Email" value={vendorEmail} onChange={setVendorEmail} type="email" />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-900">Consignment Agent details</div>
                  <div className="mt-3 grid gap-3">
                    <Field label="Full name / Legal name" value={agentLegalName} onChange={setAgentLegalName} placeholder="e.g. Stall A — Mary" />
                    <Field label="Trading name (if applicable)" value={agentTradingName} onChange={setAgentTradingName} />
                    <Field label="National ID / Company registration" value={agentNationalIdOrReg} onChange={setAgentNationalIdOrReg} />
                    <TextArea label="Stall location / market / shop" value={stallLocation} onChange={setStallLocation} rows={2} />
                    <Field label="Phone" value={agentPhone} onChange={setAgentPhone} type="tel" />
                    <Field label="Email" value={agentEmail} onChange={setAgentEmail} type="email" />
                    <Field label="Guarantor / Next of kin (name)" value={guarantorName} onChange={setGuarantorName} />
                    <Field label="Guarantor / Next of kin (phone)" value={guarantorPhone} onChange={setGuarantorPhone} type="tel" />
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-slate-900">Commercial terms</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Premium % (POS price = invoice cost + premium)" value={premiumPercent} onChange={setPremiumPercent} />
                  <Field label="Commission model" value={commissionModel} onChange={setCommissionModel} />
                  <TextArea label="Commission rate / rule" value={commissionRateText} onChange={setCommissionRateText} rows={2} />
                  <TextArea label="Settlement frequency" value={settlementFrequency} onChange={setSettlementFrequency} rows={2} />
                  <TextArea label="Settlement method" value={settlementMethod} onChange={setSettlementMethod} rows={2} />
                  <TextArea label="Territory / exclusivity" value={territoryExclusivity} onChange={setTerritoryExclusivity} rows={2} />
                  <TextArea label="Term & renewal" value={termAndRenewal} onChange={setTermAndRenewal} rows={2} />
                  <TextArea label="Security deposit / guarantee" value={securityDepositText} onChange={setSecurityDepositText} rows={2} />
                  <TextArea
                    className="sm:col-span-2"
                    label="Governing law / jurisdiction"
                    value={governingLaw}
                    onChange={setGoverningLaw}
                    rows={2}
                  />
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-slate-900">Legal clauses (seiGEN Commerce aligned)</div>
                <p className="mt-1 text-xs text-slate-600">
                  These clauses reflect the required governance: agent autonomy in operations, while stock, records, settlements, and accountability remain governed through the Vendor’s seiGEN Commerce database.
                </p>
                <textarea
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                  value={clauses}
                  onChange={(e) => setClauses(e.target.value)}
                  rows={16}
                />
              </div>

              <div className="mt-6 rounded-xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-slate-900">Signatures</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Signed at (place)" value={signedAtPlace} onChange={setSignedAtPlace} />
                  <Field label="Signed on (date)" value={signedAtDate} onChange={setSignedAtDate} type="date" />
                  <Field label="Principal signatory name" value={principalSignName} onChange={setPrincipalSignName} />
                  <Field label="Agent signatory name" value={agentSignName} onChange={setAgentSignName} />
                  <Field label="Witness 1 name" value={witness1Name} onChange={setWitness1Name} />
                  <Field label="Witness 2 name" value={witness2Name} onChange={setWitness2Name} />
                </div>
                <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                    checked={accept}
                    onChange={(e) => setAccept(e.target.checked)}
                  />
                  <span>
                    I confirm that the above agreement details and clauses reflect the intended consignment relationship and that both parties accept governance through the
                    Principal Vendor’s seiGEN Commerce records.
                  </span>
                </label>
              </div>

              <div className="mt-6 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
                <div className="text-xs text-slate-500">
                  Footer on print/PDF: <span className="font-semibold">Powered by seiGEN Commerce</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                    onClick={close}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
                    onClick={create}
                  >
                    Submit for approval
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

