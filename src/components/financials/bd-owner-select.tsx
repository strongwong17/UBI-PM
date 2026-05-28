"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  projectId: string;
  users: { id: string; name: string }[];
  current: string | null;
}

const UNASSIGNED = "__none__";

export function BdOwnerSelect({ projectId, users, current }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? UNASSIGNED);

  async function onChange(next: string) {
    setValue(next);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessDevId: next === UNASSIGNED ? null : next }),
      });
      if (!res.ok) throw new Error("Failed to update owner");
      toast.success("BD owner updated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update owner");
    }
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-52 h-8 text-[12px]">
        <SelectValue placeholder="BD owner" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
        {users.map((u) => (
          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
