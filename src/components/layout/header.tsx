"use client";

import { usePathname } from "next/navigation";

const routeTitles: Record<string, string> = {
  "/": "Dashboard",
  "/inquiries": "Inquiries",
  "/estimates": "Estimates",
  "/contracts": "Contracts",
  "/contract-templates": "Contract Templates",
  "/projects": "Projects",
  "/invoices": "Invoices",
  "/clients": "Clients",
  "/templates": "Estimate Templates",
  "/settings": "Settings",
};

export function Header() {
  const pathname = usePathname();

  // Find the matching route title
  const title = Object.entries(routeTitles).find(([route]) => {
    if (route === "/") return pathname === "/";
    return pathname.startsWith(route);
  })?.[1] || "Dashboard";

  return (
    <header className="h-16 border-b bg-white flex items-center px-6">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
    </header>
  );
}
