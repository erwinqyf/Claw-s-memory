#!/usr/bin/env node
/**
 * 发送晨间报告到飞书 v3.0
 * ========================
 * 功能：读取最新的夜间任务报告，通过 sessions_send 发送到飞书
 * 用法：node scripts/send-morning-report.js [date]
 * 
 * 版本历史:
 * - v3.0 (2026-03-27): 改用 sessions_send，移除硬编码凭证，添加会话验证
 * - v2.1 (2026-03-22): 添加配置验证、重试机制、详细日志
 * - v2.0 (2026-03-20): 动态读取夜间报告，不再硬编码内容
 * 
 * 核心改进 (v3.0):
 * - ✅ 移除硬编码的飞书 App ID/Secret（安全风险）
 * - ✅ 使用 OpenClaw sessions_send 机制（统一通知通道）
 * - ✅ 添加会话存在性验证（避免 "session not found" 错误）
 * - ✅ 支持备用通知方式（文件输出 + 控制台日志）
 * - ✅ 添加详细的故障诊断信息
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONFIG = {
  WORKSPACE_DIR: process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace'),
  REPORTS_DIR: 'reports',
  FEISHU_GROUP_ID: 'oc_544ef0ac66f15f18550668c007ee8566', // 孪生团队协作中心
  SESSION_TARGET: `agent:main:feishu:group:${process.env.FEISHU_GROUP_ID || 'oc_544ef0ac66f15f18550668c007ee8566'}`,
  MAX_CONTENT_LENGTH: 4000 // 飞书消息长度限制
};

// 检查会话是否存在
function checkSessionExists(sessionKey) {
  try {
    const output = execSync('openclaw sessions list --limit 50', { 
      encoding: 'utf-8',
      timeout: 10000
    });
    return output.includes(sessionKey) || output.includes('feishu:group');
  } catch (err) {
    console.log('⚠️ 无法检查会话状态（openclaw CLI 不可用或超时）');
    return false;
  }
}

// 查找最新的夜间报告
function findLatestNightlyReport(targetDate = null) {
  const reportsDir = path.join(CONFIG.WORKSPACE_DIR, CONFIG.REPORTS_DIR);
  
  if (!fs.existsSync(reportsDir)) {
    throw new Error(`报告目录不存在：${reportsDir}`);
  }
  
  if (targetDate) {
    const filename = `nightly-report-${targetDate}.md`;
    const filepath = path.join(reportsDir, filename);
    if (fs.existsSync(filepath)) return filepath;
    console.log(`⚠️ 未找到指定日期的报告：${filename}`);
    return null;
  }
  
  const files = fs.readdirSync(reportsDir)
    .filter(f => f.startsWith('nightly-report-') && f.endsWith('.md'))
    .sort()
    .reverse();
  
  if (files.length === 0) return null;
  return path.join(reportsDir, files[0]);
}

// 解析夜间报告内容
function parseNightlyReport(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  
  const dateMatch = content.match(/\*\*日期:\*\*\s*(\d{4}-\d{2}-\d{2})/);
  const statusMatch = content.match(/\*\*执行状态:\*\*\s*([✅⚠️❌][^\n]*)/);
  const completedSection = content.match(/## ✅ 完成的任务([\s\S]*?)(?=##|$)/);
  const findingsSection = content.match(/## 💡 发现与建议([\s\S]*?)(?=##|$)/);
  const alertsSection = content.match(/## ⚠️ 需要确认的事项([\s\S]*?)(?=##|$)/);
  
  return {
    date: dateMatch ? dateMatch[1] : 'Unknown',
    status: statusMatch ? statusMatch[1].trim() : 'Unknown',
    completed: completedSection ? completedSection[1].trim() : '',
    findings: findingsSection ? findingsSection[1].trim() : '',
    alerts: alertsSection ? alertsSection[1].trim() : ''
  };
}

// 构建简洁的飞书消息
function buildMessage(report) {
  const lines = [
    `🌅 **晨间报告** | ${report.date}`,
    `状态：${report.status}`,
    ''
  ];
  
  // 完成的任务摘要（最多 5 条）
  if (report.completed) {
    const tasks = report.completed.split('\n')
      .filter(line => line.trim().startsWith('-'))
      .slice(0, 5);
    if (tasks.length > 0) {
      lines.push('**✅ 完成摘要**');
      lines.push(...tasks);
      lines.push('');
    }
  }
  
  // 关键发现（最多 3 条）
  if (report.findings && report.findings.trim() !== '...') {
    const findings = report.findings.split('\n')
      .filter(line => line.trim())
      .slice(0, 3);
    if (findings.length > 0) {
      lines.push('**💡 关键发现**');
      lines.push(...findings);
      lines.push('');
    }
  }
  
  // 需要确认的事项
  if (report.alerts && report.alerts.trim() !== '...') {
    const alerts = report.alerts.split('\n')
      .filter(line => line.trim())
      .slice(0, 3);
    if (alerts.length > 0) {
      lines.push('**⚠️ 待确认**');
      lines.push(...alerts);
      lines.push('');
    }
  }
  
  // 完整报告链接
  const reportUrl = `https://github.com/erwinqyf/Claw-s-memory/blob/main/reports/nightly-report-${report.date}.md`;
  lines.push(`📄 [查看完整报告](${reportUrl})`);
  
  const message = lines.join('\n');
  
  // 检查长度
  if (message.length > CONFIG.MAX_CONTENT_LENGTH) {
    console.log(`⚠️ 消息过长 (${message.length} 字符)，截断到 ${CONFIG.MAX_CONTENT_LENGTH}`);
    return message.substring(0, CONFIG.MAX_CONTENT_LENGTH - 100) + '\n\n... (内容过长，请查看完整报告)';
  }
  
  return message;
}

// 通过 sessions_send 发送消息
function sendViaSessionsSend(message) {
  console.log(`📤 尝试通过 sessions_send 发送到：${CONFIG.SESSION_TARGET}`);
  
  // 转义消息中的特殊字符
  const escapedMessage = message.replace(/'/g, "'\"'\"'");
  
  try {
    const cmd = `openclaw sessions send --session-key "${CONFIG.SESSION_TARGET}" --message '${escapedMessage}'`;
    const output = execSync(cmd, { 
      encoding: 'utf-8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log('✅ sessions_send 执行成功');
    console.log(output);
    return { success: true, method: 'sessions_send' };
  } catch (err) {
    const errorMsg = err.stderr || err.stdout || err.message;
    if (errorMsg.includes('Session not found') || errorMsg.includes('not found')) {
      console.log('❌ sessions_send 失败：目标会话不存在');
      console.log('💡 可能原因：Bot 未加入飞书群聊');
    } else {
      console.log('❌ sessions_send 失败:', errorMsg.substring(0, 200));
    }
    return { success: false, method: 'sessions_send', error: errorMsg };
  }
}

// 备用方案：输出到文件
function saveToLocalFile(message, reportDate) {
  const outputPath = path.join(CONFIG.WORKSPACE_DIR, CONFIG.REPORTS_DIR, `morning-brief-${reportDate}.txt`);
  fs.writeFileSync(outputPath, message, 'utf-8');
  console.log(`📁 备用方案：消息已保存到 ${outputPath}`);
  return outputPath;
}

// 主函数
async function main() {
  const startTime = Date.now();
  const args = process.argv.slice(2);
  const reportDate = args[0] || null;
  
  console.log('🌅 晨间报告发送器 v3.0\n');
  console.log(`⏰ 启动时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
  console.log(`📅 目标日期：${reportDate || '最新报告'}`);
  console.log(`🎯 目标会话：${CONFIG.SESSION_TARGET}\n`);
  
  try {
    // 查找报告文件
    const reportPath = findLatestNightlyReport(reportDate);
    if (!reportPath) {
      throw new Error('未找到夜间任务报告文件\n💡 请确认夜间任务已执行并生成报告');
    }
    console.log(`📄 读取报告：${reportPath}\n`);
    
    // 解析报告内容
    const report = parseNightlyReport(reportPath);
    console.log(`📊 报告日期：${report.date}`);
    console.log(`📊 执行状态：${report.status}\n`);
    
    // 构建消息
    const message = buildMessage(report);
    console.log('📝 消息预览:\n');
    console.log(message.substring(0, 500) + (message.length > 500 ? '\n...' : ''));
    console.log('');
    
    // 检查会话
    console.log('🔍 检查目标会话...');
    const sessionExists = checkSessionExists(CONFIG.SESSION_TARGET);
    if (!sessionExists) {
      console.log('⚠️ 目标会话可能不存在，将尝试发送但可能失败\n');
    } else {
      console.log('✅ 目标会话存在\n');
    }
    
    // 尝试发送
    const result = sendViaSessionsSend(message);
    
    if (!result.success) {
      console.log('\n⚠️ 发送失败，启用备用方案...\n');
      const savedPath = saveToLocalFile(message, report.date);
      console.log(`\n💡 请手动将 ${savedPath} 的内容发送到飞书群聊`);
      console.log('\n🔧 故障排查步骤:');
      console.log('   1. 确认 Bot 已加入飞书群聊「孪生团队协作中心」');
      console.log('   2. 运行：openclaw directory groups list --channel feishu');
      console.log('   3. 获取正确的群聊 ID 并更新脚本配置');
      console.log('   4. 或临时使用手动发送（内容已保存到本地文件）');
    }
    
    const duration = Date.now() - startTime;
    console.log(`\n✅ 任务完成，耗时 ${duration}ms`);
    
  } catch (err) {
    console.error('\n❌ 执行失败:', err.message);
    console.error('\n💡 建议检查:');
    console.error('   1. 报告文件是否存在 (reports/nightly-report-*.md)');
    console.error('   2. 工作目录配置是否正确');
    console.error('   3. openclaw CLI 是否可用');
    console.error('   4. 查看完整错误日志 above\n');
    process.exit(1);
  }
}

main();
