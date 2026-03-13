import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import type {
  ContractTemplate,
  Contract,
  Placeholder,
  Exhibit,
} from "./contract-types";
import { DEFAULT_CONTRACT_TEMPLATES } from "./default-contract-templates";

interface ContractStore {
  templates: ContractTemplate[];
  contracts: Contract[];
  initialized: boolean;
  storeVersion: number;

  initDefaults: () => void;
  addTemplate: (
    template: Omit<ContractTemplate, "id" | "createdAt" | "updatedAt">
  ) => string;
  updateTemplate: (
    id: string,
    updates: Partial<Omit<ContractTemplate, "id" | "createdAt">>
  ) => void;
  deleteTemplate: (id: string) => void;
  getTemplate: (id: string) => ContractTemplate | undefined;

  addContract: (
    contract: Omit<Contract, "id" | "createdAt" | "updatedAt">
  ) => string;
  updateContract: (
    id: string,
    updates: Partial<Omit<Contract, "id" | "createdAt">>
  ) => void;
  deleteContract: (id: string) => void;
  getContract: (id: string) => Contract | undefined;
}

export function extractPlaceholders(
  content: string,
  exhibits?: Exhibit[]
): Placeholder[] {
  const fullContent = exhibits
    ? content + "\n" + exhibits.map((e) => e.content).join("\n")
    : content;
  const regex = /\{\{(\w+)\}\}/g;
  const keys = new Set<string>();
  let match;
  while ((match = regex.exec(fullContent)) !== null) {
    keys.add(match[1]);
  }
  return Array.from(keys).map((key) => ({
    key,
    label: key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    type: key.toLowerCase().includes("date")
      ? "date"
      : key.toLowerCase().includes("amount") ||
          key.toLowerCase().includes("price") ||
          key.toLowerCase().includes("cost") ||
          key.toLowerCase().includes("rate")
        ? "number"
        : key.toLowerCase().includes("description") ||
            key.toLowerCase().includes("scope") ||
            key.toLowerCase().includes("terms")
          ? "textarea"
          : "text",
    required: true,
  }));
}

export function renderTemplate(
  content: string,
  data: Record<string, string>,
  exhibits?: Exhibit[]
): string {
  const rendered = content.replace(
    /\{\{(\w+)\}\}/g,
    (_, key) => data[key] || `{{${key}}}`
  );
  if (!exhibits || exhibits.length === 0) return rendered;

  const renderedExhibits = exhibits
    .map((exhibit) => {
      const exhibitContent = exhibit.content.replace(
        /\{\{(\w+)\}\}/g,
        (_, key) => data[key] || `{{${key}}}`
      );
      return `\n\n${"=".repeat(50)}\n${exhibit.label}: ${exhibit.title}\n\n${exhibitContent}`;
    })
    .join("");

  return rendered + renderedExhibits;
}

export const useContractStore = create<ContractStore>()(
  persist(
    (set, get) => ({
      templates: [],
      contracts: [],
      initialized: false,
      storeVersion: 0,

      initDefaults: () => {
        const CURRENT_VERSION = 3;
        const state = get();
        if (!state.initialized || (state.storeVersion || 0) < CURRENT_VERSION) {
          const userTemplates = state.templates.filter(
            (t) => !t.id.startsWith("tpl-")
          );
          set({
            templates: [...DEFAULT_CONTRACT_TEMPLATES, ...userTemplates],
            initialized: true,
            storeVersion: CURRENT_VERSION,
          });
        }
      },

      addTemplate: (template) => {
        const id = uuidv4();
        const now = new Date().toISOString();
        set((state) => ({
          templates: [
            ...state.templates,
            { ...template, id, createdAt: now, updatedAt: now },
          ],
        }));
        return id;
      },

      updateTemplate: (id, updates) => {
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id
              ? { ...t, ...updates, updatedAt: new Date().toISOString() }
              : t
          ),
        }));
      },

      deleteTemplate: (id) => {
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
        }));
      },

      getTemplate: (id) => get().templates.find((t) => t.id === id),

      addContract: (contract) => {
        const id = uuidv4();
        const now = new Date().toISOString();
        set((state) => ({
          contracts: [
            ...state.contracts,
            { ...contract, id, createdAt: now, updatedAt: now },
          ],
        }));
        return id;
      },

      updateContract: (id, updates) => {
        set((state) => ({
          contracts: state.contracts.map((c) =>
            c.id === id
              ? { ...c, ...updates, updatedAt: new Date().toISOString() }
              : c
          ),
        }));
      },

      deleteContract: (id) => {
        set((state) => ({
          contracts: state.contracts.filter((c) => c.id !== id),
        }));
      },

      getContract: (id) => get().contracts.find((c) => c.id === id),
    }),
    { name: "contract-store" }
  )
);
