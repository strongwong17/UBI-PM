export interface Placeholder {
  key: string;
  label: string;
  type: "text" | "date" | "number" | "textarea" | "select";
  options?: string[];
  required: boolean;
  defaultValue?: string;
}

export interface Exhibit {
  id: string;
  label: string;
  title: string;
  content: string;
}

export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  category: "service-agreement" | "sow" | "vendor" | "nda" | "custom";
  content: string;
  exhibits: Exhibit[];
  placeholders: Placeholder[];
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: string;
  templateId: string;
  templateName: string;
  name: string;
  data: Record<string, string>;
  content: string;
  status: "draft" | "final";
  createdAt: string;
  updatedAt: string;
}

export interface ContactPerson {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
}

export interface Company {
  id: string;
  name: string;
  industry: string;
  address: string;
  email: string;
  phone: string;
  taxId: string;
  notes: string;
  contacts: ContactPerson[];
  createdAt: string;
  updatedAt: string;
}

export const FIELD_PREFIXES = [
  { prefix: "client_", companyLabel: "Client Company", contactLabel: "Client Contact" },
  { prefix: "provider_", companyLabel: "Provider Company", contactLabel: "Provider Contact" },
  { prefix: "vendor_", companyLabel: "Vendor", contactLabel: "Vendor Contact" },
  { prefix: "company_", companyLabel: "Company", contactLabel: "Company Contact" },
  { prefix: "party_a_", companyLabel: "Party A", contactLabel: "Party A Signatory" },
  { prefix: "party_b_", companyLabel: "Party B", contactLabel: "Party B Signatory" },
] as const;

export function companyToFields(
  prefix: string,
  company: Company,
  contact?: ContactPerson
): Record<string, string> {
  const fields: Record<string, string> = {};
  fields[`${prefix}company_name`] = company.name;
  fields[`${prefix}name`] = company.name;
  fields[`${prefix}address`] = company.address;
  fields[`${prefix}tax_id`] = company.taxId;
  if (contact) {
    fields[`${prefix}contact_name`] = contact.name;
    fields[`${prefix}email`] = contact.email || company.email;
    fields[`${prefix}signatory`] = contact.name;
    fields[`${prefix}title`] = contact.title;
  } else {
    fields[`${prefix}email`] = company.email;
  }
  return fields;
}

export const CATEGORY_LABELS: Record<ContractTemplate["category"], string> = {
  "service-agreement": "Service Agreement",
  sow: "Statement of Work",
  vendor: "Vendor Contract",
  nda: "Non-Disclosure Agreement",
  custom: "Custom",
};
