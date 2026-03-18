"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderKanban,
  Calculator,
  Receipt,
  Users,
  Settings,
  Layers,
  LogOut,
  History,
  ScrollText,
  FileText,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SidebarProps {
  userRole: string;
  userName: string;
}

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "MANAGER", "VIEWER"] },
  { href: "/projects", label: "Projects", icon: FolderKanban, roles: ["ADMIN", "MANAGER", "VIEWER"] },
  { href: "/estimates", label: "Estimates", icon: Calculator, roles: ["ADMIN", "MANAGER", "VIEWER"] },
  { href: "/invoices", label: "Invoices", icon: Receipt, roles: ["ADMIN", "MANAGER", "VIEWER"] },
  { href: "/clients", label: "Clients", icon: Users, roles: ["ADMIN", "MANAGER", "VIEWER"] },
  { href: "/contracts", label: "Contracts", icon: ScrollText, roles: ["ADMIN", "MANAGER", "VIEWER"] },
  { href: "/activity", label: "Activity", icon: History, roles: ["ADMIN", "MANAGER"] },
];

const adminItems = [
  { href: "/templates", label: "Est. Templates", icon: Layers, roles: ["ADMIN"] },
  { href: "/contract-templates", label: "Contract Tpl.", icon: FileText, roles: ["ADMIN", "MANAGER"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["ADMIN"] },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-[10px] px-3 min-h-[44px] text-[14px] font-medium transition-all duration-150",
        active
          ? "bg-gray-900 text-white"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
      )}
    >
      <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-white" : "text-gray-400")} />
      {label}
    </Link>
  );
}

export function Sidebar({ userRole, userName }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col h-full w-60 border-r border-gray-200/80 bg-white shrink-0">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <h1 className="text-[18px] font-bold text-gray-900 tracking-tight">UBInsights</h1>
        <p className="text-[12px] text-gray-400 mt-0.5">Research consulting</p>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3">
        <nav className="space-y-0.5">
          {navItems
            .filter((item) => item.roles.includes(userRole))
            .map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={isActive(item.href)}
              />
            ))}
        </nav>

        {adminItems.some((item) => item.roles.includes(userRole)) && (
          <div className="mt-6 mb-2">
            <p className="px-3 text-[11px] font-semibold text-gray-300 tracking-wider mb-2">
              Admin
            </p>
            <nav className="space-y-0.5">
              {adminItems
                .filter((item) => item.roles.includes(userRole))
                .map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    active={isActive(item.href)}
                  />
                ))}
            </nav>
          </div>
        )}
      </ScrollArea>

      {/* User */}
      <div className="px-3 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-2">
          <div className="h-8 w-8 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-semibold text-white">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-gray-900 truncate">{userName}</p>
            <p className="text-[11px] text-gray-400">{userRole}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-150"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
