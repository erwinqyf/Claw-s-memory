#!/usr/bin/env node
/**
 * Agent React 机制：根据自检结果自动响应
 * - 能修的：自动尝试修复
 * - 修不了的：标记需要人工介入
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(__dirname, '..', 'data', 'exec-results');
const REACT_LOG = path.join(RESULTS_DIR, `react-${new Date().toISOString().slice(0,10)}.json`);

function readJSON(p) {
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

const actions = [];

function log(action, status, detail) {
  actions.push({ action, status, detail, time: new Date().toISOString() });
  console.log(`[${status}] ${action}: ${detail}`);
}

// ========== 1. 处理 DEGRADED 任务 ==========
function handleDegraded(issue) {
  log(`React-${issue.name}-DEGRADED`, 'INVESTIGATING', issue.detail);
  
  if (issue.name === '行业监控') {
    // 尝试修复脚本中的 URL
    const scriptPath = path.join(__dirname, 'language-service-monitor-v2.js');
    if (fs.existsSync(scriptPath)) {
      let content = fs.readFileSync(scriptPath, 'utf8');
      let changed = false;
      
      // 检查已知失效的 URL 模式
      const urlFixes = [
        { old: 'https://www.nimdzi.com', desc: 'Nimdzi' },
        { old: 'https://slator.com', desc: 'Slator' },
        { old: 'https://multilingual.com', desc: 'Multilingual' },
      ];
      
      urlFixes.forEach(fix => {
        if (content.includes(fix.old)) {
          log(`React-${issue.name}-URL-fix`, 'NEEDS_REVIEW', `${fix.desc} URL ${fix.old} 仍在脚本中，需要人工确认新地址`);
        }
      });
    } else {
      log(`React-${issue.name}`, 'ERROR', `脚本不存在: ${scriptPath}`);
    }
  }
}

// ========== 2. 处理 MISSING 任务 ==========
function handleMissing(issue) {
  log(`React-${issue.name}-MISSING`, 'INVESTIGATING', '结果文件缺失，检查 cron 状态...');
  
  const CRON_STATE = path.join(process.env.HOME, '.openclaw', 'cron', 'jobs-state.json');
  const state = readJSON(CRON_STATE);
  
  if (!state || !state.jobs) {
    log(`React-${issue.name}`, 'ERROR', '无法读取 cron 状态');
    return;
  }
  
  // 尝试匹配任务名
  const jobNameMap = {
    '夜间脚本': '脚本执行-夜间',
    'ClawHub追踪': '脚本执行-ClawHub',
    '小红书周报': '脚本执行-小红书周报',
  };
  
  const targetName = jobNameMap[issue.name] || issue.name;
  let found = false;
  
  Object.values(state.jobs).forEach(job => {
    if (job.name && job.name.includes(targetName.replace('脚本执行-', ''))) {
      found = true;
      const lastErr = job.lastError || 'none';
      const consecErr = job.consecutiveErrors || 0;
      
      if (consecErr >= 2) {
        log(`React-${issue.name}`, 'ESCALATE', 
          `任务 ${job.name} 连续失败 ${consecErr} 次，原因: ${lastErr}. 建议：更换模型或调整 timeout`);
      } else if (lastErr !== 'none') {
        log(`React-${issue.name}`, 'WARN', `任务 ${job.name} 上次失败: ${lastErr}`);
      } else {
        log(`React-${issue.name}`, 'OK', `任务 ${job.name} 最近一次成功，可能是文件写入问题`);
      }
    }
  });
  
  if (!found) {
    log(`React-${issue.name}`, 'WARN', `未找到匹配的 cron 任务`);
  }
}

// ========== 3. 处理 CONSECUTIVE_ERRORS ==========
function handleConsecutiveErrors(issue) {
  log(`React-CRON-${issue.name}`, 'ESCALATE', issue.detail);
}

// ========== 主流程 ==========
function main() {
  // 读取最近的自检结果
  const selfCheckFiles = fs.readdirSync(RESULTS_DIR)
    .filter(f => /^self-check-/.test(f))
    .sort()
    .reverse();
  
  if (selfCheckFiles.length === 0) {
    log('React', 'ERROR', '没有找到自检结果文件');
    return;
  }
  
  const latest = readJSON(path.join(RESULTS_DIR, selfCheckFiles[0]));
  if (!latest || !latest.issues || latest.issues.length === 0) {
    log('React', 'OK', '自检无异常，无需反应');
    return;
  }
  
  console.log(`\n🔧 React 机制启动，发现 ${latest.issues.length} 个异常\n`);
  
  latest.issues.forEach(issue => {
    switch (issue.type) {
      case 'DEGRADED': handleDegraded(issue); break;
      case 'MISSING': handleMissing(issue); break;
      case 'CONSECUTIVE_ERRORS': handleConsecutiveErrors(issue); break;
      case 'ERROR': handleMissing(issue); break; // 类似处理
    }
  });
  
  // 写反应日志
  const report = {
    timestamp: new Date().toISOString(),
    sourceCheck: selfCheckFiles[0],
    actions,
    summary: `${actions.length} 个响应动作，需人工介入: ${actions.filter(a => a.status === 'ESCALATE').length}`,
    escalations: actions.filter(a => a.status === 'ESCALATE')
  };
  
  fs.writeFileSync(REACT_LOG, JSON.stringify(report, null, 2));
  console.log(`\n✅ React 日志已写入 ${REACT_LOG}`);
}

main();
