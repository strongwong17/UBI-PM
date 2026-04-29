// src/app/(dashboard)/invoices/[id]/send/page.tsx
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SendInvoicePage } from "@/components/invoices/send-invoice-page";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      project: {
        include: {
          client: true,
          primaryContact: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      },
      lineItems: {
        orderBy: { sortOrder: "asc" },
        include: {
          estimateLineItem: {
            select: { serviceModuleType: true },
          },
        },
      },
      estimate: {
        select: { id: true, estimateNumber: true, label: true, version: true },
      },
    },
  });

  if (!invoice) notFound();

  // Pull a default business profile for company billing details.
  const business = await prisma.businessProfile.findUnique({
    where: { id: "default" },
  });

  // Serialize Date fields → strings for client component props.
  const serialized = {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    currency: invoice.currency,
    subtotal: invoice.subtotal,
    taxRate: invoice.taxRate,
    tax: invoice.tax,
    discount: invoice.discount,
    total: invoice.total,
    notes: invoice.notes,
    issuedDate: invoice.issuedDate?.toISOString() ?? null,
    dueDate: invoice.dueDate?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
    project: {
      id: invoice.project.id,
      projectNumber: invoice.project.projectNumber,
      title: invoice.project.title,
      status: invoice.project.status,
      startDate: invoice.project.startDate?.toISOString() ?? null,
      endDate: invoice.project.endDate?.toISOString() ?? null,
      client: {
        id: invoice.project.client.id,
        company: invoice.project.client.company,
        billingName: invoice.project.client.billingName,
        billingAddress: invoice.project.client.billingAddress,
        billingEmail: invoice.project.client.billingEmail,
        billingPhone: invoice.project.client.billingPhone,
        taxId: invoice.project.client.taxId,
        email: invoice.project.client.email,
      },
      primaryContact: invoice.project.primaryContact
        ? {
            id: invoice.project.primaryContact.id,
            name: invoice.project.primaryContact.name,
            email: invoice.project.primaryContact.email,
          }
        : null,
      assignedTo: invoice.project.assignedTo
        ? {
            id: invoice.project.assignedTo.id,
            name: invoice.project.assignedTo.name,
            email: invoice.project.assignedTo.email,
          }
        : null,
    },
    estimate: invoice.estimate,
    lineItems: invoice.lineItems.map((li) => ({
      id: li.id,
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      total: li.total,
      sortOrder: li.sortOrder,
      serviceModuleType: li.estimateLineItem?.serviceModuleType ?? null,
    })),
  };

  const businessProfile = business
    ? {
        name: business.name,
        address: business.address,
        email: business.email,
        phone: business.phone,
      }
    : null;

  const sender = session.user
    ? {
        name: (session.user as { name?: string | null }).name ?? null,
        email: (session.user as { email?: string | null }).email ?? null,
      }
    : { name: null, email: null };

  return (
    <SendInvoicePage
      invoice={serialized}
      business={businessProfile}
      sender={sender}
    />
  );
}
