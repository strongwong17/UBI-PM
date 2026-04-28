"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface ProjectHubTabsProps {
  tabs: { value: string; label: string; content: React.ReactNode }[];
  defaultTab?: string;
}

export function ProjectHubTabs({ tabs, defaultTab }: ProjectHubTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get("tab") || defaultTab || tabs[0]?.value;

  function setActive(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="w-full">
      <div className="flex gap-0.5 border-b border-hairline mb-6">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setActive(t.value)}
            className={cn(
              "px-4 py-2.5 text-[13px] font-medium text-ink-500 border-b-2 border-transparent -mb-px hover:text-ink-900 transition-colors",
              active === t.value && "text-ink-900 border-ink-900 font-semibold",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.find((t) => t.value === active)?.content}
    </div>
  );
}
