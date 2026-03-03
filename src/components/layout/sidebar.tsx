"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderKanban,
  Receipt,
  Users,
  Settings,
  Layers,
  LogOut,
  History,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface SidebarProps {
  userRole: string;
  userName: string;
}

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "MANAGER", "VIEWER"] },
  { href: "/projects", label: "Projects", icon: FolderKanban, roles: ["ADMIN", "MANAGER", "VIEWER"] },
  { href: "/invoices", label: "Invoices", icon: Receipt, roles: ["ADMIN", "MANAGER", "VIEWER"] },
  { href: "/clients", label: "Clients", icon: Users, roles: ["ADMIN", "MANAGER", "VIEWER"] },
  { href: "/activity", label: "Activity", icon: History, roles: ["ADMIN", "MANAGER"] },
];

const adminItems = [
  { href: "/templates", label: "Templates", icon: Layers, roles: ["ADMIN"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["ADMIN"] },
];

export function Sidebar({ userRole, userName }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <div className="flex flex-col h-full w-64 border-r bg-white">
      <div className="p-6">
        <h1 className="text-xl font-bold text-gray-900">UBInsights</h1>
        <p className="text-sm text-gray-500 mt-1">UX Research Consulting</p>
      </div>
      <Separator />
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {navItems
            .filter((item) => item.roles.includes(userRole))
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
        </nav>

        {adminItems.some((item) => item.roles.includes(userRole)) && (
          <>
            <Separator className="my-4" />
            <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Admin
            </p>
            <nav className="space-y-1">
              {adminItems
                .filter((item) => item.roles.includes(userRole))
                .map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive(item.href)
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                ))}
            </nav>
          </>
        )}
      </ScrollArea>
      <Separator />
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">{userName}</p>
            <p className="text-xs text-gray-500">{userRole}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
