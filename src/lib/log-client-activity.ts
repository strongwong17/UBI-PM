export async function logClientActivity(params: {
  action: string;
  entityType: string;
  entityId: string;
  entityLabel?: string;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch {
    // Activity logging should never block the UI
  }
}
