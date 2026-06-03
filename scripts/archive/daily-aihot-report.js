#!/usr/bin/env node
/**
 * Daily AI HOT Report Generator v2.0
 *
 * 获取 AI HOT 日报（aihot.virxact.com），自动处理
 * 今日/昨日回退逻辑。
 *
 * 用法:
 *   node daily-aihot-report.js [--date YYYY-MM-DD]
 *   node daily-aihot-report.js  # 默认今日
 *
 * v2.0 变更 (2026-05-18):
 * - 用原生 https 替代 curl/execSync（减少外部依赖）
 * - 添加 --date 参数支持获取指定日期
 * - 改进错误处理（网络超时、JSON 解析失败、空数据）
 * - 添加摘要统计（条目数、版块数）
 */

'use strict';

const https = require('https');

const API_BASE = 'https://aihot.virxact.com/api/public/daily';
const REQUEST_TIMEOUT_MS = 30000;

/**
 * 发起 GET 请求
 * @param {string} url
 * @returns {Promise<object>}
 */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      timeout: REQUEST_TIMEOUT_MS
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON 解析失败: ${e.message}`));
        }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
    req.on('error', reject);
  });
}

/**
 * 获取指定日期（或今日）的日报，自动回退到昨日
 * @param {string|null} dateStr - YYYY-MM-DD 或 null
 * @returns {Promise<{data: object, isFallback: boolean}>}
 */
async function fetchDailyReport(dateStr = null) {
  const today = dateStr || new Date().toISOString().split('T')[0];

  try {
    const data = await httpGet(`${API_BASE}?date=${today}`);
    if (data && data.date) return { data, isFallback: false };
    throw new Error('空响应');
  } catch (err) {
    // 回退到昨日
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];

    console.warn(`⚠️ 今日日报不可用 (${today})，回退到昨日 (${yStr})`);
    const data = await httpGet(`${API_BASE}/${yStr}`);
    return { data, isFallback: true };
  }
}

/**
 * 格式化日报数据为 Markdown
 * @param {object} data - API 响应
 * @param {boolean} isFallback - 是否为回退数据
 * @returns {string}
 */
function formatReport(data, isFallback = false) {
  const date = data.date || '未知日期';
  const dateLabel = isFallback ? `${date}（昨日）` : date;
  
  let report = `## 🤖 AI HOT 日报 · ${dateLabel}\n\n`;
  
  // 主编点评
  if (data.lead && data.lead.title) {
    report += `### 📌 主编点评\n**${data.lead.title}**\n\n`;
    if (data.lead.leadParagraph) {
      report += `${data.lead.leadParagraph}\n\n`;
    }
  }
  
  // 各版块内容
  let totalItems = 0;
  let sectionCount = 0;

  if (data.sections && data.sections.length > 0) {
    let itemNumber = 1;

    for (const section of data.sections) {
      if (section.items && section.items.length > 0) {
        sectionCount++;
        report += `### ${section.label}\n\n`;

        for (const item of section.items) {
          totalItems++;
          const title = item.title || '无标题';
          const source = item.sourceName || item.source || '未知来源';
          const url = item.sourceUrl || item.url || '';
          const summary = item.summary
            ? item.summary.substring(0, 100) + (item.summary.length > 100 ? '...' : '')
            : '';

          report += `${itemNumber}. **${title}** — ${source}\n`;
          if (summary) report += `   ${summary}\n`;
          if (url) report += `   ${url}\n`;
          report += '\n';
          itemNumber++;
        }
      }
    }
  }
  
  // 快讯
  if (data.flashes && data.flashes.length > 0) {
    report += `### ⚡ 快讯\n\n`;
    for (const flash of data.flashes.slice(0, 5)) {
      const flashTitle = flash.title || '无标题';
      const flashSource = flash.sourceName || '未知来源';
      report += `- ${flashTitle} — ${flashSource}\n`;
    }
    report += '\n';
  }
  
  report += `---\n`;
  report += `📊 共 ${sectionCount} 个版块、${totalItems} 条内容 · 数据来自 [AI HOT](https://aihot.virxact.com)`;

  return report;
}

// ============ 主流程 ============
async function main() {
  const dateArg = process.argv[2] === '--date' ? process.argv[3] : null;

  console.log(`🤖 正在获取 AI HOT 日报...`);
  const { data, isFallback } = await fetchDailyReport(dateArg);
  const report = formatReport(data, isFallback);
  console.log(report);
}

main().catch(err => {
  console.error(`❌ 错误: ${err.message}`);
  process.exit(1);
});
