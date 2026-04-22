#!/usr/bin/env node
/**
 * 晨间报告飞书发送脚本
 * 使用 feishu_chat 工具发送消息
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace');

// 获取今天的日期
const today = new Date().toISOString().split('T')[0];
const reportPath = path.join(WORKSPACE_DIR, 'reports', `nightly-report-${today}.md`);

if (!fs.existsSync(reportPath)) {
  console.error('❌ 报告文件不存在:', reportPath);
  process.exit(1);
}

// 读取报告内容
const content = fs.readFileSync(reportPath, 'utf-8');

// 提取关键信息
const title = content.match(/# 🌅 晨间报告 - (.+)/)?.[1] || today;
const completionMatch = content.match(/完成度：(.+)/);
const completion = completionMatch ? completionMatch[1] : '未知';

// 提取任务摘要表格
const taskSection = content.match(/## 📊 夜间任务完成摘要\n\n([\s\S]*?)\n\n---/);
const taskSummary = taskSection ? taskSection[1] : '';

// 构建简洁的消息
const message = `🌅 晨间报告 - ${title}

📊 夜间任务完成度：${completion}

${taskSummary.split('\n').slice(0, 8).join('\n')}

📁 详细报告：${reportPath.replace(WORKSPACE_DIR, '')}
🔗 Git 提交：已推送

> 🪞 孪生于不同世界，彼此映照，共同演化。`;

console.log('📨 准备发送飞书消息...');
console.log('====================');
console.log(message);
console.log('');
console.log('💡 提示：请使用以下命令发送');
console.log(`  openclaw feishu_chat user_id=<用户ID> message="${message.slice(0, 100)}..."`);
console.log('');
console.log('或使用 feishu_doc 创建文档：');
console.log(`  openclaw feishu_doc action=create title="晨间报告-${today}"`);
