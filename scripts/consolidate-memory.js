#!/usr/bin/env node
/**
 * OpenClaw Memory Consolidation Script v2.1
 * 
 * 定期 consolidating 日常记忆，提取长期模式到 MEMORY.md
 * 
 * 功能：
 * 1. 扫描最近 7 天的日常记忆文件
 * 2. 智能提取关键信息（决策、偏好、教训、待办）
 * 3. 去重并追加到 MEMORY.md
 * 4. 自动 Git 提交变更
 * 
 * 用法：node scripts/consolidate-memory.js
 * 
 * 更新记录：
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
const GIT_ENABLED = true; // 是否启用 Git 自动提交

console.log('🪞 OpenClaw 记忆巩固脚本 v2.1');
console.log('================================');
console.log(`工作目录：${WORKSPACE_DIR}`);
console.log(`记忆目录：${MEMORY_DIR}`);
console.log(`记忆文件：${MEMORY_FILE}`);
console.log(`Git 集成：${GIT_ENABLED ? '✅ 启用' : '❌ 禁用'}`);
console.log('');

// ============ 工具函数 ============

/**
 * 安全执行 shell 命令
 * @param {string} command - 命令
 * @param {boolean} silent - 是否静默失败
 * @returns {string} 命令输出
 */
function safeExec(command, silent = true) {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch (e) {
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
  
  if (!fs.existsSync(MEMORY_DIR)) {
    console.log('⚠️ 记忆目录不存在');
    return logs;
  }
  
  const files = fs.readdirSync(MEMORY_DIR)
    .filter(f => f.endsWith('.md') && /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .reverse(); // 最新的在前
  
  for (const file of files.slice(0, 7)) { // 最近 7 天
    const content = fs.readFileSync(path.join(MEMORY_DIR, file), 'utf-8');
    logs.push({ file, content });
  }
  
  console.log(`📖 读取 ${logs.length} 个记忆文件`);
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

// ============ 主流程 ============

function main() {
  console.log('📖 读取日常记忆...');
  const logs = readDailyLogs();
  
  console.log('🔍 提取关键信息...');
  const insights = extractInsights(logs);
  
  console.log('📝 生成巩固报告...');
  const report = generateConsolidationReport(insights);
  
  // 追加到 MEMORY.md
  console.log('💾 更新 MEMORY.md...');
  const currentMemory = readMemoryFile();
  fs.writeFileSync(MEMORY_FILE, currentMemory + report);
  
  // Git 提交
  console.log('');
  if (GIT_ENABLED) {
    const commitMsg = `🪞 ${new Date().toISOString().split('T')[0]} 记忆巩固 - 提取 ${insights.length} 条关键信息`;
    gitCommit(commitMsg);
  }
  
  console.log('');
  console.log('================================');
  console.log('✅ 记忆巩固完成');
  console.log(`📊 处理 ${logs.length} 个文件，提取 ${insights.length} 条关键信息`);
  console.log('');
}

main();
