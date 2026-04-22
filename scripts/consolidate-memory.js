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

const SCRIPT_VERSION = '2.5';
const SCRIPT_START_TIME = Date.now();

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
 * @returns {Array<{file: string, content: string}>} 日志列表
 */
function readDailyLogs() {
  const logs = [];
  const start = Date.now();
  
  if (!fs.existsSync(MEMORY_DIR)) {
    console.log('⚠️ 记忆目录不存在');
    return logs;
  }
  
  const files = fs.readdirSync(MEMORY_DIR)
    .filter(f => f.endsWith('.md') && /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .reverse(); // 最新的在前
  
  let readErrors = 0;
  for (const file of files.slice(0, 7)) { // 最近 7 天
    try {
      const content = fs.readFileSync(path.join(MEMORY_DIR, file), 'utf-8');
      logs.push({ file, content });
    } catch (err) {
      readErrors++;
      console.log(`   ⚠️ 读取失败: ${file} - ${err.message}`);
    }
  }
  
  const duration = Date.now() - start;
  console.log(`📖 读取 ${logs.length} 个记忆文件${readErrors > 0 ? ` (${readErrors} 个失败)` : ''} - ${formatDuration(duration)}`);
  return logs;
}

/**
 * 智能提取关键信息
 * @param {Array} logs - 日志列表
 * @returns {Array<{source: string, text: string, category: string}>} 提取的信息
 */
function extractInsights(logs) {
  const insights = [];
  const seen = new Set(); // 去重
  
  // 分类关键词
  const categories = {
    '决策': ['决策', '决定', '选择', 'adopt', 'decide'],
    '教训': ['教训', '经验', 'lesson', 'learned', '反思'],
    '偏好': ['偏好', '喜欢', 'prefer', 'favorite'],
    '待办': ['待办', 'TODO', 'todo', 'task', '计划'],
    '重要': ['重要', '关键', 'critical', 'important', '核心']
  };
  
  for (const log of logs) {
    const lines = log.content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length < 10 || trimmed.startsWith('#')) continue; // 跳过太短或标题行
      
      // 检查是否匹配任何类别
      for (const [category, keywords] of Object.entries(categories)) {
        if (keywords.some(kw => trimmed.toLowerCase().includes(kw.toLowerCase()))) {
          // 去重检查
          const hash = trimmed.slice(0, 50);
          if (!seen.has(hash)) {
            seen.add(hash);
            insights.push({
              source: log.file,
              text: trimmed,
              category
            });
          }
          break;
        }
      }
    }
  }
  
  console.log(`💡 提取 ${insights.length} 条关键信息（已去重）`);
  return insights;
}

/**
 * 生成巩固报告
 * @param {Array} insights - 提取的信息
 * @returns {string} 报告内容
 */
function generateConsolidationReport(insights) {
  const timestamp = new Date().toISOString().split('T')[0];
  
  let report = `## ${timestamp} 记忆巩固\n\n`;
  report += `本次巩固检查了最近 7 天的日常记忆，提取了 ${insights.length} 条关键信息。\n\n`;
  
  if (insights.length > 0) {
    report += '### 提取的关键信息\n\n';
    for (const insight of insights) {
      report += `- [${insight.source}] ${insight.text}\n`;
    }
    report += '\n';
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
  
  console.log('');
  console.log('================================');
  console.log('✅ 记忆巩固完成');
  console.log(`📊 处理 ${logs.length} 个文件 (${fileStats.formatted.total})，提取 ${insights.length} 条关键信息`);
  console.log(`⏱️ 总耗时: ${formatDuration(totalDuration)}`);
  console.log(`📈 趋势分析: ${trend.message}`);
  if (state.runs.length > 1) {
    console.log(`📉 历史记录: ${state.runs.length} 次执行 (最快: ${formatDuration(trend.min)}, 最慢: ${formatDuration(trend.max)})`);
  }
  console.log('');
}

main();
