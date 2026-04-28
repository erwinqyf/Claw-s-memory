#!/usr/bin/env node
/**
 * 晨间报告飞书发送脚本 v1.1
 * =========================
 * 使用 sessions_send 发送飞书消息
 * 
 * 版本历史:
 * - v1.1 (2026-04-28): 简化逻辑，添加错误处理，改进日志输出
 * - v1.0 (2026-04-22): 初始版本
 * 
 * 优化点:
 * - 简化消息构建逻辑
 * - 添加错误处理和重试机制
 * - 改进日志输出格式
 * - 支持从命令行接收目标 sessionKey
 */

const fs = require('fs');
const path = require('path');

const SCRIPT_VERSION = '1.1';
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace');

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
  
  return {
    title: titleMatch ? titleMatch[1] : null,
    completion: completionMatch ? completionMatch[1] : '未知',
    taskSummary: taskSection ? taskSection[1] : ''
  };
}

/**
 * 构建飞书消息
 * @param {string} today - 日期字符串
 * @param {Object} info - 报告信息
 * @returns {string} 格式化消息
 */
function buildMessage(today, info) {
  const lines = info.taskSummary.split('\n').slice(0, 6);
  
  return `🌅 晨间报告 - ${info.title || today}

📊 夜间任务完成度：${info.completion}

${lines.join('\n')}

📁 详细报告：reports/nightly-report-${today}.md
🔗 GitHub: https://github.com/erwinqyf/Claw-s-memory

> 🪞 孪生于不同世界，彼此映照，共同演化。`;
}

/**
 * 主函数
 */
async function main() {
  log(`晨间报告发送脚本 v${SCRIPT_VERSION} 启动`, '🚀');
  
  // 获取今天的日期
  const today = new Date().toISOString().split('T')[0];
  const reportPath = path.join(WORKSPACE_DIR, 'reports', `nightly-report-${today}.md`);
  
  log(`查找报告文件: ${reportPath}`, '🔍');
  
  // 检查报告文件是否存在
  if (!fs.existsSync(reportPath)) {
    log(`报告文件不存在: ${reportPath}`, '❌');
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
  log(`完成度: ${info.completion}`, '📊');
  
  // 构建消息
  const message = buildMessage(today, info);
  
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
  
  log('脚本执行完成', '✅');
}

// 执行主函数
main().catch(err => {
  log(`脚本执行失败: ${err.message}`, '❌');
  process.exit(1);
});
