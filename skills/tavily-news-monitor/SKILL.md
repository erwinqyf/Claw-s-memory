---
name: tavily-news-monitor
description: Global news monitoring using Tavily API. Fetches real-time news across politics, economy, culture, and technology categories. Use when user wants global news monitoring, daily news summary, world news briefing, or asks for "今日新闻", "全球新闻", "午间新闻", "晚间新闻".
---

# Tavily News Monitor

抓取全球新闻并输出结构化报告。使用 Tavily Search API（`topic: "news"`）。

## 快速执行

```bash
TAVILY_API_KEY=<key> node ~/.openclaw/workspace/skills/tavily-news-monitor/scripts/tavily-news-monitor.js
```

或作为 cron 脚本（key 已在 cron 配置中）。

## 输出

- JSON: `data/exec-results/tavily-news-{YYYY-MM-DD}.json`
- Markdown: `reports/tavily-news-{YYYY-MM-DD}.md`

## 类别与查询

| 类别 | 查询词 | 条数 |
|------|--------|------|
| 政治 | `global politics world news today` | 5 |
| 经济 | `global economy markets finance business today` | 5 |
| 文化 | `culture entertainment arts society news today` | 3 |
| 科技 | `technology AI science innovation news today` | 5 |

## 读取结果供报告使用

```bash
cat data/exec-results/tavily-news-$(date +%Y-%m-%d).json
```

每条新闻含 `title`, `summary`, `url`, `source`, `date`, `category`。
