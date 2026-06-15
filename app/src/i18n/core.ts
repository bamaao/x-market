import type { Locale, MessageTree, TranslationParams } from "./types";

function getNested(tree: MessageTree, key: string): string | undefined {
  let current: unknown = tree;
  for (const part of key.split(".")) {
    if (typeof current !== "object" || current == null || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    return value == null ? `{${name}}` : String(value);
  });
}

export type Translator = (key: string, params?: TranslationParams) => string;

export function createTranslator(
  locale: Locale,
  messages: Record<Locale, MessageTree>,
): Translator {
  const tree = messages[locale] ?? messages.en;
  const fallback = messages.en;
  return (key, params) => {
    const value = getNested(tree, key) ?? getNested(fallback, key);
    if (value == null) return key;
    return interpolate(value, params);
  };
}

export function resolveLocale(input?: string | null): Locale {
  if (input === "zh" || input?.startsWith("zh")) return "zh";
  return "en";
}

export function readStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("x-market-locale");
    if (stored === "en" || stored === "zh") return stored;
  } catch {
    /* ignore */
  }
  return null;
}

export function persistLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("x-market-locale", locale);
    document.cookie = `x-market-locale=${locale};path=/;max-age=31536000;samesite=lax`;
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  } catch {
    /* ignore */
  }
}

export function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  return resolveLocale(navigator.language);
}

/** User-visible errors thrown from lib with an i18n message key (and optional params). */
export class LocalizedError extends Error {
  constructor(
    public readonly messageKey: string,
    public readonly params?: TranslationParams,
  ) {
    super(messageKey);
    this.name = "LocalizedError";
  }
}

/** Resolve lib error strings that are i18n keys (dotted paths); pass through plain text. */
export function localizeLibMessage(message: string, t: Translator): string {
  if (!message.includes(".")) return message;
  const translated = t(message);
  return translated === message ? message : translated;
}

export function formatCaughtError(err: unknown, t: Translator): string {
  if (err instanceof LocalizedError) {
    return t(err.messageKey, err.params);
  }
  if (err instanceof Error) {
    return localizeLibMessage(err.message, t);
  }
  return String(err);
}
