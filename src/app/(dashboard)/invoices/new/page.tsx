import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { InvoiceForm } from "@/components/invoices/invoice-form";

interface PageProps {
  searchParams: Promise<{ projectId?: string }>;
}

export default async function NewInvoicePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const projectId = params.projectId || "";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900 mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to invoices
        </Link>
        <div
          className="flex items-start justify-between gap-4 flex-wrap pb-[18px]"
          style={{ borderBottom: "1px solid var(--color-hairline)" }}
        >
          <div>
            <h1 className="text-[24px] font-bold tracking-[-0.025em] m-0 mb-1 text-ink-900">
              New invoice
            </h1>
            <p className="text-[13px] text-ink-500 m-0 max-w-[520px]">
              Build a manual invoice. For an invoice generated from confirmed actuals, use Confirm
              actuals on the project detail page.
            </p>
          </div>
        </div>
      </div>

      <InvoiceForm defaultProjectId={projectId} />
    </div>
  );
}
