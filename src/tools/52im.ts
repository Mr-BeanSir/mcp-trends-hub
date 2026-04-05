import { z } from "zod";
import { defineToolConfig, http } from "../utils";

const requestSchema = z.object({
  page: z.number().int().min(1).optional().default(1).describe("页码，从 1 开始"),
});

const decodeHtml = (value: string) =>
  value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8203;/g, "")
    .replace(/&hellip;/g, "…")
    .trim();

const stripTags = (value: string) => decodeHtml(value.replace(/<[^>]+>/g, " "));

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const getListPageUrl = (page: number) => {
  if (page <= 1) {
    return "http://www.52im.net/pi/";
  }
  return `http://www.52im.net/pi/index.php?page=${page}`;
};

export default defineToolConfig({
  name: "get_52im_news",
  description: "获取 52im 即时通讯网资讯列表，包含即时通讯、推送、IM 架构、产品动态及相关技术实践的中文热点资讯",
  zodSchema: requestSchema,
  func: async (args) => {
    const { page } = requestSchema.parse(args);
    const resp = await http.get<ArrayBuffer>(getListPageUrl(page), {
      responseType: "arraybuffer",
    });

    const html = new TextDecoder("gb18030").decode(new Uint8Array(resp.data));
    const listMatch = html.match(/<ul class="qingwzlist2_l">([\s\S]*?)<\/ul>/i);
    if (!listMatch) {
      throw new Error("获取 52im 资讯列表失败");
    }

    const items = Array.from(listMatch[1].matchAll(/<li class="cl"[\s\S]*?<\/li>/g)).map((match) => {
      const block = match[0];
      const linkMatch = block.match(/<h3><a href="([^"]+)"[\s\S]*?>([\s\S]*?)<\/a>/i);
      if (!linkMatch) {
        return null;
      }

      const summary = block.match(/<p class="about">([\s\S]*?)<\/p>/i)?.[1];
      const author = block.match(/文\s*&nbsp;\/&nbsp;<a [^>]*>([\s\S]*?)<\/a>/i)?.[1];
      const releasedTime = block.match(/<span title="([^"]+)">/i)?.[1];
      const views = block.match(/<div class="views[^"]*">\s*(\d+)\s*<small>阅读<\/small>/i)?.[1];
      const recommendCount = block.match(/<a class="votes[^"]*">\s*(\d+)\s*<small>推荐<\/small>/i)?.[1];
      const commentCount = block.match(/<span class="cmt_num">(\d+)\s*评<\/span>/i)?.[1];

      return {
        title: normalizeWhitespace(stripTags(linkMatch[2])),
        summary: summary ? normalizeWhitespace(stripTags(summary)) : undefined,
        author: author ? normalizeWhitespace(stripTags(author)) : undefined,
        released_time: releasedTime,
        view_count: views ? Number(views) : undefined,
        recommend_count: recommendCount ? Number(recommendCount) : undefined,
        comment_count: commentCount ? Number(commentCount) : undefined,
        link: linkMatch[1],
      };
    });

    const results = items.filter((item): item is NonNullable<typeof item> => item !== null).slice(0, 10);
    if (results.length === 0) {
      throw new Error("52im 资讯列表为空");
    }

    return results;
  },
});
