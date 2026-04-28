import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusColorMap: Record<string, string> = {
  // Project statuses (7 stages — work only)
  NEW: "bg-gray-100 text-gray-700 border-gray-200",
  BRIEFED: "bg-slate-200 text-slate-700 border-slate-300",
  ESTIMATING: "bg-blue-100 text-blue-800 border-blue-200",
  APPROVED: "bg-green-100 text-green-800 border-green-200",
  IN_PROGRESS: "bg-indigo-100 text-indigo-800 border-indigo-200",
  DELIVERED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CLOSED: "bg-zinc-200 text-zinc-700 border-zinc-300",
  // Legacy status fallbacks (kept until status remap script runs in production)
  INQUIRY_RECEIVED: "bg-gray-100 text-gray-700 border-gray-200",
  ESTIMATE_SENT: "bg-blue-100 text-blue-800 border-blue-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  INVOICED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PAID: "bg-zinc-200 text-zinc-700 border-zinc-300",
  // Estimate statuses
  DRAFT: "bg-gray-100 text-gray-600 border-gray-200",
  SENT: "bg-violet-100 text-violet-800 border-violet-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
  // Invoice statuses
  OVERDUE: "bg-orange-100 text-orange-800 border-orange-200",
  // Misc
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  ARCHIVED: "bg-stone-100 text-stone-600 border-stone-200",
  CANCELLED: "bg-pink-100 text-pink-700 border-pink-200",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colorClasses =
    statusColorMap[status] || "bg-gray-100 text-gray-800 border-gray-200";

  return (
    <Badge
      variant="outline"
      className={cn(colorClasses, "font-medium", className)}
    >
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
