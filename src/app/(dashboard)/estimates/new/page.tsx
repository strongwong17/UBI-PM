import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
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
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={backHref}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-ink-900 tracking-[-0.025em]">New Estimate</h1>
          <p className="text-[13px] text-ink-500 mt-0.5 font-mono tracking-[0.02em]">{"// new estimate"}</p>
        </div>
      </div>
      <EstimateBuilder mode="create" defaultProjectId={projectId} />
    </div>
  );
}
