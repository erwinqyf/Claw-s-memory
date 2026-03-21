#!/usr/bin/env node
/**
 * 发送晨间报告到飞书 v2.1
 * ========================
 * 功能：读取最新的夜间任务报告，自动发送到飞书
 * 用法：node scripts/send-morning-report.js [date]
 * 
 * 优化记录:
 * - v2.1 (2026-03-22): 添加配置验证、重试机制、详细日志
 * - v2.0 (2026-03-20): 动态读取夜间报告，不再硬编码内容
 * 
 * 改进点:
 * - 启动时验证所有必需配置
 * - HTTP 请求添加指数退避重试
 * - 添加超时保护（15 秒）
 * - 更详细的错误信息和恢复建议
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONFIG = {
  APP_ID: 'cli_a922b10c2362dbd3',
  APP_SECRET: 'NAcktALvcq9jPbZmWsUcyhQOhMlwlPdQ',
  OPEN_ID: 'ou_adcbc44a6fb7460391e585338f9e1e35',
  ID_TYPE: 'open_id',
  API_BASE: 'open.feishu.cn',
  TOKEN_PATH: '/open-apis/auth/v3/tenant_access_token/internal',
  MESSAGE_PATH: '/open-apis/im/v1/messages',
  WORKSPACE_DIR: process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace'),
  REPORTS_DIR: 'reports',
  // 重试配置
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  REQUEST_TIMEOUT_MS: 15000
};

// 配置验证
function validateConfig() {
  const required = ['APP_ID', 'APP_SECRET', 'OPEN_ID'];
  const missing = required.filter(key => !CONFIG[key] || CONFIG[key].length < 5);
  if (missing.length > 0) {
    throw new Error(`配置缺失：${missing.join(', ')}。请检查脚本配置部分。`);
  }
}

// HTTP 请求封装（带重试机制）
async function requestWithRetry(path, method, body, token, retryCount = 0) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: CONFIG.API_BASE,
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          // 飞书 API 错误处理
          if (result.code !== 0 && result.code !== undefined) {
            reject(new Error(`飞书 API 错误 (${result.code}): ${result.msg}`));
          } else {
            resolve(result);
          }
        } catch (e) {
          reject(new Error(`JSON 解析错误：${e.message} | 响应：${data.substring(0, 200)}`));
        }
      });
    });
    
    req.on('error', (err) => {
      // 网络错误，尝试重试
      if (retryCount < CONFIG.MAX_RETRIES) {
        const delay = CONFIG.RETRY_DELAY_MS * Math.pow(2, retryCount);
        console.log(`⏳ 请求失败，${delay/1000}秒后重试 (${retryCount + 1}/${CONFIG.MAX_RETRIES}) - ${err.message}`);
        setTimeout(() => {
          requestWithRetry(path, method, body, token, retryCount + 1)
            .then(resolve)
            .catch(reject);
        }, delay);
      } else {
        reject(new Error(`请求失败（已重试${CONFIG.MAX_RETRIES}次）: ${err.message}`));
      }
    });
    
    req.setTimeout(CONFIG.REQUEST_TIMEOUT_MS, () => {
      req.destroy();
      if (retryCount < CONFIG.MAX_RETRIES) {
        const delay = CONFIG.RETRY_DELAY_MS * Math.pow(2, retryCount);
        console.log(`⏳ 请求超时，${delay/1000}秒后重试 (${retryCount + 1}/${CONFIG.MAX_RETRIES})`);
        setTimeout(() => {
          requestWithRetry(path, method, body, token, retryCount + 1)
            .then(resolve)
            .catch(reject);
        }, delay);
      } else {
        reject(new Error(`请求超时（已重试${CONFIG.MAX_RETRIES}次）`));
      }
    });
    
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// 向后兼容的 request 函数
function request(path, method, body, token) {
  return requestWithRetry(path, method, body, token, 0);
}

// 获取飞书 Token
async function getToken() {
  const result = await request(CONFIG.TOKEN_PATH, 'POST', {
    app_id: CONFIG.APP_ID,
    app_secret: CONFIG.APP_SECRET
  });
  if (result.code !== 0) throw new Error(`Token error: ${result.msg}`);
  return result.tenant_access_token;
}

// 查找最新的夜间报告
function findLatestNightlyReport(targetDate = null) {
  const reportsDir = path.join(CONFIG.WORKSPACE_DIR, CONFIG.REPORTS_DIR);
  
  if (targetDate) {
    // 指定日期：查找对应日期的报告
    const filename = `nightly-report-${targetDate}.md`;
    const filepath = path.join(reportsDir, filename);
    if (fs.existsSync(filepath)) return filepath;
    console.log(`⚠️ 未找到指定日期的报告：${filename}`);
  }
  
  // 未指定日期：查找最新的报告
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
  
  // 提取关键信息
  const dateMatch = content.match(/\*\*日期:\*\*\s*(\d{4}-\d{2}-\d{2})/);
  const statusMatch = content.match(/\*\*执行状态:\*\*\s*([✅⚠️❌][^\n]*)/);
  
  // 提取完成的任务
  const completedSection = content.match(/## ✅ 完成的任务([\s\S]*?)(?=##|$)/);
  const gitLogSection = content.match(/## 📊 Git 提交记录([\s\S]*?)(?=##|$)/);
  const findingsSection = content.match(/## 💡 发现与建议([\s\S]*?)(?=##|$)/);
  const alertsSection = content.match(/## ⚠️ 需要确认的事项([\s\S]*?)(?=##|$)/);
  
  return {
    date: dateMatch ? dateMatch[1] : 'Unknown',
    status: statusMatch ? statusMatch[1].trim() : 'Unknown',
    completed: completedSection ? completedSection[1].trim() : '',
    gitLog: gitLogSection ? gitLogSection[1].trim() : '',
    findings: findingsSection ? findingsSection[1].trim() : '',
    alerts: alertsSection ? alertsSection[1].trim() : ''
  };
}

// 构建飞书卡片消息
function buildCard(report) {
  const elements = [
    {
      tag: 'div',
      text: {
        content: `# 🌙 夜间自主任务报告\n**日期:** ${report.date}\n**执行状态:** ${report.status}\n**报告时间:** ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}`,
        tag: 'lark_md'
      }
    },
    { tag: 'hr' }
  ];
  
  // 添加完成的任务摘要
  if (report.completed) {
    const summary = report.completed.split('\n').slice(0, 8).join('\n');
    elements.push({
      tag: 'div',
      text: {
        content: `**✅ 完成的任务**\n\n${summary}`,
        tag: 'lark_md'
      }
    });
  }
  
  // 添加 Git 提交统计
  if (report.gitLog) {
    const commitCount = (report.gitLog.match(/\n/g) || []).length;
    elements.push({
      tag: 'div',
      text: {
        content: `**📊 Git 提交:** ${commitCount} 次提交\n\n\`\`\`\n${report.gitLog.split('\n').slice(0, 5).join('\n')}\n\`\`\``,
        tag: 'lark_md'
      }
    });
  }
  
  // 添加发现与建议
  if (report.findings && report.findings.trim() !== '...') {
    elements.push({
      tag: 'div',
      text: {
        content: `**💡 发现与建议**\n\n${report.findings.split('\n').slice(0, 5).join('\n')}`,
        tag: 'lark_md'
      }
    });
  }
  
  // 添加需要确认的事项
  if (report.alerts && report.alerts.trim() !== '...') {
    elements.push({
      tag: 'div',
      text: {
        content: `**⚠️ 需要确认**\n\n${report.alerts.split('\n').slice(0, 3).join('\n')}`,
        tag: 'lark_md'
      }
    });
  }
  
  elements.push({ tag: 'hr' });
  
  // 添加查看完整报告的按钮
  elements.push({
    tag: 'action',
    actions: [
      {
        tag: 'button',
        text: { content: '📄 查看完整报告', tag: 'plain_text' },
        url: `https://github.com/erwinqyf/Claw-s-memory/blob/main/reports/nightly-report-${report.date}.md`,
        type: 'default'
      }
    ]
  });
  
  return {
    config: { wide_screen_mode: true },
    elements: elements
  };
}

// 发送消息到飞书
async function sendReport(reportDate = null) {
  console.log('📤 发送晨间报告到飞书...\n');
  
  // 查找报告文件
  const reportPath = findLatestNightlyReport(reportDate);
  if (!reportPath) {
    throw new Error('未找到夜间任务报告文件');
  }
  console.log(`📄 读取报告：${reportPath}\n`);
  
  // 解析报告内容
  const report = parseNightlyReport(reportPath);
  console.log(`📊 报告日期：${report.date}`);
  console.log(`📊 执行状态：${report.status}\n`);
  
  // 获取 Token
  const token = await getToken();
  console.log('✅ Token 获取成功\n');
  
  // 构建并发送卡片
  const card = buildCard(report);
  
  const result = await request(
    `${CONFIG.MESSAGE_PATH}?receive_id_type=${CONFIG.ID_TYPE}`,
    'POST',
    {
      receive_id: CONFIG.OPEN_ID,
      msg_type: 'interactive',
      content: JSON.stringify(card)
    },
    token
  );
  
  if (result.code !== 0) throw new Error(`Send error: ${result.msg}`);
  
  console.log('✅ 消息发送成功！');
  console.log(`Message ID: ${result.data.message_id}`);
  return result;
}

// 主函数
async function main() {
  const startTime = Date.now();
  const args = process.argv.slice(2);
  const reportDate = args[0] || null;
  
  console.log('🌅 晨间报告发送器 v2.1\n');
  console.log(`⏰ 启动时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
  console.log(`📅 目标日期：${reportDate || '最新报告'}\n`);
  
  try {
    // 配置验证
    console.log('🔍 验证配置...');
    validateConfig();
    console.log('✅ 配置验证通过\n');
    
    // 发送报告
    await sendReport(reportDate);
    
    const duration = Date.now() - startTime;
    console.log(`\n✅ 任务完成，耗时 ${duration}ms`);
  } catch (err) {
    console.error('\n❌ 发送失败:', err.message);
    console.error('\n💡 建议检查:');
    console.error('   1. 飞书 App ID/Secret 是否正确');
    console.error('   2. 网络连接是否正常');
    console.error('   3. 报告文件是否存在 (reports/nightly-report-*.md)');
    console.error('   4. 查看完整错误日志 above\n');
    process.exit(1);
  }
}

main();
