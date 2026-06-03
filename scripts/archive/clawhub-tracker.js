#!/usr/bin/env node
/**
 * ClawHub Top100 追踪脚本 v2.1
 * 抓取 ClawHub 下载量前100名技能并生成报告
 * 
 * 版本历史:
 * v2.1 (2026-05-12) - 添加数据验证、性能监控、导出格式多样化
 * v2.0 (2026-05-11) - 添加错误分类器、趋势分析、结构化日志
 * v1.0 (2026-03-20) - 初始版本
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = path.join(process.env.HOME || '/home/admin', '.openclaw/workspace');
const DATA_DIR = path.join(WORKSPACE_DIR, 'data');
const REPORTS_DIR = path.join(WORKSPACE_DIR, 'reports');
const STATE_FILE = path.join(DATA_DIR, 'clawhub-tracker-state.json');

// 日志级别
const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const CURRENT_LOG_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || 'INFO'];

// 性能监控
const perfMetrics = {
  startTime: null,
  stages: {},
  memory: []
};

function recordStage(name) {
  perfMetrics.stages[name] = Date.now();
  const memUsage = process.memoryUsage();
  perfMetrics.memory.push({ stage: name, ...memUsage });
}

// 结构化日志
function log(level, message, meta = {}) {
  const levelNum = LOG_LEVELS[level] || LOG_LEVELS.INFO;
  if (levelNum < CURRENT_LOG_LEVEL) return;
  
  const timestamp = new Date().toISOString();
  const emoji = { DEBUG: '🔍', INFO: 'ℹ️', WARN: '⚠️', ERROR: '❌' }[level];
  const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
  console.log(`${emoji} [${timestamp}] ${level}: ${message}${metaStr}`);
}

// 数据验证器
function validateSkill(skill, index) {
  const errors = [];
  
  if (!skill.name || typeof skill.name !== 'string') {
    errors.push(`[${index}] 缺少或无效的技能名称`);
  }
  if (!skill.slug || typeof skill.slug !== 'string') {
    errors.push(`[${index}] 缺少或无效的 slug`);
  }
  if (!skill.owner || typeof skill.owner !== 'string') {
    errors.push(`[${index}] 缺少或无效的作者信息`);
  }
  
  // 验证数字字段
  const downloads = parseNumber(skill.downloads);
  if (downloads < 0) {
    errors.push(`[${index}] 下载数为负数`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    skill: {
      ...skill,
      downloadsNum: downloads,
      starsNum: parseNumber(skill.stars)
    }
  };
}

// 批量验证
function validateSkills(skills) {
  const results = skills.map((s, i) => validateSkill(s, i));
  const validSkills = results.filter(r => r.valid).map(r => r.skill);
  const allErrors = results.filter(r => !r.valid).flatMap(r => r.errors);
  
  return {
    valid: validSkills,
    invalid: results.length - validSkills.length,
    errors: allErrors
  };
}

// 错误分类器
function classifyError(error) {
  const msg = error.message || String(error);
  
  if (msg.includes('ENOENT') || msg.includes('not found')) {
    return { type: 'FILE_NOT_FOUND', severity: 'ERROR', retryable: false };
  }
  if (msg.includes('EACCES') || msg.includes('permission')) {
    return { type: 'PERMISSION_DENIED', severity: 'ERROR', retryable: false };
  }
  if (msg.includes('ENOSPC') || msg.includes('space')) {
    return { type: 'DISK_FULL', severity: 'CRITICAL', retryable: false };
  }
  if (msg.includes('JSON') || msg.includes('parse')) {
    return { type: 'PARSE_ERROR', severity: 'ERROR', retryable: false };
  }
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
    return { type: 'TIMEOUT', severity: 'WARN', retryable: true };
  }
  return { type: 'UNKNOWN', severity: 'ERROR', retryable: false };
}

// 确保目录存在
function ensureDirectories() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      log('DEBUG', '创建数据目录', { path: DATA_DIR });
    }
    if (!fs.existsSync(REPORTS_DIR)) {
      fs.mkdirSync(REPORTS_DIR, { recursive: true });
      log('DEBUG', '创建报告目录', { path: REPORTS_DIR });
    }
    return true;
  } catch (error) {
    const classified = classifyError(error);
    log('ERROR', '目录创建失败', { error: classified, message: error.message });
    return false;
  }
}

const today = new Date().toISOString().split('T')[0];

// 状态管理
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    log('WARN', '状态文件读取失败，使用默认状态', { error: error.message });
  }
  return { lastRun: null, runCount: 0, errors: [] };
}

function saveState(state) {
  try {
    state.lastRun = new Date().toISOString();
    state.runCount = (state.runCount || 0) + 1;
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    log('DEBUG', '状态已保存', { runCount: state.runCount });
  } catch (error) {
    log('WARN', '状态保存失败', { error: error.message });
  }
}

// 从 ClawHub API 获取的数据
async function fetchTop100() {
  const dataPath = process.env.CLAWHUB_DATA_PATH || '/tmp/clawhub_top100_raw.json';
  
  if (!fs.existsSync(dataPath)) {
    const error = new Error(`数据文件不存在: ${dataPath}`);
    error.classified = classifyError(error);
    throw error;
  }
  
  let rawData;
  try {
    rawData = fs.readFileSync(dataPath, 'utf-8');
    log('DEBUG', '数据文件读取成功', { size: rawData.length });
  } catch (error) {
    error.classified = classifyError(error);
    throw error;
  }
  
  try {
    const parsed = JSON.parse(rawData);
    // ClawHub API 返回 { items: [...] } 格式
    const data = parsed.items || parsed;
    
    // 转换为脚本期望的格式
    const skills = data.map(item => ({
      name: item.displayName || item.slug,
      slug: item.slug,
      owner: item.publisher?.name || 'unknown',
      desc: item.summary || '',
      downloads: item.stats?.downloads?.toString() || '0',
      stars: item.stats?.stars?.toString() || '0',
      installs: item.stats?.installsCurrent?.toString() || '0',
      versions: item.stats?.versions?.toString() || '0',
      updatedAt: item.updatedAt
    }));
    
    log('INFO', '数据解析成功', { count: skills.length });
    return skills;
  } catch (error) {
    error.classified = classifyError(error);
    throw error;
  }
}

// 解析下载数和星星数
function parseNumber(str) {
  if (!str) return 0;
  const clean = str.replace(/[^\d.km]/gi, '');
  if (clean.includes('k')) {
    return parseFloat(clean.replace('k', '')) * 1000;
  }
  if (clean.includes('m')) {
    return parseFloat(clean.replace('m', '')) * 1000000;
  }
  return parseInt(clean) || 0;
}

// 生成分类（基于描述关键词）
const CATEGORY_KEYWORDS = {
  'Search': ['search', '搜索', 'find', 'query', 'lookup'],
  'Web/Browser': ['browser', 'web', 'scrap', 'crawl', 'fetch', 'surf'],
  'Memory': ['memory', 'remember', 'recall', 'store', 'persist'],
  'Automation': ['automation', 'workflow', 'n8n', 'automate', 'schedule', 'cron'],
  'Security': ['security', 'vet', 'audit', 'scan', 'protect', 'sanitize'],
  'Document': ['pdf', 'doc', 'excel', 'ppt', 'document', 'spreadsheet', 'csv'],
  'Media': ['image', 'video', 'photo', 'media', 'youtube', 'audio', 'music'],
  'Dev Tools': ['github', 'git', 'code', 'dev', 'developer', 'debug', 'lint'],
  'Communication': ['slack', 'discord', 'email', 'gmail', 'message', 'notify', 'chat'],
  'Finance': ['stock', 'finance', 'market', 'crypto', 'trading', 'invest'],
  'Weather': ['weather', 'forecast', 'climate', 'temperature'],
  'Skill Dev': ['skill', 'create', 'author', 'template', 'scaffold'],
  'Agent Enhancement': ['proactive', 'self-improving', 'enhance', 'upgrade', 'optimize'],
  'Data Analysis': ['data', 'analysis', 'analytics', 'chart', 'visualization', 'stats'],
  'Translation': ['translate', 'translation', 'language', 'i18n', 'localization']
};

// 分类置信度计算
function calculateCategoryConfidence(skill, category) {
  const desc = (skill.desc || '').toLowerCase();
  const name = (skill.name || '').toLowerCase();
  const text = `${name} ${desc}`;
  const keywords = CATEGORY_KEYWORDS[category] || [];
  
  let score = 0;
  let matchedKeywords = [];
  
  keywords.forEach(kw => {
    const regex = new RegExp(kw, 'gi');
    const matches = text.match(regex);
    if (matches) {
      score += matches.length;
      matchedKeywords.push(kw);
    }
  });
  
  // 名称匹配权重更高
  keywords.forEach(kw => {
    if (name.includes(kw)) {
      score += 2;
    }
  });
  
  return {
    score,
    matchedKeywords,
    confidence: Math.min(score / keywords.length, 1)
  };
}

function categorizeSkill(skill) {
  // 计算每个分类的置信度
  const categoryScores = {};
  for (const category of Object.keys(CATEGORY_KEYWORDS)) {
    categoryScores[category] = calculateCategoryConfidence(skill, category);
  }
  
  // 选择得分最高的分类
  const bestCategory = Object.entries(categoryScores)
    .sort((a, b) => b[1].score - a[1].score)
    .find(([_, data]) => data.score > 0);
  
  return bestCategory ? bestCategory[0] : 'Other';
}

// 生成 CSV 导出
function generateCSV(skills) {
  const headers = ['rank', 'name', 'slug', 'owner', 'downloads', 'stars', 'category', 'description'];
  const rows = skills.map((skill, idx) => {
    const category = categorizeSkill(skill);
    const desc = (skill.desc || '').replace(/"/g, '""').substring(0, 100);
    return [
      idx + 1,
      `"${(skill.name || '').replace(/"/g, '""')}"`,
      skill.slug,
      skill.owner,
      skill.downloads,
      skill.stars,
      category,
      `"${desc}"`
    ].join(',');
  });
  
  return [headers.join(','), ...rows].join('\n');
}

// 生成 JSON 统计摘要
function generateStatsSummary(skills) {
  const categories = {};
  skills.forEach(s => {
    const cat = categorizeSkill(s);
    categories[cat] = (categories[cat] || 0) + 1;
  });
  
  const totalDownloads = skills.reduce((sum, s) => sum + parseNumber(s.downloads), 0);
  const totalStars = skills.reduce((sum, s) => sum + parseNumber(s.stars), 0);
  
  return {
    generatedAt: new Date().toISOString(),
    totalSkills: skills.length,
    totalDownloads,
    totalStars,
    avgDownloads: Math.round(totalDownloads / skills.length),
    avgStars: Math.round(totalStars / skills.length),
    categories: Object.entries(categories)
      .map(([name, count]) => ({ name, count, percentage: (count / skills.length * 100).toFixed(1) }))
      .sort((a, b) => b.count - a.count),
    topAuthors: Object.entries(
      skills.reduce((acc, s) => {
        acc[s.owner] = (acc[s.owner] || 0) + 1;
        return acc;
      }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }))
  };
}

// 趋势分析 - 与历史数据对比
function analyzeTrends(currentSkills, state) {
  if (!state.lastData || !Array.isArray(state.lastData)) {
    return { hasTrends: false, message: '无历史数据可供对比' };
  }
  
  const trends = {
    hasTrends: true,
    newEntries: [],
    risers: [],
    fallers: [],
    stable: []
  };
  
  const lastRankMap = new Map(state.lastData.map((s, i) => [s.name, i + 1]));
  
  currentSkills.forEach((skill, idx) => {
    const currentRank = idx + 1;
    const lastRank = lastRankMap.get(skill.name);
    
    if (!lastRank) {
      trends.newEntries.push({ name: skill.name, rank: currentRank });
    } else if (currentRank < lastRank) {
      trends.risers.push({ name: skill.name, from: lastRank, to: currentRank, change: lastRank - currentRank });
    } else if (currentRank > lastRank) {
      trends.fallers.push({ name: skill.name, from: lastRank, to: currentRank, change: currentRank - lastRank });
    } else {
      trends.stable.push({ name: skill.name, rank: currentRank });
    }
  });
  
  // 排序：上升最多和下降最多的
  trends.risers.sort((a, b) => b.change - a.change);
  trends.fallers.sort((a, b) => b.change - a.change);
  
  return trends;
}

// 生成 Markdown 报告
function generateMarkdownReport(skills, trends = null, state = null) {
  const totalDownloads = skills.reduce((sum, s) => sum + parseNumber(s.downloads), 0);
  const totalStars = skills.reduce((sum, s) => sum + parseNumber(s.stars), 0);
  
  // 分类统计
  const categories = {};
  skills.forEach(s => {
    const cat = categorizeSkill(s);
    categories[cat] = (categories[cat] || 0) + 1;
  });
  
  let md = `# ClawHub Top100 技能追踪报告

**生成日期**: ${today}
**数据来源**: [ClawHub](https://clawhub.ai)
**运行次数**: ${state?.runCount || 1}

## 概览

| 指标 | 数值 |
|------|------|
| 追踪技能数 | ${skills.length} |
| 总下载量 | ${(totalDownloads / 1000).toFixed(1)}k |
| 总星星数 | ${(totalStars / 1000).toFixed(1)}k |

## 分类分布

| 分类 | 数量 | 占比 |
|------|------|------|
`;
  
  Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      const pct = ((count / skills.length) * 100).toFixed(1);
      md += `| ${cat} | ${count} | ${pct}% |\n`;
    });
  
  // 趋势分析
  if (trends?.hasTrends) {
    md += `
## 📈 趋势分析

`;
    if (trends.newEntries.length > 0) {
      md += `### 新上榜技能 (${trends.newEntries.length}个)\n`;
      trends.newEntries.slice(0, 5).forEach(s => {
        md += `- **${s.name}** (第${s.rank}名)\n`;
      });
      md += '\n';
    }
    
    if (trends.risers.length > 0) {
      md += `### 上升最快 🔥\n`;
      trends.risers.slice(0, 5).forEach(s => {
        md += `- **${s.name}**: 第${s.from}名 → 第${s.to}名 (↑${s.change})\n`;
      });
      md += '\n';
    }
    
    if (trends.fallers.length > 0) {
      md += `### 下降最多 📉\n`;
      trends.fallers.slice(0, 5).forEach(s => {
        md += `- **${s.name}**: 第${s.from}名 → 第${s.to}名 (↓${s.change})\n`;
      });
      md += '\n';
    }
  }
  
  md += `
## Top 100 技能详情

| 排名 | 作者 | 技能名 | 下载数 | 星星数 | 分类 | 描述 |
|------|------|--------|--------|--------|------|------|
`;
  
  skills.forEach((skill, idx) => {
    const rank = idx + 1;
    const author = skill.owner?.replace('@', '') || 'N/A';
    const name = skill.name || 'N/A';
    const downloads = skill.downloads || '0';
    const stars = skill.stars || '0';
    const category = categorizeSkill(skill);
    const desc = (skill.desc || '').substring(0, 50).replace(/\n/g, ' ') + '...';
    
    md += `| ${rank} | @${author} | ${name} | ${downloads} | ${stars} | ${category} | ${desc} |\n`;
  });
  
  md += `
## Top 10 亮点

`;
  
  skills.slice(0, 10).forEach((skill, idx) => {
    const author = skill.owner?.replace('@', '') || 'N/A';
    md += `${idx + 1}. **${skill.name}** (@${author}) - ${skill.downloads} 下载, ${skill.stars} 星星\n`;
  });
  
  md += `
---
*报告由 OpenClaw 自动生成 | 版本 v2.0*
`;
  
  return md;
}

// 主函数
async function main() {
  perfMetrics.startTime = Date.now();
  const state = loadState();
  
  log('INFO', 'ClawHub Top100 追踪开始', { version: '2.1', runCount: state.runCount + 1 });
  recordStage('start');
  
  // 确保目录存在
  if (!ensureDirectories()) {
    process.exit(1);
  }
  
  try {
    const skills = await fetchTop100();
    recordStage('fetch');
    log('INFO', '数据获取成功', { count: skills.length });
    
    // 数据验证
    const validation = validateSkills(skills);
    if (validation.invalid > 0) {
      log('WARN', '数据验证发现无效项', { 
        total: skills.length, 
        valid: validation.valid.length, 
        invalid: validation.invalid,
        errors: validation.errors.slice(0, 5) // 只显示前5个错误
      });
    } else {
      log('INFO', '数据验证通过', { count: validation.valid.length });
    }
    
    const validSkills = validation.valid;
    
    // 趋势分析
    const trends = analyzeTrends(validSkills, state);
    recordStage('trends');
    if (trends.hasTrends) {
      log('INFO', '趋势分析完成', { 
        newEntries: trends.newEntries.length,
        risers: trends.risers.length,
        fallers: trends.fallers.length
      });
    }
    
    // 保存 JSON 数据
    const jsonPath = path.join(DATA_DIR, `clawhub-top100-${today}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(validSkills, null, 2));
    log('INFO', 'JSON 数据已保存', { path: jsonPath });
    
    // 更新最新快照
    const latestPath = path.join(DATA_DIR, 'clawhub-top100-latest.json');
    fs.writeFileSync(latestPath, JSON.stringify(validSkills, null, 2));
    log('DEBUG', '最新快照已更新', { path: latestPath });
    
    // 生成 Markdown 报告
    const reportPath = path.join(REPORTS_DIR, `clawhub-top100-${today}.md`);
    const report = generateMarkdownReport(validSkills, trends, state);
    fs.writeFileSync(reportPath, report);
    log('INFO', 'Markdown 报告已生成', { path: reportPath });
    
    // 生成 CSV 导出
    const csvPath = path.join(DATA_DIR, `clawhub-top100-${today}.csv`);
    const csv = generateCSV(validSkills);
    fs.writeFileSync(csvPath, csv);
    log('INFO', 'CSV 导出已生成', { path: csvPath });
    
    // 生成统计摘要
    const statsPath = path.join(DATA_DIR, `clawhub-stats-${today}.json`);
    const stats = generateStatsSummary(validSkills);
    fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    log('INFO', '统计摘要已生成', { path: statsPath });
    recordStage('export');
    
    // 更新状态
    state.lastData = validSkills;
    saveState(state);
    recordStage('complete');
    
    // 输出摘要
    const duration = ((Date.now() - perfMetrics.startTime) / 1000).toFixed(2);
    const stageTimes = Object.entries(perfMetrics.stages).map(([name, time]) => ({
      stage: name,
      elapsed: `${((time - perfMetrics.startTime) / 1000).toFixed(2)}s`
    }));
    
    log('INFO', '执行摘要', {
      duration: `${duration}s`,
      skills: validSkills.length,
      validated: validation.valid.length,
      invalid: validation.invalid,
      top1: validSkills[0]?.name,
      top1Downloads: validSkills[0]?.downloads,
      stages: stageTimes
    });
    
    console.log('\n📊 ClawHub Top100 追踪完成!');
    console.log(`   技能总数: ${validSkills.length}`);
    console.log(`   验证通过: ${validation.valid.length}`);
    if (validation.invalid > 0) {
      console.log(`   无效数据: ${validation.invalid}`);
    }
    console.log(`   第一名: ${validSkills[0]?.name} (${validSkills[0]?.downloads})`);
    console.log(`   执行耗时: ${duration}s`);
    console.log(`   导出文件:`);
    console.log(`     - JSON: ${jsonPath}`);
    console.log(`     - CSV: ${csvPath}`);
    console.log(`     - Stats: ${statsPath}`);
    console.log(`     - Report: ${reportPath}`);
    
  } catch (error) {
    const classified = error.classified || classifyError(error);
    log('ERROR', '执行失败', { 
      type: classified.type,
      severity: classified.severity,
      retryable: classified.retryable,
      message: error.message 
    });
    
    // 记录错误到状态
    state.errors = state.errors || [];
    state.errors.push({
      time: new Date().toISOString(),
      type: classified.type,
      message: error.message
    });
    // 只保留最近 10 条错误
    if (state.errors.length > 10) {
      state.errors = state.errors.slice(-10);
    }
    saveState(state);
    
    process.exit(1);
  }
}

main();
