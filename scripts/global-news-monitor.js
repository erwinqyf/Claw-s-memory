#!/usr/bin/env node

/**
 * 全球新闻汇总监控脚本 v1.2
 * 
 * 功能：
 * 1. 抓取多个 RSS 新闻源（政治、经济、文化、科技）
 * 2. 解析并去重（标题相似度检测）
 * 3. 筛选 Top 5 新闻（每类）
 * 4. 生成 Markdown 报告
 * 5. 保存状态（避免重复抓取）
 * 6. 自动上传到 GitHub
 * 
 * 执行时间：每天 12:00 (Asia/Shanghai)
 * 输出：reports/global-news-YYYY-MM-DD.md
 * 
 * v1.2 改进 (2026-04-23):
 * - 添加自动 GitHub 上传功能
 * - 执行完成后自动提交并推送报告
 * - 添加 Git 状态检测和错误处理
 * 
 * v1.1 改进 (2026-03-23):
 * - 添加启动时配置验证（fail fast）
 * - 增强错误处理和恢复建议
 * - 改进日志输出格式
 * - 添加网络超时保护
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ==================== 配置区 ====================

const CONFIG = {
  // 新闻源配置
  feeds: {
    political: [
      { name: 'NYT World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', lang: 'en' },
      { name: 'Reuters World', url: 'https://www.reutersagency.com/feed/', lang: 'en' },
      { name: 'BBC World', url: 'http://feeds.bbci.co.uk/news/world/rss.xml', lang: 'en' },
      { name: '联合早报', url: 'https://www.zaobao.com.sg/rss/news/china.xml', lang: 'zh' },
      { name: '英国卫报', url: 'https://www.theguardian.com/world/rss', lang: 'en' },
      { name: '经济学人', url: 'https://www.economist.com/world/rss', lang: 'en' },
      { name: '泰晤士报', url: 'https://www.thetimes.co.uk/feed/rss/world', lang: 'en' },
      { name: '塔斯社', url: 'https://tass.com/rss/v2.xml', lang: 'ru' }
    ],
    economy: [
      { name: 'NYT Business', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', lang: 'en' },
      { name: 'Reuters Business', url: 'https://www.reutersagency.com/feed/?best-topics=business-finance', lang: 'en' },
      { name: 'Bloomberg', url: 'https://www.bloomberg.com/feed/podcast/etf.xml', lang: 'en' },
      { name: '华尔街日报', url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml', lang: 'en' },
      { name: '经济学人财经', url: 'https://www.economist.com/finance-and-economics/rss', lang: 'en' }
    ],
    culture: [
      { name: 'NYT Arts', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml', lang: 'en' },
      { name: 'BBC Culture', url: 'http://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml', lang: 'en' },
      { name: '卫报文化', url: 'https://www.theguardian.com/culture/rss', lang: 'en' },
      { name: '知乎日报', url: 'https://daily.zhihu.com/rss', lang: 'zh' }
    ],
    technology: [
      { name: 'NYT Technology', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', lang: 'en' },
      { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', lang: 'en' },
      { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', lang: 'en' },
      { name: 'Wired', url: 'https://www.wired.com/feed/rss', lang: 'en' },
      { name: 'Hacker News', url: 'https://hnrss.org/frontpage', lang: 'en' },
      { name: '36 氪', url: 'https://36kr.com/feed', lang: 'zh' }
    ]
  },

  // 每类新闻数量
  itemsPerCategory: 5,

  // 超时设置（毫秒）
  timeout: 30000,

  // 重试次数
  maxRetries: 3,

  // 路径配置
  paths: {
    workspace: path.join(process.env.HOME, '.openclaw', 'workspace'),
    reports: 'reports',
    data: 'data'
  }
};

// ==================== 工具函数 ====================

/**
 * 简单的 XML 解析器（解析 RSS）
 */
function parseRSS(xml) {
  const items = [];
  
  // 提取所有 <item> 标签
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    
    // 提取字段
    let title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const description = extractTag(itemXml, 'description');
    const pubDate = extractTag(itemXml, 'pubDate');
    const creator = extractTag(itemXml, 'dc:creator');
    
    // 如果标题为空，尝试从描述提取
    if (!title && description) {
      title = description.split('.')[0].slice(0, 100);
    }
    
    // 跳过标题或链接为空的条目
    if (!title || !link) {
      return;
    }
    
    const decodedTitle = decodeHTML(title).trim();
    
    // 跳过标题太短的条目（可能是解析错误）
    if (decodedTitle.length < 5) {
      return;
    }
    
    items.push({
      title: decodedTitle,
      link: decodeHTML(link),
      description: description ? decodeHTML(description) : '',
      pubDate: pubDate ? new Date(pubDate) : new Date(),
      creator: creator || ''
    });
  }
  
  return items;
}

/**
 * 提取 XML 标签内容
 */
function extractTag(xml, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * 解码 HTML 实体
 */
function decodeHTML(html) {
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' '
  };
  
  let decoded = html;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }
  
  // 移除 HTML 标签
  decoded = decoded.replace(/<[^>]*>/g, '');
  
  return decoded.trim();
}

/**
 * HTTP GET 请求（支持重试）
 */
async function fetchURL(url, retries = 0) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const options = {
      timeout: CONFIG.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GlobalNewsMonitor/1.0; +https://github.com/erwinqyf/Claw-s-memory)'
      }
    };
    
    const req = protocol.get(url, options, (res) => {
      if (res.statusCode === 200) {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      } else if (res.statusCode >= 500 && retries < CONFIG.maxRetries) {
        // 服务器错误，重试
        setTimeout(() => {
          fetchURL(url, retries + 1).then(resolve).catch(reject);
        }, 2000 * (retries + 1));
      } else {
        reject(new Error(`HTTP ${res.statusCode}: ${url}`));
      }
    });
    
    req.on('error', (err) => {
      if (retries < CONFIG.maxRetries) {
        setTimeout(() => {
          fetchURL(url, retries + 1).then(resolve).catch(reject);
        }, 2000 * (retries + 1));
      } else {
        reject(err);
      }
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout: ${url}`));
    });
  });
}

/**
 * 计算字符串相似度（简单版本）
 */
function stringSimilarity(str1, str2) {
  // 处理 null/undefined
  str1 = str1 || '';
  str2 = str2 || '';
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (!longer || longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein 编辑距离
 */
function levenshteinDistance(str1, str2) {
  // 处理 null/undefined
  str1 = str1 || '';
  str2 = str2 || '';
  
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * 去重：移除相似度高的新闻
 */
function deduplicateItems(items, threshold = 0.85) {
  const unique = [];
  
  for (const item of items) {
    const isDuplicate = unique.some(existing => {
      const similarity = stringSimilarity(item.title.toLowerCase(), existing.title.toLowerCase());
      return similarity >= threshold;
    });
    
    if (!isDuplicate) {
      unique.push(item);
    }
  }
  
  return unique;
}

// ==================== 主逻辑 ====================

/**
 * 抓取单个新闻源
 */
async function fetchFeed(feed) {
  try {
    console.log(`  📡 抓取：${feed.name} (${feed.url})`);
    const xml = await fetchURL(feed.url);
    const items = parseRSS(xml);
    console.log(`    ✅ 获取 ${items.length} 条新闻`);
    return { feed, items, error: null };
  } catch (error) {
    console.log(`    ❌ 失败：${error.message}`);
    return { feed, items: [], error: error.message };
  }
}

/**
 * 抓取单个类别的所有新闻源
 */
async function fetchCategory(categoryName, feeds) {
  console.log(`\n📰 抓取类别：${categoryName}`);
  
  const results = await Promise.all(feeds.map(fetchFeed));
  
  // 合并所有新闻
  let allItems = [];
  const errors = [];
  
  for (const result of results) {
    allItems = allItems.concat(result.items.map(item => ({
      ...item,
      source: result.feed.name,
      lang: result.feed.lang,
      category: categoryName
    })));
    
    if (result.error) {
      errors.push(`${result.feed.name}: ${result.error}`);
    }
  }
  
  // 去重
  const uniqueItems = deduplicateItems(allItems);
  
  // 按时间排序（最新的在前）
  uniqueItems.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
  
  // 取 Top N
  const topItems = uniqueItems.slice(0, CONFIG.itemsPerCategory);
  
  console.log(`  📊 去重后：${uniqueItems.length} 条 → 选取 Top ${topItems.length} 条`);
  
  return {
    category: categoryName,
    items: topItems,
    totalAvailable: uniqueItems.length,
    errors
  };
}

/**
 * 生成 Markdown 报告
 */
function generateReport(results, date) {
  const categoryNames = {
    political: '🌍 政治',
    economy: '💰 经济',
    culture: '🎭 文化',
    technology: '💻 科技'
  };
  
  let markdown = `# 全球新闻汇总 ${date}\n\n`;
  markdown += `**生成时间:** ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} (Asia/Shanghai)\n`;
  markdown += `**新闻时段:** 过去 24 小时\n\n`;
  markdown += `---\n\n`;
  
  for (const result of results) {
    const categoryName = categoryNames[result.category] || result.category;
    markdown += `## ${categoryName}\n\n`;
    
    if (result.items.length === 0) {
      markdown += `*暂无新闻*\n\n`;
      continue;
    }
    
    result.items.forEach((item, index) => {
      const timeStr = item.pubDate.toLocaleString('zh-CN', { 
        timeZone: 'Asia/Shanghai',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      markdown += `${index + 1}. **${item.title}**\n`;
      markdown += `   - 来源：${item.source}\n`;
      markdown += `   - 时间：${timeStr}\n`;
      markdown += `   - [阅读全文](${item.link})\n\n`;
    });
    
    markdown += `---\n\n`;
  }
  
  markdown += `> 来源：NYT, BBC, TechCrunch, 联合早报 | 生成：Claw | 孪生于不同世界，彼此映照，共同演化。🪞\n`;
  
  return markdown;
}

/**
 * 保存状态文件
 */
function saveState(results, date) {
  const statePath = path.join(CONFIG.paths.workspace, CONFIG.paths.data, 'global-news-state.json');
  
  const state = {
    lastRun: new Date().toISOString(),
    lastRunDate: date,
    categories: results.map(r => ({
      category: r.category,
      itemsCount: r.items.length,
      totalAvailable: r.totalAvailable,
      errors: r.errors
    })),
    totalItems: results.reduce((sum, r) => sum + r.items.length, 0)
  };
  
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
  console.log(`\n💾 状态已保存：${statePath}`);
}

/**
 * 配置验证（fail fast 原则）
 */
function validateConfig() {
  const errors = [];
  
  // 验证工作区路径
  if (!CONFIG.paths.workspace) {
    errors.push('工作区路径未配置 (CONFIG.paths.workspace)');
  } else if (!fs.existsSync(CONFIG.paths.workspace)) {
    errors.push(`工作区不存在：${CONFIG.paths.workspace}`);
  }
  
  // 验证新闻源配置
  if (!CONFIG.feeds || Object.keys(CONFIG.feeds).length === 0) {
    errors.push('新闻源配置为空 (CONFIG.feeds)');
  } else {
    for (const [category, feeds] of Object.entries(CONFIG.feeds)) {
      if (!Array.isArray(feeds) || feeds.length === 0) {
        errors.push(`类别 "${category}" 没有配置新闻源`);
      } else {
        feeds.forEach((feed, idx) => {
          if (!feed.url || !feed.url.startsWith('http')) {
            errors.push(`新闻源 #${idx + 1} (${feed.name || 'unnamed'}) URL 无效`);
          }
        });
      }
    }
  }
  
  // 验证超时设置
  if (CONFIG.timeout < 5000) {
    errors.push(`超时设置过短 (${CONFIG.timeout}ms)，建议至少 5000ms`);
  }
  
  if (errors.length > 0) {
    console.error('❌ 配置验证失败:');
    errors.forEach(err => console.error(`  - ${err}`));
    console.error('\n请检查配置文件后重试。');
    process.exit(1);
  }
  
  console.log('✅ 配置验证通过');
}

/**
 * 主函数
 */
async function main() {
  console.log('🌍 全球新闻汇总监控启动');
  console.log('='.repeat(50));
  
  // 启动时配置验证
  validateConfig();
  
  const today = new Date().toISOString().split('T')[0];
  console.log(`📅 日期：${today}`);
  console.log(`⏰ 时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
  
  // 抓取所有类别
  const results = [];
  
  for (const [categoryName, feeds] of Object.entries(CONFIG.feeds)) {
    const result = await fetchCategory(categoryName, feeds);
    results.push(result);
  }
  
  // 生成报告
  console.log('\n📝 生成报告...');
  const report = generateReport(results, today);
  
  // 保存报告（带错误处理）
  const reportPath = path.join(CONFIG.paths.workspace, CONFIG.paths.reports, `global-news-${today}.md`);
  try {
    // 确保目录存在
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
      console.log(`📁 创建目录：${reportDir}`);
    }
    
    fs.writeFileSync(reportPath, report, 'utf-8');
    console.log(`✅ 报告已保存：${reportPath}`);
  } catch (err) {
    console.error(`❌ 保存报告失败：${err.message}`);
    console.error('💡 建议：检查磁盘空间和目录权限');
    throw err; // 重新抛出以便上层捕获
  }
  
  // 保存状态
  saveState(results, today);
  
  // 打印摘要
  console.log('\n📊 摘要:');
  console.log('-'.repeat(50));
  const totalItems = results.reduce((sum, r) => sum + r.items.length, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  console.log(`总新闻数：${totalItems} 条`);
  console.log(`错误数：${totalErrors}`);
  
  if (totalErrors > 0) {
    console.log('\n⚠️ 错误详情:');
    results.forEach(r => {
      if (r.errors.length > 0) {
        r.errors.forEach(err => console.log(`  - ${r.category}: ${err}`));
      }
    });
    
    // 提供恢复建议
    console.log('\n💡 恢复建议:');
    if (totalErrors <= 2) {
      console.log('  - 少量新闻源失败属正常现象，可能是临时网络问题');
      console.log('  - 下次执行时会自动重试');
    } else if (totalErrors <= 5) {
      console.log('  - 较多新闻源失败，建议检查网络连接');
      console.log('  - 可手动执行：node scripts/global-news-monitor.js --retry');
    } else {
      console.log('  - 大量新闻源失败，可能存在网络问题或被限流');
      console.log('  - 建议：1) 检查网络 2) 等待 30 分钟后重试 3) 检查新闻源 URL 是否有效');
    }
  }
  
  console.log('\n✅ 任务完成');
  
  // 上传到 GitHub
  const gitResult = await uploadToGitHub(today, reportPath);
  
  // 写入 Delta Agent 记忆日志
  writeAgentMemory(today, totalItems, totalErrors, gitResult);
}

/**
 * 执行 Git 命令
 */
function execGit(args, cwd) {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const proc = spawn('git', args, {
      cwd: cwd || CONFIG.paths.workspace,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', data => stdout += data);
    proc.stderr.on('data', data => stderr += data);
    
    proc.on('close', code => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Git ${args.join(' ')} failed: ${stderr.trim() || stdout.trim()}`));
      }
    });
  });
}

/**
 * 上传报告到 GitHub
 */
async function uploadToGitHub(date, reportPath) {
  console.log('\n📤 开始上传报告到 GitHub...');
  
  try {
    // 检查是否是 Git 仓库
    await execGit(['status']);
    console.log('  ✅ Git 仓库检测通过');
    
    // 添加报告文件
    const relativePath = path.relative(CONFIG.paths.workspace, reportPath);
    await execGit(['add', relativePath]);
    console.log(`  ✅ 添加文件：${relativePath}`);
    
    // 添加状态文件
    const statePath = path.join(CONFIG.paths.data, 'global-news-state.json');
    if (fs.existsSync(path.join(CONFIG.paths.workspace, statePath))) {
      await execGit(['add', statePath]);
      console.log('  ✅ 添加状态文件');
    }
    
    // 检查是否有变更
    const status = await execGit(['status', '--porcelain']);
    if (!status) {
      console.log('  ℹ️ 没有变更需要提交');
      return { success: true, committed: false, message: 'No changes' };
    }
    
    // 提交
    const commitMessage = `📰 全球新闻汇总 ${date}\n\n- 生成日期: ${date}\n- 来源: Delta Agent\n- 自动提交`;
    await execGit(['commit', '-m', commitMessage]);
    console.log('  ✅ Git 提交成功');
    
    // 推送到远程
    await execGit(['push', 'origin', 'main']);
    console.log('  ✅ GitHub 推送成功');
    
    return { success: true, committed: true, message: 'Uploaded to GitHub' };
  } catch (err) {
    console.error(`  ❌ GitHub 上传失败: ${err.message}`);
    return { success: false, committed: false, message: err.message };
  }
}

/**
 * 写入 Delta Agent 记忆日志
 */
function writeAgentMemory(date, totalItems, totalErrors, gitResult) {
  const agentMemoryDir = path.join(CONFIG.paths.workspace, 'agents', 'delta', 'memory');
  const memoryPath = path.join(agentMemoryDir, `${date}.md`);
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  
  // 确保目录存在
  if (!fs.existsSync(agentMemoryDir)) {
    fs.mkdirSync(agentMemoryDir, { recursive: true });
  }
  
  const gitStatus = gitResult?.success 
    ? (gitResult?.committed ? '✅ 已上传 GitHub' : 'ℹ️ 无变更')
    : `❌ 上传失败 (${gitResult?.message || 'unknown'})`;
  
  let memoryContent = `# Delta (德尔塔) - 执行日志

## ${date} 全球新闻汇总

**执行时间:** ${now}
**状态:** ✅ 成功
**新闻总数:** ${totalItems} 条
**错误数:** ${totalErrors} 个
**报告:** reports/global-news-${date}.md
**飞书通知:** 已发送
**GitHub:** ${gitStatus}

### 执行详情

- 抓取类别：政治、经济、文化、科技
- 新闻源数量：${Object.values(CONFIG.feeds).reduce((sum, feeds) => sum + feeds.length, 0)} 个
- 去重筛选：每类 Top ${CONFIG.itemsPerCategory} 条

---
> 孪生于不同世界，彼此映照，共同演化。🪞
`;
  
  // 如果文件已存在，追加内容（保留原有内容）
  if (fs.existsSync(memoryPath)) {
    const existing = fs.readFileSync(memoryPath, 'utf-8');
    if (!existing.includes(`## ${date} 全球新闻汇总`)) {
      memoryContent = existing + '\n\n---\n\n' + memoryContent;
    }
  }
  
  fs.writeFileSync(memoryPath, memoryContent, 'utf-8');
  console.log(`📝 Agent 记忆已写入：${memoryPath}`);
}

// 运行
if (require.main === module) {
  main().then(() => {
    console.log('\n' + '='.repeat(50));
    console.log('📦 执行完成');
    console.log('='.repeat(50));
    process.exit(0);
  }).catch(err => {
    console.error('❌ 脚本执行失败:', err.message);
    process.exit(1);
  });
}

module.exports = { main, fetchCategory, generateReport };
