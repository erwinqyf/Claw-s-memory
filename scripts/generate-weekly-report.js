#!/usr/bin/env node
/**
 * 周报生成脚本
 * 每周一上午 9 点自动执行
 * 
 * 用法：node scripts/generate-weekly-report.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace');
const MEMORY_DIR = path.join(WORKSPACE_DIR, 'memory');
const MEMORY_FILE = path.join(WORKSPACE_DIR, 'MEMORY.md');
const TEMPLATE_FILE = path.join(WORKSPACE_DIR, 'templates/weekly-report.md');
const REPORTS_DIR = path.join(WORKSPACE_DIR, 'reports');

console.log('🪞 生成周报复盘...');
console.log('================================');

// 确保 reports 目录存在
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// 获取本周日期范围
function getWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
    label: `${monday.toISOString().split('T')[0]} ~ ${sunday.toISOString().split('T')[0]}`
  };
}

// 统计日常记忆文件
function countDailyLogs() {
  if (!fs.existsSync(MEMORY_DIR)) return 0;
  
  const files = fs.readdirSync(MEMORY_DIR)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f));
  
  return files.length;
}

// 获取 Git 提交次数
function getGitCommits() {
  try {
    const output = execSync('git rev-list --count HEAD', {
      cwd: WORKSPACE_DIR,
      encoding: 'utf-8'
    });
    return parseInt(output.trim());
  } catch (err) {
    return 0;
  }
}

// 检查 Git 同步状态
function checkGitSync() {
  try {
    execSync('git fetch origin', {
      cwd: WORKSPACE_DIR,
      stdio: 'pipe'
    });
    
    const status = execSync('git status --porcelain', {
      cwd: WORKSPACE_DIR,
      encoding: 'utf-8'
    });
    
    if (status.trim()) {
      return '⚠️ 有未提交的变更';
    }
    
    const aheadBehind = execSync('git rev-list --left-right --count HEAD...origin/main', {
      cwd: WORKSPACE_DIR,
      encoding: 'utf-8'
    });
    
    const [ahead, behind] = aheadBehind.trim().split('\t').map(Number);
    
    if (behind > 0) {
      return `⚠️ 落后远程 ${behind} 次提交`;
    } else if (ahead > 0) {
      return `✅ 已同步 (领先 ${ahead} 次)`;
    } else {
      return '✅ 完全同步';
    }
  } catch (err) {
    return '❌ 检查失败';
  }
}

// 读取 MEMORY.md 检查记忆质量
function checkMemoryQuality() {
  try {
    const content = fs.readFileSync(MEMORY_FILE, 'utf-8');
    const lines = content.split('\n');
    
    const checks = {
      hasIdentity: content.includes('关于我') || content.includes('关于 Claw'),
      hasUser: content.includes('关于丰') || content.includes('关于 USER'),
      hasRelationship: content.includes('关系') || content.includes('孪生'),
      hasDecisions: content.includes('决策') || content.includes('重要'),
      lineCount: lines.length
    };
    
    return {
      score: Object.values(checks).filter(Boolean).length / (Object.keys(checks).length - 1) * 100,
      details: checks
    };
  } catch (err) {
    return { score: 0, details: {} };
  }
}

// 生成周报
function generateReport() {
  const weekRange = getWeekRange();
  const timestamp = new Date().toISOString();
  
  // 读取模板
  let template = '';
  if (fs.existsSync(TEMPLATE_FILE)) {
    template = fs.readFileSync(TEMPLATE_FILE, 'utf-8');
  } else {
    console.log('⚠️ 模板文件不存在，使用默认模板');
    template = '# 周报复盘 - {{week_range}}\n\n生成时间：{{generated_at}}\n';
  }
  
  // 替换占位符
  const report = template
    .replace(/{{week_range}}/g, weekRange.label)
    .replace(/{{generated_at}}/g, timestamp)
    .replace(/{{session_count}}/g, '待统计')
    .replace(/{{message_count}}/g, '待统计')
    .replace(/{{token_usage}}/g, '待统计')
    .replace(/{{cost}}/g, '待统计')
    .replace(/{{memory_updates}}/g, String(countDailyLogs()))
    .replace(/{{daily_logs}}/g, String(countDailyLogs()))
    .replace(/{{git_commits}}/g, String(getGitCommits()))
    .replace(/{{sync_status}}/g, checkGitSync());
  
  // 保存报告
  const reportFile = path.join(REPORTS_DIR, `weekly-${weekRange.start}.md`);
  fs.writeFileSync(reportFile, report);
  
  console.log(`✅ 周报已生成：${reportFile}`);
  console.log('');
  console.log('📊 本周概览:');
  console.log(`   日期范围：${weekRange.label}`);
  console.log(`   日常记忆：${countDailyLogs()} 篇`);
  console.log(`   Git 提交：${getGitCommits()} 次`);
  console.log(`   同步状态：${checkGitSync()}`);
  console.log('');
  console.log('📝 记忆质量检查:');
  const quality = checkMemoryQuality();
  console.log(`   完整度：${quality.score.toFixed(0)}%`);
  console.log('');
  console.log('================================');
  console.log('下一步：');
  console.log('  1. 查看生成的周报');
  console.log('  2. 填充待统计的数据');
  console.log('  3. 记录成功经验和踩坑记录');
  console.log('  4. 提交到 Git 仓库');
  console.log('');
  
  return reportFile;
}

// 主流程
function main() {
  const reportFile = generateReport();
  
  // 输出报告路径，便于 cron 交付
  console.log(`REPORT_PATH=${reportFile}`);
}

main();
