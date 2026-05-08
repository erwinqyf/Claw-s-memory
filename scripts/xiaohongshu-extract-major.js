#!/usr/bin/env node
/**
 * 小红书汇总辅助脚本 v2.0 - 提取【重点】新闻
 * 
 * 功能：
 * 1. 从监控报告中提取标有【重点】的新闻
 * 2. 按标题去重
 * 3. 输出JSON格式供生成小红书文案使用
 * 
 * 用法：node xiaohongshu-extract-major.js <汇总日期>
 * 示例：node xiaohongshu-extract-major.js 2026-05-08
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace');
const REPORTS_DIR = path.join(WORKSPACE_DIR, 'reports');

/**
 * 解析命令行参数
 */
function parseArgs() {
  const summaryDate = process.argv[2] || new Date().toISOString().split('T')[0];
  return { summaryDate };
}

/**
 * 计算日期
 */
function getReportDates(summaryDate) {
  const date = new Date(summaryDate);
  const dates = [];
  
  // 上周六 (summaryDate - 6天)
  const lastSaturday = new Date(date);
  lastSaturday.setDate(date.getDate() - 6);
  dates.push(lastSaturday.toISOString().split('T')[0].replace(/-/g, ''));
  
  // 本周二 (summaryDate - 3天)
  const thisTuesday = new Date(date);
  thisTuesday.setDate(date.getDate() - 3);
  dates.push(thisTuesday.toISOString().split('T')[0].replace(/-/g, ''));
  
  // 本周四 (summaryDate - 1天)
  const thisThursday = new Date(date);
  thisThursday.setDate(date.getDate() - 1);
  dates.push(thisThursday.toISOString().split('T')[0].replace(/-/g, ''));
  
  return dates;
}

/**
 * 从监控报告中提取【重点】新闻
 * 支持两种格式：
 * 1. 新格式: ### 【重点】Slator: 标题
 * 2. 旧格式: ### 来源\n\n**【重点】标题**
 */
function extractMajorNews(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const articles = [];
    
    // 新格式: ### 【重点】来源: 标题
    const newFormatRegex = /###\s*【重点】\s*(.+?)\n\n.*?-\s*\*\*概要\*\*:\s*(.+?)\n.*?-\s*\*\*链接\*\*:\s*(.+?)\n.*?-\s*\*\*发布日期\*\*:\s*(.+?)(?:\n|$)/gs;
    
    // 旧格式: ### 来源\n\n**【重点】标题**\n...
    const oldFormatRegex = /###\s*(.+?)\n\n\*\*【重点】(.+?)\*\*\n.*?-\s*\*\*概要\*\*:\s*(.+?)\n.*?-\s*\*\*链接\*\*:\s*(.+?)\n.*?-\s*\*\*发布日期\*\*:\s*(.+?)(?:\n|$)/gs;
    
    let match;
    
    // 尝试新格式
    while ((match = newFormatRegex.exec(content)) !== null) {
      articles.push({
        isMajor: true,
        title: match[1].trim(),
        summary: match[2].trim(),
        url: match[3].trim(),
        publishDate: match[4].trim(),
        source: filePath
      });
    }
    
    // 尝试旧格式
    while ((match = oldFormatRegex.exec(content)) !== null) {
      const source = match[1].trim();
      const title = match[2].trim();
      articles.push({
        isMajor: true,
        title: `${source}: ${title}`,
        summary: match[3].trim(),
        url: match[4].trim(),
        publishDate: match[5].trim(),
        source: filePath
      });
    }
    
    return articles;
  } catch (err) {
    console.error(`读取文件失败: ${filePath}`, err.message);
    return [];
  }
}

/**
 * 主函数
 */
function main() {
  const { summaryDate } = parseArgs();
  const reportDates = getReportDates(summaryDate);
  
  console.log(`📅 汇总日期: ${summaryDate}`);
  console.log('');
  console.log('📁 需要读取的监控报告:');
  for (const date of reportDates) {
    console.log(`  - language-service-monitor-${date}.md`);
  }
  console.log('');
  
  // 提取所有【重点】新闻
  let allArticles = [];
  for (const reportDate of reportDates) {
    const filePath = path.join(REPORTS_DIR, `language-service-monitor-${reportDate}.md`);
    if (fs.existsSync(filePath)) {
      const articles = extractMajorNews(filePath);
      console.log(`✅ ${reportDate}: 提取 ${articles.length} 条【重点】新闻`);
      allArticles = allArticles.concat(articles);
    } else {
      console.log(`⚠️ ${reportDate}: 文件不存在`);
    }
  }
  
  console.log(`\n📊 总共提取: ${allArticles.length} 条【重点】新闻`);
  console.log('');
  
  // 去重（基于标题）
  const seenTitles = new Set();
  const uniqueArticles = [];
  
  for (const article of allArticles) {
    const normalizedTitle = article.title.toLowerCase().replace(/\s+/g, '');
    if (!seenTitles.has(normalizedTitle)) {
      seenTitles.add(normalizedTitle);
      uniqueArticles.push(article);
    }
  }
  
  console.log(`🔄 去重后: ${uniqueArticles.length} 条新闻`);
  console.log('');
  
  // 输出结果
  console.log('📝 【重点】新闻列表:');
  console.log('==================');
  for (let i = 0; i < uniqueArticles.length; i++) {
    const article = uniqueArticles[i];
    console.log(`${i + 1}. ${article.title}`);
    console.log(`   发布日期: ${article.publishDate}`);
    console.log(`   链接: ${article.url}`);
    console.log('');
  }
  
  // 输出JSON格式
  console.log('==================');
  console.log('📤 JSON 输出:');
  console.log(JSON.stringify(uniqueArticles, null, 2));
  
  return uniqueArticles;
}

// 执行
const articles = main();
process.exit(0);
