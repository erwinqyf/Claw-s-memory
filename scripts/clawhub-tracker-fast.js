#!/usr/bin/env node
/**
 * ClawHub Top 100 Skills Tracker - Fast Version
 * ==============================================
 * 优化版本：直接从搜索获取的数据中提取信息，减少API调用
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CONFIG = {
  WORKSPACE_DIR: process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace'),
  DATA_DIR: path.join(process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace'), 'data'),
  REPORTS_DIR: path.join(process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace'), 'reports'),
  API_BASE: 'https://clawhub.ai',
  USER_AGENT: 'OpenClaw-ClawHub-Tracker/2.2',
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 2000,
  SEARCH_QUERIES: ['a', 'agent', 'tool', 'skill', 'ai', 'auto', 'data', 'web', 'file', 'system', 'github', 'browser', 'doc']
};

function log(message, emoji = 'ℹ️') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`${emoji} [${timestamp}] ${message}`);
}

function ensureDirectories() {
  [CONFIG.DATA_DIR, CONFIG.REPORTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log(`创建目录：${dir}`, '📁');
    }
  });
}

async function httpRequest(url, retryCount = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': CONFIG.USER_AGENT,
        'Accept': 'application/json'
      },
      timeout: 15000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message}`));
          }
        } else if (res.statusCode === 429 && retryCount < CONFIG.MAX_RETRIES) {
          const delay = CONFIG.RETRY_DELAY_MS * Math.pow(2, retryCount);
          log(`API 限流，${delay/1000}秒后重试 (${retryCount + 1}/${CONFIG.MAX_RETRIES})`, '⏳');
          setTimeout(() => httpRequest(url, retryCount + 1).then(resolve).catch(reject), delay);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 100)}`));
        }
      });
    });
    
    req.on('error', (err) => {
      if (retryCount < CONFIG.MAX_RETRIES) {
        const delay = CONFIG.RETRY_DELAY_MS * Math.pow(2, retryCount);
        log(`请求失败，${delay/1000}秒后重试 (${retryCount + 1}/${CONFIG.MAX_RETRIES})`, '⏳');
        setTimeout(() => httpRequest(url, retryCount + 1).then(resolve).catch(reject), delay);
      } else {
        reject(err);
      }
    });
    
    req.on('timeout', () => {
      req.destroy();
      if (retryCount < CONFIG.MAX_RETRIES) {
        const delay = CONFIG.RETRY_DELAY_MS * Math.pow(2, retryCount);
        log(`请求超时，${delay/1000}秒后重试 (${retryCount + 1}/${CONFIG.MAX_RETRIES})`, '⏳');
        setTimeout(() => httpRequest(url, retryCount + 1).then(resolve).catch(reject), delay);
      } else {
        reject(new Error('Request timeout'));
      }
    });
  });
}

function autoCategorizeSkill(skill) {
  const slug = (skill.slug || skill.name || '').toLowerCase();
  const summary = (skill.summary || skill.description || '').toLowerCase();
  const text = `${slug} ${summary}`;
  
  const rules = [
    { name: '浏览器自动化', keywords: ['browser', 'playwright', 'puppeteer', '浏览器', '网页', 'web'] },
    { name: '搜索与研究', keywords: ['search', 'research', 'tavily', '搜索', 'deep-research'] },
    { name: '文档处理', keywords: ['doc', 'feishu', 'notion', '文档', '飞书', 'pdf'] },
    { name: '数据处理', keywords: ['excel', 'csv', 'json', 'data', '表格', '数据', 'xlsx'] },
    { name: '系统工具', keywords: ['health', 'system', 'monitor', 'cron', '系统', '健康', '监控', 'tmux'] },
    { name: '创意与演示', keywords: ['ppt', 'slide', 'presentation', '演示', 'generator'] },
    { name: 'AI 与 Agent', keywords: ['agent', 'ai', 'llm', '智能体', 'proactive', 'self-improving'] },
    { name: '版本控制', keywords: ['git', 'github', 'commit', 'pr', 'issue'] },
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

async function searchSkills(query, limit = 100) {
  const url = `${CONFIG.API_BASE}/api/v1/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const data = await httpRequest(url);
  return data.results || [];
}

async function fetchTopSkills(limit = 100) {
  console.log(`📥 获取 ClawHub 技能（通过多关键词搜索）...`);
  
  const allSkillsMap = new Map();
  
  for (const query of CONFIG.SEARCH_QUERIES) {
    try {
      log(`搜索关键词："${query}"`, '🔍');
      const results = await searchSkills(query, 100);
      for (const result of results) {
        if (!allSkillsMap.has(result.slug)) {
          allSkillsMap.set(result.slug, result);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (err) {
      log(`搜索 "${query}" 失败：${err.message}`, '⚠️');
    }
  }
  
  console.log(`✅ 找到 ${allSkillsMap.size} 个唯一技能`);
  
  // 从搜索结果直接提取数据（避免额外的API调用）
  const skillsWithDetails = [];
  for (const [slug, result] of allSkillsMap) {
    const stats = result.stats || {};
    skillsWithDetails.push({
      rank: 0,
      name: result.slug,
      displayName: result.displayName || result.slug,
      downloads: stats.downloads || stats.installsAllTime || 0,
      stars: stats.stars || 0,
      installsAllTime: stats.installsAllTime || 0,
      installsCurrent: stats.installsCurrent || 0,
      description: result.summary || '',
      category: autoCategorizeSkill(result),
      author: result.owner?.handle || result.owner?.displayName || 'unknown',
      version: result.tags?.latest || result.latestVersion?.version || 'unknown',
      updatedAt: result.updatedAt ? new Date(result.updatedAt).toISOString().split('T')[0] : 'unknown',
      createdAt: result.createdAt ? new Date(result.createdAt).toISOString().split('T')[0] : 'unknown'
    });
  }
  
  // 按下载量排序
  skillsWithDetails.sort((a, b) => b.downloads - a.downloads);
  
  // 设置排名并限制数量
  const topSkills = skillsWithDetails.slice(0, limit).map((skill, index) => ({
    ...skill,
    rank: index + 1
  }));
  
  console.log(`✅ 成功获取 ${topSkills.length} 个技能（按下载量排序）`);
  return topSkills;
}

function categorizeSkills(skills) {
  const categories = {};
  for (const skill of skills) {
    const cat = skill.category || '未分类';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(skill);
  }
  return categories;
}

function generateSummary(skills, categories) {
  const totalDownloads = skills.reduce((sum, s) => sum + s.downloads, 0);
  const totalStars = skills.reduce((sum, s) => sum + s.stars, 0);
  const avgDownloads = Math.round(totalDownloads / skills.length);
  const avgStars = (totalStars / skills.length).toFixed(2);
  
  const catStats = Object.entries(categories).map(([name, list]) => ({
    name,
    count: list.length,
    totalDownloads: list.reduce((sum, s) => sum + s.downloads, 0)
  })).sort((a, b) => b.totalDownloads - a.totalDownloads);
  
  const authorStats = {};
  skills.forEach(s => {
    authorStats[s.author] = (authorStats[s.author] || 0) + 1;
  });
  const topAuthors = Object.entries(authorStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
  
  return {
    totalSkills: skills.length,
    totalDownloads,
    totalStars,
    avgDownloads,
    avgStars,
    categoryCount: Object.keys(categories).length,
    topCategory: catStats[0],
    topAuthors
  };
}

function generateMarkdownReport(skills, categories) {
  const timestamp = new Date().toISOString().split('T')[0];
  const reportPath = path.join(CONFIG.REPORTS_DIR, `clawhub-top100-${timestamp}.md`);
  
  const summary = generateSummary(skills, categories);
  
  let report = `# ClawHub Top 100 技能排行榜\n\n`;
  report += `**更新日期:** ${timestamp}\n\n`;
  
  report += `## 📊 统计摘要\n\n`;
  report += `| 指标 | 数值 |\n`;
  report += `|------|------|\n`;
  report += `| 技能总数 | ${summary.totalSkills} 个 |\n`;
  report += `| 总下载量 | ${summary.totalDownloads.toLocaleString()} 次 |\n`;
  report += `| 总星星数 | ${summary.totalStars.toLocaleString()} ⭐ |\n`;
  report += `| 平均下载量 | ${summary.avgDownloads.toLocaleString()} 次/技能 |\n`;
  report += `| 平均星星数 | ${summary.avgStars} ⭐/技能 |\n`;
  report += `| 分类数量 | ${summary.categoryCount} 个 |\n`;
  report += `| 最热门分类 | ${summary.topCategory.name} (${summary.topCategory.count}个技能) |\n\n`;
  
  report += `### 👑 Top 5 作者\n\n`;
  report += `| 作者 | 技能数量 |\n`;
  report += `|------|----------|\n`;
  summary.topAuthors.forEach(a => {
    report += `| ${a.name} | ${a.count} 个 |\n`;
  });
  report += `\n---\n\n`;
  
  report += `## 📊 Top 20 总览\n\n`;
  report += `| 排名 | 技能名称 | 下载数 ⬇️ | 星星 ⭐ | 分类 | 描述 |\n`;
  report += `|------|----------|-----------|--------|------|------|\n`;
  
  skills.slice(0, 20).forEach((skill, idx) => {
    const desc = skill.description.substring(0, 30).replace(/\|/g, ' ') + '...';
    report += `| ${idx + 1} | ${skill.name} | ${skill.downloads.toLocaleString()} | ${skill.stars} | ${skill.category} | ${desc} |\n`;
  });
  
  report += `\n---\n\n`;
  
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

function saveJsonData(skills) {
  const timestamp = new Date().toISOString().split('T')[0];
  const jsonPath = path.join(CONFIG.DATA_DIR, `clawhub-top100-${timestamp}.json`);
  
  fs.writeFileSync(jsonPath, JSON.stringify(skills, null, 2));
  console.log(`✅ 数据已保存：${jsonPath}`);
  
  const latestPath = path.join(CONFIG.DATA_DIR, 'clawhub-top100-latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(skills, null, 2));
  console.log(`✅ 最新快照已更新：${latestPath}`);
  
  return jsonPath;
}

async function main() {
  const startTime = new Date();
  try {
    console.log('🚀 ClawHub Top 100 Tracker v2.2 (Fast)');
    console.log('═'.repeat(40));
    console.log(`开始时间：${startTime.toISOString()}`);
    console.log('');
    
    ensureDirectories();
    
    const skills = await fetchTopSkills(100);
    console.log(`✅ 获取 ${skills.length} 个技能\n`);
    
    console.log('📂 分类技能...');
    const categories = categorizeSkills(skills);
    console.log(`✅ 分为 ${Object.keys(categories).length} 个分类\n`);
    
    console.log('💾 保存数据...');
    saveJsonData(skills);
    
    console.log('📝 生成报告...');
    generateMarkdownReport(skills, categories);
    
    const summary = generateSummary(skills, categories);
    console.log('\n📈 统计摘要:');
    console.log(`  总技能数：${summary.totalSkills} 个`);
    console.log(`  总下载量：${summary.totalDownloads.toLocaleString()} 次`);
    console.log(`  平均下载量：${summary.avgDownloads.toLocaleString()} 次/技能`);
    console.log(`  最热门分类：${summary.topCategory.name}`);
    
    console.log('');
    console.log('================================');
    
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);
    console.log(`✅ ClawHub 追踪完成 (耗时：${duration}秒)`);
    console.log(`结束时间：${endTime.toISOString()}`);
    console.log('');
    
    const stateFile = path.join(CONFIG.WORKSPACE_DIR, 'memory', 'clawhub-tracker-state.json');
    const stateDir = path.dirname(stateFile);
    if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });
    const state = {
      lastRun: endTime.toISOString(),
      lastDuration: duration,
      lastStatus: 'success',
      skillsCount: skills.length,
      reportPath: path.join(CONFIG.REPORTS_DIR, `clawhub-top100-${new Date().toISOString().split('T')[0]}.md`)
    };
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    console.log(`💾 执行状态已保存：${stateFile}`);
    console.log('');
    
    console.log('🏆 Top 10 技能:');
    skills.slice(0, 10).forEach((skill, idx) => {
      console.log(`  ${idx + 1}. ${skill.name} - ${skill.downloads.toLocaleString()} 次下载`);
    });
    
  } catch (error) {
    const endTime = new Date();
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
    
    const stateFile = path.join(CONFIG.WORKSPACE_DIR, 'memory', 'clawhub-tracker-state.json');
    const stateDir = path.dirname(stateFile);
    if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });
    const state = {
      lastRun: endTime.toISOString(),
      lastStatus: 'error',
      lastError: error.message
    };
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    console.log(`\n💾 错误状态已保存：${stateFile}`);
    
    process.exit(1);
  }
}

main();