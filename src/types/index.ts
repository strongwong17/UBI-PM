import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }
}

export type Role = "ADMIN" | "MANAGER" | "VIEWER";

export type ProjectStatus =
  | "INQUIRY_RECEIVED"
  | "ESTIMATE_SENT"
  | "APPROVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "INVOICED"
  | "PAID"
  | "CLOSED";

export type ExecutionPhase = "RECRUITMENT" | "FIELDWORK" | "ANALYSIS" | "REPORTING";

export type InquirySource = "WECHAT" | "EMAIL" | "LARK" | "OTHER";

export type ServiceModuleType =
  | "RECRUITMENT"
  | "MODERATION"
  | "SIMULTANEOUS_TRANSLATION"
  | "PROJECT_MANAGEMENT"
  | "INCENTIVES"
  | "VENUE"
  | "REPORTING"
  | "LOGISTICS";

export type EstimateStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED";

export type PricingModel = "HOURLY" | "FIXED_PHASE" | "DELIVERABLE" | "MIXED";

export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE";
