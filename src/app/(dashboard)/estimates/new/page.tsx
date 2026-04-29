import Link from "next/link";
import { EstimateBuilder } from "@/components/estimates/estimate-builder";
import { ArrowLeft } from "lucide-react";

interface PageProps {
  searchParams: Promise<{ projectId?: string }>;
}

export default async function NewEstimatePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const projectId = params.projectId || "";

  let backHref = "/estimates";
  if (projectId) {
    backHref = `/projects/${projectId}?tab=estimates`;
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div>
        <div className="flex items-center gap-2 mb-3 text-[12px] text-ink-500">
          <Link
            href={backHref}
            className="hover:text-ink-900 inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        </div>
        <div
          className="flex items-start justify-between gap-4 flex-wrap pb-[18px]"
          style={{ borderBottom: "1px solid var(--color-hairline)" }}
        >
          <div>
            <h1 className="text-[24px] font-bold tracking-[-0.025em] m-0 mb-1 text-ink-900">
              New estimate
            </h1>
            <p className="text-[13px] text-ink-500 m-0 max-w-[520px]">
              Build a new estimate, group line items into execution phases, and approve when ready.
            </p>
          </div>
        </div>
      </div>
      <div className="mt-6">
        <EstimateBuilder mode="create" defaultProjectId={projectId} />
      </div>
    </div>
  );
}
