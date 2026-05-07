#!/usr/bin/env node
/**
 * ClawHub Top100 追踪脚本
 * 抓取 ClawHub 下载量前100名技能并生成报告
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = path.join(process.env.HOME || '/home/admin', '.openclaw/workspace');
const DATA_DIR = path.join(WORKSPACE_DIR, 'data');
const REPORTS_DIR = path.join(WORKSPACE_DIR, 'reports');

// 确保目录存在
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

const today = new Date().toISOString().split('T')[0];

// 从 agent-browser 获取的数据（通过外部命令注入）
// 实际使用时，应该调用 agent-browser 命令获取数据
async function fetchTop100() {
  // 这里应该调用 agent-browser 命令获取数据
  // 为了演示，数据将由调用者通过环境变量或文件传递
  const dataPath = process.env.CLAWHUB_DATA_PATH || '/tmp/clawhub_top100_raw.json';
  
  if (!fs.existsSync(dataPath)) {
    console.error('数据文件不存在:', dataPath);
    process.exit(1);
  }
  
  const rawData = fs.readFileSync(dataPath, 'utf-8');
  // 移除可能的命令输出前缀
  const jsonMatch = rawData.match(/\[.*\]/s);
  if (!jsonMatch) {
    console.error('无法解析数据');
    process.exit(1);
  }
  
  return JSON.parse(jsonMatch[0]);
}

// 解析下载数和星星数
function parseNumber(str) {
  if (!str) return 0;
  const clean = str.replace(/[^\d.km]/gi, '');
  if (clean.includes('k')) {
    return parseFloat(clean.replace('k', '')) * 1000;
  }
  if (clean.includes('m')) {
    return parseFloat(clean.replace('m', '')) * 1000000;
  }
  return parseInt(clean) || 0;
}

// 生成分类（基于描述关键词）
function categorizeSkill(skill) {
  const desc = (skill.desc || '').toLowerCase();
  const name = (skill.name || '').toLowerCase();
  
  if (desc.includes('search') || desc.includes('搜索') || name.includes('search')) return 'Search';
  if (desc.includes('browser') || desc.includes('web') || desc.includes('scrap')) return 'Web/Browser';
  if (desc.includes('memory') || desc.includes('memory')) return 'Memory';
  if (desc.includes('automation') || desc.includes('workflow') || desc.includes('n8n')) return 'Automation';
  if (desc.includes('security') || desc.includes('vet')) return 'Security';
  if (desc.includes('pdf') || desc.includes('doc') || desc.includes('excel') || desc.includes('ppt')) return 'Document';
  if (desc.includes('image') || desc.includes('video') || desc.includes('photo')) return 'Media';
  if (desc.includes('github') || desc.includes('git')) return 'Dev Tools';
  if (desc.includes('slack') || desc.includes('discord') || desc.includes('email') || desc.includes('gmail')) return 'Communication';
  if (desc.includes('stock') || desc.includes('finance') || desc.includes('market')) return 'Finance';
  if (desc.includes('weather')) return 'Weather';
  if (desc.includes('youtube')) return 'Media';
  if (desc.includes('skill') && desc.includes('create')) return 'Skill Dev';
  if (desc.includes('proactive') || desc.includes('self-improving')) return 'Agent Enhancement';
  return 'Other';
}

// 生成 Markdown 报告
function generateMarkdownReport(skills) {
  const totalDownloads = skills.reduce((sum, s) => sum + parseNumber(s.downloads), 0);
  const totalStars = skills.reduce((sum, s) => sum + parseNumber(s.stars), 0);
  
  // 分类统计
  const categories = {};
  skills.forEach(s => {
    const cat = categorizeSkill(s);
    categories[cat] = (categories[cat] || 0) + 1;
  });
  
  let md = `# ClawHub Top100 技能追踪报告

**生成日期**: ${today}
**数据来源**: [ClawHub](https://clawhub.ai)

## 概览

| 指标 | 数值 |
|------|------|
| 追踪技能数 | ${skills.length} |
| 总下载量 | ${(totalDownloads / 1000).toFixed(1)}k |
| 总星星数 | ${(totalStars / 1000).toFixed(1)}k |

## 分类分布

| 分类 | 数量 |
|------|------|
`;
  
  Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      md += `| ${cat} | ${count} |\n`;
    });
  
  md += `
## Top 100 技能详情

| 排名 | 作者 | 技能名 | 下载数 | 星星数 | 分类 | 描述 |
|------|------|--------|--------|--------|------|------|
`;
  
  skills.forEach((skill, idx) => {
    const rank = idx + 1;
    const author = skill.owner?.replace('@', '') || 'N/A';
    const name = skill.name || 'N/A';
    const downloads = skill.downloads || '0';
    const stars = skill.stars || '0';
    const category = categorizeSkill(skill);
    const desc = (skill.desc || '').substring(0, 60).replace(/\n/g, ' ') + '...';
    
    md += `| ${rank} | @${author} | ${name} | ${downloads} | ${stars} | ${category} | ${desc} |\n`;
  });
  
  md += `
## Top 10 亮点

`;
  
  skills.slice(0, 10).forEach((skill, idx) => {
    md += `${idx + 1}. **${skill.name}** (@${skill.owner?.replace('@', '')}) - ${skill.downloads} 下载, ${skill.stars} 星星\n`;
  });
  
  md += `
---
*报告由 OpenClaw 自动生成*
`;
  
  return md;
}

// 主函数
async function main() {
  try {
    console.log('📊 开始获取 ClawHub Top100 数据...');
    
    const skills = await fetchTop100();
    console.log(`✅ 成功获取 ${skills.length} 个技能数据`);
    
    // 保存 JSON 数据
    const jsonPath = path.join(DATA_DIR, `clawhub-top100-${today}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(skills, null, 2));
    console.log(`💾 JSON 数据已保存: ${jsonPath}`);
    
    // 更新最新快照
    const latestPath = path.join(DATA_DIR, 'clawhub-top100-latest.json');
    fs.writeFileSync(latestPath, JSON.stringify(skills, null, 2));
    console.log(`💾 最新快照已更新: ${latestPath}`);
    
    // 生成 Markdown 报告
    const reportPath = path.join(REPORTS_DIR, `clawhub-top100-${today}.md`);
    const report = generateMarkdownReport(skills);
    fs.writeFileSync(reportPath, report);
    console.log(`📝 Markdown 报告已生成: ${reportPath}`);
    
    // 输出摘要
    console.log('\n📈 数据摘要:');
    console.log(`- 技能总数: ${skills.length}`);
    console.log(`- 第一名: ${skills[0]?.name} (${skills[0]?.downloads} 下载)`);
    console.log(`- 第十名: ${skills[9]?.name} (${skills[9]?.downloads} 下载)`);
    
    console.log('\n✅ ClawHub Top100 追踪完成!');
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

main();
