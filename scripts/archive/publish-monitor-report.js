#!/usr/bin/env node
/**
 * 语言服务监控 - 飞书文档发布脚本
 * 将监控报告发布到飞书云文档
 * 
 * 用法：node scripts/publish-monitor-report.js <report.md>
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace');

// 读取报告文件
function readReport(reportPath) {
  if (!fs.existsSync(reportPath)) {
    throw new Error(`报告文件不存在：${reportPath}`);
  }
  return fs.readFileSync(reportPath, 'utf-8');
}

// 提取报告中的日期
function extractDateFromReport(content) {
  const match = content.match(/# 语言服务动态监控周报_(\d{8})/);
  return match ? match[1] : new Date().toISOString().split('T')[0].replace(/-/g, '');
}

// 主流程
function main() {
  const reportPath = process.argv[2] || path.join(WORKSPACE_DIR, 'reports/language-service-monitor-20260313.md');
  
  console.log('📄 语言服务监控 - 飞书文档发布');
  console.log('================================');
  console.log(`报告路径：${reportPath}`);
  console.log('');
  
  try {
    // 读取报告
    const content = readReport(reportPath);
    const dateStr = extractDateFromReport(content);
    const docTitle = `语言服务动态监控周报_${dateStr}`;
    
    console.log(`📝 文档标题：${docTitle}`);
    console.log('');
    console.log('✅ 准备完成');
    console.log('');
    console.log('下一步：');
    console.log('  使用 feishu-doc-manager 技能发布文档');
    console.log('');
    console.log('示例命令：');
    console.log(`  feishu-doc-manager create --title "${docTitle}"`);
    console.log(`  feishu-doc-manager write --doc <doc_id> --file "${reportPath}"`);
    console.log('');
    
  } catch (err) {
    console.error('❌ 错误:', err.message);
    process.exit(1);
  }
}

main();
