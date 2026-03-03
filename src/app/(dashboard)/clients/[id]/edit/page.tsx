import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
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
    <div className="max-w-3xl mx-auto">
      <ClientForm
        mode="edit"
        initialData={{
          id: client.id,
          company: client.company,
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
