"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  userRole: string;
  userName: string;
}

const MAIN_NAV = [
  { href: "/", label: "Dashboard", icon: "◆", roles: ["ADMIN", "MANAGER", "VIEWER"] },
  { href: "/projects", label: "Projects", icon: "▢", roles: ["ADMIN", "MANAGER", "VIEWER"] },
  { href: "/estimates", label: "Estimates", icon: "≡", roles: ["ADMIN", "MANAGER", "VIEWER"] },
  { href: "/invoices", label: "Invoices", icon: "$", roles: ["ADMIN", "MANAGER", "VIEWER"] },
  { href: "/clients", label: "Clients", icon: "⚇", roles: ["ADMIN", "MANAGER", "VIEWER"] },
  { href: "/contracts", label: "Contracts", icon: "§", roles: ["ADMIN", "MANAGER", "VIEWER"] },
  { href: "/activity", label: "Activity", icon: "◷", roles: ["ADMIN", "MANAGER"] },
];

const ADMIN_NAV = [
  { href: "/templates", label: "Est. Templates", icon: "⊟", roles: ["ADMIN"] },
  { href: "/contract-templates", label: "Contract Tpl.", icon: "▤", roles: ["ADMIN", "MANAGER"] },
  { href: "/settings", label: "Settings", icon: "⚙", roles: ["ADMIN"] },
];

export function Sidebar({ userRole, userName }: SidebarProps) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href);

  const visibleMain = MAIN_NAV.filter((item) => item.roles.includes(userRole));
  const visibleAdmin = ADMIN_NAV.filter((item) => item.roles.includes(userRole));

  return (
    <aside className="w-[200px] shrink-0 px-5.5 py-7 border-r border-hairline flex flex-col">
      <Link href="/" className="inline-flex items-baseline gap-0.5 mb-7">
        <span className="text-[17px] font-extrabold tracking-[-0.04em] text-ink-900">
          ubinsights
        </span>
        <span
          className="w-1.5 h-1.5 rounded-full -translate-y-px"
          style={{ background: "var(--color-accent-rd)" }}
        />
      </Link>

      <div className="mb-5.5">
        <div className="font-mono text-[10px] font-semibold tracking-[0.06em] uppercase text-ink-300 px-2.5 pb-2">
          // Main
        </div>
        {visibleMain.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] mb-px transition-colors",
              isActive(item.href)
                ? "bg-ink-900/[0.08] text-ink-900 font-medium"
                : "text-ink-700 hover:bg-ink-900/[0.04]",
            )}
          >
            <span
              className={cn(
                "w-3.5 text-center",
                isActive(item.href) ? "text-ink-900" : "text-ink-400",
              )}
            >
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      {visibleAdmin.length > 0 ? (
        <div className="mb-5.5">
          <div className="font-mono text-[10px] font-semibold tracking-[0.06em] uppercase text-ink-300 px-2.5 pb-2">
            // Admin
          </div>
          {visibleAdmin.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] mb-px transition-colors",
                isActive(item.href)
                  ? "bg-ink-900/[0.08] text-ink-900 font-medium"
                  : "text-ink-700 hover:bg-ink-900/[0.04]",
              )}
            >
              <span
                className={cn(
                  "w-3.5 text-center",
                  isActive(item.href) ? "text-ink-900" : "text-ink-400",
                )}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-auto pt-4 border-t border-hairline">
        <div className="flex items-center gap-2.5 px-2.5 py-2 mb-1">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
            style={{ background: "var(--color-accent-rd)" }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-ink-900 truncate leading-tight">
              {userName}
            </div>
            <div className="font-mono text-[10px] text-ink-400 tracking-[0.04em] uppercase">
              // {userRole.toLowerCase()}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] text-ink-500 hover:bg-ink-900/[0.04] hover:text-ink-900 transition-colors"
        >
          <span className="w-3.5 text-center text-ink-400">↗</span>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
