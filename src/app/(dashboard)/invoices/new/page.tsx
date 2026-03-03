import { InvoiceForm } from "@/components/invoices/invoice-form";

interface PageProps {
  searchParams: Promise<{ projectId?: string }>;
}

export default async function NewInvoicePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const projectId = params.projectId || "";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Invoice</h1>
      </div>
      <InvoiceForm defaultProjectId={projectId} />
    </div>
  );
}
