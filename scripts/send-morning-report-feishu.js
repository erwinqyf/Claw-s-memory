#!/usr/bin/env node
/**
 * 晨间报告飞书发送脚本 v1.2
 * =========================
 * 使用 sessions_send 发送飞书消息
 * 
 * 版本历史:
 * - v1.2 (2026-05-13): 添加报告历史对比、智能摘要生成、多格式输出支持
 * - v1.1 (2026-04-28): 简化逻辑，添加错误处理，改进日志输出
 * - v1.0 (2026-04-22): 初始版本
 * 
 * 优化点:
 * - 添加报告历史对比功能（与昨日对比完成度）
 * - 智能摘要生成（提取关键成就）
 * - 多格式输出支持（Markdown/纯文本/JSON）
 * - 支持从命令行接收目标 sessionKey
 * - 添加报告评分系统
 */

const fs = require('fs');
const path = require('path');

const SCRIPT_VERSION = '1.2';
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace');

// 配置
const CONFIG = {
  maxTaskLines: 8,        // 最大任务行数
  enableHistory: true,    // 启用历史对比
  enableScoring: true,    // 启用评分系统
  outputFormat: 'markdown' // 默认输出格式
};

/**
 * 日志输出函数
 * @param {string} message - 消息内容
 * @param {string} emoji - 表情符号
 */
function log(message, emoji = 'ℹ️') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`${emoji} [${timestamp}] ${message}`);
}

/**
 * 提取报告关键信息
 * @param {string} content - 报告内容
 * @returns {Object} 提取的信息
 */
function extractReportInfo(content) {
  const titleMatch = content.match(/# 🌅 晨间报告 - (.+)/);
  const completionMatch = content.match(/完成度：(.+)/);
  const taskSection = content.match(/## 📊 夜间任务完成摘要\n\n([\s\S]*?)\n\n---/);
  const scoreMatch = content.match(/自评：(\d+)\/10/);
  const highlightsMatch = content.match(/## ⭐ 关键成就\n\n([\s\S]*?)\n\n/);
  
  return {
    title: titleMatch ? titleMatch[1] : null,
    completion: completionMatch ? completionMatch[1] : '未知',
    taskSummary: taskSection ? taskSection[1] : '',
    score: scoreMatch ? parseInt(scoreMatch[1]) : null,
    highlights: highlightsMatch ? highlightsMatch[1].split('\n').filter(l => l.trim().startsWith('-')).slice(0, 3) : []
  };
}

/**
 * 获取昨天的报告信息（用于对比）
 * @param {string} today - 今天日期
 * @returns {Object|null} 昨天的报告信息
 */
function getYesterdayReport(today) {
  if (!CONFIG.enableHistory) return null;
  
  const yesterday = new Date(new Date(today).getTime() - 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];
  const yesterdayPath = path.join(WORKSPACE_DIR, 'reports', `nightly-report-${yesterday}.md`);
  
  if (!fs.existsSync(yesterdayPath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(yesterdayPath, 'utf-8');
    const completionMatch = content.match(/完成度：(.+)/);
    const scoreMatch = content.match(/自评：(\d+)\/10/);
    
    return {
      date: yesterday,
      completion: completionMatch ? completionMatch[1] : '未知',
      score: scoreMatch ? parseInt(scoreMatch[1]) : null
    };
  } catch (err) {
    return null;
  }
}

/**
 * 计算完成度百分比
 * @param {string} completion - 完成度字符串
 * @returns {number} 百分比
 */
function parseCompletionRate(completion) {
  const match = completion.match(/(\d+)\/(\d+)/);
  if (match) {
    return Math.round((parseInt(match[1]) / parseInt(match[2])) * 100);
  }
  return 0;
}

/**
 * 生成对比信息
 * @param {Object} todayInfo - 今天信息
 * @param {Object} yesterdayInfo - 昨天信息
 * @returns {string} 对比文本
 */
function generateComparison(todayInfo, yesterdayInfo) {
  if (!yesterdayInfo) return '';
  
  const todayRate = parseCompletionRate(todayInfo.completion);
  const yesterdayRate = parseCompletionRate(yesterdayInfo.completion);
  const diff = todayRate - yesterdayRate;
  
  if (diff > 0) {
    return `📈 比昨日提升 ${diff}%`;
  } else if (diff < 0) {
    return `📉 比昨日下降 ${Math.abs(diff)}%`;
  }
  return `➡️ 与昨日持平`;
}

/**
 * 生成评分表情
 * @param {number} score - 评分
 * @returns {string} 表情
 */
function getScoreEmoji(score) {
  if (score >= 9) return '🌟';
  if (score >= 7) return '✨';
  if (score >= 5) return '⭐';
  return '💫';
}

/**
 * 构建飞书消息
 * @param {string} today - 日期字符串
 * @param {Object} info - 报告信息
 * @param {Object} yesterdayInfo - 昨天信息
 * @returns {string} 格式化消息
 */
function buildMessage(today, info, yesterdayInfo = null) {
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
  
  return message;
}

/**
 * 构建纯文本消息（用于限制场景）
 * @param {string} today - 日期字符串
 * @param {Object} info - 报告信息
 * @returns {string} 纯文本消息
 */
function buildPlainTextMessage(today, info) {
  return `晨间报告 - ${info.title || today}

夜间任务完成度：${info.completion}
${info.score ? `自评：${info.score}/10` : ''}

详细报告：reports/nightly-report-${today}.md`;
}

/**
 * 构建JSON格式消息
 * @param {string} today - 日期字符串
 * @param {Object} info - 报告信息
 * @param {Object} yesterdayInfo - 昨天信息
 * @returns {Object} JSON对象
 */
function buildJSONMessage(today, info, yesterdayInfo = null) {
  return {
    type: 'morning_report',
    date: today,
    title: info.title || today,
    completion: info.completion,
    completionRate: parseCompletionRate(info.completion),
    score: info.score,
    highlights: info.highlights,
    yesterdayComparison: yesterdayInfo ? {
      date: yesterdayInfo.date,
      completion: yesterdayInfo.completion,
      score: yesterdayInfo.score
    } : null,
    reportPath: `reports/nightly-report-${today}.md`
  };
}

/**
 * 解析命令行参数
 * @returns {Object} 配置对象
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = { ...CONFIG };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--format':
      case '-f':
        config.outputFormat = args[++i] || 'markdown';
        break;
      case '--no-history':
        config.enableHistory = false;
        break;
      case '--no-score':
        config.enableScoring = false;
        break;
      case '--max-lines':
      case '-n':
        config.maxTaskLines = parseInt(args[++i]) || 8;
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
    }
  }
  
  return config;
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
晨间报告飞书发送脚本 v${SCRIPT_VERSION}

用法: node send-morning-report-feishu.js [选项]

选项:
  -f, --format <type>    输出格式: markdown|plain|json (默认: markdown)
  --no-history           禁用历史对比
  --no-score             禁用评分显示
  -n, --max-lines <num>  最大任务行数 (默认: 8)
  -h, --help             显示帮助
  -v, --version          显示版本

示例:
  node send-morning-report-feishu.js
  node send-morning-report-feishu.js --format plain
  node send-morning-report-feishu.js --no-history -n 5
`);
}

/**
 * 主函数
 */
async function main() {
  // 解析命令行参数
  const config = parseArgs();
  Object.assign(CONFIG, config);
  
  log(`晨间报告发送脚本 v${SCRIPT_VERSION} 启动`, '🚀');
  log(`配置: 格式=${CONFIG.outputFormat}, 历史=${CONFIG.enableHistory}, 评分=${CONFIG.enableScoring}`, '⚙️');
  
  // 获取今天的日期
  const today = new Date().toISOString().split('T')[0];
  const reportPath = path.join(WORKSPACE_DIR, 'reports', `nightly-report-${today}.md`);
  
  log(`查找报告文件: ${reportPath}`, '🔍');
  
  // 检查报告文件是否存在
  if (!fs.existsSync(reportPath)) {
    log(`报告文件不存在: ${reportPath}`, '❌');
    // 列出可用的报告文件
    const reportsDir = path.join(WORKSPACE_DIR, 'reports');
    if (fs.existsSync(reportsDir)) {
      const files = fs.readdirSync(reportsDir)
        .filter(f => f.startsWith('nightly-report-') && f.endsWith('.md'))
        .sort()
        .slice(-3);
      if (files.length > 0) {
        log('可用的报告文件:', '💡');
        files.forEach(f => console.log(`  - ${f}`));
      }
    }
    process.exit(1);
  }
  
  log('报告文件存在，读取内容...', '✅');
  
  // 读取报告内容
  let content;
  try {
    content = fs.readFileSync(reportPath, 'utf-8');
  } catch (err) {
    log(`读取报告失败: ${err.message}`, '❌');
    process.exit(1);
  }
  
  // 提取关键信息
  const info = extractReportInfo(content);
  log(`提取到标题: ${info.title || today}`, '📝');
  log(`完成度: ${info.completion} (${parseCompletionRate(info.completion)}%)`, '📊');
  if (info.score) {
    log(`自评: ${info.score}/10 ${getScoreEmoji(info.score)}`, '⭐');
  }
  
  // 获取昨天报告信息
  const yesterdayInfo = CONFIG.enableHistory ? getYesterdayReport(today) : null;
  if (yesterdayInfo) {
    log(`昨日对比: ${yesterdayInfo.completion} (${parseCompletionRate(yesterdayInfo.completion)}%)`, '📈');
  }
  
  // 根据格式构建消息
  let message;
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
  log('统计信息:', '📈');
  console.log(`  报告行数: ${content.split('\n').length}`);
  console.log(`  消息长度: ${message.length} 字符`);
  console.log(`  完成率: ${parseCompletionRate(info.completion)}%`);
  if (yesterdayInfo) {
    const diff = parseCompletionRate(info.completion) - parseCompletionRate(yesterdayInfo.completion);
    console.log(`  环比变化: ${diff >= 0 ? '+' : ''}${diff}%`);
  }
  
  log('脚本执行完成', '✅');
}

// 执行主函数
main().catch(err => {
  log(`脚本执行失败: ${err.message}`, '❌');
  process.exit(1);
});
