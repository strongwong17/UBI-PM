import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusColorMap: Record<string, string> = {
  // Project statuses (8 stages)
  INQUIRY_RECEIVED: "bg-blue-100 text-blue-800 border-blue-200",
  ESTIMATE_SENT: "bg-indigo-100 text-indigo-800 border-indigo-200",
  APPROVED: "bg-green-100 text-green-800 border-green-200",
  IN_PROGRESS: "bg-blue-100 text-blue-800 border-blue-200",
  COMPLETED: "bg-green-100 text-green-800 border-green-200",
  INVOICED: "bg-purple-100 text-purple-800 border-purple-200",
  PAID: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CLOSED: "bg-gray-100 text-gray-800 border-gray-200",
  // Estimate statuses
  DRAFT: "bg-gray-100 text-gray-800 border-gray-200",
  SENT: "bg-indigo-100 text-indigo-800 border-indigo-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
  // Invoice statuses
  OVERDUE: "bg-red-100 text-red-800 border-red-200",
  // Misc
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  ARCHIVED: "bg-gray-100 text-gray-800 border-gray-200",
  CANCELLED: "bg-red-100 text-red-800 border-red-200",
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
