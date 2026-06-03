#!/usr/bin/env node
/**
 * Agent 自省：检查最近静默任务的执行结果
 * 发现异常时：1) 写结果到 data/exec-results/self-check.json
 *           2) 返回摘要供调用者判断是否需要 react
 */

const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(__dirname, '..', 'data', 'exec-results');
const CRON_STATE = path.join(process.env.HOME, '.openclaw', 'cron', 'jobs-state.json');

function readJSON(p) {
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function getRecentResults(days = 2) {
  if (!fs.existsSync(RESULTS_DIR)) return [];
  const cutoff = Date.now() - days * 86400000;
  return fs.readdirSync(RESULTS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const stat = fs.statSync(path.join(RESULTS_DIR, f));
      return { file: f, mtime: stat.mtimeMs, data: readJSON(path.join(RESULTS_DIR, f)) };
    })
    .filter(r => r.mtime >= cutoff && r.data)
    .sort((a, b) => b.mtime - a.mtime);
}

function analyze() {
  const issues = [];
  const results = getRecentResults();

  // 1. 检查静默任务是否产出了有效数据
  const silentJobs = [
    { pattern: /^night-/, name: '夜间脚本' },
    { pattern: /^clawhub-/, name: 'ClawHub追踪' },
    { pattern: /^industry-/, name: '行业监控' },
    { pattern: /^xiaohongshu-/, name: '小红书周报' },
  ];

  silentJobs.forEach(j => {
    const match = results.find(r => j.pattern.test(r.file));
    if (!match) {
      issues.push({ type: 'MISSING', name: j.name, detail: '最近没有执行结果文件' });
      return;
    }
    // 检查 status 字段
    if (match.data.status === 'error' || match.data.status === 'degraded') {
      issues.push({
        type: match.data.status === 'error' ? 'ERROR' : 'DEGRADED',
        name: j.name,
        detail: match.data.note || '执行异常',
        file: match.file
      });
    }
  });

  // 2. 检查 cron 任务连续错误
  const state = readJSON(CRON_STATE);
  if (state && state.jobs) {
    Object.values(state.jobs).forEach(job => {
      const ce = job.consecutiveErrors || 0;
      if (ce >= 2) {
        issues.push({
          type: 'CONSECUTIVE_ERRORS',
          name: job.name || job.id,
          detail: `连续失败 ${ce} 次，上次错误: ${job.lastError || 'unknown'}`
        });
      }
    });
  }

  return {
    timestamp: new Date().toISOString(),
    issues,
    summary: issues.length === 0
      ? '所有静默任务正常'
      : `发现 ${issues.length} 个异常`,
    actionNeeded: issues.length > 0
  };
}

const result = analyze();
console.log(JSON.stringify(result, null, 2));

// 写结果文件
const outPath = path.join(RESULTS_DIR, `self-check-${new Date().toISOString().slice(0,10)}.json`);
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(`\n✅ 自检结果已写入 ${outPath}`);
