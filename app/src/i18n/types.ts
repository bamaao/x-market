export type Locale = "en" | "zh";

export const LOCALES: Locale[] = ["en", "zh"];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "x-market-locale";

export type MessageTree = {
  [key: string]: string | readonly string[] | MessageTree;
};

export type TranslationParams = Record<string, string | number | bigint>;
