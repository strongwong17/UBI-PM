import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Receipt } from "lucide-react";
import { currencySymbol } from "@/lib/currency";

const STATUSES = ["DRAFT", "SENT", "PAID", "OVERDUE"];

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function InvoicesPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const statusFilter = params.status || "";

  const where: Record<string, unknown> = { deletedAt: null };
  if (statusFilter) where.status = statusFilter;

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      project: { select: { id: true, projectNumber: true, title: true, client: { select: { id: true, company: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const sentInvoices = invoices.filter((i) => i.status === "SENT");
  const totalOutstanding = sentInvoices.reduce((sum, i) => sum + i.total, 0);
  const outstandingCurrency = sentInvoices[0]?.currency || "USD";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 mt-1">Track billing and payments</p>
        </div>
        {totalOutstanding > 0 && (
          <div className="text-right">
            <p className="text-xs text-gray-500">Outstanding (Sent)</p>
            <p className="text-lg font-bold text-orange-600">
              {currencySymbol(outstandingCurrency)}{totalOutstanding.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
        )}
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm font-medium text-gray-500 mr-1">Status:</span>
        <Button size="sm" variant={!statusFilter ? "default" : "outline"} asChild>
          <Link href="/invoices">All</Link>
        </Button>
        {STATUSES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            asChild
          >
            <Link href={`/invoices?status=${s}`}>{s}</Link>
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            All Invoices
            <Badge variant="secondary" className="ml-1">
              {invoices.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No invoices found</p>
              <p className="mt-1">
                {statusFilter
                  ? "Try a different status filter"
                  : "Invoices are created from projects"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/clients/${invoice.project.client.id}`}
                        className="text-gray-600 hover:text-blue-600 hover:underline text-sm"
                      >
                        {invoice.project.client.company}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/projects/${invoice.project.id}?tab=invoice`}
                        className="text-sm text-gray-600 hover:text-blue-600 hover:underline"
                      >
                        {invoice.project.projectNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={invoice.status} />
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {invoice.issuedDate
                        ? new Date(invoice.issuedDate).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {invoice.dueDate
                        ? new Date(invoice.dueDate).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {currencySymbol(invoice.currency)}{invoice.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
