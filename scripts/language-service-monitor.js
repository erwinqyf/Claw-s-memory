#!/usr/bin/env node
/**
 * 语言服务行业监控追踪器
 * 监控全网语言服务行业相关方的新闻动态
 * 
 * 监控对象:
 * - 组织：Nimdzi, Slator, Multilingual
 * - 公司：TransPerfect, RWS, LanguageLine 等 (Nimdzi Top100)
 * 
 * 执行周期：每周二、四、六 12:00 AM (北京时间)
 * 交付形式：飞书云文档
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace');
const DATA_DIR = path.join(WORKSPACE_DIR, 'data');
const REPORTS_DIR = path.join(WORKSPACE_DIR, 'reports');

// 确保目录存在
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

// 监控配置
const MONITOR_CONFIG = {
  organizations: [
    {
      name: 'Nimdzi',
      url: 'https://www.nimdzi.com',
      rssOrNews: '/insights/', // 假设在 /insights/ 页面
      type: 'organization'
    },
    {
      name: 'Slator',
      url: 'https://slator.com',
      rssOrNews: '/news/',
      type: 'organization'
    },
    {
      name: 'Multilingual',
      url: 'https://multilingual.com',
      rssOrNews: '/blog/',
      type: 'organization'
    }
  ],
  companies: [
    { name: 'TransPerfect', url: 'https://www.transperfect.com', newsPath: '/news' },
    { name: 'RWS', url: 'https://www.rws.com', newsPath: '/news' },
    { name: 'LanguageLine Solutions', url: 'https://www.languageline.com', newsPath: '/news' },
    { name: 'Keywords Studios', url: 'https://www.keywordsstudios.com', newsPath: '/news' },
    { name: 'Iyuno', url: 'https://iyunugroup.com', newsPath: '/news' },
    { name: 'Appen', url: 'https://appen.com', newsPath: '/news' },
    { name: 'Translate Plus', url: 'https://www.translateplus.com', newsPath: '/news' },
    { name: 'Acolad Group', url: 'https://www.acolad.com', newsPath: '/news' },
    { name: 'Welocalize', url: 'https://www.welocalize.com', newsPath: '/news' },
    { name: 'Centific', url: 'https://centific.com', newsPath: '/news' },
    { name: 'EC Innovations', url: 'https://www.ecinnovations.com', newsPath: '/news' },
    { name: 'GienTech', url: 'https://www.gientech.com', newsPath: '/news' },
    { name: 'Sunyu Transphere', url: 'https://www.sunyu.com', newsPath: '/news' }
  ]
};

// HTTP GET 请求
function httpRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LanguageServiceMonitor/1.0)',
        'Accept': 'text/html,application/xhtml+xml'
      },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        }
      });
    }).on('error', reject);
  });
}

// 从 HTML 中提取新闻链接（简化版，实际需要更复杂的解析）
function extractNewsFromHTML(html, baseUrl) {
  const news = [];
  
  // 简单的正则匹配（实际应该用 cheerio 或 jsdom）
  const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let match;
  
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const text = match[2].trim();
    
    // 过滤出可能是新闻的链接
    if (text.length > 20 && text.length < 200 && 
        (url.includes('/news') || url.includes('/blog') || url.includes('/press'))) {
      news.push({
        title: text.replace(/<[^>]*>/g, ''),
        url: url.startsWith('http') ? url : new URL(url, baseUrl).href,
        date: new Date().toISOString().split('T')[0] // 实际应该从页面提取
      });
    }
  }
  
  return news.slice(0, 10); // 最多返回 10 条
}

// 加载上次抓取的数据
function loadLastCheck() {
  const statePath = path.join(DATA_DIR, 'language-service-monitor-state.json');
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
  } catch (err) {
    return { lastCheck: null, articles: [] };
  }
}

// 保存抓取状态
function saveState(state) {
  const statePath = path.join(DATA_DIR, 'language-service-monitor-state.json');
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

// 生成 Markdown 报告
function generateMarkdownReport(articles, timestamp) {
  const dateStr = timestamp.split('T')[0].replace(/-/g, '');
  const reportPath = path.join(REPORTS_DIR, `language-service-monitor-${dateStr}.md`);
  
  let report = `# 语言服务动态监控周报_${dateStr}\n\n`;
  report += `**生成时间:** ${timestamp}\n\n`;
  report += `**监控范围:** ${MONITOR_CONFIG.organizations.length} 个组织 + ${MONITOR_CONFIG.companies.length} 个公司\n\n`;
  report += `---\n\n`;
  
  // 按组织/公司分类
  const bySource = {};
  for (const article of articles) {
    if (!bySource[article.source]) bySource[article.source] = [];
    bySource[article.source].push(article);
  }
  
  for (const [source, sourceArticles] of Object.entries(bySource)) {
    report += `## ${source}\n\n`;
    
    for (const article of sourceArticles) {
      const isMajor = article.isMajor ? '【重点】' : '';
      report += `### ${isMajor} ${article.title}\n\n`;
      report += `${article.summary}\n\n`;
      report += `📅 发布日期：${article.date} | 🔗 [原文](${article.url})\n\n`;
      report += `---\n\n`;
    }
  }
  
  if (articles.length === 0) {
    report += `## 暂无更新\n\n`;
    report += `本次检查未发现新的新闻动态。\n\n`;
  }
  
  fs.writeFileSync(reportPath, report);
  return reportPath;
}

// 主流程
async function main() {
  console.log('🔍 语言服务行业监控追踪器');
  console.log('================================');
  console.log(`执行时间：${new Date().toISOString()}`);
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
      
      // 过滤出新文章
      const newNews = news.filter(n => 
        !lastState.articles.find(a => a.url === n.url)
      );
      
      for (const article of newNews) {
        newArticles.push({
          ...article,
          source: org.name,
          type: 'organization',
          summary: `${article.title} - 来自 ${org.name}`,
          isMajor: org.name === 'Nimdzi' || org.name === 'Slator' // 标记为重点
        });
      }
    } catch (err) {
      console.error(`  ❌ ${org.name} 抓取失败：${err.message}`);
    }
  }
  
  // 抓取公司新闻
  console.log('\n🏢 抓取公司新闻...');
  for (const company of MONITOR_CONFIG.companies) {
    try {
      console.log(`  - ${company.name}`);
      const newsUrl = company.url + (company.newsPath || '/news');
      const html = await httpRequest(newsUrl);
      const news = extractNewsFromHTML(html, company.url);
      
      const newNews = news.filter(n => 
        !lastState.articles.find(a => a.url === n.url)
      );
      
      for (const article of newNews) {
        newArticles.push({
          ...article,
          source: company.name,
          type: 'company',
          summary: `${article.title} - ${company.name} 最新动态`
        });
      }
    } catch (err) {
      console.error(`  ❌ ${company.name} 抓取失败：${err.message}`);
    }
  }
  
  console.log(`\n✅ 发现 ${newArticles.length} 条新动态`);
  
  // 生成报告
  if (newArticles.length > 0) {
    const timestamp = new Date().toISOString();
    const reportPath = generateMarkdownReport(newArticles, timestamp);
    console.log(`📝 报告已保存：${reportPath}`);
    
    // 更新状态
    const allArticles = [...lastState.articles, ...newArticles].slice(-100); // 保留最近 100 条
    saveState({
      lastCheck: timestamp,
      articles: allArticles
    });
    
    console.log('');
    console.log('================================');
    console.log('✅ 监控完成，发现新动态');
    console.log('');
    console.log('下一步：');
    console.log('  1. 审查生成的报告');
    console.log('  2. 发布到飞书云文档');
    console.log('  3. Git 提交并推送');
    console.log('');
  } else {
    console.log('');
    console.log('================================');
    console.log('✅ 监控完成，无新动态');
    console.log('');
  }
}

main().catch(err => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});
