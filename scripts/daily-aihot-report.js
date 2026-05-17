#!/usr/bin/env node
/**
 * Daily AI HOT Report Generator
 * 每天早上 8 点自动获取 AI HOT 日报并发送给丰
 */

const { execSync } = require('child_process');

// User-Agent for API calls
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchDailyReport() {
  try {
    // 获取今日日报
    const response = execSync(
      `curl -sH "User-Agent: ${UA}" "https://aihot.virxact.com/api/public/daily"`,
      { encoding: 'utf-8', timeout: 30000 }
    );
    
    const data = JSON.parse(response);
    return formatReport(data);
  } catch (error) {
    // 如果今天日报还没生成（北京时间 08:00 前），获取昨天的
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      
      const response = execSync(
        `curl -sH "User-Agent: ${UA}" "https://aihot.virxact.com/api/public/daily/${dateStr}"`,
        { encoding: 'utf-8', timeout: 30000 }
      );
      
      const data = JSON.parse(response);
      return formatReport(data, true);
    } catch (err) {
      throw new Error(`获取 AI HOT 日报失败: ${err.message}`);
    }
  }
}

function formatReport(data, isYesterday = false) {
  const date = data.date || '未知日期';
  const dateLabel = isYesterday ? `${date}（昨日）` : date;
  
  let report = `## 🤖 AI HOT 日报 · ${dateLabel}\n\n`;
  
  // 主编点评
  if (data.lead && data.lead.title) {
    report += `### 📌 主编点评\n**${data.lead.title}**\n\n`;
    if (data.lead.leadParagraph) {
      report += `${data.lead.leadParagraph}\n\n`;
    }
  }
  
  // 各版块内容
  if (data.sections && data.sections.length > 0) {
    let itemNumber = 1;
    
    for (const section of data.sections) {
      if (section.items && section.items.length > 0) {
        report += `### ${section.label}\n\n`;
        
        for (const item of section.items) {
          const title = item.title || '无标题';
          const source = item.sourceName || item.source || '未知来源';
          const url = item.sourceUrl || item.url || '';
          const summary = item.summary ? item.summary.substring(0, 80) + (item.summary.length > 80 ? '...' : '') : '';
          
          report += `${itemNumber}. **${title}** — ${source}\n`;
          if (summary) {
            report += `   ${summary}\n`;
          }
          if (url) {
            report += `   ${url}\n`;
          }
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
  
  report += `---\n📊 数据来自 [AI HOT](https://aihot.virxact.com)`;
  
  return report;
}

// 主函数
async function main() {
  try {
    console.log('🤖 正在获取 AI HOT 日报...');
    const report = await fetchDailyReport();
    console.log(report);
    process.exit(0);
  } catch (error) {
    console.error(`❌ 错误: ${error.message}`);
    process.exit(1);
  }
}

main();
