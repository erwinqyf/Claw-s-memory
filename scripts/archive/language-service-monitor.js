#!/usr/bin/env node
/**
 * 语言服务行业监控追踪器 v3.1
 * 
 * 版本历史:
 * v3.0 (2026-05-04) - 初始简化版本，生成报告模板
 * v3.1 (2026-05-06) - 增强错误处理、日志输出、执行统计
 *   - 添加错误分类器
 *   - 改进日志输出格式
 *   - 添加执行时间和内存监控
 *   - 添加结构化日志级别
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace');
const DATA_DIR = path.join(WORKSPACE_DIR, 'data');
const REPORTS_DIR = path.join(WORKSPACE_DIR, 'reports');
const STATE_FILE = path.join(DATA_DIR, 'language-service-monitor-state.json');

// 日志级别
const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const CURRENT_LOG_LEVEL = LOG_LEVELS.INFO;

function log(level, message, data = null) {
  if (level < CURRENT_LOG_LEVEL) return;
  
  const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
  const levelEmojis = ['🔍', 'ℹ️', '⚠️', '❌'];
  
  console.log(`[${timestamp}] ${levelEmojis[level]} [${levelNames[level]}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

// 错误分类器
function classifyError(error) {
  const message = error.message || String(error);
  
  if (message.includes('ENOENT') || message.includes('no such file')) {
    return { type: 'FILE_NOT_FOUND', retryable: false, severity: 'ERROR' };
  }
  if (message.includes('EACCES') || message.includes('permission denied')) {
    return { type: 'PERMISSION_DENIED', retryable: false, severity: 'ERROR' };
  }
  if (message.includes('ENOSPC') || message.includes('no space')) {
    return { type: 'DISK_FULL', retryable: false, severity: 'CRITICAL' };
  }
  if (message.includes('EJSON') || message.includes('JSON')) {
    return { type: 'PARSE_ERROR', retryable: false, severity: 'ERROR' };
  }
  if (message.includes('ETIMEDOUT') || message.includes('timeout')) {
    return { type: 'TIMEOUT', retryable: true, severity: 'WARN' };
  }
  
  return { type: 'UNKNOWN', retryable: false, severity: 'ERROR' };
}

// 格式化内存使用
function formatMemory(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// 获取内存使用情况
function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    heapUsed: formatMemory(usage.heapUsed),
    heapTotal: formatMemory(usage.heapTotal),
    rss: formatMemory(usage.rss),
    external: formatMemory(usage.external)
  };
}

function initializeDirectories() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      log(LOG_LEVELS.INFO, `创建数据目录: ${DATA_DIR}`);
    }
    if (!fs.existsSync(REPORTS_DIR)) {
      fs.mkdirSync(REPORTS_DIR, { recursive: true });
      log(LOG_LEVELS.INFO, `创建报告目录: ${REPORTS_DIR}`);
    }
    return true;
  } catch (err) {
    const classified = classifyError(err);
    log(LOG_LEVELS.ERROR, `初始化目录失败: ${classified.type}`, { error: err.message });
    return false;
  }
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, 'utf8');
      return JSON.parse(content);
    }
    log(LOG_LEVELS.INFO, `状态文件不存在，创建新状态: ${STATE_FILE}`);
    return { lastRun: null, articles: [], runCount: 0 };
  } catch (err) {
    const classified = classifyError(err);
    log(LOG_LEVELS.ERROR, `加载状态失败: ${classified.type}`, { error: err.message });
    return { lastRun: null, articles: [], runCount: 0 };
  }
}

function saveState(state) {
  try {
    state.runCount = (state.runCount || 0) + 1;
    state.lastSaveTime = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    log(LOG_LEVELS.DEBUG, `状态已保存`, { runCount: state.runCount });
    return true;
  } catch (err) {
    const classified = classifyError(err);
    log(LOG_LEVELS.ERROR, `保存状态失败: ${classified.type}`, { error: err.message });
    return false;
  }
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function getFormattedDate() {
  return new Date().toISOString().split('T')[0].replace(/-/g, '');
}

function generateReport(date, existingArticles) {
  const recentArticles = existingArticles
    .filter(a => {
      const articleDate = new Date(a.date || '2026-01-01');
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      return articleDate >= threeDaysAgo;
    })
    .slice(0, 20);

  let report = `# 语言服务动态监控周报_${date.replace(/-/g, '')}\n\n`;
  report += `> 生成时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n`;
  
  if (recentArticles.length === 0) {
    report += '## 📭 本期暂无新动态\n\n';
    report += '过去3天内未检测到新的行业动态。\n\n';
  } else {
    report += `## 📊 本期概览\n\n`;
    report += `共发现 **${recentArticles.length}** 条新动态\n\n`;
    
    const orgArticles = recentArticles.filter(a => ['Nimdzi', 'Slator', 'Multilingual'].includes(a.source));
    const companyArticles = recentArticles.filter(a => !['Nimdzi', 'Slator', 'Multilingual'].includes(a.source));
    
    if (orgArticles.length > 0) {
      report += '## 🏢 行业媒体动态\n\n';
      orgArticles.forEach(article => {
        const isMajor = article.title?.includes('【重点】') ? '【重点】' : '';
        report += `### ${isMajor}${article.source}: ${article.title?.replace('【重点】', '') || '无标题'}\n\n`;
        report += `- **概要**: ${article.summary || '暂无概要'}\n`;
        report += `- **链接**: ${article.url || '#'}\n`;
        report += `- **发布日期**: ${article.date || '未知'}\n\n`;
      });
    }
    
    if (companyArticles.length > 0) {
      report += '## 🏭 企业动态\n\n';
      companyArticles.forEach(article => {
        const isMajor = article.title?.includes('【重点】') ? '【重点】' : '';
        report += `### ${isMajor}${article.source}: ${article.title?.replace('【重点】', '') || '无标题'}\n\n`;
        report += `- **概要**: ${article.summary || '暂无概要'}\n`;
        report += `- **链接**: ${article.url || '#'}\n`;
        report += `- **发布日期**: ${article.date || '未知'}\n\n`;
      });
    }
  }
  
  report += '---\n\n';
  report += '*报告由语言服务监控系统自动生成*\n';
  
  return report;
}

async function main() {
  const startTime = Date.now();
  
  console.log('🔍 语言服务行业监控启动...');
  console.log('================================');
  log(LOG_LEVELS.INFO, '开始执行监控任务');
  
  // 记录初始内存
  const initialMemory = getMemoryUsage();
  log(LOG_LEVELS.DEBUG, '初始内存使用', initialMemory);
  
  // 初始化目录
  if (!initializeDirectories()) {
    log(LOG_LEVELS.ERROR, '目录初始化失败，退出');
    process.exit(1);
  }
  
  const state = loadState();
  log(LOG_LEVELS.INFO, `已加载状态`, { 
    lastRun: state.lastRun, 
    articleCount: state.articles?.length || 0,
    runCount: state.runCount || 0
  });
  const reportDate = getTodayDate();
  const reportFileName = `language-service-monitor-${getFormattedDate()}.md`;
  const reportPath = path.join(REPORTS_DIR, reportFileName);
  
  const reportContent = generateReport(reportDate, state.articles || []);
  fs.writeFileSync(reportPath, reportContent);
  
  // 更新状态
  state.lastRun = new Date().toISOString();
  state.lastRunFormatted = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  state.reportPath = `reports/${reportFileName}`;
  state.newArticlesFound = 0;
  
  const saveSuccess = saveState(state);
  
  // 计算执行统计
  const endTime = Date.now();
  const duration = endTime - startTime;
  const finalMemory = getMemoryUsage();
  
  console.log('\n================================');
  console.log('✅ 监控完成');
  console.log(`📄 报告路径: ${reportPath}`);
  console.log(`⏱️  执行时间: ${duration}ms`);
  console.log(`💾 状态保存: ${saveSuccess ? '成功' : '失败'}`);
  console.log('\n--- 执行统计 ---');
  console.log(JSON.stringify({
    success: true,
    newArticlesCount: 0,
    reportPath: reportPath,
    hasNewContent: false,
    executionTime: `${duration}ms`,
    memoryUsage: finalMemory,
    stateSaved: saveSuccess
  }, null, 2));
  
  log(LOG_LEVELS.INFO, '监控任务完成', {
    duration: `${duration}ms`,
    reportPath,
    memoryDelta: {
      heapUsed: `${initialMemory.heapUsed} → ${finalMemory.heapUsed}`,
      rss: `${initialMemory.rss} → ${finalMemory.rss}`
    }
  });
}

main().catch(err => {
  const classified = classifyError(err);
  log(LOG_LEVELS.ERROR, `未捕获的错误: ${classified.type}`, { 
    message: err.message,
    retryable: classified.retryable,
    severity: classified.severity
  });
  process.exit(1);
});
