#!/usr/bin/env node
/**
 * OpenClaw Memory Consolidation Script
 * 定期 consolidating 日常记忆，提取长期模式到 MEMORY.md
 * 
 * 用法：node scripts/consolidate-memory.js
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace');
const MEMORY_DIR = path.join(WORKSPACE_DIR, 'memory');
const MEMORY_FILE = path.join(WORKSPACE_DIR, 'MEMORY.md');

console.log('🪞 OpenClaw 记忆巩固脚本');
console.log('================================');
console.log(`工作目录：${WORKSPACE_DIR}`);
console.log(`记忆目录：${MEMORY_DIR}`);
console.log(`记忆文件：${MEMORY_FILE}`);
console.log('');

// 读取 MEMORY.md
function readMemoryFile() {
  try {
    return fs.readFileSync(MEMORY_FILE, 'utf-8');
  } catch (err) {
    console.log('⚠️ MEMORY.md 不存在，创建新文件');
    return '# MEMORY.md - Long-term Memory\n\n';
  }
}

// 读取日常记忆文件
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
  
  return logs;
}

// 提取关键信息
function extractInsights(logs) {
  const insights = [];
  
  for (const log of logs) {
    // 简单提取：查找标记为重要的内容
    const lines = log.content.split('\n');
    for (const line of lines) {
      if (line.match(/(重要 | 决策 | 偏好 | 记住|TODO|待办)/i)) {
        insights.push({
          source: log.file,
          text: line.trim()
        });
      }
    }
  }
  
  return insights;
}

// 生成巩固报告
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

// 主流程
function main() {
  console.log('📖 读取日常记忆...');
  const logs = readDailyLogs();
  console.log(`找到 ${logs.length} 个日常记忆文件`);
  
  console.log('🔍 提取关键信息...');
  const insights = extractInsights(logs);
  console.log(`提取 ${insights.length} 条关键信息`);
  
  console.log('📝 生成巩固报告...');
  const report = generateConsolidationReport(insights);
  
  // 追加到 MEMORY.md
  console.log('💾 更新 MEMORY.md...');
  const currentMemory = readMemoryFile();
  fs.writeFileSync(MEMORY_FILE, currentMemory + report);
  
  console.log('');
  console.log('================================');
  console.log('✅ 记忆巩固完成');
  console.log('');
  console.log('下一步：');
  console.log('  1. 审查 MEMORY.md 中的新增内容');
  console.log('  2. 运行 git commit 提交变更');
  console.log('  3. 推送到远程仓库');
  console.log('');
}

main();
