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
