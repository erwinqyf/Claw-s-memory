#!/usr/bin/env node
/**
 * 小红书汇总辅助脚本 - 日期过滤和去重
 * 
 * 功能：
 * 1. 从监控报告中提取本周新发布的新闻
 * 2. 根据发布日期过滤，排除旧新闻
 * 3. 检查是否已在之前的汇总中出现过
 * 
 * 用法：node xiaohongshu-filter-helper.js <汇总日期>
 * 示例：node xiaohongshu-filter-helper.js 2026-05-08
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
 * 计算本周一的日期
 */
function getMondayOfWeek(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay(); // 0=周日, 1=周一, ..., 6=周六
  const diff = day === 0 ? -6 : 1 - day; // 如果今天是周日，回到上周一
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return monday.toISOString().split('T')[0];
}

/**
 * 从监控报告中提取新闻条目
 * 支持两种格式：
 * 1. 新格式 (2026-05-07): ### 【重点】Slator: 标题\n\n- **概要**: ...\n- **链接**: ...\n- **发布日期**: YYYY-MM-DD
 * 2. 旧格式 (2026-05-02): ### 来源\n\n**【重点】标题**\n- **概要**: ...\n- **链接**: ...\n- **发布日期**: YYYY年M月D日
 */
function extractArticlesFromReport(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const articles = [];
    
    // 新格式正则 (2026-05-07+)
    const newFormatRegex = /###\s*([【重点】]*)(.+?)\n\n.*?-\s*\*\*概要\*\*:\s*(.+?)\n.*?-\s*\*\*链接\*\*:\s*(.+?)\n.*?-\s*\*\*发布日期\*\*:\s*(\d{4}-\d{2}-\d{2})/gs;
    
    // 旧格式正则 (2026-05-02)
    const oldFormatRegex = /###\s*(.+?)\n\n\*\*([【重点】]*)(.+?)\*\*\n.*?-\s*\*\*概要\*\*:\s*(.+?)\n.*?-\s*\*\*链接\*\*:\s*(.+?)\n.*?-\s*\*\*发布日期\*\*:\s*(.+?)(?:\n|$)/gs;
    
    // 尝试新格式
    let match;
    while ((match = newFormatRegex.exec(content)) !== null) {
      articles.push({
        isMajor: match[1].includes('【重点】'),
        title: match[2].trim(),
        summary: match[3].trim(),
        url: match[4].trim(),
        publishDate: match[5],
        source: filePath
      });
    }
    
    // 尝试旧格式
    while ((match = oldFormatRegex.exec(content)) !== null) {
      const dateStr = match[6].trim();
      // 转换日期格式：2026年4月 -> 2026-04-01, 2026年3月 -> 2026-03-01
      let publishDate;
      if (dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)) {
        const parts = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        publishDate = `${parts[1]}-${parts[2].padStart(2, '0')}-${parts[3].padStart(2, '0')}`;
      } else if (dateStr.match(/(\d{4})年(\d{1,2})月/)) {
        const parts = dateStr.match(/(\d{4})年(\d{1,2})月/);
        publishDate = `${parts[1]}-${parts[2].padStart(2, '0')}-01`;
      } else if (dateStr.match(/(\d{4})-(\d{2})-(\d{2})/)) {
        publishDate = dateStr;
      } else {
        publishDate = '2026-01-01'; // 默认值
      }
      
      articles.push({
        isMajor: match[2].includes('【重点】'),
        title: `${match[1].trim()}: ${match[3].trim()}`,
        summary: match[4].trim(),
        url: match[5].trim(),
        publishDate: publishDate,
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
 * 加载之前汇总的记录（用于去重）
 */
function loadPreviousSummaries() {
  const summaries = [];
  const files = fs.readdirSync(REPORTS_DIR)
    .filter(f => f.startsWith('xiaohongshu-language-service-') && f.endsWith('.md'))
    .sort();
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(REPORTS_DIR, file), 'utf-8');
      // 提取之前汇总过的新闻标题
      const titleMatches = content.match(/##\s*\d️⃣\s*【(.+?)】/g);
      if (titleMatches) {
        for (const match of titleMatches) {
          const title = match.replace(/##\s*\d️⃣\s*【(.+?)】/, '$1').trim();
          summaries.push(title);
        }
      }
    } catch (err) {
      // 忽略读取错误
    }
  }
  
  return summaries;
}

/**
 * 主函数
 */
function main() {
  const { summaryDate } = parseArgs();
  const mondayDate = getMondayOfWeek(summaryDate);
  
  console.log(`📅 汇总日期: ${summaryDate}`);
  console.log(`📅 本周一: ${mondayDate}`);
  console.log('');
  
  // 计算需要读取的监控报告日期
  const date = new Date(summaryDate);
  const reportDates = [];
  
  // 上周六
  const lastSaturday = new Date(date);
  lastSaturday.setDate(date.getDate() - 6);
  reportDates.push(lastSaturday.toISOString().split('T')[0].replace(/-/g, ''));
  
  // 本周二
  const thisTuesday = new Date(date);
  thisTuesday.setDate(date.getDate() - 3);
  reportDates.push(thisTuesday.toISOString().split('T')[0].replace(/-/g, ''));
  
  // 本周四
  const thisThursday = new Date(date);
  thisThursday.setDate(date.getDate() - 1);
  reportDates.push(thisThursday.toISOString().split('T')[0].replace(/-/g, ''));
  
  console.log('📁 需要读取的监控报告:');
  for (const reportDate of reportDates) {
    console.log(`  - language-service-monitor-${reportDate}.md`);
  }
  console.log('');
  
  // 提取所有文章
  let allArticles = [];
  for (const reportDate of reportDates) {
    const filePath = path.join(REPORTS_DIR, `language-service-monitor-${reportDate}.md`);
    if (fs.existsSync(filePath)) {
      const articles = extractArticlesFromReport(filePath);
      console.log(`✅ ${reportDate}: 提取 ${articles.length} 条新闻`);
      allArticles = allArticles.concat(articles);
    } else {
      console.log(`⚠️ ${reportDate}: 文件不存在`);
    }
  }
  
  console.log(`\n📊 总共提取: ${allArticles.length} 条新闻`);
  console.log('');
  
  // 根据发布日期过滤（只保留本周一至今的）
  const filteredByDate = allArticles.filter(article => {
    return article.publishDate >= mondayDate;
  });
  
  console.log(`📅 发布日期过滤后: ${filteredByDate.length} 条新闻 (>= ${mondayDate})`);
  console.log('');
  
  // 去重（基于标题）
  const seenTitles = new Set();
  const uniqueArticles = [];
  
  for (const article of filteredByDate) {
    const normalizedTitle = article.title.toLowerCase().replace(/\s+/g, '');
    if (!seenTitles.has(normalizedTitle)) {
      seenTitles.add(normalizedTitle);
      uniqueArticles.push(article);
    }
  }
  
  console.log(`🔄 去重后: ${uniqueArticles.length} 条新闻`);
  console.log('');
  
  // 加载之前汇总过的标题
  const previousTitles = loadPreviousSummaries();
  console.log(`📚 之前汇总记录: ${previousTitles.length} 条`);
  console.log('');
  
  // 最终筛选（排除之前汇总过的）
  const finalArticles = uniqueArticles.filter(article => {
    const normalizedTitle = article.title.toLowerCase().replace(/\s+/g, '');
    for (const prevTitle of previousTitles) {
      const normalizedPrev = prevTitle.toLowerCase().replace(/\s+/g, '');
      if (normalizedTitle === normalizedPrev || 
          normalizedTitle.includes(normalizedPrev) || 
          normalizedPrev.includes(normalizedTitle)) {
        return false;
      }
    }
    return true;
  });
  
  console.log(`✅ 最终筛选结果: ${finalArticles.length} 条新闻`);
  console.log('');
  
  // 按重点标记排序
  finalArticles.sort((a, b) => {
    if (a.isMajor && !b.isMajor) return -1;
    if (!a.isMajor && b.isMajor) return 1;
    return new Date(b.publishDate) - new Date(a.publishDate);
  });
  
  // 输出结果
  console.log('📝 筛选后的新闻列表:');
  console.log('==================');
  for (let i = 0; i < finalArticles.length; i++) {
    const article = finalArticles[i];
    const marker = article.isMajor ? '🔥' : '📄';
    console.log(`${marker} ${i + 1}. ${article.title}`);
    console.log(`   发布日期: ${article.publishDate}`);
    console.log(`   来源: ${article.source}`);
    console.log('');
  }
  
  // 输出JSON格式（供其他脚本使用）
  console.log('==================');
  console.log('📤 JSON 输出:');
  console.log(JSON.stringify(finalArticles.slice(0, 5), null, 2));
  
  return finalArticles;
}

// 执行
const articles = main();
process.exit(0);
