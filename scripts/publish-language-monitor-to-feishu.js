#!/usr/bin/env node
/**
 * 语言服务监控 - 飞书文档发布脚本
 * 将监控报告发布到飞书云文档
 * 
 * 用法：node scripts/publish-language-monitor-to-feishu.js <report.md>
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace');
const DATA_DIR = path.join(WORKSPACE_DIR, 'data');

// 飞书文档配置
const FEISHU_CONFIG = {
  // 文档标题前缀（用于查找或创建）
  docTitlePrefix: '语言服务动态监控周报_',
  // 如果指定了 docId 则更新该文档，否则创建新文档
  targetDocId: process.env.FEISHU_MONITOR_DOC_ID || null,
  // 协作者（可选）
  collaborators: []
};

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

// 生成飞书文档发布命令
function generateFeishuCommands(content, dateStr) {
  const docTitle = `语言服务动态监控周报_${dateStr}`;
  
  console.log('📄 准备发布到飞书文档...');
  console.log(`文档标题：${docTitle}`);
  console.log('');
  
  // 输出 feishu-doc-manager 命令
  const commands = [];
  
  // 1. 创建文档（如果没有指定 docId）
  if (!FEISHU_CONFIG.targetDocId) {
    commands.push({
      action: 'create',
      title: docTitle,
      description: '语言服务行业新闻动态监控报告'
    });
  }
  
  // 2. 写入内容
  commands.push({
    action: 'write',
    docId: FEISHU_CONFIG.targetDocId || '{{new_doc_id}}',
    content: content
  });
  
  // 3. 设置权限（可选）
  if (FEISHU_CONFIG.collaborators.length > 0) {
    commands.push({
      action: 'set_permissions',
      docId: FEISHU_CONFIG.targetDocId || '{{new_doc_id}}',
      collaborators: FEISHU_CONFIG.collaborators
    });
  }
  
  return commands;
}

// 主流程
function main() {
  const reportPath = process.argv[2];
  
  if (!reportPath) {
    console.error('用法：node publish-language-monitor-to-feishu.js <report.md>');
    process.exit(1);
  }
  
  console.log('🔍 语言服务监控 - 飞书文档发布');
  console.log('================================');
  console.log(`报告路径：${reportPath}`);
  console.log('');
  
  try {
    // 读取报告
    const content = readReport(reportPath);
    const dateStr = extractDateFromReport(content);
    
    // 生成发布命令
    const commands = generateFeishuCommands(content, dateStr);
    
    console.log('✅ 准备完成');
    console.log('');
    console.log('下一步：');
    console.log('  使用 feishu-doc-manager 技能发布文档');
    console.log('');
    console.log('示例命令：');
    console.log('  feishu-doc-manager create --title "语言服务动态监控周报_' + dateStr + '"');
    console.log('  feishu-doc-manager write --doc <doc_id> --file "' + reportPath + '"');
    console.log('');
    
    // 保存发布状态
    const statePath = path.join(DATA_DIR, 'language-service-monitor-state.json');
    let state = { lastCheck: null, articles: [], lastPublished: null };
    
    if (fs.existsSync(statePath)) {
      state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    }
    
    state.lastPublished = new Date().toISOString();
    state.lastReportPath = reportPath;
    
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    console.log('✅ 发布状态已更新');
    
  } catch (err) {
    console.error('❌ 错误:', err.message);
    process.exit(1);
  }
}

main();
