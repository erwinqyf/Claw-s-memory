#!/usr/bin/env node
/**
 * ClawHub Top 100 Skills Tracker
 * 每日获取 ClawHub 下载量前 100 名技能
 * 记录：名字、下载数、星星数、功能描述、分类
 * 
 * 用法：node scripts/clawhub-tracker.js
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace');
const DATA_DIR = path.join(WORKSPACE_DIR, 'data');
const REPORTS_DIR = path.join(WORKSPACE_DIR, 'reports');

// 确保目录存在
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

console.log('🔍 ClawHub Top 100 技能追踪器');
console.log('================================');
console.log(`工作目录：${WORKSPACE_DIR}`);
console.log(`数据目录：${DATA_DIR}`);
console.log(`报告目录：${REPORTS_DIR}`);
console.log('');

const https = require('https');

// 简单的 HTTP GET 请求
function httpRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'OpenClaw-ClawHub-Tracker/1.0',
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else if (res.statusCode === 429) {
          const retryAfter = res.headers['retry-after'] || 60;
          reject(new Error(`限流：请等待 ${retryAfter} 秒后重试`));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

// 自动分类技能
function autoCategorizeSkill(skill) {
  const slug = skill.slug.toLowerCase();
  const summary = (skill.summary || '').toLowerCase();
  const tags = Object.keys(skill.tags || {}).join(' ').toLowerCase();
  
  // 浏览器自动化
  if (slug.includes('browser') || slug.includes('playwright') || slug.includes('puppeteer') ||
      summary.includes('浏览器') || summary.includes('browser') || summary.includes('网页')) {
    return '浏览器自动化';
  }
  
  // 搜索与研究
  if (slug.includes('search') || slug.includes('research') || slug.includes('tavily') ||
      summary.includes('搜索') || summary.includes('research') || summary.includes('search')) {
    return '搜索与研究';
  }
  
  // 文档处理
  if (slug.includes('doc') || slug.includes('feishu') || slug.includes('notion') ||
      summary.includes('文档') || summary.includes('doc') || summary.includes('飞书')) {
    return '文档处理';
  }
  
  // 数据处理
  if (slug.includes('excel') || slug.includes('csv') || slug.includes('json') || slug.includes('data') ||
      summary.includes('excel') || summary.includes('表格') || summary.includes('数据')) {
    return '数据处理';
  }
  
  // 系统工具
  if (slug.includes('health') || slug.includes('system') || slug.includes('monitor') || slug.includes('cron') ||
      summary.includes('系统') || summary.includes('健康') || summary.includes('监控')) {
    return '系统工具';
  }
  
  // 创意与演示
  if (slug.includes('ppt') || slug.includes('slide') || slug.includes('presentation') ||
      summary.includes('演示') || summary.includes('ppt') || summary.includes('slide')) {
    return '创意与演示';
  }
  
  // AI 与 Agent
  if (slug.includes('agent') || slug.includes('ai') || slug.includes('llm') ||
      summary.includes('agent') || summary.includes('ai') || summary.includes('智能体')) {
    return 'AI 与 Agent';
  }
  
  // 版本控制
  if (slug.includes('git') || slug.includes('github') || slug.includes('commit') ||
      summary.includes('git') || summary.includes('github')) {
    return '版本控制';
  }
  
  // 测试
  if (slug.includes('test') || slug.includes('spec') || slug.includes('jest') ||
      summary.includes('测试') || summary.includes('test')) {
    return '测试工具';
  }
  
  // 安全
  if (slug.includes('security') || slug.includes('audit') || slug.includes('vetter') ||
      summary.includes('安全') || summary.includes('security') || summary.includes('审计')) {
    return '安全工具';
  }
  
  return '其他';
}

// 获取 Top 技能
async function fetchTopSkills(limit = 100) {
  console.log(`📥 获取 ClawHub 前 ${limit} 个技能...`);
  
  const url = `https://clawhub.ai/api/v1/skills?limit=${limit}&sort=downloads`;
  const data = await httpRequest(url);
  
  if (!data.items || !Array.isArray(data.items)) {
    throw new Error('API 返回格式异常');
  }
  
  const skills = data.items.map((skill, index) => ({
    rank: index + 1,
    name: skill.slug,
    displayName: skill.displayName || skill.slug,
    downloads: skill.stats?.downloads || 0,
    stars: skill.stats?.stars || 0,
    installsAllTime: skill.stats?.installsAllTime || 0,
    installsCurrent: skill.stats?.installsCurrent || 0,
    description: skill.summary || '',
    category: autoCategorizeSkill(skill),
    author: 'unknown',  // API 未提供作者信息
    version: skill.tags?.latest || skill.latestVersion?.version || 'unknown',
    updatedAt: skill.updatedAt ? new Date(skill.updatedAt).toISOString().split('T')[0] : 'unknown',
    createdAt: skill.createdAt ? new Date(skill.createdAt).toISOString().split('T')[0] : 'unknown'
  }));
  
  console.log(`✅ 成功获取 ${skills.length} 个技能`);
  return skills;
}

// 分类技能
function categorizeSkills(skills) {
  const categories = {};
  
  for (const skill of skills) {
    const cat = skill.category || '未分类';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(skill);
  }
  
  return categories;
}

// 生成 Markdown 表格报告
function generateMarkdownReport(skills, categories) {
  const timestamp = new Date().toISOString().split('T')[0];
  const reportPath = path.join(REPORTS_DIR, `clawhub-top100-${timestamp}.md`);
  
  let report = `# ClawHub Top 100 技能排行榜\n\n`;
  report += `**更新日期:** ${timestamp}\n\n`;
  report += `**总计:** ${skills.length} 个技能 | **分类:** ${Object.keys(categories).length} 个\n\n`;
  report += `---\n\n`;
  
  // 总览表格
  report += `## 📊 Top 20 总览\n\n`;
  report += `| 排名 | 技能名称 | 下载数 ⬇️ | 星星 ⭐ | 分类 | 描述 |\n`;
  report += `|------|----------|-----------|--------|------|------|\n`;
  
  skills.slice(0, 20).forEach((skill, idx) => {
    report += `| ${idx + 1} | ${skill.name} | ${skill.downloads.toLocaleString()} | ${skill.stars} | ${skill.category} | ${skill.description.substring(0, 30)}... |\n`;
  });
  
  report += `\n---\n\n`;
  
  // 按分类详细列表
  report += `## 📁 分类详情\n\n`;
  
  for (const [category, catSkills] of Object.entries(categories).sort((a, b) => b[1].length - a[1].length)) {
    report += `### ${category} (${catSkills.length} 个)\n\n`;
    report += `| 技能名称 | 下载数 ⬇️ | 星星 ⭐ | 作者 |\n`;
    report += `|----------|-----------|--------|------|\n`;
    
    catSkills.sort((a, b) => b.downloads - a.downloads).forEach(skill => {
      report += `| ${skill.name} | ${skill.downloads.toLocaleString()} | ${skill.stars} | ${skill.author} |\n`;
    });
    
    report += `\n`;
  }
  
  fs.writeFileSync(reportPath, report);
  console.log(`✅ 报告已保存：${reportPath}`);
  
  return reportPath;
}

// 生成 JSON 数据文件
function saveJsonData(skills) {
  const timestamp = new Date().toISOString().split('T')[0];
  const jsonPath = path.join(DATA_DIR, `clawhub-top100-${timestamp}.json`);
  
  fs.writeFileSync(jsonPath, JSON.stringify(skills, null, 2));
  console.log(`✅ 数据已保存：${jsonPath}`);
  
  // 更新最新数据快照
  const latestPath = path.join(DATA_DIR, 'clawhub-top100-latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(skills, null, 2));
  console.log(`✅ 最新快照已更新：${latestPath}`);
  
  return jsonPath;
}

// 主流程
async function main() {
  try {
    console.log('🚀 开始获取 ClawHub 数据...\n');
    
    const skills = await fetchTopSkills(100);
    console.log(`✅ 获取 ${skills.length} 个技能\n`);
    
    console.log('📂 分类技能...');
    const categories = categorizeSkills(skills);
    console.log(`✅ 分为 ${Object.keys(categories).length} 个分类\n`);
    
    console.log('💾 保存数据...');
    saveJsonData(skills);
    
    console.log('📝 生成报告...');
    generateMarkdownReport(skills, categories);
    
    console.log('');
    console.log('================================');
    console.log('✅ ClawHub 追踪完成');
    console.log('');
    console.log('下一步：');
    console.log('  1. 审查生成的报告');
    console.log('  2. 运行 git commit 提交变更');
    console.log('  3. 推送到远程仓库');
    console.log('');
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

main();
