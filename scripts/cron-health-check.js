#!/usr/bin/env node
/**
 * Cron 调度器健康检查脚本
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
 * 优化记录 (2026-03-18):
 * - 简化报告格式，减少 token 消耗
 * - 移除冗余 console.log 输出
 * - 添加执行时间统计
 * - 区分严重告警 vs 警告
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
};

const startTime = Date.now();
console.log('🏥 Cron 健康检查');

const alerts = [];
const warnings = [];

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
  try {
    const output = execSync('openclaw cron status', { encoding: 'utf-8' });
    const status = JSON.parse(output);
    
    const diff = Date.now() - status.nextWakeAtMs;
    
    if (diff > CONFIG.STALE_THRESHOLD_MS) {
      const msg = `❌ 调度器停滞 ${Math.round(diff / 1000 / 60 / 60)}h`;
      alerts.push(msg);
      return false;
    } else if (diff > CONFIG.STALE_THRESHOLD_MS / 2) {
      warnings.push(`⚠️ 调度器延迟 ${Math.round(diff / 1000 / 60)}m`);
    }
    
    return true;
  } catch (e) {
    alerts.push(`❌ 无法获取调度器状态`);
    return false;
  }
}

// 3. 检查任务错误
function checkTaskErrors() {
  try {
    const output = execSync('openclaw cron list', { encoding: 'utf-8' });
    const lines = output.split('\n').slice(2);
    
    const errorTasks = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = line.split(/\s{2,}/).filter(Boolean);
      if (parts.length < 7) continue;
      const [name, , , , , status] = parts;
      if (status === 'error') errorTasks.push(name.trim());
    }
    
    if (errorTasks.length >= CONFIG.CONSECUTIVE_ERROR_THRESHOLD) {
      alerts.push(`❌ ${errorTasks.length} 个任务错误`);
    } else if (errorTasks.length > 0) {
      warnings.push(`⚠️ ${errorTasks.length} 个任务错误`);
    }
    
    return errorTasks.length < CONFIG.CONSECUTIVE_ERROR_THRESHOLD;
  } catch (e) {
    alerts.push(`❌ 无法获取任务列表`);
    return false;
  }
}

// 4. 检查过期未执行的任务
function checkOverdueTasks() {
  try {
    const data = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'));
    const now = Date.now();
    
    const overdueTasks = [];
    for (const job of data.jobs) {
      if (!job.enabled || !job.state?.nextRunAtMs) continue;
      const diff = now - job.state.nextRunAtMs;
      if (diff > CONFIG.TASK_OVERDUE_THRESHOLD_MS) {
        overdueTasks.push(`${job.name} (${Math.round(diff / 1000 / 60 / 60)}h)`);
      }
    }
    
    if (overdueTasks.length > 0) {
      warnings.push(`⚠️ ${overdueTasks.length} 个任务过期`);
    }
    
    return overdueTasks.length === 0;
  } catch (e) {
    alerts.push(`❌ 无法检查过期任务`);
    return false;
  }
}

// 5. 发送告警
function sendAlert() {
  const hasAlerts = alerts.length > 0;
  const hasWarnings = warnings.length > 0;
  
  if (!hasAlerts && !hasWarnings) {
    console.log('✅ 健康检查通过');
    return;
  }
  
  // 简洁报告格式（减少 token 消耗）
  const timestamp = new Date().toISOString().split('T')[0];
  const status = hasAlerts ? '❌ 严重' : '⚠️ 警告';
  const report = [
    `# Cron 健康检查 ${timestamp}`,
    '',
    `**状态:** ${status}`,
    '',
    hasAlerts ? '## 告警' : '## 警告',
    '',
    ...(hasAlerts ? alerts : warnings).map(x => `- ${x}`),
    '',
    '> 详情：reports/cron-health-check-${timestamp}.md',
  ].join('\n');
  
  // 保存到文件
  const reportFile = path.join(WORKSPACE_DIR, 'reports', `cron-health-check-${timestamp}.md`);
  fs.writeFileSync(reportFile, report);
  
  console.log(`📄 报告：${reportFile}`);
  
  if (hasAlerts) {
    console.log('📢 需立即通知丰');
  }
}

// 主函数
function main() {
  const results = [];
  
  results.push(checkJsonSyntax());
  results.push(checkSchedulerStatus());
  results.push(checkTaskErrors());
  results.push(checkOverdueTasks());
  
  sendAlert();
  
  // 执行时间统计
  const duration = Date.now() - startTime;
  console.log(`⏱️ 耗时：${duration}ms`);
  
  // 返回状态码（有严重告警时返回 1）
  const hasAlerts = alerts.length > 0;
  process.exit(hasAlerts ? 1 : 0);
}

main();
