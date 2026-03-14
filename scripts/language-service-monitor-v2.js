#!/usr/bin/env node
/**
 * 语言服务行业监控追踪器 v2.0
 * 
 * 增强功能：
 * - summarize: 智能摘要生成
 * - proactive-agent: 主动发现和推送
 * - self-improving: 从错误中学习优化
 * 
 * 执行周期：每周二、四、六 11:00 AM (北京时间)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace');
const DATA_DIR = path.join(WORKSPACE_DIR, 'data');
const REPORTS_DIR = path.join(WORKSPACE_DIR, 'reports');
const SELF_IMPROVING_DIR = path.join(WORKSPACE_DIR, 'self-improving', 'language-monitor');

// 确保目录存在
[DATA_DIR, REPORTS_DIR, SELF_IMPROVING_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ==================== Self-Improving: 学习记录 ====================

const LEARNING_LOG_PATH = path.join(SELF_IMPROVING_DIR, 'learning-log.md');

function loadLearningLog() {
  try {
    const content = fs.readFileSync(LEARNING_LOG_PATH, 'utf-8');
    const lines = content.split('\n');
    const learning = {
      failedSites: [],
      successfulPatterns: [],
      optimizationNotes: []
    };
    
    let currentSection = null;
    for (const line of lines) {
      if (line.includes('## 失败网站')) currentSection = 'failedSites';
      else if (line.includes('## 成功模式')) currentSection = 'successfulPatterns';
      else if (line.includes('## 优化建议')) currentSection = 'optimizationNotes';
      else if (line.startsWith('- ') && currentSection) {
        learning[currentSection].push(line.slice(2));
      }
    }
    
    return learning;
  } catch (err) {
    return { failedSites: [], successfulPatterns: [], optimizationNotes: [] };
  }
}

function saveLearning(learning) {
  let content = `# 语言服务监控 - 自我学习日志\n\n`;
  content += `**最后更新:** ${new Date().toISOString()}\n\n`;
  
  content += `## 失败网站\n\n`;
  for (const site of learning.failedSites) {
    content += `- ${site}\n`;
  }
  
  content += `\n## 成功模式\n\n`;
  for (const pattern of learning.successfulPatterns) {
    content += `- ${pattern}\n`;
  }
  
  content += `\n## 优化建议\n\n`;
  for (const note of learning.optimizationNotes) {
    content += `- ${note}\n`;
  }
  
  fs.writeFileSync(LEARNING_LOG_PATH, content);
}

function recordFailure(siteName, error) {
  const learning = loadLearningLog();
  const entry = `${siteName}: ${error} (${new Date().toISOString()})`;
  if (!learning.failedSites.includes(entry)) {
    learning.failedSites.push(entry);
    saveLearning(learning);
  }
}

function recordSuccess(siteName, pattern) {
  const learning = loadLearningLog();
  if (!learning.successfulPatterns.includes(pattern)) {
    learning.successfulPatterns.push(pattern);
    saveLearning(learning);
  }
}

// ==================== Summarize: 智能摘要（doc-summarize-pro） ====================

function summarizeContent(url, title, htmlContent = "") {
  try {
    const summarizeScript = path.join(WORKSPACE_DIR, 'scripts', 'doc-summarize.sh');
    
    // 如果有 HTML 内容，用 bullet 模式提取要点
    if (htmlContent && htmlContent.length > 100) {
      // 清理 HTML 标签，提取文本
      const text = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      
      // 调用 doc-summarize-pro 生成摘要
      const cmd = `bash "${summarizeScript}" bullet "${text.slice(0, 2000)}" 2>&1`;
      const summary = execSync(cmd, { encoding: 'utf-8', timeout: 15000, maxBuffer: 10 * 1024 * 1024 });
      
      // 提取摘要内容（去掉头部和尾部装饰）
      const lines = summary.split('\n').filter(l => l.trim() && !l.includes('===') && !l.includes('Powered by'));
      const keyPoints = lines.filter(l => l.match(/^\s*\d+\./)).slice(0, 3);
      
      if (keyPoints.length > 0) {
        return keyPoints.map(l => l.replace(/^\s*\d+\.\s*/, '')).join(' ');
      }
    }
    
    // 备用摘要
    return `${title} - 更多内容请访问原文链接`;
  } catch (err) {
    console.log(`    ⚠️ 摘要生成失败：${err.message}`);
    return `${title} - 更多内容请访问原文链接`;
  }
}

// ==================== Proactive Agent: 主动发现 ====================

function detectEmergingCompanies(articles) {
  // 主动发现新兴公司（出现在多条新闻中）
  const companyMentions = {};
  for (const article of articles) {
    // 简单关键词匹配（实际应该用 NLP）
    const keywords = ['AI', 'machine learning', 'neural', 'LLM', 'generative'];
    for (const kw of keywords) {
      if (article.title.toLowerCase().includes(kw.toLowerCase())) {
        companyMentions[article.source] = (companyMentions[article.source] || 0) + 1;
      }
    }
  }
  
  // 返回高相关度的公司
  return Object.entries(companyMentions)
    .filter(([_, count]) => count >= 2)
    .map(([company, count]) => ({ company, count, reason: 'AI/ML 相关度高' }));
}

function prioritizeArticles(articles, learning) {
  // 根据学习记录优化优先级
  return articles.map(article => {
    let priority = 'normal';
    
    // 重点来源
    if (['Nimdzi', 'Slator'].includes(article.source)) {
      priority = 'high';
    }
    
    // 避免频繁失败的网站
    const hasRecentFailures = learning.failedSites.some(f => 
      f.includes(article.source) && f.includes(new Date().toISOString().split('T')[0])
    );
    if (hasRecentFailures) {
      priority = 'low';
    }
    
    return { ...article, priority };
  });
}

// ==================== 监控配置 ====================

const MONITOR_CONFIG = {
  organizations: [
    { name: 'Nimdzi', url: 'https://www.nimdzi.com', rssOrNews: '/insights/', type: 'organization', priority: 'high' },
    { name: 'Slator', url: 'https://slator.com', rssOrNews: '/news/', type: 'organization', priority: 'high' },
    { name: 'Multilingual', url: 'https://multilingual.com', rssOrNews: '/blog/', type: 'organization', priority: 'medium' }
  ],
  companies: [
    // Top 10
    { name: 'TransPerfect', url: 'https://www.transperfect.com', newsPath: '/news' },
    { name: 'RWS', url: 'https://www.rws.com', newsPath: '/news' },
    { name: 'DeepL', url: 'https://www.deepl.com', newsPath: '/blog' },
    { name: 'Smartling', url: 'https://www.smartling.com', newsPath: '/blog' },
    { name: 'Rask AI', url: 'https://www.rask.ai', newsPath: '/blog' },
    { name: 'Lilt', url: 'https://lilt.com', newsPath: '/blog' }
  ]
};

// ==================== 主流程 ====================

async function main() {
  console.log('🔍 语言服务行业监控追踪器 v2.0');
  console.log('================================');
  console.log(`执行时间：${new Date().toISOString()}`);
  console.log('');
  
  // 加载学习记录
  const learning = loadLearningLog();
  console.log(`📚 已加载 ${learning.failedSites.length} 条失败记录`);
  console.log(`📚 已加载 ${learning.successfulPatterns.length} 条成功模式`);
  console.log('');
  
  const lastState = loadLastCheck();
  const newArticles = [];
  
  // 抓取组织网站
  console.log('📰 抓取组织网站...');
  for (const org of MONITOR_CONFIG.organizations) {
    try {
      console.log(`  - ${org.name} (${org.url})`);
      const html = await httpRequest(org.url + org.rssOrNews);
      const news = extractNewsFromHTML(html, org.url);
      
      const newNews = news.filter(n => !lastState.articles.find(a => a.url === n.url));
      
      for (const article of newNews) {
        // 使用 summarize 生成智能摘要
        console.log(`    🧾 生成摘要...`);
        const summary = summarizeContent(article.url, article.title);
        
        newArticles.push({
          ...article,
          source: org.name,
          type: 'organization',
          summary: summary,
          isMajor: org.priority === 'high',
          priority: org.priority
        });
      }
      
      recordSuccess(org.name, `成功抓取 ${org.rssOrNews}`);
    } catch (err) {
      console.log(`  ❌ ${org.name} 抓取失败：${err.message}`);
      recordFailure(org.name, err.message);
    }
  }
  
  // 抓取公司新闻
  console.log('');
  console.log('🏢 抓取公司新闻...');
  for (const company of MONITOR_CONFIG.companies) {
    try {
      console.log(`  - ${company.name}`);
      const html = await httpRequest(company.url + company.newsPath);
      const news = extractNewsFromHTML(html, company.url);
      
      const newNews = news.filter(n => !lastState.articles.find(a => a.url === n.url));
      
      for (const article of newNews) {
        const summary = summarizeContent(article.url, article.title);
        newArticles.push({
          ...article,
          source: company.name,
          type: 'company',
          summary: summary,
          priority: 'normal'
        });
      }
      
      recordSuccess(company.name, `成功抓取 ${company.newsPath}`);
    } catch (err) {
      console.log(`  ❌ ${company.name} 抓取失败：${err.message}`);
      recordFailure(company.name, err.message);
    }
  }
  
  // Proactive Agent: 主动发现新兴公司
  console.log('');
  console.log('🔮 Proactive Agent: 分析趋势...');
  const emergingCompanies = detectEmergingCompanies(newArticles);
  if (emergingCompanies.length > 0) {
    console.log(`  ✨ 发现 ${emergingCompanies.length} 家高相关度公司:`);
    for (const c of emergingCompanies) {
      console.log(`    - ${c.company} (${c.count} 条 AI/ML 相关新闻)`);
    }
  }
  
  // 优先级排序
  const prioritizedArticles = prioritizeArticles(newArticles, learning);
  
  // 保存状态
  const newState = {
    lastCheck: new Date().toISOString(),
    articles: [...lastState.articles, ...newArticles].slice(-100) // 保留最近 100 条
  };
  saveState(newState);
  
  // 生成报告
  if (newArticles.length > 0) {
    console.log('');
    console.log(`✅ 发现 ${newArticles.length} 条新动态`);
    const reportPath = generateMarkdownReport(prioritizedArticles, newState.lastCheck);
    console.log(`📝 报告已保存：${reportPath}`);
    
    // 输出 emerging companies 到报告
    if (emergingCompanies.length > 0) {
      fs.appendFileSync(reportPath, `\n## 🔮 趋势发现\n\n`);
      fs.appendFileSync(reportPath, `以下公司展现出较高的 AI/ML 相关度：\n\n`);
      for (const c of emergingCompanies) {
        fs.appendFileSync(reportPath, `- **${c.company}**: ${c.count} 条相关新闻 (${c.reason})\n`);
      }
    }
  } else {
    console.log('');
    console.log('✅ 监控完成，无新动态');
  }
  
  console.log('');
  console.log('================================');
  console.log('✅ v2.0 监控完成');
}

// 辅助函数（从 v1 继承）
function httpRequest(url, followRedirect = true) {
  const https = require('https');
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LanguageServiceMonitor/2.0)' },
      timeout: 10000
    }, (res) => {
      if ([301, 302, 308].includes(res.statusCode) && followRedirect && res.headers.location) {
        httpRequest(res.headers.location, false).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => res.statusCode === 200 ? resolve(data) : reject(new Error(`HTTP ${res.statusCode}`)));
    }).on('error', reject);
  });
}

function extractNewsFromHTML(html, baseUrl) {
  const news = [];
  const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const text = match[2].trim();
    if (text.length > 20 && text.length < 200) {
      news.push({
        title: text.replace(/<[^>]*>/g, ''),
        url: url.startsWith('http') ? url : new URL(url, baseUrl).href,
        date: new Date().toISOString().split('T')[0]
      });
    }
  }
  return news.slice(0, 10);
}

function loadLastCheck() {
  const statePath = path.join(DATA_DIR, 'language-service-monitor-state.json');
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
  } catch (err) {
    return { lastCheck: null, articles: [] };
  }
}

function saveState(state) {
  const statePath = path.join(DATA_DIR, 'language-service-monitor-state.json');
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function generateMarkdownReport(articles, timestamp) {
  const dateStr = timestamp.split('T')[0].replace(/-/g, '');
  const reportPath = path.join(REPORTS_DIR, `language-service-monitor-${dateStr}-v2.md`);
  
  let report = `# 语言服务动态监控周报_${dateStr} (v2.0 增强版)\n\n`;
  report += `**生成时间:** ${timestamp}\n\n`;
  report += `**增强功能:** summarize 智能摘要 + proactive-agent 趋势发现 + self-improving 学习优化\n\n`;
  report += `---\n\n`;
  
  const byPriority = { high: [], normal: [], low: [] };
  for (const article of articles) {
    byPriority[article.priority || 'normal'].push(article);
  }
  
  for (const [priority, sourceArticles] of Object.entries(byPriority)) {
    if (sourceArticles.length === 0) continue;
    
    const icon = priority === 'high' ? '🔥' : priority === 'low' ? '⚪' : '📄';
    report += `## ${icon} ${priority === 'high' ? '重点' : priority === 'low' ? '低优先级' : '普通'}动态\n\n`;
    
    for (const article of sourceArticles) {
      report += `### ${article.title}\n\n`;
      report += `${article.summary}\n\n`;
      report += `📅 发布日期：${article.date} | 🔗 [原文](${article.url}) | 📍 来源：${article.source}\n\n`;
      report += `---\n\n`;
    }
  }
  
  fs.writeFileSync(reportPath, report);
  return reportPath;
}

main().catch(console.error);
