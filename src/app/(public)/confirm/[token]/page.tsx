"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";

interface ScopeData {
  content: string;
  version: number;
  createdAt: string;
  createdBy: string;
  confirmed: boolean;
  confirmedAt: string | null;
  confirmedByName: string | null;
  project: {
    title: string;
    projectNumber: string;
    company: string;
  };
}

export default function ConfirmPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ScopeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/confirm/${token}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || "Not found");
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleConfirm() {
    if (!name.trim()) return;
    setConfirming(true);
    try {
      const res = await fetch(`/api/confirm/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to confirm");
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] px-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-10 w-10 mx-auto mb-3 text-red-400" />
            <p className="font-medium text-gray-900">Link not found</p>
            <p className="text-sm text-gray-500 mt-1">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  // Already confirmed (before this session or just now)
  if (data.confirmed || done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] px-4">
        <Card className="max-w-lg w-full">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <h1 className="text-xl font-semibold text-gray-900">Scope confirmed</h1>
            <p className="text-sm text-gray-500 mt-2">
              {done
                ? `Thank you, ${name}. Your confirmation has been recorded.`
                : `Confirmed by ${data.confirmedByName} on ${new Date(data.confirmedAt!).toLocaleDateString()}`}
            </p>
            <div className="mt-6 text-left bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">{data.project.company} / {data.project.title}</p>
              <div className="text-sm text-gray-700 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: data.content }} />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] px-4 py-8">
      <Card className="max-w-lg w-full">
        <CardContent className="py-8">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-lg font-semibold text-gray-900">Confirm scope of work</h1>
            <p className="text-sm text-gray-500 mt-1">
              {data.project.company} — {data.project.title}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Version {data.version} · Sent by {data.createdBy} · {new Date(data.createdAt).toLocaleDateString()}
            </p>
          </div>

          {/* Scope content */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="text-sm text-gray-700 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: data.content }} />
          </div>

          {/* Confirmation form */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Your name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name to confirm"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button
              onClick={handleConfirm}
              disabled={!name.trim() || confirming}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {confirming ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Confirm scope of work
            </Button>

            <p className="text-xs text-gray-400 text-center">
              By confirming, you agree this scope of work accurately reflects your requirements.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
