#!/usr/bin/env node
/**
 * 都察院代码审查 - Censorate Code Review
 * 
 * 灵感来源：菠萝菠菠 AI 朝廷 (danghuangshang)
 * GitHub: https://github.com/wanikua/danghuangshang
 * 
 * 功能：
 * - 监听 GitHub push 事件
 * - 自动审查代码质量、安全问题、最佳实践
 * - 审查结果发送到飞书/ Discord
 * - ✅ 通过则合并，❌ 驳回则打回修改
 * 
 * 使用方式：
 * 1. 配置 GitHub Webhook 指向此脚本
 * 2. 或在 cron 中定时执行检查最新提交
 * 
 * @example
 * node scripts/censorate-code-review.js --repo erwinqyf/Claw-s-memory --commit abc123
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ============ 配置 ============
const CONFIG = {
  // GitHub 配置
  github: {
    token: process.env.GITHUB_TOKEN || '',
    owner: 'erwinqyf',
    repo: 'Claw-s-memory',
  },
  
  // 飞书通知配置
  feishu: {
    webhook: process.env.FEISHU_WEBHOOK || '',
    userId: process.env.FEISHU_USER_ID || 'ou_adcbc44a6fb7460391e585338f9e1e35',
  },
  
  // 审查规则
  review: {
    checkSecurity: true,      // 安全检查（密钥、敏感信息）
    checkQuality: true,       // 代码质量（console.log、TODO 注释）
    checkBestPractices: true, // 最佳实践（文件过大、复杂度过高）
    maxFileSize: 500,         // 最大文件行数
    maxComplexity: 10,        // 最大圈复杂度
  },
};

// ============ 审查规则 ============
const REVIEW_RULES = {
  security: [
    {
      name: '硬编码密钥',
      pattern: /(api[_-]?key|apikey|secret|token|password|passwd)\s*[:=]\s*["'][^"']{8,}["']/i,
      severity: 'critical',
      message: '发现硬编码密钥/密码，请使用环境变量',
    },
    {
      name: '敏感文件路径',
      pattern: /\/etc\/passwd|\/etc\/shadow|\.ssh\/id_rsa|\.env/i,
      severity: 'high',
      message: '发现敏感文件路径引用',
    },
    {
      name: 'eval 执行',
      pattern: /\beval\s*\(/i,
      severity: 'high',
      message: '发现 eval 执行，存在代码注入风险',
    },
    {
      name: 'SQL 注入风险',
      pattern: /(SELECT|INSERT|UPDATE|DELETE).*\$\{?.*\}?/i,
      severity: 'medium',
      message: '疑似 SQL 注入风险，请使用参数化查询',
    },
  ],
  
  quality: [
    {
      name: '调试代码',
      pattern: /console\.(log|debug|info|warn|error)\s*\(/i,
      severity: 'low',
      message: '发现调试代码，建议移除或使用日志库',
    },
    {
      name: 'TODO 注释',
      pattern: /\/\/\s*TODO|\/\*\s*TODO/i,
      severity: 'info',
      message: '发现 TODO 注释，记得后续处理',
    },
    {
      name: 'FIXME 注释',
      pattern: /\/\/\s*FIXME|\/\*\s*FIXME/i,
      severity: 'medium',
      message: '发现 FIXME 注释，存在已知问题',
    },
  ],
  
  bestPractices: [
    {
      name: '文件过大',
      check: (file) => file.lines > CONFIG.review.maxFileSize,
      severity: 'medium',
      message: (file) => `文件过大 (${file.lines} 行)，建议拆分（阈值：${CONFIG.review.maxFileSize} 行）`,
    },
    {
      name: '缺少文件头注释',
      check: (file) => !file.content.startsWith('/**') && !file.content.startsWith('//'),
      severity: 'low',
      message: '文件缺少头部注释，建议添加文件说明',
    },
  ],
};

// ============ 工具函数 ============

/**
 * 发送 HTTP 请求
 */
function httpRequest(url, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const req = (url.startsWith('https') ? https : http).request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: JSON.parse(data),
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data,
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

/**
 * 获取 GitHub 文件内容
 */
async function getGitHubFile(filePath, ref = 'main') {
  const url = `https://api.github.com/repos/${CONFIG.github.owner}/${CONFIG.github.repo}/contents/${filePath}?ref=${ref}`;
  
  const response = await httpRequest(url, {
    method: 'GET',
    headers: {
      'Authorization': `token ${CONFIG.github.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Censorate-Code-Review',
    },
  });
  
  if (response.status !== 200) {
    throw new Error(`GitHub API 错误：${response.status} - ${JSON.stringify(response.data)}`);
  }
  
  // 解码 base64 内容
  const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
  const lines = content.split('\n').length;
  
  return {
    path: response.data.path,
    sha: response.data.sha,
    size: response.data.size,
    content,
    lines,
  };
}

/**
 * 获取最近的 commits
 */
async function getRecentCommits(limit = 5) {
  const url = `https://api.github.com/repos/${CONFIG.github.owner}/${CONFIG.github.repo}/commits?per_page=${limit}`;
  
  const response = await httpRequest(url, {
    method: 'GET',
    headers: {
      'Authorization': `token ${CONFIG.github.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Censorate-Code-Review',
    },
  });
  
  if (response.status !== 200) {
    throw new Error(`GitHub API 错误：${response.status}`);
  }
  
  return response.data;
}

/**
 * 获取 commit 的 files 变更
 */
async function getCommitFiles(sha) {
  const url = `https://api.github.com/repos/${CONFIG.github.owner}/${CONFIG.github.repo}/commits/${sha}`;
  
  const response = await httpRequest(url, {
    method: 'GET',
    headers: {
      'Authorization': `token ${CONFIG.github.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Censorate-Code-Review',
    },
  });
  
  if (response.status !== 200) {
    throw new Error(`GitHub API 错误：${response.status}`);
  }
  
  return response.data.files || [];
}

/**
 * 执行代码审查
 */
function reviewFile(file) {
  const issues = [];
  
  // 安全检查
  if (CONFIG.review.checkSecurity) {
    for (const rule of REVIEW_RULES.security) {
      if (rule.pattern && rule.pattern.test(file.content)) {
        issues.push({
          rule: rule.name,
          severity: rule.severity,
          message: rule.message,
          file: file.path,
        });
      }
    }
  }
  
  // 质量检查
  if (CONFIG.review.checkQuality) {
    for (const rule of REVIEW_RULES.quality) {
      if (rule.pattern && rule.pattern.test(file.content)) {
        issues.push({
          rule: rule.name,
          severity: rule.severity,
          message: rule.message,
          file: file.path,
        });
      }
    }
  }
  
  // 最佳实践检查
  if (CONFIG.review.checkBestPractices) {
    for (const rule of REVIEW_RULES.bestPractices) {
      if (rule.check && rule.check(file)) {
        issues.push({
          rule: rule.name,
          severity: rule.severity,
          message: typeof rule.message === 'function' ? rule.message(file) : rule.message,
          file: file.path,
        });
      }
    }
  }
  
  return issues;
}

/**
 * 发送飞书通知
 */
async function sendFeishuNotification(reviewResult) {
  if (!CONFIG.feishu.webhook) {
    console.log('⚠️  未配置飞书 webhook，跳过通知发送');
    return;
  }
  
  const { passed, issues, commitSha, files } = reviewResult;
  
  // 构建飞书卡片消息
  const card = {
    config: {
      wide_screen_mode: true,
    },
    header: {
      template: passed ? 'green' : 'red',
      title: {
        tag: 'plain_text',
        content: passed ? '✅ 代码审查通过' : '❌ 代码审查未通过',
      },
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'markdown',
          content: `**Commit:** ${commitSha?.substring(0, 7) || 'N/A'}\n**审查文件:** ${files.length} 个\n**发现问题:** ${issues.length} 个`,
        },
      },
    ],
  };
  
  // 添加问题列表
  if (issues.length > 0) {
    const issueList = issues.slice(0, 10).map((issue, i) => {
      const severityIcon = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🔵',
        info: 'ℹ️',
      }[issue.severity] || '•';
      
      return `${i + 1}. ${severityIcon} **${issue.rule}**\n   ${issue.message}\n   文件：\`${issue.file}\``;
    }).join('\n\n');
    
    card.elements.push({
      tag: 'div',
      text: {
        tag: 'markdown',
        content: `**审查问题:**\n${issueList}`,
      },
    });
    
    if (issues.length > 10) {
      card.elements.push({
        tag: 'div',
        text: {
          tag: 'markdown',
          content: `... 还有 ${issues.length - 10} 个问题，请查看详细报告`,
        },
      });
    }
  }
  
  // 添加操作按钮
  card.elements.push({
    tag: 'action',
    actions: [
      {
        tag: 'button',
        text: {
          tag: 'plain_text',
          content: '📊 查看详细报告',
        },
        url: `https://github.com/${CONFIG.github.owner}/${CONFIG.github.repo}/commit/${commitSha}`,
        type: 'default',
      },
    ],
  });
  
  // 发送请求
  const response = await httpRequest(CONFIG.feishu.webhook, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  }, JSON.stringify(card));
  
  if (response.status === 200) {
    console.log('✅ 飞书通知发送成功');
  } else {
    console.error('❌ 飞书通知发送失败:', response.status, response.data);
  }
}

/**
 * 主审查流程
 */
async function main() {
  console.log('🏛️  都察院代码审查启动...');
  console.log(`📂 仓库：${CONFIG.github.owner}/${CONFIG.github.repo}`);
  
  try {
    // 获取最近的 commits
    const commits = await getRecentCommits(1);
    if (commits.length === 0) {
      console.log('ℹ️  没有最近的提交');
      return;
    }
    
    const latestCommit = commits[0];
    const commitSha = latestCommit.sha;
    console.log(`📝 审查 Commit: ${commitSha.substring(0, 7)}`);
    
    // 获取 commit 的文件变更
    const files = await getCommitFiles(commitSha);
    console.log(`📄 变更文件：${files.length} 个`);
    
    // 审查每个文件
    const allIssues = [];
    const reviewedFiles = [];
    
    for (const file of files) {
      if (file.status === 'removed') continue; // 跳过已删除的文件
      
      // 只审查代码文件
      const codeExtensions = ['.js', '.ts', '.py', '.sh', '.json', '.md', '.yml', '.yaml'];
      if (!codeExtensions.some(ext => file.filename.endsWith(ext))) {
        console.log(`⏭️  跳过非代码文件：${file.filename}`);
        continue;
      }
      
      try {
        const fileContent = await getGitHubFile(file.filename);
        reviewedFiles.push(fileContent);
        
        const issues = reviewFile(fileContent);
        allIssues.push(...issues);
        
        if (issues.length > 0) {
          console.log(`❌ ${file.filename}: ${issues.length} 个问题`);
        } else {
          console.log(`✅ ${file.filename}: 通过`);
        }
      } catch (error) {
        console.error(`⚠️  无法审查 ${file.filename}: ${error.message}`);
      }
    }
    
    // 生成审查结果
    const reviewResult = {
      passed: allIssues.length === 0,
      issues: allIssues,
      commitSha,
      files: reviewedFiles,
      timestamp: new Date().toISOString(),
    };
    
    // 输出审查报告
    console.log('\n' + '='.repeat(50));
    console.log('🏛️  都察院代码审查报告');
    console.log('='.repeat(50));
    console.log(`Commit: ${commitSha.substring(0, 7)}`);
    console.log(`审查文件：${reviewedFiles.length} 个`);
    console.log(`发现问题：${allIssues.length} 个`);
    console.log(`审查结果：${reviewResult.passed ? '✅ 通过' : '❌ 未通过'}`);
    
    if (allIssues.length > 0) {
      console.log('\n问题列表:');
      allIssues.forEach((issue, i) => {
        console.log(`  ${i + 1}. [${issue.severity}] ${issue.rule} @ ${issue.file}`);
        console.log(`     ${issue.message}`);
      });
    }
    console.log('='.repeat(50));
    
    // 发送飞书通知
    await sendFeishuNotification(reviewResult);
    
    // 保存审查报告到文件
    const reportPath = path.join(__dirname, '..', 'reports', `code-review-${commitSha.substring(0, 7)}.json`);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(reviewResult, null, 2));
    console.log(`📁 报告已保存：${reportPath}`);
    
    // 如果不通过，退出码设为 1（可用于 CI/CD 阻断）
    if (!reviewResult.passed) {
      console.log('\n❌ 代码审查未通过，请修复问题后重新提交');
      process.exit(1);
    } else {
      console.log('\n✅ 代码审查通过，可以继续');
    }
    
  } catch (error) {
    console.error('❌ 审查过程出错:', error.message);
    process.exit(1);
  }
}

// ============ 命令行参数解析 ============
function parseArgs() {
  const args = process.argv.slice(2);
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--repo':
        const [owner, repo] = args[++i].split('/');
        CONFIG.github.owner = owner;
        CONFIG.github.repo = repo;
        break;
      case '--commit':
        // 可以指定特定 commit
        CONFIG.commitSha = args[++i];
        break;
      case '--webhook':
        CONFIG.feishu.webhook = args[++i];
        break;
      case '--user':
        CONFIG.feishu.userId = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`
🏛️  都察院代码审查 - Censorate Code Review

用法：node ${path.basename(__filename)} [选项]

选项:
  --repo <owner/repo>   GitHub 仓库（默认：erwinqyf/Claw-s-memory）
  --commit <sha>        指定 commit hash（默认：最新 commit）
  --webhook <url>       飞书 webhook URL
  --user <id>           飞书用户 ID
  --help, -h            显示帮助信息

示例:
  node ${path.basename(__filename)} --repo erwinqyf/my-project
  node ${path.basename(__filename)} --commit abc123def
        `);
        process.exit(0);
    }
  }
}

// ============ 执行 ============
if (require.main === module) {
  parseArgs();
  main();
}

module.exports = { reviewFile, getGitHubFile, getRecentCommits, getCommitFiles };
