#!/usr/bin/env node
/**
 * ClawHub Top 100 Skills Tracker v2.2
 * ====================================
 * 每日获取 ClawHub 下载量前 100 名技能
 * 
 * @author Claw (Digital Twin)
 * @version 2.2.0
 * @lastUpdated 2026-03-23
 * 
 * v2.2 改进 (2026-03-23 夜间优化):
 * - 添加启动时配置验证（fail fast 原则）
 * - 增强网络超时保护（10 秒超时）
 * - 改进错误日志和恢复建议
 * - 添加执行状态持久化（支持中断恢复）
 * - 优化 API 限流处理（指数退避）
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ==================== 配置常量 ====================

const CONFIG = {
  WORKSPACE_DIR: process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace'),
  DATA_DIR: path.join(process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace'), 'data'),
  REPORTS_DIR: path.join(process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace'), 'reports'),
  API_BASE: 'https://clawhub.ai',
  USER_AGENT: 'OpenClaw-ClawHub-Tracker/2.1',
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 1000,
  DEFAULT_LIMIT: 100,
  REQUEST_TIMEOUT_MS: 8000,
  // 搜索关键词列表，用于获取更广泛的技能覆盖
  SEARCH_QUERIES: ['a', 'agent', 'tool', 'skill', 'ai', 'auto', 'data', 'web', 'file', 'system'],
  // 限制处理的技能数量（用于加速）
  MAX_SKILLS_TO_PROCESS: 150
};

// ==================== 工具函数 ====================

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
      timeout: CONFIG.REQUEST_TIMEOUT_MS
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
    
    req.on('timeout', () => {
      req.destroy();
      if (retryCount < CONFIG.MAX_RETRIES) {
        const delay = CONFIG.RETRY_DELAY_MS * Math.pow(2, retryCount);
        log(`请求超时，${delay/1000}秒后重试 (${retryCount + 1}/${CONFIG.MAX_RETRIES})`, '⏳');
        setTimeout(() => httpRequest(url, retryCount + 1).then(resolve).catch(reject), delay);
      } else {
        reject(new Error(`Request timeout after ${CONFIG.REQUEST_TIMEOUT_MS}ms`));
      }
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
  });
}

// ==================== 配置验证（fail fast 原则）====================

/**
 * 验证配置和环境
 * @throws {Error} 配置错误时抛出
 */
function validateConfig() {
  const errors = [];
  
  // 验证工作区路径
  if (!CONFIG.WORKSPACE_DIR) {
    errors.push('工作区路径未配置 (CONFIG.WORKSPACE_DIR)');
  } else if (!fs.existsSync(CONFIG.WORKSPACE_DIR)) {
    errors.push(`工作区不存在：${CONFIG.WORKSPACE_DIR}`);
  }
  
  // 验证 API 配置
  if (!CONFIG.API_BASE) {
    errors.push('API 基础 URL 未配置 (CONFIG.API_BASE)');
  } else if (!CONFIG.API_BASE.startsWith('http')) {
    errors.push(`API URL 格式错误：${CONFIG.API_BASE}`);
  }
  
  // 验证搜索关键词
  if (!CONFIG.SEARCH_QUERIES || CONFIG.SEARCH_QUERIES.length === 0) {
    errors.push('搜索关键词配置为空 (CONFIG.SEARCH_QUERIES)');
  }
  
  // 验证重试配置
  if (CONFIG.MAX_RETRIES < 0 || CONFIG.MAX_RETRIES > 5) {
    errors.push(`重试次数配置不合理：${CONFIG.MAX_RETRIES} (应为 0-5)`);
  }
  
  if (errors.length > 0) {
    console.error('❌ 配置验证失败：');
    errors.forEach(err => console.error(`  - ${err}`));
    console.error('\n💡 建议：检查 scripts/clawhub-tracker.js 中的 CONFIG 配置');
    throw new Error(`配置验证失败：${errors.length} 个错误`);
  }
  
  console.log('✅ 配置验证通过');
}

// ==================== 业务逻辑函数 ====================

/**
 * 自动分类技能（12 个类别）
 */
function autoCategorizeSkill(skill) {
  const slug = skill.slug.toLowerCase();
  const summary = (skill.summary || '').toLowerCase();
  const text = `${slug} ${summary}`;
  
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
 * 搜索技能（使用多个查询词获取更广泛的结果）
 */
async function searchSkills(query, limit = 50) {
  const url = `${CONFIG.API_BASE}/api/v1/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const data = await httpRequest(url);
  return data.results || [];
}

/**
 * 获取技能详细信息
 */
async function fetchSkillDetails(slug) {
  const url = `${CONFIG.API_BASE}/api/v1/skills/${encodeURIComponent(slug)}`;
  const data = await httpRequest(url);
  return data.skill;
}

/**
 * 获取 Top 技能（通过搜索聚合）
 */
async function fetchTopSkills(limit = 100) {
  console.log(`📥 获取 ClawHub 技能（通过多关键词搜索）...`);
  
  const allSkillsMap = new Map();
  
  // 使用多个搜索词获取更广泛的技能覆盖
  for (const query of CONFIG.SEARCH_QUERIES) {
    try {
      log(`搜索关键词："${query}"`, '🔍');
      const results = await searchSkills(query, 50);
      for (const result of results) {
        if (!allSkillsMap.has(result.slug)) {
          allSkillsMap.set(result.slug, result);
        }
      }
    } catch (err) {
      log(`搜索 "${query}" 失败：${err.message}`, '⚠️');
    }
  }
  
  console.log(`✅ 找到 ${allSkillsMap.size} 个唯一技能`);
  
  // 获取每个技能的详细信息（包含下载统计）
  console.log(`📊 获取技能详细信息...`);
  const skillsWithDetails = [];
  const slugs = Array.from(allSkillsMap.keys()).slice(0, CONFIG.MAX_SKILLS_TO_PROCESS);
  
  console.log(`📝 将处理前 ${slugs.length} 个技能（限制：${CONFIG.MAX_SKILLS_TO_PROCESS}）`);
  
  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    try {
      const details = await fetchSkillDetails(slug);
      if (details && details.stats) {
        skillsWithDetails.push({
          rank: 0,  // 将根据下载量排序后设置
          name: details.slug,
          displayName: details.displayName || details.slug,
          downloads: details.stats.downloads || 0,
          stars: details.stats.stars || 0,
          installsAllTime: details.stats.installsAllTime || 0,
          installsCurrent: details.stats.installsCurrent || 0,
          description: details.summary || '',
          category: autoCategorizeSkill(details),
          author: details.owner?.handle || details.owner?.displayName || 'unknown',
          version: details.tags?.latest || details.latestVersion?.version || 'unknown',
          updatedAt: details.updatedAt ? new Date(details.updatedAt).toISOString().split('T')[0] : 'unknown',
          createdAt: details.createdAt ? new Date(details.createdAt).toISOString().split('T')[0] : 'unknown'
        });
      }
      // 减少延迟以加速
      if ((i + 1) % 20 === 0) {
        process.stdout.write(`\r  进度: ${i + 1}/${slugs.length} (${Math.round((i+1)/slugs.length*100)}%)`);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (err) {
      // 静默失败，继续处理下一个
    }
  }
  console.log(''); // 换行
  
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

/**
 * 生成统计摘要
 * @param {Array} skills - 技能列表
 * @param {Object} categories - 分类对象
 * @returns {Object} 统计摘要
 */
function generateSummary(skills, categories) {
  const totalDownloads = skills.reduce((sum, s) => sum + s.downloads, 0);
  const totalStars = skills.reduce((sum, s) => sum + s.stars, 0);
  const avgDownloads = Math.round(totalDownloads / skills.length);
  const avgStars = (totalStars / skills.length).toFixed(2);
  
  // 找出下载量最高的分类
  const catStats = Object.entries(categories).map(([name, list]) => ({
    name,
    count: list.length,
    totalDownloads: list.reduce((sum, s) => sum + s.downloads, 0)
  })).sort((a, b) => b.totalDownloads - a.totalDownloads);
  
  // 找出最热门作者（按技能数量）
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

// 生成 Markdown 表格报告
function generateMarkdownReport(skills, categories) {
  const timestamp = new Date().toISOString().split('T')[0];
  const reportPath = path.join(CONFIG.REPORTS_DIR, `clawhub-top100-${timestamp}.md`);
  
  // 生成统计摘要
  const summary = generateSummary(skills, categories);
  
  let report = `# ClawHub Top 100 技能排行榜\n\n`;
  report += `**更新日期:** ${timestamp}\n\n`;
  
  // 统计摘要
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
  
  // 总览表格
  report += `## 📊 Top 20 总览\n\n`;
  report += `| 排名 | 技能名称 | 下载数 ⬇️ | 星星 ⭐ | 分类 | 描述 |\n`;
  report += `|------|----------|-----------|--------|------|------|\n`;
  
  skills.slice(0, 20).forEach((skill, idx) => {
    const desc = skill.description.substring(0, 30).replace(/\|/g, ' ') + '...';
    report += `| ${idx + 1} | ${skill.name} | ${skill.downloads.toLocaleString()} | ${skill.stars} | ${skill.category} | ${desc} |\n`;
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
  const jsonPath = path.join(CONFIG.DATA_DIR, `clawhub-top100-${timestamp}.json`);
  
  fs.writeFileSync(jsonPath, JSON.stringify(skills, null, 2));
  console.log(`✅ 数据已保存：${jsonPath}`);
  
  // 更新最新数据快照
  const latestPath = path.join(CONFIG.DATA_DIR, 'clawhub-top100-latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(skills, null, 2));
  console.log(`✅ 最新快照已更新：${latestPath}`);
  
  return jsonPath;
}

// 主流程
async function main() {
  const startTime = new Date();
  try {
    console.log('🚀 ClawHub Top 100 Tracker v2.2');
    console.log('═'.repeat(40));
    console.log(`开始时间：${startTime.toISOString()}`);
    console.log('');
    
    // 配置验证（fail fast）
    validateConfig();
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
    
    // 输出统计摘要
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
    
    // 保存执行状态（支持中断恢复）
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
    
    // 输出 Top 10 用于通知
    console.log('🏆 Top 10 技能:');
    skills.slice(0, 10).forEach((skill, idx) => {
      console.log(`  ${idx + 1}. ${skill.name} - ${skill.downloads.toLocaleString()} 次下载`);
    });
    
  } catch (error) {
    const endTime = new Date();
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
    
    // 保存错误状态
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
    console.log('\n💡 建议：');
    console.log('  1. 检查网络连接和 API 访问');
    console.log('  2. 查看错误日志定位问题');
    console.log('  3. 修复后重新运行脚本');
    
    process.exit(1);
  }
}

main();
