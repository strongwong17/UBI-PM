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
  | "NEW"
  | "BRIEFED"
  | "ESTIMATING"
  | "APPROVED"
  | "IN_PROGRESS"
  | "DELIVERED"
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
