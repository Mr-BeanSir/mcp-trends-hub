import { defineToolConfig, http } from "../utils";

const decodeHtml = (value: string) =>
  value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number.parseInt(num, 10)))
    .trim();

const stripTags = (value: string) => decodeHtml(value.replace(/<[^>]+>/g, " "));

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const extractCategory = (block: string) => {
  const categoryMatch =
    block.match(/分类于\s*<a [^>]*>([\s\S]*?)<\/a>/i) ??
    block.match(/分类于\s*<span [^>]*>\s*<a [^>]*>([\s\S]*?)<\/a>/i);
  return categoryMatch ? normalizeWhitespace(stripTags(categoryMatch[1])) : undefined;
};

const extractSummary = (block: string) => {
  const quoteMatch = block.match(/<blockquote[\s\S]*?>([\s\S]*?)<\/blockquote>/i)?.[1];
  if (quoteMatch) {
    return normalizeWhitespace(stripTags(quoteMatch));
  }

  const paragraphMatches = Array.from(block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
    .map((match) => normalizeWhitespace(stripTags(match[1])))
    .filter(Boolean)
    .filter((text) => !text.includes("发表于") && !text.includes("阅读全文"));

  return paragraphMatches[0];
};

export default defineToolConfig({
  name: "get_jiankunking_blog",
  description: "获取 衣舞晨风 博客首页文章列表，包含云原生、网关、Go、Java、ElasticSearch 等技术实践内容",
  func: async () => {
    const resp = await http.get<string>("https://jiankunking.com/");
    const html = resp.data;

    const articleBlocks = Array.from(html.matchAll(/<article[\s\S]*?<\/article>/gi)).map((match) => match[0]);
    if (articleBlocks.length === 0) {
      throw new Error("获取 衣舞晨风 博客首页失败");
    }

    const results = articleBlocks
      .map((block) => {
        const titleMatch =
          block.match(/<h[1-6][^>]*>\s*<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h[1-6]>/i) ??
          block.match(/<a [^>]*href="([^"]+)"[^>]*rel="bookmark"[^>]*>([\s\S]*?)<\/a>/i);
        if (!titleMatch) {
          return null;
        }

        const publishedAt = block.match(/发表于\s*([^<\n]+)/i)?.[1]?.trim();
        const updatedAt = block.match(/更新于\s*([^<\n]+)/i)?.[1]?.trim();
        const wordCount = block.match(/本文字数：\s*([^<\n]+)/i)?.[1]?.trim();
        const readingTime = block.match(/阅读时长\s*≈\s*([^<\n]+)/i)?.[1]?.trim();

        return {
          title: normalizeWhitespace(stripTags(titleMatch[2])),
          summary: extractSummary(block),
          category: extractCategory(block),
          publish_time: publishedAt,
          updated_time: updatedAt,
          word_count: wordCount,
          reading_time: readingTime,
          link: titleMatch[1],
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .slice(0, 10);

    if (results.length === 0) {
      throw new Error("衣舞晨风 博客首页文章列表为空");
    }

    return results;
  },
});
