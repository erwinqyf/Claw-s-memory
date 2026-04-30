#!/usr/bin/env node
/**
 * OpenClaw Memory Consolidation Script v2.4
 * 
 * 定期 consolidating 日常记忆，提取长期模式到 MEMORY.md
 * 
 * 功能：
 * 1. 扫描最近 7 天的日常记忆文件
 * 2. 智能提取关键信息（决策、偏好、教训、待办）
 * 3. 去重并追加到 MEMORY.md
 * 4. 自动 Git 提交变更
 * 5. 执行时间统计与趋势分析
 * 6. 健康检查摘要
 * 7. 文件大小统计与监控
 * 
 * 用法：node scripts/consolidate-memory.js
 * 
 * 更新记录：
 * - v2.4 (2026-04-22): 添加文件大小统计、优化错误分类、改进报告格式
 * - v2.3 (2026-04-20): 添加执行时间趋势分析、改进健康检查摘要、优化日志输出格式
 * - v2.2 (2026-04-18): 添加执行时间统计、优化错误处理、改进日志格式
 * - v2.1 (2026-04-13): 修复 Git 提交目录问题，添加错误处理，优化日志输出
 * - v2.0 (2026-03-29): 添加 Git 集成、改进提取逻辑、添加去重机制
 * - v1.0: 基础版本
 */

const SCRIPT_VERSION = '2.7';
const SCRIPT_START_TIME = Date.now();

/**
 * 脚本版本历史：
 * - v2.7 (2026-05-01): 增强错误处理与优雅降级、改进信息提取去重、添加内存监控
 * - v2.6 (2026-04-27): 优化日志输出格式，添加执行阶段标记，改进错误分类
 * - v2.5 (2026-04-26): 优化 classifyError 函数，增强错误模式识别
 * - v2.4 (2026-04-22): 添加文件大小统计、优化错误分类、改进报告格式
 * - v2.3 (2026-04-20): 添加执行时间趋势分析、改进健康检查摘要、优化日志输出格式
 * - v2.2 (2026-04-18): 添加执行时间统计、优化错误处理、改进日志格式
 * - v2.1 (2026-04-13): 修复 Git 提交目录问题，添加错误处理，优化日志输出
 * - v2.0 (2026-03-29): 添加 Git 集成、改进提取逻辑、添加去重机制
 * - v1.0: 基础版本
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============ 配置常量 ============
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace');
const MEMORY_DIR = path.join(WORKSPACE_DIR, 'memory');
const MEMORY_FILE = path.join(WORKSPACE_DIR, 'MEMORY.md');
const STATE_FILE = path.join(MEMORY_DIR, 'consolidate-state.json');
const GIT_ENABLED = true; // 是否启用 Git 自动提交

// 执行时间趋势分析配置
const TREND_WINDOW_SIZE = 10; // 保留最近10次执行记录

console.log(`🪞 OpenClaw 记忆巩固脚本 v${SCRIPT_VERSION}`);
console.log('================================');
console.log(`工作目录：${WORKSPACE_DIR}`);
console.log(`记忆目录：${MEMORY_DIR}`);
console.log(`记忆文件：${MEMORY_FILE}`);
console.log(`状态文件：${STATE_FILE}`);
console.log(`Git 集成：${GIT_ENABLED ? '✅ 启用' : '❌ 禁用'}`);
console.log('');

// ============ 辅助函数 ============

/**
 * 格式化执行时间
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
 * 获取当前内存使用情况
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
 * 检查内存使用是否健康
 * @param {Object} mem - 内存使用统计
 * @returns {boolean} 是否健康
 */
function isMemoryHealthy(mem) {
  // 如果堆内存使用超过 512MB，认为不健康
  return mem.heapUsed < 512;
}

/**
 * 读取状态文件
 * @returns {Object} 状态数据
 */
function readStateFile() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch (err) {
    console.log(`   ⚠️ 状态文件读取失败: ${err.message}`);
  }
  return { runs: [], version: SCRIPT_VERSION };
}

/**
 * 保存状态文件
 * @param {Object} state - 状态数据
 */
function saveStateFile(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.log(`   ⚠️ 状态文件保存失败: ${err.message}`);
  }
}

/**
 * 分析执行时间趋势
 * @param {Array} runs - 历史执行记录
 * @param {number} currentDuration - 当前执行时间
 * @returns {Object} 趋势分析结果
 */
function analyzeTrend(runs, currentDuration) {
  if (runs.length < 3) {
    return { trend: 'insufficient_data', message: '数据不足，需要至少3次执行记录' };
  }
  
  const recent = runs.slice(-TREND_WINDOW_SIZE);
  const avg = recent.reduce((a, b) => a + b.duration, 0) / recent.length;
  const min = Math.min(...recent.map(r => r.duration));
  const max = Math.max(...recent.map(r => r.duration));
  
  // 计算与平均值的偏差
  const deviation = ((currentDuration - avg) / avg) * 100;
  
  let trend = 'stable';
  let message = `执行时间稳定 (平均: ${formatDuration(avg)})`;
  
  if (deviation > 20) {
    trend = 'slower';
    message = `⚠️ 执行时间增加 ${deviation.toFixed(1)}% (平均: ${formatDuration(avg)})`;
  } else if (deviation < -20) {
    trend = 'faster';
    message = `✨ 执行时间减少 ${Math.abs(deviation).toFixed(1)}% (平均: ${formatDuration(avg)})`;
  }
  
  return { trend, message, avg, min, max, deviation, count: recent.length };
}

// ============ 工具函数 ============

/**
 * 安全执行 shell 命令
 * @param {string} command - 命令
 * @param {boolean} silent - 是否静默失败
 * @returns {string} 命令输出
 */
function safeExec(command, silent = true) {
  const start = Date.now();
  try {
    const result = execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.log(`   ⏱️ 命令耗时: ${formatDuration(duration)}`);
    }
    return result;
  } catch (e) {
    const duration = Date.now() - start;
    if (!silent) {
      console.log(`   ⚠️ 命令失败 (${formatDuration(duration)}): ${command}`);
    }
    return silent ? '' : null;
  }
}

// ============ 核心函数 ============

/**
 * 读取 MEMORY.md
 * @returns {string} 文件内容
 */
function readMemoryFile() {
  try {
    return fs.readFileSync(MEMORY_FILE, 'utf-8');
  } catch (err) {
    console.log('⚠️ MEMORY.md 不存在，创建新文件');
    return '# MEMORY.md - Long-term Memory\n\n';
  }
}

/**
 * 读取日常记忆文件
 * 扫描 memory/ 目录，读取最近 7 天的 .md 文件
 * 支持优雅降级：单文件失败不中断整体流程
 * 
 * @returns {Array<{file: string, content: string}>} 日志列表
 * @example
 * const logs = readDailyLogs();
 * // logs = [{ file: '2026-04-27.md', content: '...' }, ...]
 */
function readDailyLogs() {
  const logs = [];
  const start = Date.now();
  const errors = []; // 收集错误信息
  
  if (!fs.existsSync(MEMORY_DIR)) {
    console.log('⚠️ 记忆目录不存在');
    return logs;
  }
  
  // 检查内存状态
  const memBefore = getMemoryUsage();
  if (!isMemoryHealthy(memBefore)) {
    console.log(`⚠️ 内存使用较高: ${memBefore.heapUsed}MB，可能影响性能`);
  }
  
  // 使用更高效的文件遍历：先获取所有文件，再过滤和排序
  let allFiles;
  try {
    allFiles = fs.readdirSync(MEMORY_DIR, { withFileTypes: true });
  } catch (err) {
    const errorType = classifyFileError(err);
    console.log(`   ⚠️ 目录读取失败 [${errorType}]: ${err.message}`);
    return logs;
  }
  
  // 过滤：只保留符合日期格式的 .md 文件，且是文件（不是目录）
  const datePattern = /^\d{4}-\d{2}-\d{2}\.md$/;
  const files = allFiles
    .filter(dirent => dirent.isFile() && datePattern.test(dirent.name))
    .map(dirent => dirent.name)
    .sort()
    .reverse(); // 最新的在前
  
  // 限制读取最近 7 天，但保留更多候选以应对读取失败
  const targetFiles = files.slice(0, 10);
  let readErrors = 0;
  let skippedNonDaily = 0;
  let skippedLargeFiles = 0;
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB 文件大小限制
  
  for (const file of targetFiles) {
    // 只读取标准日期格式文件（排除带时间戳的文件如 2026-04-07-0949.md）
    if (!datePattern.test(file)) {
      skippedNonDaily++;
      continue;
    }
    
    // 已达到 7 个文件限制
    if (logs.length >= 7) break;
    
    const filePath = path.join(MEMORY_DIR, file);
    
    try {
      // 预检查文件大小
      const stats = fs.statSync(filePath);
      if (stats.size > MAX_FILE_SIZE) {
        skippedLargeFiles++;
        errors.push({ file, reason: 'FILE_TOO_LARGE', size: stats.size });
        continue; // 跳过超大文件，继续处理其他
      }
      
      const content = fs.readFileSync(filePath, 'utf-8');
      logs.push({ file, content, size: stats.size });
    } catch (err) {
      readErrors++;
      // 分类错误类型，提供更具体的错误信息
      const errorType = classifyFileError(err);
      errors.push({ file, reason: errorType, message: err.message });
      console.log(`   ⚠️ 读取失败 [${errorType}]: ${file} - ${err.message}`);
      // 优雅降级：继续处理其他文件
      continue;
    }
  }
  
  const duration = Date.now() - start;
  const memAfter = getMemoryUsage();
  const memDelta = Math.round((memAfter.heapUsed - memBefore.heapUsed) * 100) / 100;
  
  // 输出摘要
  const statusIcon = readErrors > 0 ? '⚠️' : '✅';
  let summary = `${statusIcon} 读取 ${logs.length} 个记忆文件 (${duration}ms)`;
  if (readErrors > 0) summary += ` - ${readErrors} 个失败`;
  if (skippedNonDaily > 0) summary += ` - ${skippedNonDaily} 个非日文件跳过`;
  if (skippedLargeFiles > 0) summary += ` - ${skippedLargeFiles} 个超大文件跳过`;
  if (memDelta > 0) summary += ` - 内存+${memDelta}MB`;
  console.log(summary);
  
  // 如果有错误，输出错误摘要
  if (errors.length > 0) {
    const errorTypes = errors.reduce((acc, e) => {
      acc[e.reason] = (acc[e.reason] || 0) + 1;
      return acc;
    }, {});
    const errorSummary = Object.entries(errorTypes)
      .map(([type, count]) => `${type}:${count}`)
      .join(', ');
    console.log(`   📊 错误分类: ${errorSummary}`);
  }
  
  return logs;
}

/**
 * 分类文件操作错误类型
 * 用于提供更具体的错误诊断信息
 * 
 * @param {Error} err - 错误对象
 * @returns {string} 错误类型标签
 */
function classifyFileError(err) {
  if (!err) return 'UNKNOWN';
  
  const code = err.code || '';
  const message = err.message || '';
  
  // 权限错误
  if (code === 'EACCES' || code === 'EPERM' || message.includes('permission')) {
    return 'PERM';
  }
  // 文件不存在
  if (code === 'ENOENT' || message.includes('no such file')) {
    return 'MISSING';
  }
  // 磁盘空间
  if (code === 'ENOSPC' || message.includes('space')) {
    return 'DISK';
  }
  // 文件过大
  if (code === 'EOVERFLOW' || message.includes('too large')) {
    return 'SIZE';
  }
  // 编码错误
  if (message.includes('encoding') || message.includes('invalid character')) {
    return 'ENCODING';
  }
  
  return 'IO';
}

/**
 * 智能提取关键信息
 * 从日志内容中提取决策、教训、偏好、待办、重要信息
 * 使用改进的去重算法和评分机制
 * 
 * @param {Array} logs - 日志列表
 * @returns {Array<{source: string, text: string, category: string, score: number}>} 提取的信息
 * @example
 * const insights = extractInsights(logs);
 * // insights = [{ source: '2026-04-27.md', text: '...', category: '决策', score: 0.85 }, ...]
 */
function extractInsights(logs) {
  const insights = [];
  const seen = new Set(); // 去重集合 - 使用标准化后的文本
  const semanticSeen = new Map(); // 语义去重 - 检测相似内容
  
  // 分类关键词配置
  // 每个类别包含中英文关键词，支持大小写不敏感匹配
  const categories = {
    '决策': ['决策', '决定', '选择', 'adopt', 'decide', '确定', '采用', '方案'],
    '教训': ['教训', '经验', 'lesson', 'learned', '反思', '改进', 'mistake', '错误', '问题'],
    '偏好': ['偏好', '喜欢', 'prefer', 'favorite', '倾向', '习惯', '风格'],
    '待办': ['待办', 'TODO', 'todo', 'task', '计划', '待处理', 'pending', '待办事项'],
    '重要': ['重要', '关键', 'critical', 'important', '核心', 'essential', 'vital', 'major'],
    '技术': ['技术', '架构', 'design', 'implementation', '优化', 'refactor', '系统']
  };
  
  // 提取统计
  const stats = {};
  for (const cat of Object.keys(categories)) {
    stats[cat] = 0;
  }
  
  // 计算信息重要性评分
  function calculateScore(text, category) {
    let score = 0.5; // 基础分
    
    // 长度因子：适中长度（30-150字符）得分更高
    const len = text.length;
    if (len >= 30 && len <= 150) score += 0.2;
    else if (len >= 20 && len < 30) score += 0.1;
    else if (len > 150 && len <= 300) score += 0.1;
    
    // 类别权重
    const weights = { '重要': 0.15, '决策': 0.1, '教训': 0.1, '技术': 0.05, '待办': 0.05, '偏好': 0 };
    score += weights[category] || 0;
    
    // 质量信号
    if (text.includes('：') || text.includes(':')) score += 0.05; // 有结构化内容
    if (/\d{4}-\d{2}-\d{2}/.test(text)) score += 0.05; // 包含日期
    if (text.includes('✅') || text.includes('❌') || text.includes('⚠️')) score += 0.05; // 有状态标记
    
    return Math.min(score, 1.0); // 上限 1.0
  }
  
  // 标准化文本用于去重
  function normalize(text) {
    return text
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-z0-9]/g, '') // 只保留中文、英文、数字
      .slice(0, 80); // 限制长度
  }
  
  // 计算文本相似度（简单的 Jaccard 系数）
  function similarity(text1, text2) {
    const set1 = new Set(text1.split('').slice(0, 50));
    const set2 = new Set(text2.split('').slice(0, 50));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
  }
  
  for (const log of logs) {
    const lines = log.content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      
      // 过滤条件：
      // 1. 长度至少 10 个字符（太短无意义）
      // 2. 不以 # 开头（跳过 Markdown 标题）
      // 3. 不以 - 或 * 开头（跳过列表标记行本身）
      if (trimmed.length < 10 || trimmed.startsWith('#')) continue;
      if (/^[-*]\s*$/.test(trimmed.slice(0, 3))) continue;
      
      // 检查是否匹配任何类别
      for (const [category, keywords] of Object.entries(categories)) {
        const lowerTrimmed = trimmed.toLowerCase();
        const isMatch = keywords.some(kw => {
          const lowerKw = kw.toLowerCase();
          // 检查完整单词匹配或中文关键词包含
          if (/^[\u4e00-\u9fa5]/.test(kw)) {
            // 中文关键词：直接包含匹配
            return lowerTrimmed.includes(lowerKw);
          } else {
            // 英文关键词：边界匹配（避免匹配到单词的一部分）
            const regex = new RegExp(`\\b${lowerKw}\\b`, 'i');
            return regex.test(trimmed) || lowerTrimmed.includes(lowerKw);
          }
        });
        
        if (isMatch) {
          // 标准化去重检查
          const normalized = normalize(trimmed);
          if (seen.has(normalized)) {
            continue; // 完全重复
          }
          
          // 语义去重：检查相似度
          let isSimilar = false;
          for (const [existingNorm, existingText] of semanticSeen) {
            if (similarity(normalized, existingNorm) > 0.7) {
              isSimilar = true;
              // 如果新文本质量更高，替换旧的
              const newScore = calculateScore(trimmed, category);
              const existingInsight = insights.find(i => normalize(i.text) === existingNorm);
              if (existingInsight && newScore > existingInsight.score) {
                existingInsight.text = trimmed;
                existingInsight.source = log.file;
                existingInsight.score = newScore;
              }
              break;
            }
          }
          
          if (isSimilar) continue;
          
          // 添加到集合
          seen.add(normalized);
          semanticSeen.set(normalized, trimmed);
          
          const score = calculateScore(trimmed, category);
          insights.push({
            source: log.file,
            text: trimmed,
            category,
            score
          });
          stats[category]++;
          break; // 一行只归属一个类别
        }
      }
    }
  }
  
  // 按评分排序
  insights.sort((a, b) => b.score - a.score);
  
  // 输出分类统计
  const categorySummary = Object.entries(stats)
    .filter(([_, count]) => count > 0)
    .map(([cat, count]) => `${cat}:${count}`)
    .join(', ');
  
  const avgScore = insights.length > 0 
    ? (insights.reduce((sum, i) => sum + i.score, 0) / insights.length).toFixed(2)
    : 0;
  
  console.log(`💡 提取 ${insights.length} 条关键信息（已去重，平均评分: ${avgScore}）`);
  if (categorySummary) {
    console.log(`   📊 分类统计: ${categorySummary}`);
  }
  
  return insights;
}

/**
 * 生成巩固报告
 * 按类别分组展示提取的关键信息
 * 
 * @param {Array} insights - 提取的信息
 * @returns {string} Markdown 格式的报告内容
 */
function generateConsolidationReport(insights) {
  const timestamp = new Date().toISOString().split('T')[0];
  
  let report = `## ${timestamp} 记忆巩固\n\n`;
  report += `本次巩固检查了最近 7 天的日常记忆，提取了 ${insights.length} 条关键信息。\n\n`;
  
  if (insights.length > 0) {
    // 按类别分组
    const byCategory = {};
    for (const insight of insights) {
      if (!byCategory[insight.category]) {
        byCategory[insight.category] = [];
      }
      byCategory[insight.category].push(insight);
    }
    
    // 按优先级顺序输出类别
    const priority = ['重要', '决策', '教训', '技术', '待办', '偏好'];
    const categories = Object.keys(byCategory).sort((a, b) => {
      const idxA = priority.indexOf(a);
      const idxB = priority.indexOf(b);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
    
    for (const category of categories) {
      const items = byCategory[category];
      // 按评分排序，高评分在前
      items.sort((a, b) => b.score - a.score);
      report += `### ${category} (${items.length} 条)\n\n`;
      for (const insight of items) {
        // 截断过长的文本，保持可读性
        let text = insight.text;
        if (text.length > 200) {
          text = text.slice(0, 197) + '...';
        }
        // 高评分项目添加星标
        const star = insight.score >= 0.8 ? '⭐ ' : '';
        report += `- ${star}[${insight.source}] ${text}\n`;
      }
      report += '\n';
    }
  } else {
    report += '> 本次未提取到关键信息。\n\n';
  }
  
  report += '---\n\n';
  return report;
}

/**
 * Git 提交变更
 * @param {string} message - 提交信息
 * @returns {boolean} 是否成功
 */
function gitCommit(message) {
  if (!GIT_ENABLED) {
    console.log('⚠️ Git 已禁用，跳过提交');
    return false;
  }
  
  // 切换到工作目录执行 Git 命令
  const gitOpts = { 
    encoding: 'utf-8', 
    stdio: ['pipe', 'pipe', 'ignore'],
    cwd: WORKSPACE_DIR
  };
  
  console.log('🔧 检查 Git 状态...');
  let status;
  try {
    status = execSync('git status --porcelain', gitOpts).trim();
  } catch (e) {
    console.log('⚠️ 无法检查 Git 状态');
    return false;
  }
  
  if (!status) {
    console.log('✅ Git 工作区干净，无需提交');
    return false;
  }
  
  console.log('📝 Git 变更：');
  status.split('\n').forEach(line => console.log(`   ${line}`));
  
  console.log('💾 Git add...');
  try {
    execSync('git add MEMORY.md', gitOpts);
  } catch (e) {
    console.log('⚠️ Git add 失败');
  }
  
  console.log('💾 Git commit...');
  try {
    execSync(`git commit -m "${message}"`, gitOpts);
    console.log('✅ 提交成功');
  } catch (e) {
    console.log('⚠️ Git commit 失败（可能无变更）');
  }
  
  console.log('🚀 Git push...');
  try {
    execSync('git push', gitOpts);
    console.log('✅ 推送成功');
  } catch (e) {
    console.log('⚠️ Git push 失败');
  }
  
  return true;
}

/**
 * 统计文件大小信息
 * @param {Array} logs - 日志列表
 * @returns {Object} 文件大小统计
 */
function analyzeFileSizes(logs) {
  let totalSize = 0;
  let maxSize = 0;
  let minSize = Infinity;
  const sizes = [];
  
  for (const log of logs) {
    const size = Buffer.byteLength(log.content, 'utf8');
    totalSize += size;
    sizes.push({ file: log.file, size });
    maxSize = Math.max(maxSize, size);
    minSize = Math.min(minSize, size);
  }
  
  const avgSize = logs.length > 0 ? totalSize / logs.length : 0;
  
  // 格式化文件大小
  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  }
  
  return {
    totalSize,
    avgSize,
    maxSize,
    minSize: minSize === Infinity ? 0 : minSize,
    count: logs.length,
    formatted: {
      total: formatBytes(totalSize),
      avg: formatBytes(avgSize),
      max: formatBytes(maxSize),
      min: formatBytes(minSize === Infinity ? 0 : minSize)
    }
  };
}

// ============ 主流程 ============

function main() {
  // 读取历史状态
  const state = readStateFile();
  
  console.log('📖 读取日常记忆...');
  const logs = readDailyLogs();
  
  // 文件大小统计
  console.log('📊 统计文件大小...');
  const fileStats = analyzeFileSizes(logs);
  console.log(`   总大小: ${fileStats.formatted.total} (${fileStats.count} 个文件)`);
  console.log(`   平均: ${fileStats.formatted.avg}, 最大: ${fileStats.formatted.max}, 最小: ${fileStats.formatted.min}`);
  
  console.log('🔍 提取关键信息...');
  const insightsStart = Date.now();
  const insights = extractInsights(logs);
  const extractDuration = Date.now() - insightsStart;
  console.log(`   ⏱️ 提取耗时: ${formatDuration(extractDuration)}`);
  
  console.log('📝 生成巩固报告...');
  const report = generateConsolidationReport(insights);
  
  // 追加到 MEMORY.md
  console.log('💾 更新 MEMORY.md...');
  const writeStart = Date.now();
  const currentMemory = readMemoryFile();
  fs.writeFileSync(MEMORY_FILE, currentMemory + report);
  const writeDuration = Date.now() - writeStart;
  console.log(`   ⏱️ 写入耗时: ${formatDuration(writeDuration)}`);
  
  // Git 提交
  console.log('');
  let gitDuration = 0;
  if (GIT_ENABLED) {
    const gitStart = Date.now();
    const commitMsg = `🪞 ${new Date().toISOString().split('T')[0]} 记忆巩固 - 提取 ${insights.length} 条关键信息`;
    gitCommit(commitMsg);
    gitDuration = Date.now() - gitStart;
  }
  
  // 计算总耗时并保存状态
  const totalDuration = Date.now() - SCRIPT_START_TIME;
  const runRecord = {
    timestamp: new Date().toISOString(),
    duration: totalDuration,
    filesProcessed: logs.length,
    insightsExtracted: insights.length,
    fileStats: {
      totalSize: fileStats.totalSize,
      avgSize: fileStats.avgSize,
      count: fileStats.count
    },
    version: SCRIPT_VERSION
  };
  
  state.runs = [...(state.runs || []), runRecord].slice(-TREND_WINDOW_SIZE);
  state.version = SCRIPT_VERSION;
  state.lastRun = runRecord;
  saveStateFile(state);
  
  // 执行时间趋势分析
  const trend = analyzeTrend(state.runs.slice(0, -1), totalDuration);
  
  // 内存使用监控
  const finalMem = getMemoryUsage();
  const peakMem = Math.max(finalMem.heapUsed, fileStats.totalSize / 1024 / 1024 * 2); // 估算峰值
  
  console.log('');
  console.log('================================');
  console.log('✅ 记忆巩固完成');
  console.log(`📊 处理 ${logs.length} 个文件 (${fileStats.formatted.total})，提取 ${insights.length} 条关键信息`);
  console.log(`⏱️ 总耗时: ${formatDuration(totalDuration)}`);
  console.log(`📈 趋势分析: ${trend.message}`);
  if (state.runs.length > 1) {
    console.log(`📉 历史记录: ${state.runs.length} 次执行 (最快: ${formatDuration(trend.min)}, 最慢: ${formatDuration(trend.max)})`);
  }
  console.log(`🧠 内存使用: ${finalMem.heapUsed}MB (峰值约 ${Math.round(peakMem)}MB)`);
  if (!isMemoryHealthy(finalMem)) {
    console.log(`⚠️ 内存使用较高，建议检查是否有内存泄漏`);
  }
  console.log('');
}

main();
