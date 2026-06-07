export async function sendWebhookAlert(
  webhookUrl: string | undefined,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!webhookUrl?.trim()) return;
  try {
    await fetch(webhookUrl.trim(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        ts: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.warn(
      JSON.stringify({
        event: "alert_webhook_failed",
        error: e instanceof Error ? e.message : String(e),
      }),
    );
  }
}
