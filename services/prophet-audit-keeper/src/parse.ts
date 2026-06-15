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

export function parseMoveFields(content: unknown): Record<string, unknown> | undefined {
  if (!content || typeof content !== "object") return undefined;
  const c = content as { dataType?: string; fields?: Record<string, unknown> };
  if (c.dataType === "moveObject" && c.fields) return c.fields;
  return undefined;
}

export function bytesToHex(value: unknown): string {
  if (typeof value === "string") {
    try {
      return Array.from(Uint8Array.from(atob(value), (ch) => ch.charCodeAt(0)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) {
    return (value as number[])
      .map((b) => Number(b).toString(16).padStart(2, "0"))
      .join("");
  }
  return "";
}

export function parseObjectId(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    return String((value as { id: string }).id);
  }
  return "";
}
