export { en } from "./en";
export { zh } from "./zh";

import { en } from "./en";
import { zh } from "./zh";
import type { Locale, MessageTree } from "../types";

export const messages: Record<Locale, MessageTree> = { en, zh };
