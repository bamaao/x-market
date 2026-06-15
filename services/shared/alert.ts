// Copyright (c) 2026 zouyc zouyccq@gmail.com.
// All rights reserved.
//
// Licensed under the Business Source License 1.1 (BSL 1.1).
// You may not use this file except in compliance with the License.
//
// Change Date: 2031-01-01
// On the Change Date, or the fourth anniversary of the first publicly available
// distribution of the code under the BSL, whichever comes first, the code
// automatically becomes available under the Apache License 2.0.

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
