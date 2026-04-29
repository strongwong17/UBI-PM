"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save } from "lucide-react";

interface BusinessProfile {
  id: string;
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  tagline: string | null;
}

export default function SettingsPage() {
  const [, setProfile] = useState<BusinessProfile | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [tagline, setTagline] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/business-profile")
      .then((r) => r.json())
      .then((data: BusinessProfile) => {
        setProfile(data);
        setName(data.name || "");
        setAddress(data.address || "");
        setEmail(data.email || "");
        setPhone(data.phone || "");
        setTagline(data.tagline || "");
      })
      .catch(() => toast.error("Failed to load business profile"))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Business name is required");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings/business-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          tagline: tagline.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      const updated: BusinessProfile = await res.json();
      setProfile(updated);
      toast.success("Business profile saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-5 w-5 animate-spin text-ink-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        className="flex items-start justify-between gap-4 flex-wrap pb-[18px]"
        style={{ borderBottom: "1px solid var(--color-hairline)" }}
      >
        <div>
          <h1 className="text-[24px] font-bold tracking-[-0.025em] m-0 mb-1 text-ink-900">
            Settings
          </h1>
          <p className="text-[13px] text-ink-500 m-0 max-w-[520px]">
            Manage the business profile that appears on generated estimates, invoices, and
            contracts.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
            {"// BUSINESS PROFILE"}
          </p>
          <div
            className="bg-card-rd rounded-[14px] p-5 space-y-4"
            style={{
              border: "1px solid var(--color-hairline)",
              boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
            }}
          >
            <div className="space-y-1.5">
              <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
                {"// BUSINESS NAME *"}
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="UBInsights LLC"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
                {"// TAGLINE"}
              </label>
              <Input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="UX Research Consulting"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
                {"// ADDRESS"}
              </label>
              <Textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={"28016 Ridgebluff Ct\nRancho Palos Verdes, CA 90275"}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
                  {"// EMAIL"}
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="yushi@ubinsights.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
                  {"// PHONE"}
                </label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="310 906 5677"
                />
              </div>
            </div>
          </div>
        </div>

        <div
          className="flex items-center justify-between p-4 rounded-[14px] mt-5 sticky"
          style={{
            background: "var(--color-card-rd)",
            border: "1px solid var(--color-hairline)",
            boxShadow:
              "0 6px 24px -6px rgba(15, 23, 41, 0.10), 0 2px 6px -2px rgba(15, 23, 41, 0.06)",
            bottom: 16,
            zIndex: 5,
          }}
        >
          <div className="text-[12px] text-ink-500">
            Changes apply to all future generated documents.
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white tracking-[-0.005em] disabled:opacity-50"
            style={{
              background: "var(--color-accent-rd)",
              boxShadow: "0 4px 12px -2px rgba(217, 82, 43, 0.32)",
            }}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
