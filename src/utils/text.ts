export function withoutInlineLinks(value: string) {
  return value
    .replace(/\(\s*\[[^\]]*\]\(https?:\/\/[^)]*\)\s*\)/gi, "")
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]*\)/gi, "$1")
    .replace(/\(\s*https?:\/\/[^\s)]*\s*\)/gi, "")
    .replace(/https?:\/\/[^\s)]+/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([。、，．])/g, "$1")
    .trim();
}

export function withoutPageNumberPrefix(value: string) {
  return value
    .replace(
      /^\s*ページ\s*[0-9０-９一二三四五六七八九十]+\s*[：:；;、.．・\-ー]?\s*/,
      "",
    )
    .trim();
}

export function containsGenerationMeta(value: string) {
  return (
    /本文[・、]問題[・、]暗記カードは未作成/.test(value) ||
    /ロードマップと目次[（(].*未作成/.test(value) ||
    /参考情報は信頼できる.*(?:史料|情報源).*基づいて/.test(value)
  );
}
