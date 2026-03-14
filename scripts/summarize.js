#!/usr/bin/env node
/**
 * 简易 URL/文本摘要工具（Linux 版）
 * 使用 DashScope API (通义千问) 生成摘要
 * 
 * 用法:
 *   node summarize.js "文本" [--length short|medium|long]
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// API 配置
const API_KEY = 'sk-sp-2da1c944331b49c7b0bed33ca31e6830';
const MODEL = 'qwen-plus';

// 解析参数
const args = process.argv.slice(2);
let length = 'medium';
let input = args[0];

for (let i = 1; i < args.length; i++) {
  if (args[i] === '--length' && args[i + 1]) {
    length = args[++i];
  }
}

if (!input) {
  console.log('用法：node summarize.js <文本> [--length short|medium|long]');
  process.exit(1);
}

// 调用 DashScope API
async function summarize(text, len) {
  const lengthPrompt = {
    short: '用 1-2 句话简要概括',
    medium: '用 3-5 句话概括主要内容',
    long: '详细总结，包含关键点和结论'
  }[len] || '概括主要内容';

  const body = JSON.stringify({
    model: MODEL,
    input: {
      messages: [
        { role: 'system', content: '你是一个专业的内容摘要助手。' },
        { role: 'user', content: `${lengthPrompt}：\n\n${text.slice(0, 8000)}` }
      ]
    },
    parameters: {
      result_format: 'message',
      max_tokens: 500
    }
  });

  return new Promise((resolve, reject) => {
    const req = https.request('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
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
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// 主流程
async function main() {
  console.log('🧾 摘要生成中...\n');
  const summary = await summarize(input, length);
  console.log('📝 摘要:\n');
  console.log(summary);
  console.log('');
}

main().catch(err => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});
