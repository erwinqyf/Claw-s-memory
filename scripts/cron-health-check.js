#!/usr/bin/env node
/**
 * Cron 调度器健康检查脚本 v3.0
 * ============================
 * 
 * 用途：监控 OpenClaw 定时任务调度器状态，发现异常立即告警
 * 检查项：
 * 1. 调度器是否停滞（nextWakeAtMs > 1 小时未更新）
 * 2. 是否有任务连续错误 > 3 次
 * 3. jobs.json 语法是否正确
 * 4. 是否有任务应该执行但未执行
 * 5. 任务执行超时检测
 * 6. 磁盘空间检查
 * 7. 任务统计摘要
 * 8. 内存使用检查
 * 9. 错误分类统计（v2.8）
 * 10. 执行时间历史数据持久化（v2.9）
 * 11. 智能告警抑制（v3.0）
 * 12. 健康评分系统（v3.0）
 * 13. 可操作建议生成（v3.0）
 * 
 * 用法：node scripts/cron-health-check.js
 * 定时：每小时执行一次
 * 
 * 优化记录:
 * - v3.0 (2026-05-02): 添加智能告警抑制、健康评分系统、可操作建议生成、改进趋势图表
 * - v2.9 (2026-04-21): 修复版本号不一致、添加错误分类统计函数、改进执行时间历史数据存储
 * - v2.8 (2026-04-19): 添加错误分类统计、优化健康任务摘要格式、增强执行时间趋势分析
 * - v2.7 (2026-04-17): 优化任务执行时间趋势分析、添加历史数据持久化、改进报告格式
 * - v2.6 (2026-04-16): 优化错误输出解析、添加执行时间统计、改进代码结构
 * - v2.5 (2026-04-12): 增强错误解析健壮性、改进日志格式、添加代码注释
 * - v2.4 (2026-04-08): 添加内存使用检查、改进错误处理、添加任务执行时间趋势分析
 * - v2.3 (2026-04-07): 修复版本号不一致、添加 wakeMode 配置检查
 * - v2.2 (2026-03-26): 添加磁盘空间检查、任务统计摘要
 * - v2.1 (2026-03-25): 添加任务执行超时检查、修复重试机制阻塞方式
 * - v2.0 (2026-03-22): 添加配置验证、重试机制、详细日志、健康任务摘要
 * - v1.0 (2026-03-18): 初始版本
 * 
 * 改进点:
 * - 启动时验证所有必需路径和配置
 * - execSync 调用添加错误捕获和重试
 * - 添加健康任务数量统计
 * - 更详细的错误信息和恢复建议
 * - 检测任务执行超时（如 global-news-monitor 超时问题）
 * - 重试机制改用简单阻塞循环（避免 Atomics.wait 兼容性问题）
 * - 添加磁盘空间监控（阈值 90%）
 * - 添加内存使用监控（阈值 80%）
 * - 添加任务统计（总数/启用/禁用）
 * - 统一版本号显示
 * - 错误分类统计（网络/配置/超时/其他）
 * - 智能告警抑制（避免重复通知已知问题）
 * - 健康评分系统（0-100 分）
 * - 可操作建议自动生成
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
  // 任务执行超时阈值（毫秒）- 60 分钟（与 OpenClaw 默认超时对齐）
  TASK_EXEC_TIMEOUT_MS: 60 * 60 * 1000,
  // 内存使用阈值（百分比）
  MEMORY_THRESHOLD_PERCENT: 80,
  // 重试配置
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 500,
};

const startTime = Date.now();
const alerts = [];
const warnings = [];
const healthyTasks = [];

// 告警抑制状态文件
const ALERT_STATE_FILE = path.join(WORKSPACE_DIR, 'data', 'cron-alert-state.json');

/**
 * 智能告警抑制系统（v3.0 新增）
 * 
 * 避免重复通知已知问题，减少噪音
 * 抑制规则：
 * 1. 相同告警 4 小时内不重复通知
 * 2. 已知问题（如飞书投递失败）首次通知后标记为已知
 * 3. 问题恢复后自动清除抑制状态
 */
const AlertSuppressor = {
  loadState() {
    try {
      if (fs.existsSync(ALERT_STATE_FILE)) {
        return JSON.parse(fs.readFileSync(ALERT_STATE_FILE, 'utf-8'));
      }
    } catch (e) {
      console.log(`⚠️ 无法加载告警状态：${e.message}`);
    }
    return { suppressed: {}, knownIssues: {}, lastNotify: {} };
  },

  saveState(state) {
    try {
      const dataDir = path.dirname(ALERT_STATE_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(ALERT_STATE_FILE, JSON.stringify(state, null, 2));
    } catch (e) {
      console.log(`⚠️ 无法保存告警状态：${e.message}`);
    }
  },

  /**
   * 检查是否应该抑制告警
   * @param {string} alertKey - 告警唯一标识
   * @param {number} suppressHours - 抑制时长（小时）
   * @returns {boolean} true = 抑制，false = 允许通知
   */
  shouldSuppress(alertKey, suppressHours = 4) {
    const state = this.loadState();
    const now = Date.now();
    const lastNotify = state.lastNotify[alertKey];
    
    if (lastNotify && (now - lastNotify) < suppressHours * 60 * 60 * 1000) {
      return true; // 在抑制期内
    }
    
    // 更新最后通知时间
    state.lastNotify[alertKey] = now;
    this.saveState(state);
    return false;
  },

  /**
   * 标记已知问题
   * @param {string} issueKey - 问题标识
   * @param {string} description - 问题描述
   */
  markKnownIssue(issueKey, description) {
    const state = this.loadState();
    state.knownIssues[issueKey] = {
      description,
      markedAt: Date.now()
    };
    this.saveState(state);
  },

  /**
   * 检查是否为已知问题
   * @param {string} issueKey - 问题标识
   * @returns {object|null} 已知问题信息或 null
   */
  isKnownIssue(issueKey) {
    const state = this.loadState();
    return state.knownIssues[issueKey] || null;
  },

  /**
   * 清除已恢复问题的抑制状态
   * @param {Array<string>} currentAlerts - 当前存在的告警列表
   */
  clearRecovered(currentAlerts) {
    const state = this.loadState();
    const currentKeys = new Set(currentAlerts);
    
    // 清除已恢复问题的抑制状态
    for (const key of Object.keys(state.lastNotify)) {
      if (!currentKeys.has(key)) {
        delete state.lastNotify[key];
        console.log(`✅ 问题已恢复，清除抑制状态：${key}`);
      }
    }
    
    this.saveState(state);
  }
};

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
      // 同步等待 - 使用简单的阻塞循环（Node.js 单线程环境安全）
      const start = Date.now();
      while (Date.now() - start < CONFIG.RETRY_DELAY_MS) {
        // busy wait
      }
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
    // 使用 JSON 输出避免文本解析问题
    const output = execWithRetry('openclaw cron list --json');
    const data = JSON.parse(output);
    
    const errorTasks = [];
    const warningTasks = [];
    
    for (const job of data.jobs || []) {
      if (!job.enabled) continue;
      
      // 安全获取嵌套属性，避免 undefined 访问错误
      const jobState = job.state || {};
      const consecutiveErrors = typeof jobState.consecutiveErrors === 'number' ? jobState.consecutiveErrors : 0;
      const lastStatus = jobState.lastStatus;
      const lastDeliveryStatus = jobState.lastDeliveryStatus;
      
      // 检测连续错误（执行失败）
      if (consecutiveErrors >= CONFIG.CONSECUTIVE_ERROR_THRESHOLD) {
        errorTasks.push(`${job.name} (连续${consecutiveErrors}次失败)`);
      } else if (consecutiveErrors > 0) {
        warningTasks.push(`${job.name} (连续${consecutiveErrors}次失败)`);
      }
      
      // 检测投递失败（任务成功但通知失败）
      if (lastDeliveryStatus === 'unknown' || lastDeliveryStatus === 'error') {
        if (consecutiveErrors === 0) {
          // 仅投递失败，任务本身成功
          warningTasks.push(`${job.name} (投递失败)`);
        }
      }
    }
    
    if (errorTasks.length > 0) {
      const msg = `❌ ${errorTasks.length} 个任务连续错误：${errorTasks.join(', ')}`;
      alerts.push(msg);
      console.log(msg);
    } else if (warningTasks.length > 0) {
      const msg = `⚠️ ${warningTasks.length} 个任务异常：${warningTasks.join(', ')}`;
      warnings.push(msg);
      console.log(msg);
    } else {
      const msg = `✅ 所有任务状态正常`;
      healthyTasks.push(msg);
      console.log(msg);
    }
    
    return errorTasks.length === 0;
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

// 5. 检查任务执行超时（新增 v2.1）
function checkTaskTimeouts() {
  console.log('\n⏱️ 检查任务执行超时...');
  try {
    const data = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'));
    const timeoutTasks = [];
    
    for (const job of data.jobs) {
      if (!job.enabled) continue;
      
      // 检查最近一次执行是否超时
      if (job.state?.lastRunStatus === 'error' && 
          job.state?.lastError?.includes('timed out')) {
        const duration = job.state?.lastDurationMs ? 
          `${Math.round(job.state.lastDurationMs / 1000 / 60)}分钟` : '未知时长';
        timeoutTasks.push(`${job.name} (${duration})`);
      }
    }
    
    if (timeoutTasks.length > 0) {
      const msg = `⚠️ ${timeoutTasks.length} 个任务执行超时：${timeoutTasks.join(', ')}`;
      warnings.push(msg);
      console.log(msg);
      console.log('💡 建议：检查任务逻辑、增加超时时间、或优化性能');
    } else {
      const msg = `✅ 无任务执行超时`;
      healthyTasks.push(msg);
      console.log(msg);
    }
    
    return timeoutTasks.length === 0;
  } catch (e) {
    const msg = `❌ 无法检查任务超时：${e.message}`;
    alerts.push(msg);
    console.log(msg);
    return false;
  }
}

// 6. 检查磁盘空间（新增 v2.2）
function checkDiskSpace() {
  console.log('\n💾 检查磁盘空间...');
  try {
    const output = execSync('df -h /home | tail -1', { encoding: 'utf-8' });
    const parts = output.trim().split(/\s+/);
    const usagePercent = parseInt(parts[4]);
    const used = parts[2];
    const total = parts[1];
    
    if (usagePercent >= 90) {
      const msg = `❌ 磁盘空间紧张：${usagePercent}% (已用 ${used}/${total})`;
      alerts.push(msg);
      console.log(msg);
      return false;
    } else if (usagePercent >= 80) {
      const msg = `⚠️ 磁盘使用率较高：${usagePercent}% (已用 ${used}/${total})`;
      warnings.push(msg);
      console.log(msg);
    } else {
      const msg = `✅ 磁盘空间充足：${usagePercent}% (已用 ${used}/${total})`;
      healthyTasks.push(msg);
      console.log(msg);
    }
    
    return usagePercent < 90;
  } catch (e) {
    const msg = `❌ 无法检查磁盘空间：${e.message}`;
    alerts.push(msg);
    console.log(msg);
    return false;
  }
}

// 7. 检查内存使用（新增 v2.4）
function checkMemoryUsage() {
  console.log('\n🧠 检查内存使用...');
  try {
    // 读取 /proc/meminfo 获取内存信息
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf-8');
    const lines = meminfo.split('\n');
    
    let totalMem = 0;
    let availableMem = 0;
    
    for (const line of lines) {
      if (line.startsWith('MemTotal:')) {
        totalMem = parseInt(line.split(/\s+/)[1]) * 1024; // 转换为字节
      } else if (line.startsWith('MemAvailable:')) {
        availableMem = parseInt(line.split(/\s+/)[1]) * 1024;
      }
    }
    
    if (totalMem === 0) {
      throw new Error('无法读取内存信息');
    }
    
    const usedMem = totalMem - availableMem;
    const usagePercent = Math.round((usedMem / totalMem) * 100);
    
    // 格式化显示
    const formatBytes = (bytes) => {
      const gb = bytes / (1024 * 1024 * 1024);
      return `${gb.toFixed(1)}GB`;
    };
    
    if (usagePercent >= 90) {
      const msg = `❌ 内存使用过高：${usagePercent}% (已用 ${formatBytes(usedMem)}/${formatBytes(totalMem)})`;
      alerts.push(msg);
      console.log(msg);
      return false;
    } else if (usagePercent >= CONFIG.MEMORY_THRESHOLD_PERCENT) {
      const msg = `⚠️ 内存使用率较高：${usagePercent}% (已用 ${formatBytes(usedMem)}/${formatBytes(totalMem)})`;
      warnings.push(msg);
      console.log(msg);
    } else {
      const msg = `✅ 内存使用正常：${usagePercent}% (已用 ${formatBytes(usedMem)}/${formatBytes(totalMem)})`;
      healthyTasks.push(msg);
      console.log(msg);
    }
    
    return usagePercent < 90;
  } catch (e) {
    const msg = `❌ 无法检查内存使用：${e.message}`;
    warnings.push(msg);
    console.log(msg);
    return false;
  }
}

// 8. 任务统计摘要（新增 v2.2）
function getTaskStats() {
  console.log('\n📊 任务统计...');
  try {
    const data = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'));
    const jobs = data.jobs || [];
    const total = jobs.length;
    const enabled = jobs.filter(j => j.enabled !== false).length;
    const disabled = total - enabled;
    
    // 检查是否有任务配置了 wakeMode="next-heartbeat" 但没有 heartbeat（2026-03-13 教训）
    // 注意：wakeMode="now" 不依赖 heartbeat，只有 "next-heartbeat" 才需要
    const hasHeartbeat = jobs.some(j => j.name?.toLowerCase().includes('heartbeat') && j.enabled !== false);
    const wakeModeTasks = jobs.filter(j => j.enabled && j.wakeMode === 'next-heartbeat' && !hasHeartbeat);
    if (wakeModeTasks.length > 0) {
      const msg = `⚠️ ${wakeModeTasks.length} 个任务配置 wakeMode="next-heartbeat" 但无 heartbeat：${wakeModeTasks.map(j => j.name).join(', ')}`;
      warnings.push(msg);
      console.log(msg);
      console.log('💡 教训 (2026-03-13): wakeMode="next-heartbeat" 依赖 heartbeat 唤醒，否则任务永远无法执行');
    }
    
    const msg = `📋 任务总数：${total} | 启用：${enabled} | 禁用：${disabled}`;
    healthyTasks.push(msg);
    console.log(msg);
    
    return { total, enabled, disabled, wakeModeTasks };
  } catch (e) {
    const msg = `❌ 无法获取任务统计：${e.message}`;
    warnings.push(msg);
    console.log(msg);
    return null;
  }
}

/**
 * 错误分类统计（v2.9 新增）
 * 
 * 将错误消息分类为预定义类别，便于统计分析和告警
 * 
 * @param {string} errorMessage - 错误消息文本
 * @returns {string} 错误类别: 'network' | 'config' | 'timeout' | 'permission' | 'resource' | 'unknown'
 * 
 * @example
 * classifyError('Connection timeout after 30000ms') // => 'network'
 * classifyError('Invalid configuration: missing API key') // => 'config'
 * classifyError('Task execution timed out') // => 'timeout'
 */
function classifyError(errorMessage) {
  if (!errorMessage) return 'unknown';
  
  const errorLower = errorMessage.toLowerCase();
  
  // 网络相关错误
  if (errorLower.includes('timeout') || errorLower.includes('etimedout') || 
      errorLower.includes('econnrefused') || errorLower.includes('enotfound') ||
      errorLower.includes('network') || errorLower.includes('socket') ||
      errorLower.includes('dns') || errorLower.includes('unreachable')) {
    return 'network';
  }
  
  // 配置相关错误
  if (errorLower.includes('config') || errorLower.includes('configuration') ||
      errorLower.includes('invalid') || errorLower.includes('parse') ||
      errorLower.includes('syntax')) {
    return 'config';
  }
  
  // 资源相关错误
  if (errorLower.includes('memory') || errorLower.includes('disk') ||
      errorLower.includes('space') || errorLower.includes('quota') ||
      errorLower.includes('enospc') || errorLower.includes('emfile')) {
    return 'resource';
  }
  
  // 权限相关错误
  if (errorLower.includes('permission') || errorLower.includes('access') ||
      errorLower.includes('denied') || errorLower.includes('eacces') ||
      errorLower.includes('eperm') || errorLower.includes('forbidden')) {
    return 'permission';
  }
  
  // 外部 API 错误
  if (errorLower.includes('api') || errorLower.includes('http') ||
      errorLower.includes('response') || errorLower.includes('status') ||
      errorLower.includes('fetch') || errorLower.includes('request')) {
    return 'api';
  }
  
  // 超时错误（专门类别）
  if (errorLower.includes('timed out') || errorLower.includes('deadline exceeded')) {
    return 'timeout';
  }
  
  return 'other';
}

// 执行时间历史数据管理（v2.9 新增）
const EXEC_TIME_HISTORY_FILE = path.join(WORKSPACE_DIR, 'data', 'cron-exec-time-history.json');

function loadExecTimeHistory() {
  try {
    if (fs.existsSync(EXEC_TIME_HISTORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(EXEC_TIME_HISTORY_FILE, 'utf-8'));
      return data.history || [];
    }
  } catch (e) {
    console.log(`⚠️ 无法加载执行时间历史：${e.message}`);
  }
  return [];
}

function saveExecTimeHistory(duration) {
  try {
    const history = loadExecTimeHistory();
    history.push({
      timestamp: Date.now(),
      duration: duration,
      date: new Date().toISOString()
    });
    // 只保留最近 30 条记录
    if (history.length > 30) {
      history.shift();
    }
    const dataDir = path.dirname(EXEC_TIME_HISTORY_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(EXEC_TIME_HISTORY_FILE, JSON.stringify({ history }, null, 2));
  } catch (e) {
    console.log(`⚠️ 无法保存执行时间历史：${e.message}`);
  }
}

function getExecTimeTrend() {
  const history = loadExecTimeHistory();
  if (history.length < 2) return null;
  
  const recent = history.slice(-5); // 最近 5 次
  const avg = recent.reduce((sum, h) => sum + h.duration, 0) / recent.length;
  const prevAvg = history.slice(-10, -5).reduce((sum, h) => sum + h.duration, 0) / 5;
  
  const change = ((avg - prevAvg) / prevAvg) * 100;
  return {
    current: Math.round(avg),
    change: Math.round(change),
    samples: history.length
  };
}

/**
 * 健康评分系统（v3.0 新增）
 * 
 * 基于检查结果计算 0-100 分的健康评分
 * 评分维度：调度器状态、任务状态、资源使用、配置健康
 * 
 * @returns {object} 评分详情
 */
function calculateHealthScore() {
  let score = 100;
  const deductions = [];
  
  // 调度器状态（30 分）
  const schedulerAlert = alerts.find(a => a.includes('调度器停滞'));
  const schedulerWarning = warnings.find(w => w.includes('调度器延迟'));
  if (schedulerAlert) {
    score -= 30;
    deductions.push({ category: '调度器', points: 30, reason: '调度器停滞' });
  } else if (schedulerWarning) {
    score -= 15;
    deductions.push({ category: '调度器', points: 15, reason: '调度器延迟' });
  }
  
  // 任务状态（40 分）
  const taskErrors = alerts.filter(a => a.includes('连续错误')).length;
  const taskWarnings = warnings.filter(w => w.includes('任务')).length;
  if (taskErrors > 0) {
    const deduction = Math.min(40, taskErrors * 10);
    score -= deduction;
    deductions.push({ category: '任务状态', points: deduction, reason: `${taskErrors} 个任务连续错误` });
  } else if (taskWarnings > 0) {
    const deduction = Math.min(20, taskWarnings * 5);
    score -= deduction;
    deductions.push({ category: '任务状态', points: deduction, reason: `${taskWarnings} 个任务警告` });
  }
  
  // 资源使用（20 分）
  const diskAlert = alerts.find(a => a.includes('磁盘'));
  const diskWarning = warnings.find(w => w.includes('磁盘'));
  const memAlert = alerts.find(a => a.includes('内存'));
  const memWarning = warnings.find(w => w.includes('内存'));
  
  if (diskAlert || memAlert) {
    score -= 20;
    deductions.push({ category: '资源使用', points: 20, reason: '资源严重不足' });
  } else if (diskWarning || memWarning) {
    score -= 10;
    deductions.push({ category: '资源使用', points: 10, reason: '资源使用率较高' });
  }
  
  // 配置健康（10 分）
  const jsonError = alerts.find(a => a.includes('JSON'));
  const wakeModeWarning = warnings.find(w => w.includes('wakeMode'));
  if (jsonError) {
    score -= 10;
    deductions.push({ category: '配置', points: 10, reason: 'JSON 语法错误' });
  } else if (wakeModeWarning) {
    score -= 5;
    deductions.push({ category: '配置', points: 5, reason: 'wakeMode 配置问题' });
  }
  
  // 确保分数在 0-100 范围内
  score = Math.max(0, Math.min(100, score));
  
  // 健康等级
  let grade;
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';
  else grade = 'F';
  
  return { score, grade, deductions };
}

/**
 * 生成可操作建议（v3.0 新增）
 * 
 * 基于当前问题自动生成具体的操作建议
 * @returns {Array<string>} 建议列表
 */
function generateActionableRecommendations() {
  const recommendations = [];
  
  // 调度器问题
  if (alerts.some(a => a.includes('调度器停滞'))) {
    recommendations.push('🔴 **立即重启调度器**：`openclaw gateway restart`');
    recommendations.push('   检查日志：`journalctl -u openclaw -n 100`');
  } else if (warnings.some(w => w.includes('调度器延迟'))) {
    recommendations.push('🟡 **观察调度器状态**：`openclaw cron status`');
    recommendations.push('   如持续延迟，考虑重启');
  }
  
  // 任务错误
  const errorTasks = alerts.filter(a => a.includes('连续错误'));
  if (errorTasks.length > 0) {
    recommendations.push(`🔴 **检查失败任务**：${errorTasks.length} 个任务连续失败`);
    recommendations.push('   查看详情：`openclaw cron list`');
    recommendations.push('   查看日志：`openclaw cron runs <job-id>`');
  }
  
  // 资源问题
  if (alerts.some(a => a.includes('磁盘'))) {
    recommendations.push('🔴 **紧急清理磁盘**：`df -h` 查看使用情况');
    recommendations.push('   清理日志：`find /var/log -name "*.log" -mtime +7 -delete`');
  } else if (warnings.some(w => w.includes('磁盘'))) {
    recommendations.push('🟡 **监控磁盘使用**：考虑清理旧日志');
  }
  
  if (alerts.some(a => a.includes('内存'))) {
    recommendations.push('🔴 **检查内存泄漏**：`top` 查看内存使用');
    recommendations.push('   重启高内存进程');
  } else if (warnings.some(w => w.includes('内存'))) {
    recommendations.push('🟡 **监控内存使用**：`free -m`');
  }
  
  // 配置问题
  if (alerts.some(a => a.includes('JSON'))) {
    recommendations.push('🔴 **修复 jobs.json**：检查语法错误');
    recommendations.push('   验证：`cat ~/.openclaw/cron/jobs.json | jq .`');
  }
  
  if (warnings.some(w => w.includes('wakeMode'))) {
    recommendations.push('🟡 **修复 wakeMode 配置**：添加 heartbeat 任务或移除 wakeMode');
  }
  
  // 无问题时的建议
  if (recommendations.length === 0) {
    recommendations.push('✅ **系统运行正常**，无需操作');
    recommendations.push('   下次检查：1 小时后');
  }
  
  return recommendations;
}

/**
 * 生成 ASCII 趋势图表（v3.0 改进）
 * 
 * 将执行时间历史数据可视化为 ASCII 图表
 * @returns {string} ASCII 图表
 */
function generateAsciiTrendChart() {
  const history = loadExecTimeHistory();
  if (history.length < 3) return null;
  
  // 取最近 15 条记录
  const recent = history.slice(-15);
  const values = recent.map(h => h.duration);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  
  // 图表高度
  const height = 8;
  const width = recent.length;
  
  let chart = '\n```\n';
  chart += '执行时间趋势 (ms)\n';
  chart += `${max.toFixed(0).padStart(4)}ms ┤`;
  
  for (let row = height; row > 0; row--) {
    const threshold = min + (range * row / height);
    let line = '';
    for (let i = 0; i < width; i++) {
      const value = values[i];
      if (value >= threshold) {
        line += '█';
      } else if (value >= threshold - range / height / 2) {
        line += '▄';
      } else {
        line += ' ';
      }
    }
    if (row === height) {
      chart += line + '\n';
    } else {
      chart += '     │' + line + '\n';
    }
  }
  
  chart += `${min.toFixed(0).padStart(4)}ms ┤` + '─'.repeat(width) + '\n';
  chart += '     └' + '最近 15 次检查'.padStart(width) + '\n';
  chart += '```\n';
  
  return chart;
}

// 生成详细报告（v3.0 重写）
function generateDetailedReport() {
  const timestamp = new Date().toISOString().split('T')[0];
  const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const reportFile = path.join(WORKSPACE_DIR, 'reports', `cron-health-check-${timestamp}.md`);
  
  // 获取执行时间趋势和健康评分
  const trend = getExecTimeTrend();
  const healthScore = calculateHealthScore();
  const recommendations = generateActionableRecommendations();
  const asciiChart = generateAsciiTrendChart();
  
  let report = `# Cron 健康检查报告 v3.0\n\n`;
  report += `**检查时间:** ${new Date().toISOString()}\n`;
  report += `**检查版本:** v3.0\n`;
  report += `**健康评分:** ${healthScore.score}/100 (${healthScore.grade}级)\n`;
  
  if (trend) {
    const trendIcon = trend.change > 10 ? '⚠️' : trend.change < -10 ? '✅' : '➡️';
    report += `**执行时间趋势:** ${trend.current}ms (${trend.change > 0 ? '+' : ''}${trend.change}%) ${trendIcon}\n`;
  }
  report += `\n`;
  
  // 健康评分可视化
  report += `## 📊 健康评分\n\n`;
  report += `\`\`\`\n`;
  report += `评分: ${healthScore.score}/100 [${'█'.repeat(Math.floor(healthScore.score / 5))}${'░'.repeat(20 - Math.floor(healthScore.score / 5))}] ${healthScore.grade}级\n`;
  report += `\`\`\`\n\n`;
  
  if (healthScore.deductions.length > 0) {
    report += `**扣分详情:**\n`;
    healthScore.deductions.forEach(d => {
      report += `- ${d.category}: -${d.points}分 (${d.reason})\n`;
    });
    report += `\n`;
  }
  
  // 状态摘要
  const totalChecks = alerts.length + warnings.length + healthyTasks.length;
  report += `## 📋 检查摘要\n\n`;
  report += `- 总检查项：${totalChecks}\n`;
  report += `- ✅ 健康：${healthyTasks.length}\n`;
  report += `- ⚠️ 警告：${warnings.length}\n`;
  report += `- ❌ 告警：${alerts.length}\n\n`;
  
  // ASCII 趋势图
  if (asciiChart) {
    report += `## 📈 执行时间趋势\n`;
    report += asciiChart;
    report += `\n`;
  }
  
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
  
  // 可操作建议
  report += `## 💡 建议操作\n\n`;
  recommendations.forEach(r => report += `${r}\n`);
  report += `\n`;
  
  // 告警抑制信息
  const suppressedCount = alerts.filter(a => {
    const key = a.substring(0, 50);
    return AlertSuppressor.shouldSuppress(key, 4);
  }).length;
  
  if (suppressedCount > 0) {
    report += `## 🔕 告警抑制\n\n`;
    report += `${suppressedCount} 个告警被抑制（4 小时内已通知过）\n`;
    report += `抑制状态文件：${ALERT_STATE_FILE}\n\n`;
  }
  
  report += `---\n`;
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
  console.log('🏥 Cron 健康检查 v3.0');
  console.log('='.repeat(40));
  
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
  results.push(checkTaskTimeouts());
  results.push(checkDiskSpace());
  results.push(checkMemoryUsage());
  getTaskStats();
  
  // 3. 清除已恢复问题的抑制状态
  const currentAlertKeys = alerts.map(a => a.substring(0, 50));
  AlertSuppressor.clearRecovered(currentAlertKeys);
  
  // 4. 发送报告
  sendAlert();
  
  // 5. 执行时间统计
  const duration = Date.now() - startTime;
  console.log(`\n⏱️ 耗时：${duration}ms`);
  
  // 保存执行时间历史
  saveExecTimeHistory(duration);
  
  // 显示趋势和健康评分
  const trend = getExecTimeTrend();
  const healthScore = calculateHealthScore();
  
  if (trend) {
    const trendIcon = trend.change > 10 ? '⚠️ 上升' : trend.change < -10 ? '✅ 下降' : '➡️ 平稳';
    console.log(`📊 平均执行时间：${trend.current}ms (${trend.change > 0 ? '+' : ''}${trend.change}%) ${trendIcon}`);
  }
  
  console.log(`🏆 健康评分：${healthScore.score}/100 (${healthScore.grade}级)`);
  
  // 6. 返回状态码（有严重告警时返回 1）
  const hasAlerts = alerts.length > 0;
  process.exit(hasAlerts ? 1 : 0);
}

main();
