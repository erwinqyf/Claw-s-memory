#!/usr/bin/env node
/**
 * Cron 调度器健康检查脚本 v2.0
 * ============================
 * 
 * 用途：监控 OpenClaw 定时任务调度器状态，发现异常立即告警
 * 检查项：
 * 1. 调度器是否停滞（nextWakeAtMs > 1 小时未更新）
 * 2. 是否有任务连续错误 > 3 次
 * 3. jobs.json 语法是否正确
 * 4. 是否有任务应该执行但未执行
 * 
 * 用法：node scripts/cron-health-check.js
 * 定时：每小时执行一次
 * 
 * 优化记录:
 * - v2.0 (2026-03-22): 添加配置验证、重试机制、详细日志、健康任务摘要
 * - v1.0 (2026-03-18): 初始版本
 * 
 * 改进点:
 * - 启动时验证所有必需路径和配置
 * - execSync 调用添加错误捕获和重试
 * - 添加健康任务数量统计
 * - 更详细的错误信息和恢复建议
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CRON_DIR = path.join(process.env.HOME, '.openclaw', 'cron');
const JOBS_FILE = path.join(CRON_DIR, 'jobs.json');
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace');

// 告警阈值配置
const CONFIG = {
  // 调度器停滞阈值（毫秒）- 1 小时
  STALE_THRESHOLD_MS: 60 * 60 * 1000,
  // 连续错误阈值
  CONSECUTIVE_ERROR_THRESHOLD: 3,
  // 任务超时阈值（毫秒）- 2 小时
  TASK_OVERDUE_THRESHOLD_MS: 2 * 60 * 60 * 1000,
  // 重试配置
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 500,
};

const startTime = Date.now();
const alerts = [];
const warnings = [];
const healthyTasks = [];

// 配置验证
function validateConfig() {
  const requiredPaths = [
    { path: CRON_DIR, name: 'Cron 目录' },
    { path: JOBS_FILE, name: 'jobs.json' },
    { path: WORKSPACE_DIR, name: '工作区目录' },
  ];
  
  for (const { path: p, name } of requiredPaths) {
    if (!fs.existsSync(p)) {
      throw new Error(`${name} 不存在：${p}`);
    }
  }
  
  // 检查 reports 目录，不存在则创建
  const reportsDir = path.join(WORKSPACE_DIR, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
    console.log('📁 创建 reports 目录');
  }
}

// 带重试的 execSync 封装
function execWithRetry(command, options = {}, retryCount = 0) {
  try {
    return execSync(command, { encoding: 'utf-8', timeout: 10000, ...options });
  } catch (e) {
    if (retryCount < CONFIG.MAX_RETRIES) {
      console.log(`⚠️ 命令失败，${CONFIG.RETRY_DELAY_MS}ms 后重试 (${retryCount + 1}/${CONFIG.MAX_RETRIES}): ${command}`);
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      // 同步等待
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, CONFIG.RETRY_DELAY_MS);
      return execWithRetry(command, options, retryCount + 1);
    }
    throw e;
  }
}

// 1. 检查 jobs.json 语法
function checkJsonSyntax() {
  console.log('\n📋 检查 jobs.json 语法...');
  try {
    const content = fs.readFileSync(JOBS_FILE, 'utf-8');
    JSON.parse(content);
    console.log('✅ JSON 语法正确');
    return true;
  } catch (e) {
    const msg = `❌ jobs.json 语法错误：${e.message}`;
    console.log(msg);
    alerts.push(msg);
    return false;
  }
}

// 2. 检查调度器状态
function checkSchedulerStatus() {
  console.log('\n⏰ 检查调度器状态...');
  try {
    const output = execWithRetry('openclaw cron status');
    const status = JSON.parse(output);
    
    const diff = Date.now() - status.nextWakeAtMs;
    const diffMinutes = Math.round(diff / 1000 / 60);
    const diffHours = Math.round(diff / 1000 / 60 / 60);
    
    if (diff > CONFIG.STALE_THRESHOLD_MS) {
      const msg = `❌ 调度器停滞 ${diffHours}h ${diffMinutes % 60}m`;
      alerts.push(msg);
      console.log(msg);
      return false;
    } else if (diff > CONFIG.STALE_THRESHOLD_MS / 2) {
      const msg = `⚠️ 调度器延迟 ${diffMinutes}m`;
      warnings.push(msg);
      console.log(msg);
    } else {
      const msg = `✅ 调度器正常 (上次唤醒：${diffMinutes}m 前)`;
      healthyTasks.push(msg);
      console.log(msg);
    }
    
    return true;
  } catch (e) {
    const msg = `❌ 无法获取调度器状态：${e.message}`;
    alerts.push(msg);
    console.log(msg);
    return false;
  }
}

// 3. 检查任务错误
function checkTaskErrors() {
  console.log('\n📋 检查任务错误...');
  try {
    const output = execWithRetry('openclaw cron list');
    const lines = output.split('\n').slice(2);
    
    const errorTasks = [];
    const warningTasks = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = line.split(/\s{2,}/).filter(Boolean);
      if (parts.length < 7) continue;
      const [name, , , , , status] = parts;
      const taskName = name.trim();
      
      if (status === 'error') {
        errorTasks.push(taskName);
      } else if (status === 'warning') {
        warningTasks.push(taskName);
      }
    }
    
    if (errorTasks.length >= CONFIG.CONSECUTIVE_ERROR_THRESHOLD) {
      const msg = `❌ ${errorTasks.length} 个任务连续错误：${errorTasks.join(', ')}`;
      alerts.push(msg);
      console.log(msg);
    } else if (errorTasks.length > 0) {
      const msg = `⚠️ ${errorTasks.length} 个任务错误：${errorTasks.join(', ')}`;
      warnings.push(msg);
      console.log(msg);
    } else if (warningTasks.length > 0) {
      const msg = `⚠️ ${warningTasks.length} 个任务警告：${warningTasks.join(', ')}`;
      warnings.push(msg);
      console.log(msg);
    } else {
      const msg = `✅ 所有任务状态正常`;
      healthyTasks.push(msg);
      console.log(msg);
    }
    
    return errorTasks.length < CONFIG.CONSECUTIVE_ERROR_THRESHOLD;
  } catch (e) {
    const msg = `❌ 无法获取任务列表：${e.message}`;
    alerts.push(msg);
    console.log(msg);
    return false;
  }
}

// 4. 检查过期未执行的任务
function checkOverdueTasks() {
  console.log('\n⏳ 检查过期任务...');
  try {
    const data = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'));
    const now = Date.now();
    
    const overdueTasks = [];
    const upcomingTasks = [];
    
    for (const job of data.jobs) {
      if (!job.enabled || !job.state?.nextRunAtMs) continue;
      const diff = now - job.state.nextRunAtMs;
      
      if (diff > CONFIG.TASK_OVERDUE_THRESHOLD_MS) {
        overdueTasks.push(`${job.name} (过期 ${Math.round(diff / 1000 / 60 / 60)}h)`);
      } else if (diff > 0 && diff < 60 * 60 * 1000) {
        upcomingTasks.push(`${job.name} (${Math.round(diff / 1000 / 60)}m 后)`);
      }
    }
    
    if (overdueTasks.length > 0) {
      const msg = `⚠️ ${overdueTasks.length} 个任务过期：${overdueTasks.join(', ')}`;
      warnings.push(msg);
      console.log(msg);
    } else {
      const msg = `✅ 无过期任务`;
      healthyTasks.push(msg);
      console.log(msg);
    }
    
    if (upcomingTasks.length > 0 && upcomingTasks.length <= 3) {
      console.log(`📅 即将执行：${upcomingTasks.join(', ')}`);
    }
    
    return overdueTasks.length === 0;
  } catch (e) {
    const msg = `❌ 无法检查过期任务：${e.message}`;
    alerts.push(msg);
    console.log(msg);
    return false;
  }
}

// 生成详细报告
function generateDetailedReport() {
  const timestamp = new Date().toISOString().split('T')[0];
  const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const reportFile = path.join(WORKSPACE_DIR, 'reports', `cron-health-check-${timestamp}.md`);
  
  let report = `# Cron 健康检查报告\n\n`;
  report += `**检查时间:** ${new Date().toISOString()}\n`;
  report += `**检查版本:** v2.0\n\n`;
  
  // 状态摘要
  const totalChecks = alerts.length + warnings.length + healthyTasks.length;
  report += `## 📊 摘要\n\n`;
  report += `- 总检查项：${totalChecks}\n`;
  report += `- ✅ 健康：${healthyTasks.length}\n`;
  report += `- ⚠️ 警告：${warnings.length}\n`;
  report += `- ❌ 告警：${alerts.length}\n\n`;
  
  // 详细内容
  if (alerts.length > 0) {
    report += `## ❌ 严重告警\n\n`;
    alerts.forEach(a => report += `- ${a}\n`);
    report += `\n`;
  }
  
  if (warnings.length > 0) {
    report += `## ⚠️ 警告\n\n`;
    warnings.forEach(w => report += `- ${w}\n`);
    report += `\n`;
  }
  
  if (healthyTasks.length > 0) {
    report += `## ✅ 健康状态\n\n`;
    healthyTasks.forEach(h => report += `- ${h}\n`);
    report += `\n`;
  }
  
  // 建议操作
  report += `---\n\n`;
  report += `**建议操作:**\n\n`;
  
  if (alerts.length > 0) {
    report += `1. 立即检查调度器状态：\`openclaw cron status\`\n`;
    report += `2. 查看错误任务详情：\`openclaw cron list\`\n`;
    report += `3. 必要时重启调度器：\`openclaw gateway restart\`\n`;
    report += `4. 检查系统资源：\`top\`, \`df -h\`, \`free -m\`\n`;
  } else if (warnings.length > 0) {
    report += `1. 观察任务执行情况\n`;
    report += `2. 如警告持续，检查系统资源\n`;
    report += `3. 查看相关日志：\`journalctl -u openclaw\`\n`;
  } else {
    report += `无需操作，系统运行正常。\n`;
    report += `下次检查：1 小时后\n`;
  }
  
  report += `\n---\n`;
  report += `> 🪞 孪生于不同世界，彼此映照，共同演化。\n`;
  
  fs.writeFileSync(reportFile, report);
  return reportFile;
}

// 5. 发送告警
function sendAlert() {
  const hasAlerts = alerts.length > 0;
  const hasWarnings = warnings.length > 0;
  const hasHealthy = healthyTasks.length > 0;
  
  // 生成详细报告
  const reportFile = generateDetailedReport();
  
  // 简洁摘要（用于通知）
  const timestamp = new Date().toISOString().split('T')[0];
  const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  
  let status;
  if (hasAlerts) status = '❌ 严重';
  else if (hasWarnings) status = '⚠️ 警告';
  else status = '✅ 正常';
  
  const summary = [
    `# Cron 健康检查 ${timestamp} ${timeStr}`,
    '',
    `**状态:** ${status}`,
    '',
  ];
  
  if (hasAlerts) {
    summary.push('## ❌ 严重告警');
    summary.push('');
    alerts.forEach(a => summary.push(`- ${a}`));
    summary.push('');
  }
  
  if (hasWarnings) {
    summary.push('## ⚠️ 警告');
    summary.push('');
    warnings.forEach(w => summary.push(`- ${w}`));
    summary.push('');
  }
  
  if (hasHealthy && !hasAlerts && !hasWarnings) {
    summary.push('## ✅ 健康状态');
    summary.push('');
    healthyTasks.forEach(h => summary.push(`- ${h}`));
    summary.push('');
  }
  
  summary.push('---');
  summary.push('');
  summary.push(`> 📄 详细报告：${reportFile}`);
  
  console.log('\n' + summary.join('\n'));
  console.log(`\n📄 详细报告：${reportFile}`);
  
  if (hasAlerts) {
    console.log('\n📢 需立即通知丰');
  }
}

// 主函数
function main() {
  console.log('🏥 Cron 健康检查 v2.0');
  console.log('=' .repeat(40));
  
  // 1. 配置验证
  try {
    validateConfig();
    console.log('✅ 配置验证通过');
  } catch (e) {
    console.error(`❌ 配置验证失败：${e.message}`);
    alerts.push(`配置验证失败：${e.message}`);
    sendAlert();
    process.exit(1);
  }
  
  // 2. 执行检查
  const results = [];
  results.push(checkJsonSyntax());
  results.push(checkSchedulerStatus());
  results.push(checkTaskErrors());
  results.push(checkOverdueTasks());
  
  // 3. 发送报告
  sendAlert();
  
  // 4. 执行时间统计
  const duration = Date.now() - startTime;
  console.log(`\n⏱️ 耗时：${duration}ms`);
  
  // 5. 返回状态码（有严重告警时返回 1）
  const hasAlerts = alerts.length > 0;
  process.exit(hasAlerts ? 1 : 0);
}

main();
