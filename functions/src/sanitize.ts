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

export function containsGenerationMeta(value: unknown) {
  const text = String(value ?? "");
  return (
    /本文[・、]問題[・、]暗記カードは未作成/.test(text) ||
    /ロードマップと目次[（(].*未作成/.test(text) ||
    /参考情報は信頼できる.*(?:史料|情報源).*基づいて/.test(text)
  );
}
