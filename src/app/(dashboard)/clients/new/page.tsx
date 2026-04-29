import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ClientForm } from "@/components/clients/client-form";

export default function NewClientPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/clients"
          className="inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900 mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to clients
        </Link>
        <div
          className="flex items-start justify-between gap-4 flex-wrap pb-[18px]"
          style={{ borderBottom: "1px solid var(--color-hairline)" }}
        >
          <div>
            <h1 className="text-[24px] font-bold tracking-[-0.025em] m-0 mb-1 text-ink-900">
              New client
            </h1>
            <p className="text-[13px] text-ink-500 m-0 max-w-[520px]">
              Add a company and at least one contact. You can refine billing and tax fields later.
            </p>
          </div>
        </div>
      </div>

      <ClientForm mode="create" />
    </div>
  );
}
