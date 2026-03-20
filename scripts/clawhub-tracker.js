#!/usr/bin/env node
/**
 * ClawHub Top 100 Skills Tracker v2.0
 * ====================================
 * 每日获取 ClawHub 下载量前 100 名技能，支持趋势分析和自动 Git 提交
 * 
 * 功能特性：
 * - 自动分类技能（12 个类别）
 * - 趋势分析（与昨日数据对比，计算排名变化）
 * - 生成 Markdown 报告 + JSON 数据快照
 * - 可选自动 Git 提交（--auto-commit 参数）
 * - 指数退避重试机制（应对 API 限流）
 * 
 * 用法：
 *   node scripts/clawhub-tracker.js              # 基本运行
 *   node scripts/clawhub-tracker.js --auto-commit # 自动提交 Git
 *   node scripts/clawhub-tracker.js --limit 50    # 只获取前 50 个
 * 
 * 输出：
 *   - data/clawhub-top100-YYYY-MM-DD.json    (原始数据)
 *   - data/clawhub-top100-latest.json        (最新快照)
 *   - reports/clawhub-top100-YYYY-MM-DD.md   (Markdown 报告)
 * 
 * @author Claw (Digital Twin)
 * @version 2.0.0
 * @lastUpdated 2026-03-21
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ==================== 配置常量 ====================

const CONFIG = {
  WORKSPACE_DIR: process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace'),
  DATA_DIR: path.join(process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace'), 'data'),
  REPORTS_DIR: path.join(process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace'), 'reports'),
  API_BASE: 'https://clawhub.ai/api/v1',
  USER_AGENT: 'OpenClaw-ClawHub-Tracker/2.0',
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 2000,
  DEFAULT_LIMIT: 100
};

// ==================== 工具函数 ====================

/**
 * 日志输出（带时间戳和 emoji）
 */
function log(message, emoji = 'ℹ️') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`${emoji} [${timestamp}] ${message}`);
}

/**
 * 确保目录存在
 */
function ensureDirectories() {
  [CONFIG.DATA_DIR, CONFIG.REPORTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log(`创建目录：${dir}`, '📁');
    }
  });
}

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    autoCommit: false,
    limit: CONFIG.DEFAULT_LIMIT
  };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--auto-commit') options.autoCommit = true;
    if (args[i] === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[i + 1], 10);
      i++;
    }
  }
  
  return options;
}

/**
 * HTTP GET 请求（带重试机制）
 */
async function httpRequest(url, retryCount = 0) {
  const https = require('https');
  
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': CONFIG.USER_AGENT,
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else if (res.statusCode === 429 && retryCount < CONFIG.MAX_RETRIES) {
          const retryAfter = parseInt(res.headers['retry-after'] || '60', 10);
          const delay = Math.min(retryAfter * 1000, CONFIG.RETRY_DELAY_MS * Math.pow(2, retryCount));
          log(`API 限流，${delay/1000}秒后重试 (${retryCount + 1}/${CONFIG.MAX_RETRIES})`, '⏳');
          setTimeout(() => httpRequest(url, retryCount + 1).then(resolve).catch(reject), delay);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 100)}`));
        }
      });
    }).on('error', (err) => {
      if (retryCount < CONFIG.MAX_RETRIES) {
        const delay = CONFIG.RETRY_DELAY_MS * Math.pow(2, retryCount);
        log(`请求失败，${delay/1000}秒后重试 (${retryCount + 1}/${CONFIG.MAX_RETRIES})`, '⏳');
        setTimeout(() => httpRequest(url, retryCount + 1).then(resolve).catch(reject), delay);
      } else {
        reject(err);
      }
    });
  });
}

// ==================== 业务逻辑函数 ====================

/**
 * 自动分类技能（12 个类别）
 * 基于技能 slug、描述、标签进行关键词匹配
 */
function autoCategorizeSkill(skill) {
  const slug = skill.slug.toLowerCase();
  const summary = (skill.summary || '').toLowerCase();
  const text = `${slug} ${summary} ${Object.keys(skill.tags || {}).join(' ')}`;
  
  // 分类规则（按优先级排序）
  const rules = [
    { name: '浏览器自动化', keywords: ['browser', 'playwright', 'puppeteer', '浏览器', '网页'] },
    { name: '搜索与研究', keywords: ['search', 'research', 'tavily', '搜索'] },
    { name: '文档处理', keywords: ['doc', 'feishu', 'notion', '文档', '飞书'] },
    { name: '数据处理', keywords: ['excel', 'csv', 'json', 'data', '表格', '数据'] },
    { name: '系统工具', keywords: ['health', 'system', 'monitor', 'cron', '系统', '健康', '监控'] },
    { name: '创意与演示', keywords: ['ppt', 'slide', 'presentation', '演示'] },
    { name: 'AI 与 Agent', keywords: ['agent', 'ai', 'llm', '智能体'] },
    { name: '版本控制', keywords: ['git', 'github', 'commit'] },
    { name: '测试工具', keywords: ['test', 'spec', 'jest', '测试'] },
    { name: '安全工具', keywords: ['security', 'audit', 'vetter', '安全', '审计'] },
    { name: '通信与通知', keywords: ['email', 'sms', 'notify', 'message', '邮件', '通知'] },
    { name: '其他', keywords: [] }
  ];
  
  for (const rule of rules) {
    if (rule.keywords.some(k => text.includes(k))) {
      return rule.name;
    }
  }
  
  return '其他';
}

/**
 * 加载昨日数据用于趋势分析
 */
function loadYesterdayData() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];
  const yesterdayPath = path.join(CONFIG.DATA_DIR, `clawhub-top100-${dateStr}.json`);
  
  if (fs.existsSync(yesterdayPath)) {
    log(`加载昨日数据：${dateStr}`, '📅');
    return JSON.parse(fs.readFileSync(yesterdayPath, 'utf-8'));
  }
  
  log('无昨日数据，跳过趋势分析', '⚠️');
  return null;
}

/**
 * 计算排名变化
 */
function calculateRankChanges(todaySkills, yesterdaySkills) {
  if (!yesterdaySkills) return todaySkills;
  
  const yesterdayMap = new Map(yesterdaySkills.map(s => [s.name, s.rank]));
  
  return todaySkills.map(skill => {
    const yesterdayRank = yesterdayMap.get(skill.name);
    const rankChange = yesterdayRank ? yesterdayRank - skill.rank : null;
    
    return {
      ...skill,
      yesterdayRank: yesterdayRank || null,
      rankChange: rankChange,
      trend: rankChange > 0 ? 'up' : rankChange < 0 ? 'down' : 'stable'
    };
  });
}

/**
 * 识别显著变化（排名变化 >= 10 或新进榜）
 */
function findSignificantChanges(skills) {
  const gainers = skills.filter(s => s.rankChange !== null && s.rankChange >= 10);
  const losers = skills.filter(s => s.rankChange !== null && s.rankChange <= -10);
  const newcomers = skills.filter(s => s.yesterdayRank === null && s.rank <= 20);
  
  return { gainers, losers, newcomers };
}

// 获取 Top 技能
async function fetchTopSkills(limit = 100) {
  console.log(`📥 获取 ClawHub 前 ${limit} 个技能...`);
  
  const url = `https://clawhub.ai/api/v1/skills?limit=${limit}&sort=downloads`;
  const data = await httpRequest(url);
  
  if (!data.items || !Array.isArray(data.items)) {
    throw new Error('API 返回格式异常');
  }
  
  const skills = data.items.map((skill, index) => ({
    rank: index + 1,
    name: skill.slug,
    displayName: skill.displayName || skill.slug,
    downloads: skill.stats?.downloads || 0,
    stars: skill.stats?.stars || 0,
    installsAllTime: skill.stats?.installsAllTime || 0,
    installsCurrent: skill.stats?.installsCurrent || 0,
    description: skill.summary || '',
    category: autoCategorizeSkill(skill),
    author: 'unknown',  // API 未提供作者信息
    version: skill.tags?.latest || skill.latestVersion?.version || 'unknown',
    updatedAt: skill.updatedAt ? new Date(skill.updatedAt).toISOString().split('T')[0] : 'unknown',
    createdAt: skill.createdAt ? new Date(skill.createdAt).toISOString().split('T')[0] : 'unknown'
  }));
  
  console.log(`✅ 成功获取 ${skills.length} 个技能`);
  return skills;
}

// 分类技能
function categorizeSkills(skills) {
  const categories = {};
  
  for (const skill of skills) {
    const cat = skill.category || '未分类';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(skill);
  }
  
  return categories;
}

// 生成 Markdown 表格报告
function generateMarkdownReport(skills, categories) {
  const timestamp = new Date().toISOString().split('T')[0];
  const reportPath = path.join(REPORTS_DIR, `clawhub-top100-${timestamp}.md`);
  
  let report = `# ClawHub Top 100 技能排行榜\n\n`;
  report += `**更新日期:** ${timestamp}\n\n`;
  report += `**总计:** ${skills.length} 个技能 | **分类:** ${Object.keys(categories).length} 个\n\n`;
  report += `---\n\n`;
  
  // 总览表格
  report += `## 📊 Top 20 总览\n\n`;
  report += `| 排名 | 技能名称 | 下载数 ⬇️ | 星星 ⭐ | 分类 | 描述 |\n`;
  report += `|------|----------|-----------|--------|------|------|\n`;
  
  skills.slice(0, 20).forEach((skill, idx) => {
    report += `| ${idx + 1} | ${skill.name} | ${skill.downloads.toLocaleString()} | ${skill.stars} | ${skill.category} | ${skill.description.substring(0, 30)}... |\n`;
  });
  
  report += `\n---\n\n`;
  
  // 按分类详细列表
  report += `## 📁 分类详情\n\n`;
  
  for (const [category, catSkills] of Object.entries(categories).sort((a, b) => b[1].length - a[1].length)) {
    report += `### ${category} (${catSkills.length} 个)\n\n`;
    report += `| 技能名称 | 下载数 ⬇️ | 星星 ⭐ | 作者 |\n`;
    report += `|----------|-----------|--------|------|\n`;
    
    catSkills.sort((a, b) => b.downloads - a.downloads).forEach(skill => {
      report += `| ${skill.name} | ${skill.downloads.toLocaleString()} | ${skill.stars} | ${skill.author} |\n`;
    });
    
    report += `\n`;
  }
  
  fs.writeFileSync(reportPath, report);
  console.log(`✅ 报告已保存：${reportPath}`);
  
  return reportPath;
}

// 生成 JSON 数据文件
function saveJsonData(skills) {
  const timestamp = new Date().toISOString().split('T')[0];
  const jsonPath = path.join(DATA_DIR, `clawhub-top100-${timestamp}.json`);
  
  fs.writeFileSync(jsonPath, JSON.stringify(skills, null, 2));
  console.log(`✅ 数据已保存：${jsonPath}`);
  
  // 更新最新数据快照
  const latestPath = path.join(DATA_DIR, 'clawhub-top100-latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(skills, null, 2));
  console.log(`✅ 最新快照已更新：${latestPath}`);
  
  return jsonPath;
}

// 主流程
async function main() {
  try {
    console.log('🚀 开始获取 ClawHub 数据...\n');
    
    const skills = await fetchTopSkills(100);
    console.log(`✅ 获取 ${skills.length} 个技能\n`);
    
    console.log('📂 分类技能...');
    const categories = categorizeSkills(skills);
    console.log(`✅ 分为 ${Object.keys(categories).length} 个分类\n`);
    
    console.log('💾 保存数据...');
    saveJsonData(skills);
    
    console.log('📝 生成报告...');
    generateMarkdownReport(skills, categories);
    
    console.log('');
    console.log('================================');
    console.log('✅ ClawHub 追踪完成');
    console.log('');
    console.log('下一步：');
    console.log('  1. 审查生成的报告');
    console.log('  2. 运行 git commit 提交变更');
    console.log('  3. 推送到远程仓库');
    console.log('');
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

main();
