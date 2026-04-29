import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ArrowLeft } from "lucide-react";
import { ClientForm } from "@/components/clients/client-form";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      contacts: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!client) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/clients/${client.id}`}
          className="inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900 mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to {client.company}
        </Link>
        <div
          className="flex items-start justify-between gap-4 flex-wrap pb-[18px]"
          style={{ borderBottom: "1px solid var(--color-hairline)" }}
        >
          <div>
            <h1 className="text-[24px] font-bold tracking-[-0.025em] m-0 mb-1 text-ink-900">
              Edit client
            </h1>
            <p className="text-[13px] text-ink-500 m-0 max-w-[520px]">
              Update company details, billing fields, and contacts for {client.company}.
            </p>
          </div>
        </div>
      </div>

      <ClientForm
        mode="edit"
        initialData={{
          id: client.id,
          company: client.company,
          shortName: client.shortName || "",
          industry: client.industry || "",
          email: client.email || "",
          phone: client.phone || "",
          wechatId: client.wechatId || "",
          notes: client.notes || "",
          billingName: client.billingName || "",
          billingAddress: client.billingAddress || "",
          billingEmail: client.billingEmail || "",
          billingPhone: client.billingPhone || "",
          taxId: client.taxId || "",
        }}
        initialContacts={client.contacts.map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email || "",
          phone: c.phone || "",
          title: c.title || "",
          isPrimary: c.isPrimary,
        }))}
      />
    </div>
  );
}
