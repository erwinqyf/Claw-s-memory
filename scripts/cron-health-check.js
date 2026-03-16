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

console.log('🏥 Cron 调度器健康检查');
console.log('================================');

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
  console.log('\n⏰ 检查调度器状态...');
  try {
    const output = execSync('openclaw cron status', { encoding: 'utf-8' });
    const status = JSON.parse(output);
    
    const now = Date.now();
    const nextWakeAt = status.nextWakeAtMs;
    const diff = now - nextWakeAt;
    
    console.log(`当前时间：${new Date(now).toISOString()}`);
    console.log(`下次唤醒：${new Date(nextWakeAt).toISOString()}`);
    console.log(`时间差：${Math.round(diff / 1000 / 60)} 分钟`);
    
    if (diff > CONFIG.STALE_THRESHOLD_MS) {
      const msg = `❌ 调度器停滞！已超过 ${Math.round(diff / 1000 / 60 / 60)} 小时未唤醒`;
      console.log(msg);
      alerts.push(msg);
      return false;
    } else if (diff > CONFIG.STALE_THRESHOLD_MS / 2) {
      const msg = `⚠️ 调度器可能异常：超过 ${Math.round(diff / 1000 / 60)} 分钟未唤醒`;
      console.log(msg);
      warnings.push(msg);
    } else {
      console.log('✅ 调度器状态正常');
    }
    
    return true;
  } catch (e) {
    const msg = `❌ 无法获取调度器状态：${e.message}`;
    console.log(msg);
    alerts.push(msg);
    return false;
  }
}

// 3. 检查任务错误
function checkTaskErrors() {
  console.log('\n📊 检查任务错误...');
  try {
    const output = execSync('openclaw cron list', { encoding: 'utf-8' });
    const lines = output.split('\n').slice(2); // 跳过表头
    
    let errorCount = 0;
    for (const line of lines) {
      if (!line.trim()) continue;
      
      // 解析表格行
      const parts = line.split(/\s{2,}/).filter(Boolean);
      if (parts.length < 7) continue;
      
      const [name, , , , , status] = parts;
      
      if (status === 'error') {
        errorCount++;
        const msg = `⚠️ 任务错误：${name.trim()}`;
        console.log(msg);
        warnings.push(msg);
      }
    }
    
    if (errorCount >= CONFIG.CONSECUTIVE_ERROR_THRESHOLD) {
      const msg = `❌ 有 ${errorCount} 个任务连续错误，超过阈值 (${CONFIG.CONSECUTIVE_ERROR_THRESHOLD})`;
      console.log(msg);
      alerts.push(msg);
    } else if (errorCount > 0) {
      console.log(`⚠️ 共 ${errorCount} 个任务错误`);
    } else {
      console.log('✅ 所有任务状态正常');
    }
    
    return errorCount < CONFIG.CONSECUTIVE_ERROR_THRESHOLD;
  } catch (e) {
    const msg = `❌ 无法获取任务列表：${e.message}`;
    console.log(msg);
    alerts.push(msg);
    return false;
  }
}

// 4. 检查过期未执行的任务
function checkOverdueTasks() {
  console.log('\n📅 检查过期任务...');
  try {
    const content = fs.readFileSync(JOBS_FILE, 'utf-8');
    const data = JSON.parse(content);
    const now = Date.now();
    
    let overdueCount = 0;
    for (const job of data.jobs) {
      if (!job.enabled) continue;
      if (!job.state || !job.state.nextRunAtMs) continue;
      
      const diff = now - job.state.nextRunAtMs;
      if (diff > CONFIG.TASK_OVERDUE_THRESHOLD_MS) {
        overdueCount++;
        const hours = Math.round(diff / 1000 / 60 / 60);
        const msg = `⚠️ 任务过期未执行：${job.name} (${hours} 小时前应执行)`;
        console.log(msg);
        warnings.push(msg);
      }
    }
    
    if (overdueCount > 0) {
      console.log(`⚠️ 共 ${overdueCount} 个任务过期未执行`);
    } else {
      console.log('✅ 所有任务按时执行');
    }
    
    return overdueCount === 0;
  } catch (e) {
    const msg = `❌ 无法检查过期任务：${e.message}`;
    console.log(msg);
    alerts.push(msg);
    return false;
  }
}

// 5. 发送告警
function sendAlert() {
  if (alerts.length === 0 && warnings.length === 0) {
    console.log('\n✅ 健康检查通过，无需告警');
    return;
  }
  
  console.log('\n🚨 生成告警报告...');
  
  const report = [
    '## 🏥 Cron 调度器健康检查报告',
    '',
    `**检查时间：** ${new Date().toISOString()}`,
    '',
    alerts.length > 0 ? `### ❌ 严重告警 (${alerts.length})` : null,
    ...alerts.map(a => `- ${a}`),
    '',
    warnings.length > 0 ? `### ⚠️ 警告 (${warnings.length})` : null,
    ...warnings.map(w => `- ${w}`),
    '',
    '---',
    '> 自动检查，发现异常请立即处理',
  ].filter(Boolean).join('\n');
  
  console.log('\n' + report);
  
  // 保存到文件
  const reportFile = path.join(WORKSPACE_DIR, 'reports', `cron-health-check-${new Date().toISOString().split('T')[0]}.md`);
  fs.writeFileSync(reportFile, report);
  console.log(`\n📄 报告已保存：${reportFile}`);
  
  // 如果有严重告警，应该通知丰（这里输出消息内容，由调用方决定如何发送）
  if (alerts.length > 0) {
    console.log('\n📢 需要立即通知丰！');
    console.log('告警内容：', alerts.join('\n'));
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
  
  // 返回状态码（有严重告警时返回 1）
  const hasAlerts = alerts.length > 0;
  process.exit(hasAlerts ? 1 : 0);
}

main();
