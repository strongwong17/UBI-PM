import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusPill } from "@/components/redesign/status-pill";
import { ArrowLeft, Edit, Star } from "lucide-react";
import { ClientDeleteButton } from "@/components/clients/client-delete-button";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const isAdmin = (session?.user as { role?: string })?.role === "ADMIN";
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      contacts: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      projects: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          invoices: { where: { deletedAt: null }, select: { id: true, status: true }, take: 1 },
          _count: { select: { estimates: true } },
        },
      },
      _count: {
        select: {
          contacts: true,
          projects: true,
        },
      },
    },
  });

  if (!client) notFound();

  const invoiceCount = client.projects.filter((p) => p.invoices.length > 0).length;
  const hasBilling =
    client.billingName ||
    client.billingEmail ||
    client.billingAddress ||
    client.billingPhone ||
    client.taxId;

  return (
    <div className="space-y-6">
      {/* Header */}
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
            {client.industry && (
              <div className="font-mono text-[11px] text-ink-500 tracking-[0.04em] mb-1.5">
                {client.industry}
              </div>
            )}
            <h1 className="text-[24px] font-bold tracking-[-0.025em] text-ink-900 m-0 mb-2">
              {client.company}
            </h1>
            {client.shortName && (
              <div className="font-mono text-[11px] font-bold tracking-[0.06em] uppercase text-ink-500">
                {client.shortName}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Link
              href={`/clients/${client.id}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-card-rd"
              style={{
                background: "var(--color-canvas-cool)",
                border: "1px solid var(--color-hairline-strong)",
              }}
            >
              <Edit className="h-3.5 w-3.5" /> Edit
            </Link>
            {isAdmin && (
              <ClientDeleteButton clientId={client.id} clientName={client.company} />
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: "// CONTACTS", value: client._count.contacts },
          { label: "// PROJECTS", value: client._count.projects },
          { label: "// INVOICES", value: invoiceCount },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-card-rd rounded-[14px] px-4 py-3"
            style={{
              border: "1px solid var(--color-hairline)",
              boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
            }}
          >
            <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-1">
              {stat.label}
            </div>
            <div className="text-[24px] font-bold tracking-[-0.02em] text-ink-900 rd-tabular leading-none">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar — details */}
        <div className="space-y-6">
          <div>
            <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
              {"// DETAILS"}
            </p>
            <div
              className="bg-card-rd rounded-[14px] p-5 space-y-3"
              style={{
                border: "1px solid var(--color-hairline)",
                boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
              }}
            >
              {client.email && (
                <div>
                  <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                    {"// EMAIL"}
                  </div>
                  <a
                    href={`mailto:${client.email}`}
                    className="text-[13px] text-ink-900 hover:text-accent-rd"
                  >
                    {client.email}
                  </a>
                </div>
              )}
              {client.phone && (
                <div>
                  <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                    {"// PHONE"}
                  </div>
                  <div className="text-[13px] text-ink-900">{client.phone}</div>
                </div>
              )}
              {client.wechatId && (
                <div>
                  <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                    {"// WECHAT"}
                  </div>
                  <div className="text-[13px] text-ink-900 font-mono">{client.wechatId}</div>
                </div>
              )}
              <div
                className="pt-3"
                style={{ borderTop: "1px solid var(--color-hairline)" }}
              >
                <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                  {"// CREATED"}
                </div>
                <div className="text-[12px] text-ink-700">
                  {new Date(client.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          {hasBilling && (
            <div>
              <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
                {"// BILLING"}
              </p>
              <div
                className="bg-card-rd rounded-[14px] p-5 space-y-3"
                style={{
                  border: "1px solid var(--color-hairline)",
                  boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
                }}
              >
                {client.billingName && (
                  <div>
                    <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                      {"// BILL TO"}
                    </div>
                    <div className="text-[13px] font-medium text-ink-900">
                      {client.billingName}
                    </div>
                  </div>
                )}
                {client.billingAddress && (
                  <div>
                    <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                      {"// ADDRESS"}
                    </div>
                    <div className="text-[12px] text-ink-700 whitespace-pre-wrap leading-[1.5]">
                      {client.billingAddress}
                    </div>
                  </div>
                )}
                {client.billingEmail && (
                  <div>
                    <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                      {"// BILLING EMAIL"}
                    </div>
                    <a
                      href={`mailto:${client.billingEmail}`}
                      className="text-[13px] text-ink-900 hover:text-accent-rd"
                    >
                      {client.billingEmail}
                    </a>
                  </div>
                )}
                {client.billingPhone && (
                  <div>
                    <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                      {"// BILLING PHONE"}
                    </div>
                    <div className="text-[13px] text-ink-900">{client.billingPhone}</div>
                  </div>
                )}
                {client.taxId && (
                  <div>
                    <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                      {"// TAX ID"}
                    </div>
                    <div className="text-[13px] text-ink-900 font-mono rd-tabular">
                      {client.taxId}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {client.notes && (
            <div>
              <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
                {"// NOTES"}
              </p>
              <div
                className="bg-card-rd rounded-[14px] p-5"
                style={{
                  border: "1px solid var(--color-hairline)",
                  boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
                }}
              >
                <div className="text-[12px] text-ink-700 whitespace-pre-wrap leading-[1.5]">
                  {client.notes}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main column — contacts + projects */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contacts */}
          <div>
            <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
              {"// CONTACTS"}
            </p>
            {client.contacts.length === 0 ? (
              <div
                className="bg-card-rd rounded-[14px] p-8 text-center"
                style={{
                  border: "1px solid var(--color-hairline)",
                  boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
                }}
              >
                <p className="text-[13px] text-ink-500">No contacts added yet.</p>
              </div>
            ) : (
              <div
                className="bg-card-rd rounded-[14px] overflow-hidden"
                style={{
                  border: "1px solid var(--color-hairline)",
                  boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
                }}
              >
                <div
                  className="grid gap-3 px-5 py-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.06em]"
                  style={{
                    gridTemplateColumns: "1fr 1fr 1.4fr 1fr",
                    background: "#FAFAF6",
                    borderBottom: "1px solid var(--color-hairline)",
                    color: "var(--color-ink-400)",
                  }}
                >
                  <span>Name</span>
                  <span>Title</span>
                  <span>Email</span>
                  <span>Phone</span>
                </div>
                {client.contacts.map((contact, i) => (
                  <div
                    key={contact.id}
                    className="grid gap-3 items-center px-5 py-3 hover:bg-[#FCFAF6] transition-colors"
                    style={{
                      gridTemplateColumns: "1fr 1fr 1.4fr 1fr",
                      borderBottom:
                        i < client.contacts.length - 1
                          ? "1px solid var(--color-hairline)"
                          : "none",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-ink-900">
                        {contact.name}
                      </span>
                      {contact.isPrimary && (
                        <Star
                          className="h-3.5 w-3.5"
                          style={{
                            color: "var(--color-accent-rd)",
                            fill: "var(--color-accent-rd)",
                          }}
                        />
                      )}
                    </div>
                    <div className="text-[12px] text-ink-700">{contact.title || "—"}</div>
                    <div className="text-[12px]">
                      {contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-ink-900 hover:text-accent-rd"
                        >
                          {contact.email}
                        </a>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </div>
                    <div className="text-[12px] text-ink-700">{contact.phone || "—"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Projects */}
          <div>
            <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
              {"// RECENT PROJECTS"}
            </p>
            {client.projects.length === 0 ? (
              <div
                className="bg-card-rd rounded-[14px] p-8 text-center"
                style={{
                  border: "1px solid var(--color-hairline)",
                  boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
                }}
              >
                <p className="text-[13px] text-ink-500">No projects yet.</p>
              </div>
            ) : (
              <div
                className="bg-card-rd rounded-[14px] overflow-hidden"
                style={{
                  border: "1px solid var(--color-hairline)",
                  boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
                }}
              >
                <div
                  className="grid gap-3 px-5 py-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.06em]"
                  style={{
                    gridTemplateColumns: "1fr 110px 80px 110px 90px",
                    background: "#FAFAF6",
                    borderBottom: "1px solid var(--color-hairline)",
                    color: "var(--color-ink-400)",
                  }}
                >
                  <span>Project</span>
                  <span>Status</span>
                  <span className="text-right">Estimates</span>
                  <span>Invoice</span>
                  <span className="text-right">Created</span>
                </div>
                {client.projects.map((project, i) => (
                  <div
                    key={project.id}
                    className="grid gap-3 items-center px-5 py-3 hover:bg-[#FCFAF6] transition-colors"
                    style={{
                      gridTemplateColumns: "1fr 110px 80px 110px 90px",
                      borderBottom:
                        i < client.projects.length - 1
                          ? "1px solid var(--color-hairline)"
                          : "none",
                    }}
                  >
                    <div>
                      <Link
                        href={`/projects/${project.id}`}
                        className="text-[13px] font-medium text-ink-900 hover:text-accent-rd font-mono"
                      >
                        {project.projectNumber}
                      </Link>
                      <div className="text-[12px] text-ink-500 mt-0.5 truncate">
                        {project.title}
                      </div>
                    </div>
                    <div>
                      <StatusPill status={project.status} size="xs" />
                    </div>
                    <div className="text-right text-[13px] text-ink-700 rd-tabular">
                      {project._count.estimates}
                    </div>
                    <div>
                      {project.invoices.length > 0 ? (
                        <Link href={`/invoices/${project.invoices[0].id}`}>
                          <StatusPill status={project.invoices[0].status} size="xs" />
                        </Link>
                      ) : (
                        <span className="text-[12px] text-ink-400">—</span>
                      )}
                    </div>
                    <div className="text-right text-[12px] text-ink-500 font-mono">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
