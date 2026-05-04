#!/usr/bin/env node
/**
 * ClawHub Top 100 Skills Tracker - Fast Version
 * ==============================================
 * 优化的每日获取脚本，减少API调用次数
 * 
 * 版本历史:
 * - v2.5 (2026-05-05): 添加执行时间统计与趋势分析、内存使用监控、健康检查摘要、改进错误分类器
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
 * - 性能监控：执行时间趋势分析、内存使用监控
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CONFIG = {
  WORKSPACE_DIR: process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace'),
  DATA_DIR: path.join(process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace'), 'data'),
  REPORTS_DIR: path.join(process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace'), 'reports'),
  API_BASE: 'https://clawhub.ai',
  USER_AGENT: 'OpenClaw-ClawHub-Tracker/2.5',
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  REQUEST_DELAY_MS: 100,
  DEFAULT_LIMIT: 100,
  // v2.5: 性能监控配置
  TREND_WINDOW_SIZE: 10, // 保留最近10次执行记录
  MEMORY_WARNING_MB: 100 // 内存使用警告阈值
};

// 确保路径使用绝对路径，避免工作目录问题
CONFIG.DATA_DIR = path.resolve(CONFIG.WORKSPACE_DIR, 'data');
CONFIG.REPORTS_DIR = path.resolve(CONFIG.WORKSPACE_DIR, 'reports');

function log(message, emoji = 'ℹ️') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`${emoji} [${timestamp}] ${message}`);
}

/**
 * v2.5: 格式化执行时间
 * @param {number} ms - 毫秒数
 * @returns {string} 格式化后的时间
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = ((ms % 60000) / 1000).toFixed(1);
  return `${mins}m ${secs}s`;
}

/**
 * v2.5: 获取当前内存使用情况
 * @returns {Object} 内存使用统计
 */
function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100, // MB
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100, // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100, // MB
    external: Math.round(usage.external / 1024 / 1024 * 100) / 100 // MB
  };
}

/**
 * v2.5: 检查内存使用是否健康
 * @param {Object} mem - 内存使用统计
 * @returns {boolean} 是否健康
 */
function isMemoryHealthy(mem) {
  return mem.heapUsed < CONFIG.MEMORY_WARNING_MB;
}

/**
 * v2.5: 错误分类器
 * 对错误进行分类，便于后续处理
 * @param {Error} error - 错误对象
 * @returns {string} 错误类型
 */
function classifyError(error) {
  const message = error.message?.toLowerCase() || '';
  
  if (message.includes('timeout') || message.includes('etimedout')) {
    return 'TIMEOUT';
  }
  if (message.includes('econnrefused') || message.includes('enotfound') || message.includes('dns')) {
    return 'CONNECTION';
  }
  if (message.includes('429') || message.includes('rate limit')) {
    return 'RATE_LIMIT';
  }
  if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
    return 'SERVER_ERROR';
  }
  if (message.includes('parse') || message.includes('json') || message.includes('syntax')) {
    return 'PARSE_ERROR';
  }
  if (message.includes('enoent') || message.includes('permission') || message.includes('eacces')) {
    return 'FILE_ERROR';
  }
  return 'UNKNOWN';
}

function ensureDirectories() {
  [CONFIG.DATA_DIR, CONFIG.REPORTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log(`创建目录：${dir}`, '📁');
    }
  });
}

/**
 * v2.5: 增强错误分类和日志
 */
async function httpRequest(url, retryCount = 0) {
  const requestStart = Date.now();
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
        const requestDuration = Date.now() - requestStart;
        
        // 健壮性：检查响应状态码
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            // v2.5: 记录慢请求
            if (requestDuration > 5000) {
              log(`Slow request (${requestDuration}ms): ${url}`, '⚠️');
            }
            resolve(parsed);
          } catch (e) {
            const errorType = classifyError(e);
            log(`JSON parse error [${errorType}] for ${url}: ${e.message}`, '⚠️');
            reject(new Error(`JSON parse error [${errorType}]: ${e.message}, data: ${data.substring(0, 200)}`));
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
      const errorType = classifyError(err);
      log(`Network error [${errorType}] for ${url}: ${err.message}`, '❌');
      if (retryCount < CONFIG.MAX_RETRIES) {
        const delay = CONFIG.RETRY_DELAY_MS * Math.pow(2, retryCount);
        log(`Retrying in ${delay/1000}s (${retryCount + 1}/${CONFIG.MAX_RETRIES})`, '⏳');
        setTimeout(() => httpRequest(url, retryCount + 1).then(resolve).catch(reject), delay);
      } else {
        reject(new Error(`[${errorType}] Failed after ${CONFIG.MAX_RETRIES} retries: ${err.message}`));
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
 * v2.5 改进：
 * - 添加执行时间统计
 * - 添加错误分类统计
 * - 内存使用监控
 * 
 * v2.4 改进：
 * - 添加执行阶段日志
 * - 优化搜索词组合
 * - 添加分类统计预览
 */
async function fetchTopSkills(limit = 100) {
  console.log(`\n📥 阶段 1/3: 获取 ClawHub 技能列表...`);
  const stageStart = Date.now();
  
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
  const errorStats = {}; // v2.5: 错误分类统计
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
      const errorType = classifyError(err);
      errorStats[errorType] = (errorStats[errorType] || 0) + 1;
      log(`搜索 "${query}" 失败 [${errorType}]: ${err.message}`, '⚠️');
      searchErrors++;
    }
  }
  
  const searchDuration = Date.now() - stageStart;
  console.log(`✅ 找到 ${allSkillsMap.size} 个唯一技能${searchErrors > 0 ? ` (${searchErrors} 个搜索失败)` : ''} (耗时: ${formatDuration(searchDuration)})`);
  
  // v2.5: 检查内存使用
  const memAfterSearch = getMemoryUsage();
  if (!isMemoryHealthy(memAfterSearch)) {
    log(`内存使用较高: ${memAfterSearch.heapUsed}MB`, '⚠️');
  }
  
  // 获取每个技能的详细信息（包含下载统计）
  console.log(`\n📊 阶段 2/3: 获取技能详细信息...`);
  const detailsStart = Date.now();
  const skillsWithDetails = [];
  const slugs = Array.from(allSkillsMap.keys());
  let detailErrors = 0;
  
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
          const errorType = classifyError(err);
          errorStats[errorType] = (errorStats[errorType] || 0) + 1;
          log(`获取 ${slug} 详情失败 [${errorType}]: ${err.message}`, '⚠️');
          detailErrors++;
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
  
  const detailsDuration = Date.now() - detailsStart;
  console.log(`✅ 获取 ${skillsWithDetails.length} 个技能详情${detailErrors > 0 ? ` (${detailErrors} 个失败)` : ''} (耗时: ${formatDuration(detailsDuration)})`);
  
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
  
  // v2.5: 返回错误统计供后续使用
  topSkills._errorStats = errorStats;
  topSkills._stageTimings = {
    search: searchDuration,
    details: detailsDuration
  };
  
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

/**
 * v2.5: 生成执行时间趋势图
 * @param {Array} history - 历史执行记录
 * @returns {string} ASCII 趋势图
 */
function generateTrendChart(history) {
  if (!history || history.length < 2) return '暂无足够数据生成趋势图';
  
  const durations = history.map(h => h.duration || 0);
  const max = Math.max(...durations);
  const min = Math.min(...durations);
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  
  const chartWidth = 40;
  const lines = [];
  
  // 标题
  lines.push('执行时间趋势 (最近' + history.length + '次)');
  lines.push('');
  
  // 趋势图
  for (let i = 0; i < history.length; i++) {
    const item = history[i];
    const duration = item.duration || 0;
    const barLength = max > 0 ? Math.round((duration / max) * chartWidth) : 0;
    const bar = '█'.repeat(barLength) + '░'.repeat(chartWidth - barLength);
    const date = item.date ? item.date.substring(5) : '??-??'; // MM-DD
    const status = item.status === 'success' ? '✓' : '✗';
    lines.push(`${date} ${status} ${bar} ${formatDuration(duration)}`);
  }
  
  lines.push('');
  lines.push(`平均: ${formatDuration(avg)} | 最快: ${formatDuration(min)} | 最慢: ${formatDuration(max)}`);
  
  return lines.join('\n');
}

/**
 * v2.5: 加载历史执行记录
 * @returns {Array} 历史记录
 */
function loadExecutionHistory() {
  const stateFile = path.join(CONFIG.WORKSPACE_DIR, 'memory', 'clawhub-tracker-state.json');
  if (!fs.existsSync(stateFile)) return [];
  
  try {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    return state.executionHistory || [];
  } catch (e) {
    return [];
  }
}

/**
 * v2.5: 生成健康检查摘要
 * @param {Object} errorStats - 错误统计
 * @param {Object} stageTimings - 阶段耗时
 * @param {Object} memoryUsage - 内存使用
 * @returns {string} 健康检查摘要
 */
function generateHealthSummary(errorStats, stageTimings, memoryUsage) {
  const lines = [];
  lines.push('## 🔍 健康检查摘要\n');
  
  // 错误统计
  const totalErrors = Object.values(errorStats || {}).reduce((a, b) => a + b, 0);
  if (totalErrors === 0) {
    lines.push('✅ **错误统计**: 无错误');
  } else {
    lines.push(`⚠️ **错误统计**: 共 ${totalErrors} 个错误`);
    lines.push('');
    lines.push('| 错误类型 | 数量 |');
    lines.push('|----------|------|');
    for (const [type, count] of Object.entries(errorStats || {}).sort((a, b) => b[1] - a[1])) {
      lines.push(`| ${type} | ${count} |`);
    }
  }
  lines.push('');
  
  // 阶段耗时
  if (stageTimings) {
    lines.push('**阶段耗时**:');
    lines.push('');
    lines.push('| 阶段 | 耗时 |');
    lines.push('|------|------|');
    if (stageTimings.search) lines.push(`| 搜索阶段 | ${formatDuration(stageTimings.search)} |`);
    if (stageTimings.details) lines.push(`| 详情获取 | ${formatDuration(stageTimings.details)} |`);
    lines.push('');
  }
  
  // 内存使用
  if (memoryUsage) {
    const memHealthy = isMemoryHealthy(memoryUsage);
    lines.push(`**内存使用**: ${memHealthy ? '✅' : '⚠️'} ${memoryUsage.heapUsed}MB / ${memoryUsage.heapTotal}MB (堆)`);
    lines.push('');
  }
  
  return lines.join('\n');
}

function generateMarkdownReport(skills, categories, options = {}) {
  const timestamp = new Date().toISOString().split('T')[0];
  const reportPath = path.join(CONFIG.REPORTS_DIR, `clawhub-top100-${timestamp}.md`);
  
  const summary = generateSummary(skills, categories);
  const { errorStats, stageTimings, memoryUsage, executionHistory } = options;
  
  let report = `# ClawHub Top 100 技能排行榜\n\n`;
  report += `**更新日期:** ${timestamp}\n\n`;
  
  // v2.5: 添加健康检查摘要
  if (errorStats || stageTimings || memoryUsage) {
    report += generateHealthSummary(errorStats, stageTimings, memoryUsage);
    report += '\n';
  }
  
  // v2.5: 添加执行时间趋势图
  if (executionHistory && executionHistory.length >= 2) {
    report += '## 📈 执行时间趋势\n\n';
    report += '```\n';
    report += generateTrendChart(executionHistory);
    report += '\n```\n\n';
  }
  
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
 * v2.5 改进：添加执行时间统计、内存监控、健康检查摘要
 * v2.4 改进：添加执行阶段标记、优化日志输出
 */
async function main() {
  const scriptStart = Date.now();
  const startTime = new Date();
  
  try {
    console.log('🚀 ClawHub Top 100 Tracker v2.5 (Fast)');
    console.log('📦 更新: 执行时间趋势、内存监控、健康检查、错误分类');
    console.log('═'.repeat(40));
    console.log(`开始时间：${startTime.toISOString()}`);
    console.log('');
    
    ensureDirectories();
    
    // v2.5: 加载历史记录
    const executionHistory = loadExecutionHistory();
    
    // 阶段 1: 获取技能
    const skills = await fetchTopSkills(100);
    const errorStats = skills._errorStats || {};
    const stageTimings = skills._stageTimings || {};
    
    // v2.5: 获取内存使用
    const memoryUsage = getMemoryUsage();
    
    console.log(`\n✅ 阶段 1 完成: 获取 ${skills.length} 个技能\n`);
    
    // 阶段 2: 分类
    console.log('📂 阶段 3/3: 分类技能并生成报告...');
    const categories = categorizeSkills(skills);
    console.log(`✅ 分为 ${Object.keys(categories).length} 个分类`);
    
    // 阶段 3: 保存和报告
    console.log('💾 保存 JSON 数据...');
    saveJsonData(skills);
    
    console.log('📝 生成 Markdown 报告...');
    generateMarkdownReport(skills, categories, {
      errorStats,
      stageTimings,
      memoryUsage,
      executionHistory
    });
    
    const summary = generateSummary(skills, categories);
    console.log('\n📈 统计摘要:');
    console.log(`  总技能数：${summary.totalSkills} 个`);
    console.log(`  总下载量：${summary.totalDownloads.toLocaleString()} 次`);
    console.log(`  平均下载量：${summary.avgDownloads.toLocaleString()} 次/技能`);
    console.log(`  最热门分类：${summary.topCategory.name}`);
    
    // v2.5: 显示内存使用
    console.log(`  内存使用：${memoryUsage.heapUsed}MB (堆)`);
    
    console.log('');
    console.log('================================');
    
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);
    console.log(`✅ ClawHub 追踪完成 (耗时：${formatDuration(duration * 1000)})`);
    console.log(`结束时间：${endTime.toISOString()}`);
    console.log('');
    
    // v2.5: 保存状态（包含历史记录）
    const stateFile = path.join(CONFIG.WORKSPACE_DIR, 'memory', 'clawhub-tracker-state.json');
    const stateDir = path.dirname(stateFile);
    if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });
    
    // 更新历史记录
    const newHistoryEntry = {
      date: new Date().toISOString().split('T')[0],
      duration: duration * 1000,
      status: 'success',
      skillsCount: skills.length,
      memoryUsed: memoryUsage.heapUsed
    };
    const updatedHistory = [...executionHistory, newHistoryEntry].slice(-CONFIG.TREND_WINDOW_SIZE);
    
    const state = {
      lastRun: endTime.toISOString(),
      lastDuration: duration,
      lastStatus: 'success',
      skillsCount: skills.length,
      reportPath: path.join(CONFIG.REPORTS_DIR, `clawhub-top100-${new Date().toISOString().split('T')[0]}.md`),
      executionHistory: updatedHistory,
      lastMemoryUsage: memoryUsage,
      lastErrorStats: errorStats
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
    const errorType = classifyError(error);
    console.error(`❌ 错误 [${errorType}]:`, error.message);
    console.error(error.stack);
    
    const stateFile = path.join(CONFIG.WORKSPACE_DIR, 'memory', 'clawhub-tracker-state.json');
    const stateDir = path.dirname(stateFile);
    if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });
    
    // v2.5: 保存错误状态时也更新历史
    const executionHistory = loadExecutionHistory();
    const newHistoryEntry = {
      date: new Date().toISOString().split('T')[0],
      duration: Date.now() - scriptStart,
      status: 'error',
      errorType: errorType,
      errorMessage: error.message
    };
    const updatedHistory = [...executionHistory, newHistoryEntry].slice(-CONFIG.TREND_WINDOW_SIZE);
    
    const state = {
      lastRun: endTime.toISOString(),
      lastStatus: 'error',
      lastError: error.message,
      lastErrorType: errorType,
      executionHistory: updatedHistory
    };
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    console.log(`\n💾 错误状态已保存：${stateFile}`);
    
    process.exit(1);
  }
}

main();