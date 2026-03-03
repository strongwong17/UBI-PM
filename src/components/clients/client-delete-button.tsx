"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ClientDeleteButtonProps {
  clientId: string;
  clientName: string;
}

export function ClientDeleteButton({ clientId, clientName }: ClientDeleteButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${clientName}"? This cannot be undone.`)) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete client");
      }
      toast.success("Client deleted");
      router.push("/clients");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete client");
      setIsDeleting(false);
    }
  }

  return (
    <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
      {isDeleting ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4 mr-2" />
      )}
      {isDeleting ? "Deleting..." : "Delete"}
    </Button>
  );
}
