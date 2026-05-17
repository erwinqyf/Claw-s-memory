#!/usr/bin/env node
/**
 * Task Metrics Collector v1.0
 * 任务执行指标收集器 - 阶段一：量化指标系统
 * 
 * 功能：
 * - 记录每个任务的执行数据
 * - 计算成功率、耗时分布
 * - 生成每日/每周报告
 * 
 * 数据存储：data/task-metrics.json
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'task-metrics.json');
const REPORTS_DIR = path.join(__dirname, '..', 'reports', 'metrics');

// 确保目录存在
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 初始化数据文件
function initDataFile() {
  ensureDir(path.dirname(DATA_FILE));
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      version: '1.0',
      createdAt: new Date().toISOString(),
      tasks: [],
      dailyStats: {},
      agentStats: {}
    }, null, 2));
  }
}

// 加载数据
function loadData() {
  initDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

// 保存数据
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// 记录任务
function recordTask({
  taskId,
  taskType,      // 'cron' | 'user' | 'subagent' | 'heartbeat'
  agentId,       // 'main' | 'alpha' | 'bravo' | etc.
  description,
  startTime,
  endTime,
  status,        // 'success' | 'failed' | 'timeout' | 'error'
  errorType,     // 'network' | 'timeout' | 'permission' | 'unknown'
  errorMessage,
  toolsUsed = [],
  tokenCount = 0
}) {
  const data = loadData();
  
  const task = {
    id: taskId || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: taskType,
    agent: agentId,
    description: description || 'Unknown task',
    startTime: startTime || new Date().toISOString(),
    endTime: endTime || new Date().toISOString(),
    duration: endTime && startTime 
      ? new Date(endTime) - new Date(startTime)
      : 0,
    status: status,
    errorType: errorType || null,
    errorMessage: errorMessage || null,
    toolsUsed: toolsUsed,
    tokenCount: tokenCount,
    recordedAt: new Date().toISOString()
  };
  
  data.tasks.push(task);
  
  // 更新每日统计
  const date = new Date().toISOString().split('T')[0];
  if (!data.dailyStats[date]) {
    data.dailyStats[date] = {
      total: 0,
      success: 0,
      failed: 0,
      timeout: 0,
      byType: {},
      byAgent: {}
    };
  }
  
  const daily = data.dailyStats[date];
  daily.total++;
  daily[status]++;
  
  // 按类型统计
  if (!daily.byType[taskType]) {
    daily.byType[taskType] = { total: 0, success: 0, failed: 0 };
  }
  daily.byType[taskType].total++;
  daily.byType[taskType][status === 'success' ? 'success' : 'failed']++;
  
  // 按 Agent 统计
  if (!daily.byAgent[agentId]) {
    daily.byAgent[agentId] = { total: 0, success: 0, failed: 0 };
  }
  daily.byAgent[agentId].total++;
  daily.byAgent[agentId][status === 'success' ? 'success' : 'failed']++;
  
  // 更新 Agent 总体统计
  if (!data.agentStats[agentId]) {
    data.agentStats[agentId] = {
      totalTasks: 0,
      successCount: 0,
      failedCount: 0,
      totalDuration: 0,
      avgDuration: 0
    };
  }
  
  const agentStat = data.agentStats[agentId];
  agentStat.totalTasks++;
  if (status === 'success') {
    agentStat.successCount++;
  } else {
    agentStat.failedCount++;
  }
  agentStat.totalDuration += task.duration;
  agentStat.avgDuration = Math.round(agentStat.totalDuration / agentStat.totalTasks);
  
  // 保留最近 90 天的任务详情
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  data.tasks = data.tasks.filter(t => new Date(t.recordedAt) > cutoff);
  
  saveData(data);
  
  return task;
}

// 生成每日报告
function generateDailyReport(date = new Date().toISOString().split('T')[0]) {
  const data = loadData();
  const daily = data.dailyStats[date];
  
  if (!daily) {
    return null;
  }
  
  const successRate = daily.total > 0 
    ? ((daily.success / daily.total) * 100).toFixed(1)
    : 0;
  
  // 计算趋势（与前一天对比）
  const prevDate = new Date(date);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateStr = prevDate.toISOString().split('T')[0];
  const prevDaily = data.dailyStats[prevDateStr];
  const prevSuccessRate = prevDaily 
    ? ((prevDaily.success / prevDaily.total) * 100).toFixed(1)
    : 0;
  
  const trend = successRate - prevSuccessRate;
  const trendIcon = trend > 0 ? '↑' : trend < 0 ? '↓' : '→';
  
  // 找出最慢的 Agent
  let slowestAgent = null;
  let maxAvgDuration = 0;
  
  for (const [agent, stat] of Object.entries(data.agentStats)) {
    if (stat.avgDuration > maxAvgDuration) {
      maxAvgDuration = stat.avgDuration;
      slowestAgent = agent;
    }
  }
  
  // 找出错误最多的类型
  let errorTypes = {};
  const todayTasks = data.tasks.filter(t => t.recordedAt.startsWith(date) && t.status !== 'success');
  todayTasks.forEach(t => {
    const type = t.errorType || 'unknown';
    errorTypes[type] = (errorTypes[type] || 0) + 1;
  });
  
  const topError = Object.entries(errorTypes)
    .sort((a, b) => b[1] - a[1])[0];
  
  const report = {
    date,
    summary: {
      totalTasks: daily.total,
      successCount: daily.success,
      failedCount: daily.failed,
      timeoutCount: daily.timeout,
      successRate: `${successRate}%`,
      trend: `${trendIcon} ${Math.abs(trend).toFixed(1)}%`
    },
    byType: daily.byType,
    byAgent: daily.byAgent,
    insights: {
      slowestAgent: slowestAgent ? `${slowestAgent} (${maxAvgDuration}ms avg)` : 'N/A',
      topErrorType: topError ? `${topError[0]} (${topError[1]}次)` : '无错误',
      alert: daily.failed >= 3 ? '⚠️ 今日失败任务较多，建议检查' : '✅ 系统运行正常'
    }
  };
  
  return report;
}

// 生成周报告
function generateWeeklyReport(endDate = new Date()) {
  const data = loadData();
  const reports = [];
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    if (data.dailyStats[dateStr]) {
      reports.push({
        date: dateStr,
        ...data.dailyStats[dateStr]
      });
    }
  }
  
  if (reports.length === 0) {
    return null;
  }
  
  const total = reports.reduce((sum, r) => sum + r.total, 0);
  const success = reports.reduce((sum, r) => sum + r.success, 0);
  const failed = reports.reduce((sum, r) => sum + r.failed, 0);
  
  // 计算 Agent 效率排名
  const agentRanking = Object.entries(data.agentStats)
    .map(([agent, stat]) => ({
      agent,
      successRate: ((stat.successCount / stat.totalTasks) * 100).toFixed(1),
      avgDuration: stat.avgDuration,
      totalTasks: stat.totalTasks
    }))
    .sort((a, b) => parseFloat(b.successRate) - parseFloat(a.successRate));
  
  return {
    period: `${reports[0].date} ~ ${reports[reports.length - 1].date}`,
    summary: {
      totalTasks: total,
      successCount: success,
      failedCount: failed,
      successRate: `${((success / total) * 100).toFixed(1)}%`
    },
    dailyBreakdown: reports.map(r => ({
      date: r.date,
      total: r.total,
      success: r.success,
      failed: r.failed,
      rate: `${((r.success / r.total) * 100).toFixed(1)}%`
    })),
    agentRanking,
    recommendation: failed > total * 0.1 
      ? '⚠️ 本周失败率较高，建议审查错误日志'
      : '✅ 本周系统运行良好'
  };
}

// 导出 Markdown 报告
function exportMarkdown(report, type = 'daily') {
  if (!report) return '无数据';
  
  if (type === 'daily') {
    return `# 任务执行日报 - ${report.date}

## 📊 总体概况

| 指标 | 数值 | 趋势 |
|------|------|------|
| 总任务数 | ${report.summary.totalTasks} | - |
| 成功 | ${report.summary.successCount} | - |
| 失败 | ${report.summary.failedCount} | - |
| 超时 | ${report.summary.timeoutCount} | - |
| **成功率** | **${report.summary.successRate}** | ${report.summary.trend} |

## 📈 按类型分布

${Object.entries(report.byType).map(([type, stat]) => 
  `- **${type}**: ${stat.total} 次 (成功率 ${((stat.success / stat.total) * 100).toFixed(1)}%)`
).join('\n')}

## 🤖 按 Agent 分布

${Object.entries(report.byAgent).map(([agent, stat]) => 
  `- **${agent}**: ${stat.total} 次 (成功率 ${((stat.success / stat.total) * 100).toFixed(1)}%)`
).join('\n')}

## 💡 洞察

- **最慢 Agent**: ${report.insights.slowestAgent}
- **主要错误**: ${report.insights.topErrorType}
- **状态**: ${report.insights.alert}

---
*生成时间: ${new Date().toISOString()}*`;
  }
  
  if (type === 'weekly') {
    return `# 任务执行周报 - ${report.period}

## 📊 总体概况

| 指标 | 数值 |
|------|------|
| 总任务数 | ${report.summary.totalTasks} |
| 成功 | ${report.summary.successCount} |
| 失败 | ${report.summary.failedCount} |
| **成功率** | **${report.summary.successRate}** |

## 📅 每日明细

| 日期 | 总数 | 成功 | 失败 | 成功率 |
|------|------|------|------|--------|
${report.dailyBreakdown.map(d => 
  `| ${d.date} | ${d.total} | ${d.success} | ${d.failed} | ${d.rate} |`
).join('\n')}

## 🏆 Agent 效率排名

| 排名 | Agent | 成功率 | 平均耗时 | 总任务 |
|------|-------|--------|----------|--------|
${report.agentRanking.map((a, i) => 
  `| ${i + 1} | ${a.agent} | ${a.successRate}% | ${a.avgDuration}ms | ${a.totalTasks} |`
).join('\n')}

## 📋 建议

${report.recommendation}

---
*生成时间: ${new Date().toISOString()}*`;
  }
  
  return '未知报告类型';
}

// CLI 接口
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'record':
      // 从 JSON 参数记录任务
      const taskData = JSON.parse(args[1] || '{}');
      const task = recordTask(taskData);
      console.log('Task recorded:', task.id);
      break;
      
    case 'daily':
      const date = args[1] || new Date().toISOString().split('T')[0];
      const dailyReport = generateDailyReport(date);
      if (dailyReport) {
        const md = exportMarkdown(dailyReport, 'daily');
        ensureDir(REPORTS_DIR);
        const file = path.join(REPORTS_DIR, `daily-${date}.md`);
        fs.writeFileSync(file, md);
        console.log('Daily report generated:', file);
        console.log('\n' + md);
      } else {
        console.log('No data for', date);
      }
      break;
      
    case 'weekly':
      const weeklyReport = generateWeeklyReport();
      if (weeklyReport) {
        const md = exportMarkdown(weeklyReport, 'weekly');
        ensureDir(REPORTS_DIR);
        const file = path.join(REPORTS_DIR, `weekly-${weeklyReport.period.split(' ~ ')[1]}.md`);
        fs.writeFileSync(file, md);
        console.log('Weekly report generated:', file);
        console.log('\n' + md);
      } else {
        console.log('No weekly data available');
      }
      break;
      
    case 'stats':
      const data = loadData();
      console.log('=== Task Metrics Statistics ===');
      console.log('Total tasks recorded:', data.tasks.length);
      console.log('Daily stats entries:', Object.keys(data.dailyStats).length);
      console.log('Agent stats:', Object.keys(data.agentStats));
      break;
      
    default:
      console.log(`
Task Metrics Collector v1.0

Usage:
  node task-metrics-collector.js <command> [args]

Commands:
  record '<json>'    Record a task (JSON format)
  daily [date]       Generate daily report (default: today)
  weekly             Generate weekly report
  stats              Show statistics

Examples:
  node task-metrics-collector.js record '{"taskType":"cron","agentId":"bravo","status":"success"}'
  node task-metrics-collector.js daily 2026-05-12
  node task-metrics-collector.js weekly
`);
  }
}

// 如果直接运行
if (require.main === module) {
  main();
}

// 导出 API
module.exports = {
  recordTask,
  generateDailyReport,
  generateWeeklyReport,
  exportMarkdown,
  loadData,
  saveData
};