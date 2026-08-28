export function withoutInlineLinks(value: unknown) {
  return String(value ?? "")
    .replace(/\(\s*\[[^\]]*\]\(https?:\/\/[^)]*\)\s*\)/gi, "")
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]*\)/gi, "$1")
    .replace(/\(\s*https?:\/\/[^\s)]*\s*\)/gi, "")
    .replace(/https?:\/\/[^\s)]+/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([。、，．])/g, "$1")
    .trim();
}
