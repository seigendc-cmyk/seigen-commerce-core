import { browserLocalJson } from "@/modules/inventory/services/storage";

const NS = { namespace: "seigen.consignment", version: 1 as const };

export type ConsignmentAgreementDocument = {
  id: string;
  createdAt: string;
  agreementTitle: string;

  // Parties — principal (vendor)
  vendorLegalName: string;
  vendorTradingName: string;
  vendorRegistration: string;
  vendorAddress: string;
  vendorPostalAddress: string;
  vendorContactPerson: string;
  vendorPhone: string;
  vendorEmail: string;

  // Parties — agent
  agentLegalName: string;
  agentTradingName: string;
  agentNationalIdOrReg: string;
  stallLocation: string;
  agentPhone: string;
  agentEmail: string;
  guarantorOrNextOfKinName: string;
  guarantorOrNextOfKinPhone: string;

  // Commercial terms
  premiumPercent: number;
  commissionModel: string;
  commissionRateText: string;
  settlementFrequency: string;
  settlementMethod: string;
  territoryExclusivity: string;
  termAndRenewal: string;
  governingLawAndJurisdiction: string;
  securityDepositText: string;

  // Signatures
  signedAtPlace: string;
  signedAtDate: string; // YYYY-MM-DD
  principalSignName: string;
  agentSignName: string;
  witness1Name: string;
  witness2Name: string;

  // Snapshot of clauses (for PDF output consistency)
  clausesSnapshot: string;
};

type Db = { docs: ConsignmentAgreementDocument[] };

function uid(): string {
  return `cadoc_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function getDb(): Db {
  const store = browserLocalJson(NS);
  if (!store) return { docs: [] };
  return store.read<Db>("agreement_docs", { docs: [] });
}

function setDb(db: Db) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("agreement_docs", db);
}

export function getConsignmentAgreementDoc(id: string): ConsignmentAgreementDocument | undefined {
  return getDb().docs.find((d) => d.id === id);
}

export function createConsignmentAgreementDoc(
  input: Omit<ConsignmentAgreementDocument, "id" | "createdAt"> & { id?: string; createdAt?: string },
): ConsignmentAgreementDocument {
  const db = getDb();
  const row: ConsignmentAgreementDocument = {
    id: input.id ?? uid(),
    createdAt: input.createdAt ?? new Date().toISOString(),
    ...input,
  };
  db.docs.push(row);
  setDb(db);
  return row;
}

