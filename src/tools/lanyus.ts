import { defineToolConfig, getRssItems } from "../utils";

export default defineToolConfig({
  name: "get_lanyus_blog",
  description: "获取 蓝雨博客 的技术文章 RSS，包含即时通讯、系统架构、网络技术及工程实践相关内容",
  func: () => getRssItems("https://blog.lanyus.com/feed/"),
});
