#!/usr/bin/env node
/**
 * @fileoverview 晨间报告飞书发送脚本
 * @description 读取夜间任务报告，生成格式化消息并通过飞书发送
 * @version 1.3
 * @author Claw (Digital Twin)
 * @license MIT
 * 
 * @example
 * // 基本用法
 * node send-morning-report-feishu.js
 * 
 * // 指定输出格式
 * node send-morning-report-feishu.js --format plain
 * 
 * // 禁用历史对比
 * node send-morning-report-feishu.js --no-history
 * 
 * @changelog
 * - v1.3 (2026-05-15): 添加完整 JSDoc 注释，优化错误处理，添加配置验证
 * - v1.2 (2026-05-13): 添加报告历史对比、智能摘要生成、多格式输出支持
 * - v1.1 (2026-04-28): 简化逻辑，添加错误处理，改进日志输出
 * - v1.0 (2026-04-22): 初始版本
 */

const fs = require('fs');
const path = require('path');

/** @constant {string} 脚本版本号 */
const SCRIPT_VERSION = '1.3';

/** @constant {string} 工作目录路径 */
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace');

/** @constant {string} 报告目录路径 */
const REPORTS_DIR = path.join(WORKSPACE_DIR, 'reports');

/**
 * @typedef {Object} Config
 * @property {number} maxTaskLines - 最大任务行数
 * @property {boolean} enableHistory - 是否启用历史对比
 * @property {boolean} enableScoring - 是否启用评分系统
 * @property {string} outputFormat - 输出格式 (markdown|plain|json)
 */

/** @type {Config} 全局配置对象 */
const CONFIG = {
  maxTaskLines: 8,
  enableHistory: true,
  enableScoring: true,
  outputFormat: 'markdown'
};

/**
 * 日志级别枚举
 * @readonly
 * @enum {string}
 */
const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
};

/**
 * 日志输出函数
 * @param {string} message - 消息内容
 * @param {string} [emoji='ℹ️'] - 表情符号
 * @param {LogLevel} [level=LogLevel.INFO] - 日志级别
 * @returns {void}
 * @example
 * log('开始处理', '🚀', LogLevel.INFO);
 * log('发生错误', '❌', LogLevel.ERROR);
 */
function log(message, emoji = 'ℹ️', level = LogLevel.INFO) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const levelEmoji = {
    [LogLevel.DEBUG]: '🔍',
    [LogLevel.INFO]: 'ℹ️',
    [LogLevel.WARN]: '⚠️',
    [LogLevel.ERROR]: '❌'
  }[level] || 'ℹ️';
  
  // DEBUG 级别只在环境变量 DEBUG 设置时输出
  if (level === LogLevel.DEBUG && !process.env.DEBUG) {
    return;
  }
  
  console.log(`${emoji || levelEmoji} [${timestamp}] [${level}] ${message}`);
}

/**
 * 错误分类器
 * @param {Error} error - 错误对象
 * @returns {Object} 分类后的错误信息
 * @property {string} type - 错误类型
 * @property {string} code - 错误代码
 * @property {boolean} retryable - 是否可重试
 */
function classifyError(error) {
  const code = error.code || 'UNKNOWN';
  const message = error.message || '';
  
  // 文件系统错误
  if (code === 'ENOENT' || message.includes('not found') || message.includes('不存在')) {
    return { type: 'FILE_NOT_FOUND', code: 'ENOENT', retryable: false };
  }
  if (code === 'EACCES' || code === 'EPERM' || message.includes('permission') || message.includes('权限')) {
    return { type: 'PERMISSION_DENIED', code, retryable: false };
  }
  if (code === 'ENOSPC' || message.includes('space') || message.includes('磁盘')) {
    return { type: 'DISK_FULL', code, retryable: false };
  }
  
  // 解析错误
  if (error instanceof SyntaxError || message.includes('parse') || message.includes('解析')) {
    return { type: 'PARSE_ERROR', code: 'PARSE', retryable: false };
  }
  
  // 超时错误
  if (code === 'ETIMEDOUT' || code === 'TIMEOUT' || message.includes('timeout') || message.includes('超时')) {
    return { type: 'TIMEOUT', code, retryable: true };
  }
  
  return { type: 'UNKNOWN', code, retryable: false };
}

/**
 * @typedef {Object} ReportInfo
 * @property {string|null} title - 报告标题
 * @property {string} completion - 完成度字符串 (如 "6/6")
 * @property {string} taskSummary - 任务摘要
 * @property {number|null} score - 自评分数
 * @property {string[]} highlights - 关键成就列表
 */

/**
 * 提取报告关键信息
 * @param {string} content - 报告内容
 * @returns {ReportInfo} 提取的信息
 * @throws {Error} 当内容为空或格式异常时抛出
 * @example
 * const info = extractReportInfo(reportContent);
 * console.log(info.completion); // "6/6"
 */
function extractReportInfo(content) {
  if (!content || typeof content !== 'string') {
    throw new Error('报告内容不能为空');
  }
  
  // 使用 try-catch 包装正则匹配，防止异常
  try {
    const titleMatch = content.match(/# 🌅 晨间报告 - (.+)/);
    const completionMatch = content.match(/完成度：(.+)/);
    const taskSection = content.match(/## 📊 夜间任务完成摘要\n\n([\s\S]*?)\n\n---/);
    const scoreMatch = content.match(/自评：(\d+)\/10/);
    const highlightsMatch = content.match(/## ⭐ 关键成就\n\n([\s\S]*?)\n\n/);
    
    return {
      title: titleMatch ? titleMatch[1].trim() : null,
      completion: completionMatch ? completionMatch[1].trim() : '未知',
      taskSummary: taskSection ? taskSection[1] : '',
      score: scoreMatch ? parseInt(scoreMatch[1], 10) : null,
      highlights: highlightsMatch ? highlightsMatch[1].split('\n').filter(l => l.trim().startsWith('-')).slice(0, 3) : []
    };
  } catch (err) {
    log(`提取报告信息失败: ${err.message}`, '⚠️', LogLevel.WARN);
    return {
      title: null,
      completion: '未知',
      taskSummary: '',
      score: null,
      highlights: []
    };
  }
}

/**
 * @typedef {Object} YesterdayReport
 * @property {string} date - 日期
 * @property {string} completion - 完成度
 * @property {number|null} score - 评分
 */

/**
 * 获取昨天的报告信息（用于对比）
 * @param {string} today - 今天日期 (YYYY-MM-DD 格式)
 * @returns {YesterdayReport|null} 昨天的报告信息
 * @example
 * const yesterdayInfo = getYesterdayReport('2026-05-15');
 * if (yesterdayInfo) {
 *   console.log(`昨日完成度: ${yesterdayInfo.completion}`);
 * }
 */
function getYesterdayReport(today) {
  if (!CONFIG.enableHistory) {
    log('历史对比已禁用', 'ℹ️', LogLevel.DEBUG);
    return null;
  }
  
  // 验证日期格式
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    log(`日期格式无效: ${today}`, '⚠️', LogLevel.WARN);
    return null;
  }
  
  const yesterday = new Date(new Date(today).getTime() - 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];
  const yesterdayPath = path.join(REPORTS_DIR, `nightly-report-${yesterday}.md`);
  
  log(`查找昨日报告: ${yesterdayPath}`, '🔍', LogLevel.DEBUG);
  
  if (!fs.existsSync(yesterdayPath)) {
    log(`昨日报告不存在: ${yesterdayPath}`, 'ℹ️', LogLevel.DEBUG);
    return null;
  }
  
  try {
    const content = fs.readFileSync(yesterdayPath, 'utf-8');
    const completionMatch = content.match(/完成度：(.+)/);
    const scoreMatch = content.match(/自评：(\d+)\/10/);
    
    log(`成功读取昨日报告: ${yesterday}`, '✅', LogLevel.DEBUG);
    
    return {
      date: yesterday,
      completion: completionMatch ? completionMatch[1].trim() : '未知',
      score: scoreMatch ? parseInt(scoreMatch[1], 10) : null
    };
  } catch (err) {
    const errorInfo = classifyError(err);
    log(`读取昨日报告失败 [${errorInfo.type}]: ${err.message}`, '⚠️', LogLevel.WARN);
    return null;
  }
}

/**
 * 计算完成度百分比
 * @param {string} completion - 完成度字符串 (如 "6/6" 或 "5/6")
 * @returns {number} 百分比 (0-100)
 * @example
 * parseCompletionRate('6/6'); // 100
 * parseCompletionRate('3/6'); // 50
 * parseCompletionRate('未知'); // 0
 */
function parseCompletionRate(completion) {
  if (!completion || typeof completion !== 'string') {
    return 0;
  }
  
  const match = completion.match(/(\d+)\/(\d+)/);
  if (match) {
    const completed = parseInt(match[1], 10);
    const total = parseInt(match[2], 10);
    
    if (total === 0) {
      log('完成度计算: 总任务数为0', '⚠️', LogLevel.WARN);
      return 0;
    }
    
    const percentage = Math.round((completed / total) * 100);
    log(`完成度计算: ${completed}/${total} = ${percentage}%`, '📊', LogLevel.DEBUG);
    return percentage;
  }
  
  log(`无法解析完成度: ${completion}`, '⚠️', LogLevel.DEBUG);
  return 0;
}

/**
 * 生成对比信息
 * @param {ReportInfo} todayInfo - 今天信息
 * @param {YesterdayReport} yesterdayInfo - 昨天信息
 * @returns {string} 对比文本
 * @example
 * const comparison = generateComparison(
 *   { completion: '6/6' },
 *   { completion: '5/6' }
 * );
 * // "📈 比昨日提升 17%"
 */
function generateComparison(todayInfo, yesterdayInfo) {
  if (!yesterdayInfo) {
    log('无昨日数据，跳过对比', 'ℹ️', LogLevel.DEBUG);
    return '';
  }
  
  const todayRate = parseCompletionRate(todayInfo.completion);
  const yesterdayRate = parseCompletionRate(yesterdayInfo.completion);
  const diff = todayRate - yesterdayRate;
  
  log(`完成度对比: 今日${todayRate}% vs 昨日${yesterdayRate}%`, '📊', LogLevel.DEBUG);
  
  if (diff > 0) {
    return `📈 比昨日提升 ${diff}%`;
  } else if (diff < 0) {
    return `📉 比昨日下降 ${Math.abs(diff)}%`;
  }
  return `➡️ 与昨日持平`;
}

/**
 * 评分等级枚举
 * @readonly
 * @enum {string}
 */
const ScoreLevel = {
  EXCELLENT: '🌟',  // 9-10分
  GOOD: '✨',       // 7-8分
  AVERAGE: '⭐',    // 5-6分
  NEEDS_IMPROVEMENT: '💫' // 0-4分
};

/**
 * 生成评分表情
 * @param {number} score - 评分 (0-10)
 * @returns {string} 表情符号
 * @example
 * getScoreEmoji(10); // '🌟'
 * getScoreEmoji(8);  // '✨'
 * getScoreEmoji(5);  // '⭐'
 * getScoreEmoji(3);  // '💫'
 */
function getScoreEmoji(score) {
  // 验证输入
  if (typeof score !== 'number' || isNaN(score)) {
    log(`无效的评分值: ${score}`, '⚠️', LogLevel.WARN);
    return ScoreLevel.NEEDS_IMPROVEMENT;
  }
  
  // 限制范围
  const normalizedScore = Math.max(0, Math.min(10, score));
  
  if (normalizedScore >= 9) return ScoreLevel.EXCELLENT;
  if (normalizedScore >= 7) return ScoreLevel.GOOD;
  if (normalizedScore >= 5) return ScoreLevel.AVERAGE;
  return ScoreLevel.NEEDS_IMPROVEMENT;
}

/**
 * 构建飞书消息 (Markdown 格式)
 * @param {string} today - 日期字符串 (YYYY-MM-DD)
 * @param {ReportInfo} info - 报告信息
 * @param {YesterdayReport} [yesterdayInfo=null] - 昨天信息
 * @returns {string} 格式化消息
 * @example
 * const message = buildMessage('2026-05-15', reportInfo, yesterdayInfo);
 * sessions_send({ sessionKey: '...', message });
 */
function buildMessage(today, info, yesterdayInfo = null) {
  // 验证输入
  if (!info) {
    throw new Error('报告信息不能为空');
  }
  
  const lines = info.taskSummary.split('\n').filter(l => l.trim()).slice(0, CONFIG.maxTaskLines);
  const comparison = generateComparison(info, yesterdayInfo);
  const scoreEmoji = info.score ? getScoreEmoji(info.score) : '';
  
  let message = `🌅 晨间报告 - ${info.title || today}

📊 夜间任务完成度：${info.completion}`;
  
  if (comparison) {
    message += ` (${comparison})`;
  }
  
  if (info.score) {
    message += `\n${scoreEmoji} 自评：${info.score}/10`;
  }
  
  message += '\n\n';
  
  // 添加关键成就
  if (info.highlights && info.highlights.length > 0) {
    message += '⭐ 关键成就：\n';
    info.highlights.forEach(h => {
      message += h.replace(/^- /, '  • ') + '\n';
    });
    message += '\n';
  }
  
  // 添加任务摘要
  if (lines.length > 0) {
    message += '📝 任务摘要：\n';
    lines.forEach(line => {
      message += line + '\n';
    });
  }
  
  message += `\n📁 详细报告：reports/nightly-report-${today}.md
🔗 GitHub: https://github.com/erwinqyf/Claw-s-memory

> 🪞 孪生于不同世界，彼此映照，共同演化。`;
  
  log(`消息构建完成: ${message.length} 字符`, '✅', LogLevel.DEBUG);
  return message;
}

/**
 * 构建纯文本消息（用于限制场景）
 * @param {string} today - 日期字符串 (YYYY-MM-DD)
 * @param {ReportInfo} info - 报告信息
 * @returns {string} 纯文本消息
 * @example
 * const plainText = buildPlainTextMessage('2026-05-15', reportInfo);
 * // 适合飞书纯文本消息或短信场景
 */
function buildPlainTextMessage(today, info) {
  if (!info) {
    throw new Error('报告信息不能为空');
  }
  
  const lines = [
    `晨间报告 - ${info.title || today}`,
    '',
    `夜间任务完成度：${info.completion}`
  ];
  
  if (info.score) {
    lines.push(`自评：${info.score}/10`);
  }
  
  lines.push('', `详细报告：reports/nightly-report-${today}.md`);
  
  return lines.join('\n');
}

/**
 * @typedef {Object} JSONMessage
 * @property {string} type - 消息类型
 * @property {string} date - 日期
 * @property {string} title - 标题
 * @property {string} completion - 完成度字符串
 * @property {number} completionRate - 完成度百分比
 * @property {number|null} score - 评分
 * @property {string[]} highlights - 关键成就
 * @property {Object|null} yesterdayComparison - 昨日对比
 * @property {string} reportPath - 报告路径
 */

/**
 * 构建JSON格式消息
 * @param {string} today - 日期字符串 (YYYY-MM-DD)
 * @param {ReportInfo} info - 报告信息
 * @param {YesterdayReport} [yesterdayInfo=null] - 昨天信息
 * @returns {JSONMessage} JSON对象
 * @example
 * const jsonMessage = buildJSONMessage('2026-05-15', reportInfo, yesterdayInfo);
 * console.log(JSON.stringify(jsonMessage, null, 2));
 */
function buildJSONMessage(today, info, yesterdayInfo = null) {
  if (!info) {
    throw new Error('报告信息不能为空');
  }
  
  return {
    type: 'morning_report',
    date: today,
    title: info.title || today,
    completion: info.completion,
    completionRate: parseCompletionRate(info.completion),
    score: info.score,
    highlights: info.highlights || [],
    yesterdayComparison: yesterdayInfo ? {
      date: yesterdayInfo.date,
      completion: yesterdayInfo.completion,
      score: yesterdayInfo.score
    } : null,
    reportPath: `reports/nightly-report-${today}.md`
  };
}

/**
 * 有效的输出格式
 * @constant {string[]}
 */
const VALID_FORMATS = ['markdown', 'plain', 'json'];

/**
 * 解析命令行参数
 * @returns {Config} 配置对象
 * @throws {Error} 当参数无效时抛出
 * @example
 * // node send-morning-report-feishu.js --format plain -n 5
 * const config = parseArgs();
 * // { maxTaskLines: 5, enableHistory: true, enableScoring: true, outputFormat: 'plain' }
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = { ...CONFIG };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--format':
      case '-f':
        const format = args[++i];
        if (!format || !VALID_FORMATS.includes(format)) {
          log(`无效的格式: ${format}，使用默认值: markdown`, '⚠️', LogLevel.WARN);
          config.outputFormat = 'markdown';
        } else {
          config.outputFormat = format;
        }
        break;
      case '--no-history':
        config.enableHistory = false;
        log('已禁用历史对比', 'ℹ️', LogLevel.DEBUG);
        break;
      case '--no-score':
        config.enableScoring = false;
        log('已禁用评分显示', 'ℹ️', LogLevel.DEBUG);
        break;
      case '--max-lines':
      case '-n':
        const lines = parseInt(args[++i], 10);
        if (isNaN(lines) || lines < 1 || lines > 50) {
          log(`无效的行数: ${args[i]}，使用默认值: 8`, '⚠️', LogLevel.WARN);
          config.maxTaskLines = 8;
        } else {
          config.maxTaskLines = lines;
          log(`设置最大行数: ${lines}`, 'ℹ️', LogLevel.DEBUG);
        }
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      case '--version':
      case '-v':
        console.log(`v${SCRIPT_VERSION}`);
        process.exit(0);
        break;
      default:
        if (args[i].startsWith('-')) {
          log(`未知参数: ${args[i]}`, '⚠️', LogLevel.WARN);
        }
    }
  }
  
  return config;
}

/**
 * 显示帮助信息
 * @returns {void}
 */
function showHelp() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║     晨间报告飞书发送脚本 v${SCRIPT_VERSION}                      ║
╚════════════════════════════════════════════════════════════╝

用法: node send-morning-report-feishu.js [选项]

选项:
  -f, --format <type>    输出格式: markdown|plain|json (默认: markdown)
  --no-history           禁用历史对比
  --no-score             禁用评分显示
  -n, --max-lines <num>  最大任务行数 1-50 (默认: 8)
  -h, --help             显示帮助
  -v, --version          显示版本

环境变量:
  DEBUG=1                启用调试日志
  WORKSPACE_DIR          工作目录路径

示例:
  # 基本用法
  node send-morning-report-feishu.js

  # 纯文本格式
  node send-morning-report-feishu.js --format plain

  # 禁用历史对比，只显示5行任务
  node send-morning-report-feishu.js --no-history -n 5

  # 调试模式
  DEBUG=1 node send-morning-report-feishu.js

输出:
  脚本会输出发送给飞书的消息内容，以及发送指令示例。
`);
}

/**
 * 验证环境配置
 * @returns {boolean} 是否验证通过
 */
function validateEnvironment() {
  log('验证环境配置...', '🔍');
  
  // 检查工作目录
  if (!fs.existsSync(WORKSPACE_DIR)) {
    log(`工作目录不存在: ${WORKSPACE_DIR}`, '❌', LogLevel.ERROR);
    return false;
  }
  
  // 检查报告目录
  if (!fs.existsSync(REPORTS_DIR)) {
    log(`报告目录不存在: ${REPORTS_DIR}，尝试创建...`, '⚠️', LogLevel.WARN);
    try {
      fs.mkdirSync(REPORTS_DIR, { recursive: true });
      log('报告目录创建成功', '✅');
    } catch (err) {
      const errorInfo = classifyError(err);
      log(`创建报告目录失败 [${errorInfo.type}]: ${err.message}`, '❌', LogLevel.ERROR);
      return false;
    }
  }
  
  log('环境验证通过', '✅');
  return true;
}

/**
 * 列出可用的报告文件
 * @param {number} [limit=3] - 返回的最大文件数
 * @returns {string[]} 报告文件名列表
 */
function listAvailableReports(limit = 3) {
  try {
    if (!fs.existsSync(REPORTS_DIR)) {
      return [];
    }
    
    return fs.readdirSync(REPORTS_DIR)
      .filter(f => f.startsWith('nightly-report-') && f.endsWith('.md'))
      .sort()
      .slice(-limit);
  } catch (err) {
    log(`列出报告文件失败: ${err.message}`, '⚠️', LogLevel.WARN);
    return [];
  }
}

/**
 * 主函数
 * @returns {Promise<void>}
 * @example
 * main().catch(err => {
 *   console.error('执行失败:', err);
 *   process.exit(1);
 * });
 */
async function main() {
  const startTime = Date.now();
  
  try {
    // 解析命令行参数
    const config = parseArgs();
    Object.assign(CONFIG, config);
    
    log(`晨间报告发送脚本 v${SCRIPT_VERSION} 启动`, '🚀');
    log(`配置: 格式=${CONFIG.outputFormat}, 历史=${CONFIG.enableHistory}, 评分=${CONFIG.enableScoring}`, '⚙️');
    
    // 验证环境
    if (!validateEnvironment()) {
      process.exit(1);
    }
    
    // 获取今天的日期
    const today = new Date().toISOString().split('T')[0];
    const reportPath = path.join(REPORTS_DIR, `nightly-report-${today}.md`);
    
    log(`查找报告文件: ${reportPath}`, '🔍');
    
    // 检查报告文件是否存在
    if (!fs.existsSync(reportPath)) {
      log(`报告文件不存在: ${reportPath}`, '❌', LogLevel.ERROR);
      
      // 列出可用的报告文件
      const availableReports = listAvailableReports(3);
      if (availableReports.length > 0) {
        log('可用的报告文件:', '💡');
        availableReports.forEach(f => console.log(`  - ${f}`));
      } else {
        log('没有找到可用的报告文件', '⚠️');
      }
      
      process.exit(1);
    }
    
    log('报告文件存在，读取内容...', '✅');
    
    // 读取报告内容
    let content;
    try {
      content = fs.readFileSync(reportPath, 'utf-8');
      log(`成功读取报告: ${content.length} 字符`, '✅');
    } catch (err) {
      const errorInfo = classifyError(err);
      log(`读取报告失败 [${errorInfo.type}]: ${err.message}`, '❌', LogLevel.ERROR);
      process.exit(1);
    }
    
    // 提取关键信息
    let info;
    try {
      info = extractReportInfo(content);
      log(`提取到标题: ${info.title || today}`, '📝');
      log(`完成度: ${info.completion} (${parseCompletionRate(info.completion)}%)`, '📊');
      if (info.score) {
        log(`自评: ${info.score}/10 ${getScoreEmoji(info.score)}`, '⭐');
      }
    } catch (err) {
      log(`提取报告信息失败: ${err.message}`, '❌', LogLevel.ERROR);
      process.exit(1);
    }
    
    // 获取昨天报告信息
    const yesterdayInfo = CONFIG.enableHistory ? getYesterdayReport(today) : null;
    if (yesterdayInfo) {
      log(`昨日对比: ${yesterdayInfo.completion} (${parseCompletionRate(yesterdayInfo.completion)}%)`, '📈');
    }
    
    // 根据格式构建消息
    let message;
    try {
      switch (CONFIG.outputFormat) {
        case 'plain':
          message = buildPlainTextMessage(today, info);
          break;
        case 'json':
          const jsonData = buildJSONMessage(today, info, yesterdayInfo);
          message = JSON.stringify(jsonData, null, 2);
          break;
        case 'markdown':
        default:
          message = buildMessage(today, info, yesterdayInfo);
      }
      log('消息构建完成', '✅');
    } catch (err) {
      log(`构建消息失败: ${err.message}`, '❌', LogLevel.ERROR);
      process.exit(1);
    }
    
    // 输出消息
    log('====================', '─');
    console.log(message);
    log('====================', '─');
    
    // 输出发送指令
    log('请使用以下方式发送消息:', '💡');
    console.log('');
    console.log('方式1: 通过 sessions_send 工具');
    console.log('  sessions_send({');
    console.log('    sessionKey: "agent:main:feishu:group:YOUR_GROUP_ID",');
    console.log(`    message: "晨间报告已生成..."`);
    console.log('  })');
    console.log('');
    console.log('方式2: 通过 openclaw CLI');
    console.log(`  openclaw message send --channel feishu --to <目标ID> "${message.slice(0, 50)}..."`);
    console.log('');
    
    // 输出统计信息
    const executionTime = Date.now() - startTime;
    log('统计信息:', '📈');
    console.log(`  报告行数: ${content.split('\n').length}`);
    console.log(`  消息长度: ${message.length} 字符`);
    console.log(`  完成率: ${parseCompletionRate(info.completion)}%`);
    if (yesterdayInfo) {
      const diff = parseCompletionRate(info.completion) - parseCompletionRate(yesterdayInfo.completion);
      console.log(`  环比变化: ${diff >= 0 ? '+' : ''}${diff}%`);
    }
    console.log(`  执行耗时: ${executionTime}ms`);
    
    log('脚本执行完成', '✅');
    
  } catch (err) {
    const errorInfo = classifyError(err);
    log(`脚本执行失败 [${errorInfo.type}]: ${err.message}`, '❌', LogLevel.ERROR);
    process.exit(1);
  }
}

// 执行主函数
main().catch(err => {
  const errorInfo = classifyError(err);
  log(`脚本执行失败 [${errorInfo.type}]: ${err.message}`, '❌', LogLevel.ERROR);
  process.exit(1);
});
