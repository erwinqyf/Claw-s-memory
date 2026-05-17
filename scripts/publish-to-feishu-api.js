#!/usr/bin/env node
/**
 * 飞书文档发布脚本 - 使用OpenClaw内置功能
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace');

// 读取报告内容
const reportPath = process.argv[2] || path.join(WORKSPACE_DIR, 'reports', 'language-service-monitor-20260421.md');

if (!fs.existsSync(reportPath)) {
  console.error('报告文件不存在:', reportPath);
  process.exit(1);
}

const content = fs.readFileSync(reportPath, 'utf-8');
const title = content.match(/# (.+)/)?.[1] || '语言服务动态监控周报';

console.log('📄 飞书文档发布准备');
console.log('====================');
console.log('文档标题:', title);
console.log('内容长度:', content.length, '字符');
console.log('');
console.log('请使用以下方式发布到飞书:');
console.log('');
console.log('方式1: 使用 feishu_doc 工具');
console.log('  1. 创建文档: feishu_doc action=create title="' + title + '"');
console.log('  2. 写入内容: feishu_doc action=write doc_token=<token> content="..."');
console.log('');
console.log('方式2: 手动复制内容');
console.log('  报告路径:', reportPath);
console.log('');

// 输出内容摘要
console.log('内容摘要:');
console.log('-------------------');
console.log(content.slice(0, 500) + '...');
