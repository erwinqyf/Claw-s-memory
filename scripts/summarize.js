#!/usr/bin/env node
/**
 * 简易文本摘要工具 v2.0
 * 使用 DashScope API (通义千问) 生成摘要
 *
 * 用法:
 *   node summarize.js "文本" [--length short|medium|long]
 *   node summarize.js --file <path> [--length short|medium|long]
 *
 * v2.0 变更 (2026-05-18):
 * - 支持 --file 参数读取文件内容
 * - API_KEY 从环境变量 DASHSCOPE_API_KEY 读取，不再硬编码
 * - 添加请求超时控制（30s）
 * - 添加输入长度警告（>8000 字符自动截断）
 * - 改进错误处理和退出码
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

// ============ 配置 ============
const API_KEY = process.env.DASHSCOPE_API_KEY || '';
const MODEL = 'qwen-plus';
const API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
const MAX_INPUT_CHARS = 8000;
const REQUEST_TIMEOUT_MS = 30000;

if (!API_KEY) {
  console.error('❌ 错误：请设置环境变量 DASHSCOPE_API_KEY 或在脚本中配置 API_KEY');
  process.exit(1);
}

// ============ 参数解析 ============
const args = process.argv.slice(2);
let length = 'medium';
let input = '';

const VALID_LENGTHS = ['short', 'medium', 'long'];

/**
 * 解析命令行参数
 * @returns {{ input: string, length: string }|null}
 */
function parseArgs() {
  let fileInput = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--length' && args[i + 1]) {
      length = args[++i];
    } else if (args[i] === '--file' && args[i + 1]) {
      fileInput = args[++i];
    } else if (!input && !fileInput) {
      input = args[i];
    }
  }

  if (!VALID_LENGTHS.includes(length)) {
    console.error(`❌ 无效的长度参数: ${length}，可选: ${VALID_LENGTHS.join(', ')}`);
    return null;
  }

  if (fileInput) {
    try {
      input = fs.readFileSync(fileInput, 'utf-8');
    } catch (err) {
      console.error(`❌ 无法读取文件: ${fileInput} — ${err.message}`);
      return null;
    }
  }

  if (!input) {
    console.log('用法：node summarize.js <文本> [--length short|medium|long]');
    console.log('      node summarize.js --file <路径> [--length short|medium|long]');
    return null;
  }

  return { input, length };
}

// ============ 摘要生成 ============

const LENGTH_PROMPTS = {
  short: '用 1-2 句话简要概括',
  medium: '用 3-5 句话概括主要内容',
  long: '详细总结，包含关键点和结论'
};

/**
 * 调用 DashScope API 生成摘要
 * @param {string} text - 待摘要文本
 * @param {string} len - 摘要长度 (short|medium|long)
 * @returns {Promise<string>}
 */
async function summarize(text, len) {
  const prompt = LENGTH_PROMPTS[len] || '概括主要内容';
  const truncated = text.length > MAX_INPUT_CHARS
    ? text.slice(0, MAX_INPUT_CHARS)
    : text;

  if (text.length > MAX_INPUT_CHARS) {
    console.warn(`⚠️ 输入过长 (${text.length} 字符)，已截断至 ${MAX_INPUT_CHARS}`);
  }

  const body = JSON.stringify({
    model: MODEL,
    input: {
      messages: [
        { role: 'system', content: '你是一个专业的内容摘要助手。' },
        { role: 'user', content: `${prompt}：\n\n${truncated}` }
      ]
    },
    parameters: {
      result_format: 'message',
      max_tokens: 500
    }
  });

  return new Promise((resolve, reject) => {
    const req = https.request(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: REQUEST_TIMEOUT_MS
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`API ${res.statusCode}: ${data.slice(0, 300)}`));
          return;
        }
        try {
          const result = JSON.parse(data);
          const content = result.output?.choices?.[0]?.message?.content;
          resolve(content || '摘要生成失败');
        } catch (e) {
          reject(new Error(`解析失败：${e.message}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`请求超时 (${REQUEST_TIMEOUT_MS / 1000}s)`));
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ============ 主流程 ============
async function main() {
  const parsed = parseArgs();
  if (!parsed) process.exit(1);

  console.log(`🧾 摘要生成中 (${parsed.length})...\n`);
  const summary = await summarize(parsed.input, parsed.length);
  console.log('📝 摘要:\n');
  console.log(summary);
  console.log('');
}

main().catch(err => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});
