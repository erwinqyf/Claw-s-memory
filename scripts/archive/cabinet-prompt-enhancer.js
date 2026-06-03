#!/usr/bin/env node
/**
 * 内阁 Prompt 增强 - Cabinet Prompt Enhancer
 * 
 * 灵感来源：菠萝菠菠 AI 朝廷 (danghuangshang)
 * GitHub: https://github.com/wanikua/danghuangshang
 * 
 * 功能：
 * - 接收用户的原始指令
 * - 内阁（首辅）分析意图、追问澄清、生成执行计划
 * - 返回优化后的 Prompt + Plan 给执行 Agent
 * 
 * 使用场景：
 * 1. 复杂任务（S/A 级）先经内阁优化再派发
 * 2. 模糊需求引导用户澄清
 * 3. 多步骤任务自动生成执行计划
 * 
 * @example
 * node scripts/cabinet-prompt-enhancer.js --prompt "重构我们的系统"
 */

const fs = require('fs');
const path = require('path');

// ============ 配置 ============
const CONFIG = {
  // 内阁角色设定
  cabinet: {
    name: '内阁首辅',
    title: '首席策略官 (CSO)',
    personality: '深思熟虑、逻辑清晰、善于拆解复杂问题',
    style: '先理解意图，再生成计划，必要时追问澄清',
  },
  
  // 任务分级标准
  taskLevels: {
    S: {
      keywords: ['重构', '架构', ' redesign', '迁移', '重写', '核心系统'],
      description: '影响核心系统的重大变更',
      requiresPlan: true,
      requiresReview: true,
      estimatedTime: '> 4 小时',
    },
    A: {
      keywords: ['优化', '改进', '增强', '扩展', '新功能', '模块'],
      description: '重要功能开发或优化',
      requiresPlan: true,
      requiresReview: false,
      estimatedTime: '1-4 小时',
    },
    B: {
      keywords: ['修复', 'bug', '问题', '错误', '调整', '修改'],
      description: '常规问题修复或调整',
      requiresPlan: false,
      requiresReview: false,
      estimatedTime: '< 1 小时',
    },
    C: {
      keywords: ['查询', '查看', '检查', '状态', '帮助', '解释'],
      description: '信息查询或简单问答',
      requiresPlan: false,
      requiresReview: false,
      estimatedTime: '< 15 分钟',
    },
  },
  
  // 执行 Agent 映射
  agentMapping: {
    '编码': 'bravo',
    '技术': 'bravo',
    '开发': 'bravo',
    '财务': 'alpha',
    '分析': 'bravo',
    '监控': 'bravo',
    '健康检查': 'bravo',
    '记忆': 'charlie',
    '巩固': 'charlie',
    '报告': 'delta',
    '新闻': 'delta',
    '调研': 'echo',
    '追踪': 'echo',
    '复杂任务': 'alpha',
    '架构': 'alpha',
    '战略': 'alpha',
  },
};

// ============ Prompt 模板 ============
const PROMPT_TEMPLATES = {
  // 内阁分析 Prompt
  analysis: `你是一位经验丰富的内阁首辅（首席策略官），负责分析和优化用户的指令。

## 你的职责
1. **理解意图** - 深入理解用户的真实需求
2. **任务分级** - 评估任务的复杂度和影响面（S/A/B/C 级）
3. **追问澄清** - 对于模糊需求，提出精准的澄清问题
4. **生成计划** - 对于复杂任务，拆解为可执行的步骤
5. **分配资源** - 推荐合适的执行 Agent

## 任务分级标准
- **S 级**：影响核心系统的重大变更（重构、架构调整、迁移）
- **A 级**：重要功能开发或优化（新功能、模块扩展）
- **B 级**：常规问题修复或调整（bug 修复、小改进）
- **C 级**：信息查询或简单问答

## 输出格式
请严格按照以下 JSON 格式输出：

{
  "originalPrompt": "用户的原始指令",
  "enhancedPrompt": "优化后的指令（更清晰、具体、可执行）",
  "taskLevel": "S|A|B|C",
  "taskDescription": "任务的详细描述",
  "clarifyingQuestions": ["需要用户澄清的问题列表，如果不需要则为空"],
  "executionPlan": [
    {
      "step": 1,
      "action": "具体动作",
      "agent": "推荐的执行 Agent (alpha/bravo/charlie/delta/echo)",
      "estimatedTime": "预计耗时",
      "deliverable": "交付物"
    }
  ],
  "risks": ["潜在风险列表"],
  "successCriteria": ["成功标准列表"],
  "requiresReview": true|false,
  "estimatedTotalTime": "总预计耗时"
}

## 示例

用户输入："重构我们的系统"

输出：
{
  "originalPrompt": "重构我们的系统",
  "enhancedPrompt": "对现有系统进行架构重构，优化代码结构、提升可维护性、改善性能",
  "taskLevel": "S",
  "taskDescription": "系统级重构，涉及核心架构变更",
  "clarifyingQuestions": [
    "重构的具体目标是什么？（性能/可维护性/可扩展性）",
    "有哪些模块优先级最高？",
    "是否有时间限制或上线压力？"
  ],
  "executionPlan": [
    {
      "step": 1,
      "action": "分析现有架构，识别痛点",
      "agent": "alpha",
      "estimatedTime": "1 小时",
      "deliverable": "架构分析报告"
    },
    {
      "step": 2,
      "action": "设计新架构方案",
      "agent": "alpha",
      "estimatedTime": "2 小时",
      "deliverable": "架构设计文档"
    },
    {
      "step": 3,
      "action": "分模块重构实施",
      "agent": "bravo",
      "estimatedTime": "8 小时",
      "deliverable": "重构后的代码"
    },
    {
      "step": 4,
      "action": "代码审查和测试",
      "agent": "bravo",
      "estimatedTime": "2 小时",
      "deliverable": "审查报告 + 测试结果"
    }
  ],
  "risks": [
    "重构可能引入新 bug",
    "影响现有功能",
    "耗时超出预期"
  ],
  "successCriteria": [
    "代码复杂度降低 30%",
    "测试覆盖率提升至 80%",
    "性能提升 20%"
  ],
  "requiresReview": true,
  "estimatedTotalTime": "13 小时"
}

现在请分析以下用户指令：`,

  // 追问模板
  clarifying: `感谢你的指令！为了更好地完成任务，内阁需要先确认几个问题：

{questions}

请回答以上问题，内阁将为你生成详细的执行计划。🪞`,

  // 计划确认模板
  planConfirmed: `✅ 内阁已生成执行计划

**任务等级:** {level}
**预计耗时:** {time}
**执行 Agent:** {agents}
**需要审查:** {review}

## 执行计划
{plan}

## 潜在风险
{risks}

## 成功标准
{criteria}

是否开始执行？回复"开始"或"执行"即可。🪞`,
};

// ============ 核心函数 ============

/**
 * 任务分级
 */
function classifyTask(prompt) {
  const promptLower = prompt.toLowerCase();
  
  for (const [level, config] of Object.entries(CONFIG.taskLevels)) {
    if (config.keywords.some(keyword => promptLower.includes(keyword.toLowerCase()))) {
      return {
        level,
        config,
      };
    }
  }
  
  // 默认 B 级
  return {
    level: 'B',
    config: CONFIG.taskLevels.B,
  };
}

/**
 * 推荐执行 Agent
 */
function recommendAgent(taskDescription) {
  const descLower = taskDescription.toLowerCase();
  
  for (const [keyword, agent] of Object.entries(CONFIG.agentMapping)) {
    if (descLower.includes(keyword.toLowerCase())) {
      return agent;
    }
  }
  
  // 默认 alpha（全能主力）
  return 'alpha';
}

/**
 * 生成内阁分析 Prompt
 */
function buildAnalysisPrompt(userPrompt) {
  return PROMPT_TEMPLATES.analysis + userPrompt;
}

/**
 * 解析内阁输出（假设使用 LLM）
 * 这里简化处理，实际需要调用 LLM API
 */
function parseCabinetOutput(llmResponse) {
  try {
    // 尝试解析 JSON
    const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('无法解析 JSON');
  } catch (error) {
    console.error('❌ 解析内阁输出失败:', error.message);
    
    // 降级处理：返回简化版本
    const taskClassification = classifyTask(llmResponse);
    return {
      originalPrompt: llmResponse,
      enhancedPrompt: llmResponse,
      taskLevel: taskClassification.level,
      taskDescription: taskClassification.config.description,
      clarifyingQuestions: [],
      executionPlan: [
        {
          step: 1,
          action: '执行任务',
          agent: recommendAgent(llmResponse),
          estimatedTime: taskClassification.config.estimatedTime,
          deliverable: '完成任务',
        },
      ],
      risks: [],
      successCriteria: ['任务完成'],
      requiresReview: taskClassification.config.requiresReview,
      estimatedTotalTime: taskClassification.config.estimatedTime,
    };
  }
}

/**
 * 生成追问消息
 */
function buildClarifyingMessage(questions) {
  if (!questions || questions.length === 0) {
    return null;
  }
  
  const questionList = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
  return PROMPT_TEMPLATES.clarifying.replace('{questions}', questionList);
}

/**
 * 生成计划确认消息
 */
function buildPlanConfirmationMessage(plan) {
  const agents = [...new Set(plan.executionPlan.map(step => step.agent))].join(', ');
  const planList = plan.executionPlan.map(step => 
    `${step.step}. **${step.action}**\n   Agent: ${step.agent} | 耗时：${step.estimatedTime}\n   交付物：${step.deliverable}`
  ).join('\n\n');
  
  const risksList = plan.risks.map(r => `• ${r}`).join('\n');
  const criteriaList = plan.successCriteria.map(c => `• ${c}`).join('\n');
  
  return PROMPT_TEMPLATES.planConfirmed
    .replace('{level}', plan.taskLevel)
    .replace('{time}', plan.estimatedTotalTime)
    .replace('{agents}', agents)
    .replace('{review}', plan.requiresReview ? '✅ 是' : '❌ 否')
    .replace('{plan}', planList)
    .replace('{risks}', risksList || '无明显风险')
    .replace('{criteria}', criteriaList);
}

/**
 * 主处理流程
 */
async function processUserPrompt(userPrompt, options = {}) {
  console.log('🏛️  内阁 Prompt 增强启动...');
  console.log(`📝 原始指令：${userPrompt}`);
  
  // 1. 任务分级
  const classification = classifyTask(userPrompt);
  console.log(`📊 任务等级：${classification.level} 级 - ${classification.config.description}`);
  
  // 2. 构建分析 Prompt（实际应调用 LLM）
  const analysisPrompt = buildAnalysisPrompt(userPrompt);
  
  // 3. 调用 LLM（这里用简化版本模拟）
  // 实际使用时应该调用 bailian/qwen3.5-plus 或其他模型
  console.log('🤖 调用 LLM 进行内阁分析...');
  
  // 模拟 LLM 响应（实际应替换为真实 API 调用）
  const llmResponse = simulateLLMResponse(userPrompt, classification);
  
  // 4. 解析内阁输出
  const cabinetOutput = parseCabinetOutput(llmResponse);
  
  // 5. 检查是否需要追问
  const clarifyingMessage = buildClarifyingMessage(cabinetOutput.clarifyingQuestions);
  if (clarifyingMessage) {
    console.log('❓ 需要追问澄清');
    return {
      status: 'clarifying',
      message: clarifyingMessage,
      questions: cabinetOutput.clarifyingQuestions,
    };
  }
  
  // 6. 生成计划确认消息
  const confirmationMessage = buildPlanConfirmationMessage(cabinetOutput);
  
  console.log('✅ 内阁分析完成');
  console.log(`📋 执行计划：${cabinetOutput.executionPlan.length} 步`);
  console.log(`🎯 推荐 Agent: ${[...new Set(cabinetOutput.executionPlan.map(s => s.agent))].join(', ')}`);
  
  return {
    status: 'ready',
    originalPrompt: userPrompt,
    enhancedPrompt: cabinetOutput.enhancedPrompt,
    taskLevel: cabinetOutput.taskLevel,
    executionPlan: cabinetOutput.executionPlan,
    requiresReview: cabinetOutput.requiresReview,
    confirmationMessage,
    cabinetOutput,
  };
}

/**
 * 模拟 LLM 响应（实际使用时应替换为真实 API 调用）
 */
function simulateLLMResponse(userPrompt, classification) {
  // 这是一个简化版本，实际应该调用 bailian/qwen3.5-plus
  const agent = recommendAgent(userPrompt);
  
  return JSON.stringify({
    originalPrompt: userPrompt,
    enhancedPrompt: userPrompt,
    taskLevel: classification.level,
    taskDescription: classification.config.description,
    clarifyingQuestions: [],
    executionPlan: [
      {
        step: 1,
        action: '执行任务',
        agent: agent,
        estimatedTime: classification.config.estimatedTime,
        deliverable: '完成任务',
      },
    ],
    risks: [],
    successCriteria: ['任务完成'],
    requiresReview: classification.config.requiresReview,
    estimatedTotalTime: classification.config.estimatedTime,
  });
}

/**
 * 调用真实 LLM API（示例）
 */
async function callLLMApi(prompt) {
  // 这里应该调用 OpenClaw 的 API 或 Sessions
  // 示例代码（需要根据实际情况调整）：
  /*
  const response = await fetch('http://localhost:8080/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'bailian/qwen3.5-plus',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await response.json();
  return data.choices[0].message.content;
  */
  
  throw new Error('请实现真实的 LLM API 调用');
}

// ============ 命令行参数解析 ============
function parseArgs() {
  const args = process.argv.slice(2);
  let prompt = null;
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--prompt':
      case '-p':
        prompt = args[++i];
        break;
      case '--interactive':
      case '-i':
        // 交互模式
        return runInteractive();
      case '--help':
      case '-h':
        console.log(`
🏛️  内阁 Prompt 增强 - Cabinet Prompt Enhancer

用法：node ${path.basename(__filename)} [选项]

选项:
  --prompt, -p <text>   用户指令
  --interactive, -i     交互模式
  --help, -h            显示帮助信息

示例:
  node ${path.basename(__filename)} --prompt "重构我们的系统"
  node ${path.basename(__filename)} --interactive
        `);
        process.exit(0);
    }
  }
  
  if (prompt) {
    return { mode: 'prompt', prompt };
  }
  
  return { mode: 'help' };
}

/**
 * 交互模式
 */
async function runInteractive() {
  console.log('🏛️  内阁 Prompt 增强 - 交互模式');
  console.log('输入你的指令，内阁将为你分析和优化（输入 "quit" 退出）\n');
  
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  const ask = () => {
    readline.question('📝 你：', async (userPrompt) => {
      if (userPrompt.toLowerCase() === 'quit') {
        readline.close();
        return;
      }
      
      const result = await processUserPrompt(userPrompt);
      
      if (result.status === 'clarifying') {
        console.log('\n❓ 内阁：' + result.message + '\n');
      } else {
        console.log('\n✅ 内阁：' + result.confirmationMessage + '\n');
      }
      
      ask();
    });
  };
  
  ask();
}

// ============ 执行 ============
if (require.main === module) {
  const options = parseArgs();
  
  if (options.mode === 'prompt') {
    processUserPrompt(options.prompt).then(result => {
      if (result.status === 'clarifying') {
        console.log('\n❓ 内阁：' + result.message);
      } else {
        console.log('\n✅ 内阁：' + result.confirmationMessage);
      }
    });
  } else if (options.mode === 'help') {
    parseArgs(); // 显示帮助
  }
}

module.exports = { processUserPrompt, classifyTask, recommendAgent, parseCabinetOutput };
