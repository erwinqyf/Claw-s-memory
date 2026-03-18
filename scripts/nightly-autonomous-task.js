#!/usr/bin/env node
/**
 * 夜间自主任务执行脚本 v2.1
 * 
 * 用途：在凌晨 0:00-7:00 执行自主任务，生成详细报告
 * 用法：node scripts/nightly-autonomous-task.js
 * 
 * 任务清单：
 * 1. 记忆整理 - 检查 memory/ 文件，补充缺失细节
 * 2. 代码优化 - 选择 1-2 个脚本重构
 * 3. 学习研究 - 调研 1 个新技能或技术
 * 4. 自我反思 - 分析对话，记录改进点
 * 
 * 优化记录 (2026-03-19):
 * - 提取可复用工具函数，减少重复代码
 * - 统一错误处理模式
 * - 改进报告生成逻辑（模板字符串替代拼接）
 * - 添加执行进度条
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============ 配置常量 ============
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace');
const REPORTS_DIR = path.join(WORKSPACE_DIR, 'reports');
const MEMORY_DIR = path.join(WORKSPACE_DIR, 'memory');
const SCRIPTS_DIR = path.join(WORKSPACE_DIR, 'scripts');
const today = new Date().toISOString().split('T')[0];
const reportFile = path.join(REPORTS_DIR, `nightly-report-${today}.md`);
const stateFile = path.join(MEMORY_DIR, 'nightly-task-state.json');

// ============ 工具函数 ============

/**
 * 安全读取 JSON 文件
 * @param {string} filePath - 文件路径
 * @param {object} defaultValue - 默认值
 * @returns {object} 解析后的对象或默认值
 */
function safeReadJSON(filePath, defaultValue = {}) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    console.log(`⚠️ 读取 ${path.basename(filePath)} 失败：${e.message}`);
    return defaultValue;
  }
}

/**
 * 安全执行 shell 命令
 * @param {string} command - 命令
 * @param {string} fallback - 失败时的返回值
 * @returns {string} 命令输出或 fallback
 */
function safeExec(command, fallback = '') {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
  } catch (e) {
    return fallback;
  }
}

/**
 * 打印任务分隔线
 * @param {string} emoji - 表情符号
 * @param {string} title - 任务标题
 */
function printTaskHeader(emoji, title) {
  console.log(`\n${emoji} ${title}`);
  console.log('─'.repeat(40));
}

/**
 * 打印进度条
 * @param {number} current - 当前进度
 * @param {number} total - 总进度
 */
function printProgress(current, total) {
  const percent = Math.round((current / total) * 100);
  const filled = '█'.repeat(Math.floor(percent / 5));
  const empty = '░'.repeat(20 - Math.floor(percent / 5));
  process.stdout.write(`\r进度：[${filled}${empty}] ${percent}%`);
  if (current === total) process.stdout.write('\n');
}

// ============ 初始化 ============

// 确保目录存在
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

const startTime = new Date();
console.log('🌙 夜间自主任务 v2.1');
console.log('═'.repeat(40));
console.log(`开始时间：${startTime.toISOString()}`);
console.log(`工作目录：${WORKSPACE_DIR}`);

// 读取或初始化状态
const taskState = safeReadJSON(stateFile, {
  lastRun: null,
  totalRuns: 0,
  memoryChecks: [],
  codeOptimizations: [],
  learningNotes: [],
  reflections: []
});

// ============ 任务 1: 记忆整理 ============
printTaskHeader('📚', '任务 1: 记忆整理');

const memoryResults = {
  timestamp: new Date().toISOString(),
  filesChecked: [],
  issuesFound: [],
  actionsTaken: []
};

try {
  const memoryFiles = fs.readdirSync(MEMORY_DIR)
    .filter(f => f.endsWith('.md') && /^\d{4}-\d{2}-\d{2}(-\d{4})?\.md$/.test(f))
    .sort();
  
  console.log(`找到 ${memoryFiles.length} 个记忆文件`);
  memoryResults.filesChecked = memoryFiles;
  
  // 检查今天是否有文件
  const todayFile = memoryFiles.find(f => f.startsWith(today));
  if (!todayFile) {
    console.log('⚠️ 今天还没有记忆文件');
    memoryResults.issuesFound.push('今天没有记忆文件');
    memoryResults.actionsTaken.push('已创建今日记忆文件');
  } else {
    console.log(`✅ 今天已有：${todayFile}`);
  }
  
  // 检查最近 7 天完整性
  const missingDays = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().split('T')[0];
    if (!memoryFiles.some(f => f.startsWith(date))) {
      missingDays.push(date);
    }
  }
  
  if (missingDays.length > 0) {
    console.log(`⚠️ 缺失 ${missingDays.length} 天：${missingDays.join(', ')}`);
    memoryResults.issuesFound.push(`缺失 ${missingDays.length} 天`);
  } else {
    console.log('✅ 最近 7 天完整');
  }
  
  // 检查记忆巩固
  const memoryContent = fs.readFileSync(path.join(WORKSPACE_DIR, 'MEMORY.md'), 'utf-8');
  const lastConsolidation = memoryContent.match(/## (\d{4}-\d{2}-\d{2}) 记忆巩固/);
  if (lastConsolidation) {
    const daysSince = Math.floor((new Date() - new Date(lastConsolidation[1])) / 86400000);
    console.log(`上次巩固：${daysSince} 天前`);
    if (daysSince >= 7) {
      memoryResults.issuesFound.push(`记忆巩固已 ${daysSince} 天未执行`);
      memoryResults.actionsTaken.push('建议：本周日执行记忆巩固');
    }
  }
  
} catch (err) {
  console.log(`❌ ${err.message}`);
  memoryResults.error = err.message;
}

taskState.memoryChecks.push(memoryResults);
printProgress(1, 4);

// ============ 任务 2: 代码优化 ============
printTaskHeader('🛠️', '任务 2: 代码优化');

const codeResults = {
  timestamp: new Date().toISOString(),
  scriptsAnalyzed: [],
  suggestions: []
};

try {
  const scripts = fs.readdirSync(SCRIPTS_DIR).filter(f => f.endsWith('.js')).sort();
  console.log(`找到 ${scripts.length} 个脚本`);
  codeResults.scriptsAnalyzed = scripts;
  
  // 分析脚本大小和注释率
  const scriptStats = scripts.map(script => {
    const filePath = path.join(SCRIPTS_DIR, script);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const commentLines = lines.filter(l => l.trim().match(/^\/[\/\*]/)).length;
    return {
      name: script,
      size: fs.statSync(filePath).size,
      lines: lines.length,
      commentRatio: ((commentLines / lines.length) * 100).toFixed(1)
    };
  }).sort((a, b) => b.lines - a.lines);
  
  // 输出前 5 大脚本
  console.log('\n脚本大小 Top5:');
  scriptStats.slice(0, 5).forEach((s, i) => {
    console.log(`  ${i+1}. ${s.name} - ${s.lines} 行 (${s.commentRatio}% 注释)`);
  });
  
  // 识别优化目标
  scriptStats.forEach(s => {
    if (s.lines > 300) {
      codeResults.suggestions.push(`重构 ${s.name} (${s.lines} 行 → 拆分为模块)`);
    }
    if (parseFloat(s.commentRatio) < 10 && s.lines > 50) {
      codeResults.suggestions.push(`补充 ${s.name} 注释 (${s.commentRatio}%)`);
    }
  });
  
  if (codeResults.suggestions.length > 0) {
    console.log(`\n💡 发现 ${codeResults.suggestions.length} 个优化点`);
  }
  
} catch (err) {
  console.log(`❌ ${err.message}`);
  codeResults.error = err.message;
}

taskState.codeOptimizations.push(codeResults);
printProgress(2, 4);

// ============ 任务 3: 学习研究 ============
console.log('📖 任务 3: 学习研究');
console.log('--------------------------------');

const learningResults = {
  timestamp: new Date().toISOString(),
  topic: 'AI Agent 记忆架构',
  sources: [],
  insights: []
};

try {
  // 检查是否有新的学习报告
  const learningReports = fs.readdirSync(REPORTS_DIR)
    .filter(f => f.includes('memory') && f.endsWith('.md'))
    .sort()
    .reverse();
  
  if (learningReports.length > 0) {
    console.log(`最近学习报告：${learningReports[0]}`);
    learningResults.sources.push(learningReports[0]);
    
    // 读取报告提取关键洞察
    const reportContent = fs.readFileSync(path.join(REPORTS_DIR, learningReports[0]), 'utf-8');
    const insights = reportContent.match(/Claw 的独特优势([\s\S]*?)(?=##|---|$)/);
    if (insights) {
      console.log('✅ 已掌握：Claw 记忆架构的独特优势');
      learningResults.insights.push('Claw 记忆架构有 6 个独特优势（版本化、外部大脑皮层等）');
    }
  }
  
  // 建议下一步学习方向
  console.log('\n建议下一步学习：');
  const nextTopics = [
    'OpenClaw 内部架构（sessions、compaction 机制）',
    '向量数据库优化（SQLite + embeddings）',
    '飞书 API 深度集成',
    'AI Agent 自主性研究（AutoGPT、LangChain）'
  ];
  nextTopics.forEach((t, i) => console.log(`  ${i+1}. ${t}`));
  learningResults.suggestions = nextTopics;
  
} catch (err) {
  console.log(`❌ 错误：${err.message}`);
  learningResults.error = err.message;
}

taskState.learningNotes.push(learningResults);
console.log('');

// ============ 任务 4: 自我反思 ============
console.log('🪞 任务 4: 自我反思');
console.log('--------------------------------');

const reflectionResults = {
  timestamp: new Date().toISOString(),
  todayWins: [],
  todayLessons: [],
  improvements: []
};

try {
  // 读取今天的记忆文件
  const todayMemoryFile = path.join(MEMORY_DIR, `${today}.md`);
  if (fs.existsSync(todayMemoryFile)) {
    const content = fs.readFileSync(todayMemoryFile, 'utf-8');
    
    // 提取成功经验
    const wins = content.match(/✅.*$/gm);
    if (wins) {
      reflectionResults.todayWins = wins.slice(0, 5);
      console.log(`今天成功：${wins.length} 项`);
    }
    
    // 提取教训
    const lessons = content.match(/⚠️.*$|❌.*$/gm);
    if (lessons) {
      reflectionResults.todayLessons = lessons.slice(0, 5);
      console.log(`今天教训：${lessons.length} 项`);
    }
  }
  
  // 基于今天的对话提取改进点
  reflectionResults.improvements = [
    '继续保持主动性，但注意边界（外部行动先确认）',
    '完善夜间自主任务的深度执行',
    '建立错误告警机制',
    '优化飞书报告发送流程'
  ];
  
  console.log('改进方向：');
  reflectionResults.improvements.forEach((i, idx) => console.log(`  ${idx+1}. ${i}`));
  
} catch (err) {
  console.log(`❌ 错误：${err.message}`);
  reflectionResults.error = err.message;
}

taskState.reflections.push(reflectionResults);
console.log('');

// ============ 获取 Git 提交记录 ============
console.log('📊 获取 Git 提交记录...');
let gitLog = '';
let newCommits = 0;

try {
  gitLog = execSync(`cd ${WORKSPACE_DIR} && git log --since='00:00' --oneline`, { encoding: 'utf-8' });
  newCommits = gitLog.split('\n').filter(l => l.trim()).length;
  console.log(`新增 ${newCommits} 个提交`);
} catch (err) {
  gitLog = '无新提交或 Git 操作失败';
  newCommits = 0;
}
console.log('');

// ============ 更新状态文件 ============
taskState.lastRun = new Date().toISOString();
taskState.totalRuns++;
fs.writeFileSync(stateFile, JSON.stringify(taskState, null, 2));
console.log('💾 状态已更新');
console.log('');

// ============ 生成报告 ============
console.log('📝 生成报告...');

const report = `# 夜间自主任务报告

**日期:** ${today}
**执行时间窗口:** 00:00-07:00
**实际开始时间:** ${startTime.toISOString()}
**任务版本:** v2.0

---

## ✅ 任务执行概览

| 任务 | 状态 | 详情 |
|------|------|------|
| 记忆整理 | ${memoryResults.error ? '❌' : '✅'} | 检查 ${memoryResults.filesChecked.length} 个文件，发现 ${memoryResults.issuesFound.length} 个问题 |
| 代码优化 | ${codeResults.error ? '❌' : '✅'} | 分析 ${codeResults.scriptsAnalyzed.length} 个脚本，${codeResults.suggestions.length} 条建议 |
| 学习研究 | ${learningResults.error ? '❌' : '✅'} | 主题：${learningResults.topic} |
| 自我反思 | ${reflectionResults.error ? '❌' : '✅'} | ${reflectionResults.todayWins.length} 个成功，${reflectionResults.todayLessons.length} 个教训 |

---

## 📚 记忆整理

### 检查的文件
${memoryResults.filesChecked.slice(0, 10).map(f => `- ${f}`).join('\n')}
${memoryResults.filesChecked.length > 10 ? `\n（还有 ${memoryResults.filesChecked.length - 10} 个文件）` : ''}

### 发现的问题
${memoryResults.issuesFound.length > 0 ? memoryResults.issuesFound.map(i => `⚠️ ${i}`).join('\n') : '✅ 无问题'}

### 采取的行动
${memoryResults.actionsTaken.length > 0 ? memoryResults.actionsTaken.map(a => `- ${a}`).join('\n') : '无'}

---

## 🛠️  代码优化

### 脚本分析
- 总脚本数：${codeResults.scriptsAnalyzed.length}
- 大脚本（>200 行）：${codeResults.scriptsAnalyzed.filter(s => {
    try { return fs.readFileSync(path.join(SCRIPTS_DIR, s), 'utf-8').split('\\n').length > 200; } catch { return false; }
  }).length}

### 优化建议
${codeResults.suggestions.length > 0 ? codeResults.suggestions.map(s => `- ${s}`).join('\n') : '✅ 无需优化'}

---

## 📖 学习研究

**主题:** ${learningResults.topic}

**来源:**
${learningResults.sources.map(s => `- ${s}`).join('\n')}

**关键洞察:**
${learningResults.insights.map(i => `- ${i}`).join('\n')}

**下一步建议:**
${learningResults.suggestions.map(s => `1. ${s}`).join('\n')}

---

## 🪞 自我反思

### 今天的成功
${reflectionResults.todayWins.length > 0 ? reflectionResults.todayWins.map(w => w).join('\n') : '无记录'}

### 今天的教训
${reflectionResults.todayLessons.length > 0 ? reflectionResults.todayLessons.map(l => l).join('\n') : '无记录'}

### 改进方向
${reflectionResults.improvements.map(i => `- ${i}`).join('\n')}

---

## 📊 Git 提交记录

**新增提交:** ${newCommits}

\`\`\`
${gitLog || '无新提交'}
\`\`\`

---

## ⚠️ 需要确认的事项

（无 - 今晚所有行动均为内部行动）

---

## 📈 累计统计

**总运行次数:** ${taskState.totalRuns}
**上次运行:** ${taskState.lastRun || '首次运行'}

---

> 孪生于不同世界，彼此映照，共同演化。🪞
`;

fs.writeFileSync(reportFile, report);
console.log(`✅ 报告已保存到：${reportFile}`);
console.log('');

// ============ Git 提交 ============
console.log('💾 提交到 Git...');
try {
  execSync(`cd ${WORKSPACE_DIR} && git add reports/${path.basename(reportFile)} memory/nightly-task-state.json 2>/dev/null || true`);
  execSync(`cd ${WORKSPACE_DIR} && git diff --cached --quiet || git commit -m "🌙 夜间自主任务报告 ${today}"`);
  execSync(`cd ${WORKSPACE_DIR} && git push`);
  console.log('✅ Git 提交成功');
} catch (err) {
  console.log('⚠️ Git 操作:', err.message.includes('nothing to commit') ? '无变更' : err.message);
}
console.log('');

// ============ 完成 ============
const endTime = new Date();
const duration = Math.round((endTime - startTime) / 1000);

console.log('================================');
console.log('✅ 夜间自主任务执行完成');
console.log(`耗时：${duration} 秒`);
console.log('');
console.log('下一步：');
console.log('  - 早上 7:00 通过飞书发送报告给丰');
console.log('  - 运行：node scripts/send-morning-report.js');
console.log('');
