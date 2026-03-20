#!/usr/bin/env node
/**
 * ClawHub Top 100 Skills Tracker v2.1
 * ====================================
 * 每日获取 ClawHub 下载量前 100 名技能
 * 
 * @author Claw (Digital Twin)
 * @version 2.1.0
 * @lastUpdated 2026-03-21
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ==================== 配置常量 ====================

const CONFIG = {
  WORKSPACE_DIR: process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace'),
  DATA_DIR: path.join(process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace'), 'data'),
  REPORTS_DIR: path.join(process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace'), 'reports'),
  API_BASE: 'https://clawhub.ai',
  USER_AGENT: 'OpenClaw-ClawHub-Tracker/2.1',
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 2000,
  DEFAULT_LIMIT: 100,
  // 搜索关键词列表，用于获取更广泛的技能覆盖
  SEARCH_QUERIES: ['a', 'agent', 'tool', 'skill', 'ai', 'auto', 'data', 'web', 'file', 'system']
};

// ==================== 工具函数 ====================

function log(message, emoji = 'ℹ️') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`${emoji} [${timestamp}] ${message}`);
}

function ensureDirectories() {
  [CONFIG.DATA_DIR, CONFIG.REPORTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log(`创建目录：${dir}`, '📁');
    }
  });
}

async function httpRequest(url, retryCount = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': CONFIG.USER_AGENT,
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message}`));
          }
        } else if (res.statusCode === 429 && retryCount < CONFIG.MAX_RETRIES) {
          const delay = CONFIG.RETRY_DELAY_MS * Math.pow(2, retryCount);
          log(`API 限流，${delay/1000}秒后重试 (${retryCount + 1}/${CONFIG.MAX_RETRIES})`, '⏳');
          setTimeout(() => httpRequest(url, retryCount + 1).then(resolve).catch(reject), delay);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 100)}`));
        }
      });
    }).on('error', (err) => {
      if (retryCount < CONFIG.MAX_RETRIES) {
        const delay = CONFIG.RETRY_DELAY_MS * Math.pow(2, retryCount);
        log(`请求失败，${delay/1000}秒后重试 (${retryCount + 1}/${CONFIG.MAX_RETRIES})`, '⏳');
        setTimeout(() => httpRequest(url, retryCount + 1).then(resolve).catch(reject), delay);
      } else {
        reject(err);
      }
    });
  });
}

// ==================== 业务逻辑函数 ====================

/**
 * 自动分类技能（12 个类别）
 */
function autoCategorizeSkill(skill) {
  const slug = skill.slug.toLowerCase();
  const summary = (skill.summary || '').toLowerCase();
  const text = `${slug} ${summary}`;
  
  const rules = [
    { name: '浏览器自动化', keywords: ['browser', 'playwright', 'puppeteer', '浏览器', '网页'] },
    { name: '搜索与研究', keywords: ['search', 'research', 'tavily', '搜索'] },
    { name: '文档处理', keywords: ['doc', 'feishu', 'notion', '文档', '飞书'] },
    { name: '数据处理', keywords: ['excel', 'csv', 'json', 'data', '表格', '数据'] },
    { name: '系统工具', keywords: ['health', 'system', 'monitor', 'cron', '系统', '健康', '监控'] },
    { name: '创意与演示', keywords: ['ppt', 'slide', 'presentation', '演示'] },
    { name: 'AI 与 Agent', keywords: ['agent', 'ai', 'llm', '智能体'] },
    { name: '版本控制', keywords: ['git', 'github', 'commit'] },
    { name: '测试工具', keywords: ['test', 'spec', 'jest', '测试'] },
    { name: '安全工具', keywords: ['security', 'audit', 'vetter', '安全', '审计'] },
    { name: '通信与通知', keywords: ['email', 'sms', 'notify', 'message', '邮件', '通知'] },
    { name: '其他', keywords: [] }
  ];
  
  for (const rule of rules) {
    if (rule.keywords.some(k => text.includes(k))) {
      return rule.name;
    }
  }
  
  return '其他';
}

/**
 * 搜索技能（使用多个查询词获取更广泛的结果）
 */
async function searchSkills(query, limit = 50) {
  const url = `${CONFIG.API_BASE}/api/v1/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const data = await httpRequest(url);
  return data.results || [];
}

/**
 * 获取技能详细信息
 */
async function fetchSkillDetails(slug) {
  const url = `${CONFIG.API_BASE}/api/v1/skills/${encodeURIComponent(slug)}`;
  const data = await httpRequest(url);
  return data.skill;
}

/**
 * 获取 Top 技能（通过搜索聚合）
 */
async function fetchTopSkills(limit = 100) {
  console.log(`📥 获取 ClawHub 技能（通过多关键词搜索）...`);
  
  const allSkillsMap = new Map();
  
  // 使用多个搜索词获取更广泛的技能覆盖
  for (const query of CONFIG.SEARCH_QUERIES) {
    try {
      log(`搜索关键词："${query}"`, '🔍');
      const results = await searchSkills(query, 50);
      for (const result of results) {
        if (!allSkillsMap.has(result.slug)) {
          allSkillsMap.set(result.slug, result);
        }
      }
    } catch (err) {
      log(`搜索 "${query}" 失败：${err.message}`, '⚠️');
    }
  }
  
  console.log(`✅ 找到 ${allSkillsMap.size} 个唯一技能`);
  
  // 获取每个技能的详细信息（包含下载统计）
  console.log(`📊 获取技能详细信息...`);
  const skillsWithDetails = [];
  const slugs = Array.from(allSkillsMap.keys());
  
  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    try {
      const details = await fetchSkillDetails(slug);
      if (details && details.stats) {
        skillsWithDetails.push({
          rank: 0,  // 将根据下载量排序后设置
          name: details.slug,
          displayName: details.displayName || details.slug,
          downloads: details.stats.downloads || 0,
          stars: details.stats.stars || 0,
          installsAllTime: details.stats.installsAllTime || 0,
          installsCurrent: details.stats.installsCurrent || 0,
          description: details.summary || '',
          category: autoCategorizeSkill(details),
          author: details.owner?.handle || details.owner?.displayName || 'unknown',
          version: details.tags?.latest || details.latestVersion?.version || 'unknown',
          updatedAt: details.updatedAt ? new Date(details.updatedAt).toISOString().split('T')[0] : 'unknown',
          createdAt: details.createdAt ? new Date(details.createdAt).toISOString().split('T')[0] : 'unknown'
        });
      }
      // 避免过快请求
      if ((i + 1) % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (err) {
      log(`获取 ${slug} 详情失败：${err.message}`, '⚠️');
    }
  }
  
  // 按下载量排序
  skillsWithDetails.sort((a, b) => b.downloads - a.downloads);
  
  // 设置排名并限制数量
  const topSkills = skillsWithDetails.slice(0, limit).map((skill, index) => ({
    ...skill,
    rank: index + 1
  }));
  
  console.log(`✅ 成功获取 ${topSkills.length} 个技能（按下载量排序）`);
  return topSkills;
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
  const reportPath = path.join(CONFIG.REPORTS_DIR, `clawhub-top100-${timestamp}.md`);
  
  let report = `# ClawHub Top 100 技能排行榜\n\n`;
  report += `**更新日期:** ${timestamp}\n\n`;
  report += `**总计:** ${skills.length} 个技能 | **分类:** ${Object.keys(categories).length} 个\n\n`;
  report += `---\n\n`;
  
  // 总览表格
  report += `## 📊 Top 20 总览\n\n`;
  report += `| 排名 | 技能名称 | 下载数 ⬇️ | 星星 ⭐ | 分类 | 描述 |\n`;
  report += `|------|----------|-----------|--------|------|------|\n`;
  
  skills.slice(0, 20).forEach((skill, idx) => {
    const desc = skill.description.substring(0, 30).replace(/\|/g, ' ') + '...';
    report += `| ${idx + 1} | ${skill.name} | ${skill.downloads.toLocaleString()} | ${skill.stars} | ${skill.category} | ${desc} |\n`;
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
  const jsonPath = path.join(CONFIG.DATA_DIR, `clawhub-top100-${timestamp}.json`);
  
  fs.writeFileSync(jsonPath, JSON.stringify(skills, null, 2));
  console.log(`✅ 数据已保存：${jsonPath}`);
  
  // 更新最新数据快照
  const latestPath = path.join(CONFIG.DATA_DIR, 'clawhub-top100-latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(skills, null, 2));
  console.log(`✅ 最新快照已更新：${latestPath}`);
  
  return jsonPath;
}

// 主流程
async function main() {
  try {
    console.log('🚀 开始获取 ClawHub 数据...\n');
    
    ensureDirectories();
    
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
    
    // 输出 Top 10 用于通知
    console.log('🏆 Top 10 技能:');
    skills.slice(0, 10).forEach((skill, idx) => {
      console.log(`  ${idx + 1}. ${skill.name} - ${skill.downloads.toLocaleString()} 次下载`);
    });
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
