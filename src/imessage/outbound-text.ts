import { stripInlineDirectiveTagsForDisplay } from "../utils/directive-tags.js";

export function normalizeIMessageOutboundText(text: string): string {
  return stripInlineDirectiveTagsForDisplay(text)
    .text.replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .trim();
}
