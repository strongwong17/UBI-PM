"use client";

import { useState } from "react";
import type { Placeholder, Company, ContactPerson } from "@/lib/contract-types";
import { FIELD_PREFIXES, companyToFields } from "@/lib/contract-types";
import {
  Building2,
  ChevronDown,
  Check,
  User,
  ArrowLeft,
  BookUser,
} from "lucide-react";

interface ContactPickerProps {
  placeholders: Placeholder[];
  formData: Record<string, string>;
  onApply: (fields: Record<string, string>) => void;
  companies: Company[];
}

export default function ContactPicker({
  placeholders,
  formData,
  onApply,
  companies,
}: ContactPickerProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"prefix" | "company" | "contact">("prefix");
  const [selectedPrefix, setSelectedPrefix] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // Detect which prefixes this template uses
  const activePrefixes = FIELD_PREFIXES.filter((fp) =>
    placeholders.some((p) => p.key.startsWith(fp.prefix))
  );

  const handleSelectPrefix = (prefix: string) => {
    setSelectedPrefix(prefix);
    setStep("company");
  };

  const handleSelectCompany = (company: Company) => {
    setSelectedCompany(company);
    if (company.contacts.length === 0) {
      // No contacts — apply company fields directly
      const fields = companyToFields(selectedPrefix!, company);
      applyAndClose(fields);
    } else if (company.contacts.length === 1) {
      // Single contact — auto-select
      const fields = companyToFields(selectedPrefix!, company, company.contacts[0]);
      applyAndClose(fields);
    } else {
      setStep("contact");
    }
  };

  const handleSelectContact = (contact: ContactPerson) => {
    const fields = companyToFields(selectedPrefix!, selectedCompany!, contact);
    applyAndClose(fields);
  };

  const handleApplyWithoutContact = () => {
    const fields = companyToFields(selectedPrefix!, selectedCompany!);
    applyAndClose(fields);
  };

  const applyAndClose = (fields: Record<string, string>) => {
    // Only apply fields that match existing placeholders
    const placeholderKeys = new Set(placeholders.map((p) => p.key));
    const filtered: Record<string, string> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (placeholderKeys.has(key) && value) {
        filtered[key] = value;
      }
    }
    onApply(filtered);
    resetAndClose();
  };

  const resetAndClose = () => {
    setOpen(false);
    setStep("prefix");
    setSelectedPrefix(null);
    setSelectedCompany(null);
  };

  const goBack = () => {
    if (step === "contact") {
      setSelectedCompany(null);
      setStep("company");
    } else if (step === "company") {
      setSelectedPrefix(null);
      setStep("prefix");
    }
  };

  if (activePrefixes.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <BookUser className="h-4 w-4 text-blue-600" />
        Auto-fill from Contact
        <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={resetAndClose} />
          <div className="absolute right-0 top-full z-20 mt-1 w-80 rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
              {step !== "prefix" && (
                <button
                  onClick={goBack}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
              )}
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {step === "prefix"
                  ? "Which role to fill?"
                  : step === "company"
                    ? "Select company"
                    : "Select contact person"}
              </p>
            </div>

            {/* Step 1: Choose prefix/role */}
            {step === "prefix" && (
              <div className="py-1">
                {activePrefixes.map((fp) => (
                  <button
                    key={fp.prefix}
                    onClick={() => handleSelectPrefix(fp.prefix)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
                      <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {fp.companyLabel}
                      </p>
                      <p className="text-xs text-zinc-400">
                        Fill {fp.companyLabel.toLowerCase()} & {fp.contactLabel.toLowerCase()} fields
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Step 2: Choose company */}
            {step === "company" && (
              <div className="max-h-64 overflow-y-auto py-1">
                {companies.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <Building2 className="mx-auto mb-2 h-6 w-6 text-zinc-300 dark:text-zinc-600" />
                    <p className="text-sm text-zinc-400">No companies saved</p>
                    <p className="mt-1 text-xs text-zinc-400">
                      Add companies in the Contacts page
                    </p>
                  </div>
                ) : (
                  companies.map((company) => (
                    <button
                      key={company.id}
                      onClick={() => handleSelectCompany(company)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {company.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                          {company.name}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {company.industry || "No industry"}
                          {company.contacts.length > 0 &&
                            ` · ${company.contacts.length} contact${company.contacts.length > 1 ? "s" : ""}`}
                        </p>
                      </div>
                      <Check className="h-4 w-4 shrink-0 text-zinc-200 dark:text-zinc-700" />
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Step 3: Choose contact person */}
            {step === "contact" && selectedCompany && (
              <div className="max-h-64 overflow-y-auto py-1">
                <button
                  onClick={handleApplyWithoutContact}
                  className="flex w-full items-center gap-3 border-b border-zinc-100 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <Building2 className="h-4 w-4 text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      Company only (no contact)
                    </p>
                  </div>
                </button>

                {selectedCompany.contacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => handleSelectContact(contact)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                      {contact.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {contact.name}
                      </p>
                      <p className="truncate text-xs text-zinc-400">
                        {contact.title}
                        {contact.email && ` · ${contact.email}`}
                      </p>
                    </div>
                    <Check className="h-4 w-4 shrink-0 text-zinc-200 dark:text-zinc-700" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
