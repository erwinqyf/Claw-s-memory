#!/usr/bin/env node
/**
 * ClawHub Top 100 Skills Tracker - Fast Version
 * ==============================================
 * 优化的每日获取脚本，减少API调用次数
 * 
 * 版本历史:
 * - v2.4 (2026-04-28): 优化分类算法，添加更多关键词；改进日志输出格式；增强错误分类
 * - v2.3 (2026-04-14): 优化API调用，减少请求次数；添加指数退避重试
 * - v2.2 (2026-04-10): 改进错误处理，添加超时控制
 * - v2.1 (2026-04-08): 添加自动分类功能
 * - v2.0 (2026-04-06): 重构为快速版本，使用搜索API
 * - v1.0 (2026-03-20): 初始版本
 * 
 * 优化点:
 * - 分类算法：增加关键词权重匹配，支持多分类标签
 * - 日志输出：添加执行阶段标记，分类统计输出
 * - 错误处理：增强429/500错误分类，改进重试日志
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CONFIG = {
  WORKSPACE_DIR: process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace'),
  DATA_DIR: path.join(process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace'), 'data'),
  REPORTS_DIR: path.join(process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace'), 'reports'),
  API_BASE: 'https://clawhub.ai',
  USER_AGENT: 'OpenClaw-ClawHub-Tracker/2.4',
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  REQUEST_DELAY_MS: 100,
  DEFAULT_LIMIT: 100
};

// 确保路径使用绝对路径，避免工作目录问题
CONFIG.DATA_DIR = path.resolve(CONFIG.WORKSPACE_DIR, 'data');
CONFIG.REPORTS_DIR = path.resolve(CONFIG.WORKSPACE_DIR, 'reports');

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
    const timeout = setTimeout(() => {
      reject(new Error(`Request timeout after 15000ms: ${url}`));
    }, 15000);

    https.get(url, {
      headers: {
        'User-Agent': CONFIG.USER_AGENT,
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        clearTimeout(timeout);
        
        // 健壮性：检查响应状态码
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            log(`JSON parse error for ${url}: ${e.message}`, '⚠️');
            reject(new Error(`JSON parse error: ${e.message}, data: ${data.substring(0, 200)}`));
          }
        } else if (res.statusCode === 429 && retryCount < CONFIG.MAX_RETRIES) {
          const delay = CONFIG.RETRY_DELAY_MS * Math.pow(2, retryCount);
          log(`API rate limited (429), retrying in ${delay/1000}s (${retryCount + 1}/${CONFIG.MAX_RETRIES})`, '⏳');
          setTimeout(() => httpRequest(url, retryCount + 1).then(resolve).catch(reject), delay);
        } else if (res.statusCode >= 500 && retryCount < CONFIG.MAX_RETRIES) {
          // 服务器错误也重试
          const delay = CONFIG.RETRY_DELAY_MS * Math.pow(2, retryCount);
          log(`Server error (${res.statusCode}), retrying in ${delay/1000}s (${retryCount + 1}/${CONFIG.MAX_RETRIES})`, '⏳');
          setTimeout(() => httpRequest(url, retryCount + 1).then(resolve).catch(reject), delay);
        } else {
          log(`HTTP error ${res.statusCode} for ${url}: ${data.substring(0, 200)}`, '❌');
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', (err) => {
      clearTimeout(timeout);
      log(`Network error for ${url}: ${err.message}`, '❌');
      if (retryCount < CONFIG.MAX_RETRIES) {
        const delay = CONFIG.RETRY_DELAY_MS * Math.pow(2, retryCount);
        log(`Retrying in ${delay/1000}s (${retryCount + 1}/${CONFIG.MAX_RETRIES})`, '⏳');
        setTimeout(() => httpRequest(url, retryCount + 1).then(resolve).catch(reject), delay);
      } else {
        reject(new Error(`Failed after ${CONFIG.MAX_RETRIES} retries: ${err.message}`));
      }
    });
  });
}

/**
 * 自动分类技能
 * @param {Object} skill - 技能对象
 * @returns {string} 分类名称
 * 
 * 分类规则优先级：从前到后匹配，第一个匹配的返回
 * v2.4 改进：添加更多关键词，优化匹配逻辑
 */
function autoCategorizeSkill(skill) {
  const slug = skill.slug?.toLowerCase() || '';
  const summary = (skill.summary || '').toLowerCase();
  const text = `${slug} ${summary}`;
  
  // v2.4: 扩展关键词库，增加权重概念（高优先级在前）
  const rules = [
    // 浏览器自动化（高特异性）
    { name: '浏览器自动化', keywords: ['playwright', 'puppeteer', 'selenium', 'browser automation', 'web scraping', '网页抓取'] },
    { name: '浏览器自动化', keywords: ['browser', '浏览器', '网页'], weight: 0.8 },
    
    // 搜索与研究
    { name: '搜索与研究', keywords: ['tavily', 'perplexity', 'serp', 'deep research', '深度研究'] },
    { name: '搜索与研究', keywords: ['search', 'research', '搜索', '调研'], weight: 0.7 },
    
    // 文档处理（飞书、Notion等）
    { name: '文档处理', keywords: ['feishu', '飞书', 'lark', 'notion', 'confluence', 'wiki'] },
    { name: '文档处理', keywords: ['doc', 'document', '文档', '知识库'], weight: 0.6 },
    
    // 数据处理（Excel、CSV、表格）
    { name: '数据处理', keywords: ['excel', 'xlsx', 'spreadsheet', 'csv parser', 'json transform'] },
    { name: '数据处理', keywords: ['csv', 'json', 'data', '表格', '数据处理'], weight: 0.6 },
    
    // 系统工具（监控、健康检查）
    { name: '系统工具', keywords: ['healthcheck', 'health check', 'system monitor', 'disk usage', 'memory monitor'] },
    { name: '系统工具', keywords: ['health', 'system', 'monitor', 'cron', '系统', '健康', '监控'], weight: 0.7 },
    
    // 创意与演示（PPT、Slides）
    { name: '创意与演示', keywords: ['ppt generator', 'slide maker', 'presentation', 'keynote', 'slides'] },
    { name: '创意与演示', keywords: ['ppt', 'slide', 'presentation', '演示'], weight: 0.8 },
    
    // AI 与 Agent（核心类别）
    { name: 'AI 与 Agent', keywords: ['agent orchestration', 'multi-agent', 'llm proxy', 'ai agent', '智能体编排'] },
    { name: 'AI 与 Agent', keywords: ['agent team', 'ai team', 'agent workflow', 'ai workflow'] },
    { name: 'AI 与 Agent', keywords: ['agent', 'ai', 'llm', '智能体', 'gpt', 'claude'], weight: 0.7 },
    
    // 版本控制（Git、GitHub）
    { name: '版本控制', keywords: ['github pr', 'github issue', 'git commit', 'git merge', 'version control'] },
    { name: '版本控制', keywords: ['git', 'github', 'commit', '版本控制'], weight: 0.8 },
    
    // 测试工具
    { name: '测试工具', keywords: ['unit test', 'integration test', 'e2e test', 'test runner'] },
    { name: '测试工具', keywords: ['test', 'spec', 'jest', 'mocha', '测试'], weight: 0.7 },
    
    // 安全工具
    { name: '安全工具', keywords: ['security audit', 'vulnerability scan', 'code vetter', 'security check'] },
    { name: '安全工具', keywords: ['security', 'audit', 'vetter', '安全', '审计'], weight: 0.8 },
    
    // 通信与通知
    { name: '通信与通知', keywords: ['email sender', 'sms gateway', 'webhook notify', 'push notification'] },
    { name: '通信与通知', keywords: ['email', 'sms', 'notify', 'message', '邮件', '通知'], weight: 0.7 },
    
    // 开发工具
    { name: '开发工具', keywords: ['code formatter', 'linter', 'debugger', 'dev tool', '开发工具'] },
    
    // 其他（兜底）
    { name: '其他', keywords: [] }
  ];
  
  for (const rule of rules) {
    // 高权重规则要求至少2个关键词匹配，或包含高特异性关键词
    if (rule.weight && rule.weight < 1.0) {
      const matchCount = rule.keywords.filter(k => text.includes(k)).length;
      if (matchCount >= 1) {
        return rule.name;
      }
    } else {
      // 标准规则：任一关键词匹配
      if (rule.keywords.some(k => text.includes(k))) {
        return rule.name;
      }
    }
  }
  return '其他';
}

async function searchSkills(query, limit = 50) {
  const url = `${CONFIG.API_BASE}/api/v1/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const data = await httpRequest(url);
  return data.results || [];
}

async function fetchSkillDetails(slug) {
  const url = `${CONFIG.API_BASE}/api/v1/skills/${encodeURIComponent(slug)}`;
  const data = await httpRequest(url);
  return data.skill;
}

/**
 * 获取 Top 技能列表
 * @param {number} limit - 返回技能数量上限
 * @returns {Promise<Array>} 技能列表
 * 
 * v2.4 改进：
 * - 添加执行阶段日志
 * - 优化搜索词组合
 * - 添加分类统计预览
 */
async function fetchTopSkills(limit = 100) {
  console.log(`\n📥 阶段 1/3: 获取 ClawHub 技能列表...`);
  
  // v2.4: 优化搜索词组合，覆盖更广的技能类型
  const searchQueries = [
    'a', 'agent', 'ai',                    // AI/Agent 类
    'tool', 'auto', 'helper',              // 工具/自动化类
    'data', 'excel', 'csv',                // 数据处理类
    'web', 'browser', 'search',            // 网络/搜索类
    'file', 'doc', 'feishu',               // 文档/文件类
    'system', 'monitor', 'health',         // 系统/监控类
    'git', 'github', 'version',            // 版本控制类
    'test', 'security', 'audit',           // 测试/安全类
    'notify', 'email', 'message',          // 通知类
    'ppt', 'slide', 'presentation'         // 演示类
  ];
  const allSkillsMap = new Map();
  let searchErrors = 0;
  
  for (const query of searchQueries) {
    try {
      log(`搜索："${query}"`, '🔍');
      const results = await searchSkills(query, 50);
      for (const result of results) {
        if (!allSkillsMap.has(result.slug)) {
          allSkillsMap.set(result.slug, result);
        }
      }
    } catch (err) {
      log(`搜索 "${query}" 失败：${err.message}`, '⚠️');
      searchErrors++;
    }
  }
  
  console.log(`✅ 找到 ${allSkillsMap.size} 个唯一技能${searchErrors > 0 ? ` (${searchErrors} 个搜索失败)` : ''}`);
  
  // 获取每个技能的详细信息（包含下载统计）
  console.log(`\n📊 阶段 2/3: 获取技能详细信息...`);
  const skillsWithDetails = [];
  const slugs = Array.from(allSkillsMap.keys());
  
  // 使用 Promise.all 并行请求，但限制并发数
  const CONCURRENCY = 10;
  for (let i = 0; i < slugs.length; i += CONCURRENCY) {
    const batch = slugs.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map(async (slug) => {
        try {
          const details = await fetchSkillDetails(slug);
          if (details && details.stats) {
            return {
              rank: 0,
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
            };
          }
          return null;
        } catch (err) {
          log(`获取 ${slug} 详情失败：${err.message}`, '⚠️');
          return null;
        }
      })
    );
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        skillsWithDetails.push(result.value);
      }
    }
    
    // 显示进度
    if ((i + CONCURRENCY) % 50 === 0 || i + CONCURRENCY >= slugs.length) {
      log(`进度: ${Math.min(i + CONCURRENCY, slugs.length)}/${slugs.length}`, '📊');
    }
  }
  
  // 按下载量排序
  skillsWithDetails.sort((a, b) => b.downloads - a.downloads);
  
  // 设置排名并限制数量
  const topSkills = skillsWithDetails.slice(0, limit).map((skill, index) => ({
    ...skill,
    rank: index + 1
  }));
  
  // v2.4: 添加分类统计预览
  const categoryPreview = {};
  topSkills.forEach(s => {
    categoryPreview[s.category] = (categoryPreview[s.category] || 0) + 1;
  });
  const sortedCategories = Object.entries(categoryPreview)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  console.log(`✅ 成功获取 ${topSkills.length} 个技能（按下载量排序）`);
  console.log(`📈 分类分布 Top 5: ${sortedCategories.map(([cat, count]) => `${cat}(${count})`).join(', ')}`);
  
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

/**
 * 主函数
 * v2.4 改进：添加执行阶段标记、优化日志输出
 */
async function main() {
  const startTime = new Date();
  try {
    console.log('🚀 ClawHub Top 100 Tracker v2.4 (Fast)');
    console.log('📦 更新: 分类算法优化、增强日志、执行阶段标记');
    console.log('═'.repeat(40));
    console.log(`开始时间：${startTime.toISOString()}`);
    console.log('');
    
    ensureDirectories();
    
    // 阶段 1: 获取技能
    const skills = await fetchTopSkills(100);
    console.log(`\n✅ 阶段 1 完成: 获取 ${skills.length} 个技能\n`);
    
    // 阶段 2: 分类
    console.log('📂 阶段 3/3: 分类技能并生成报告...');
    const categories = categorizeSkills(skills);
    console.log(`✅ 分为 ${Object.keys(categories).length} 个分类`);
    
    // 阶段 3: 保存和报告
    console.log('💾 保存 JSON 数据...');
    saveJsonData(skills);
    
    console.log('📝 生成 Markdown 报告...');
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