#!/usr/bin/env node
/**
 * 发送语言服务监控报告到飞书
 */

const https = require('https');

const APP_ID = 'cli_a922b10c2362dbd3';
const APP_SECRET = 'NAcktALvcq9jPbZmWsUcyhQOhMlwlPdQ';

// 获取 tenant_access_token
function getTenantToken() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      app_id: APP_ID,
      app_secret: APP_SECRET
    });

    const options = {
      hostname: 'open.feishu.cn',
      port: 443,
      path: '/open-apis/auth/v3/tenant_access_token/internal',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const result = JSON.parse(body);
        if (result.code === 0) {
          resolve(result.tenant_access_token);
        } else {
          reject(new Error(`获取 token 失败：${result.msg}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// 发送飞书消息
function sendFeishuMessage(token, content) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      receive_id: 'ou_adcbc44a6fb7460391e585338f9e1e35',
      msg_type: 'interactive',
      content: JSON.stringify(content)
    });

    const options = {
      hostname: 'open.feishu.cn',
      port: 443,
      path: '/open-apis/im/v1/messages?receive_id=ou_adcbc44a6fb7460391e585338f9e1e35',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const result = JSON.parse(body);
        if (result.code === 0) {
          resolve(result);
        } else {
          reject(new Error(`发送失败：${result.msg}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// 主流程
async function main() {
  console.log('📤 发送语言服务监控报告到飞书...');
  
  try {
    // 1. 获取 token
    console.log('1️⃣ 获取 tenant_access_token...');
    const token = await getTenantToken();
    console.log(`✅ Token 获取成功`);
    
    // 2. 构建消息内容（使用 text 类型）
    const messageContent = {
      text: '📊 **语言服务动态监控报告** _2026-03-13_\n\n' +
            '**监控概况:**\n• 监控范围：3 个组织 + 49 个公司\n• 新增动态：40 条\n• 抓取成功率：90%+\n\n' +
            '**重点新闻:**\n• TransPerfect 2025 年营收增长 7% 至 13.2 亿美元\n• Smartling 发布 LLM 翻译企业应用指南\n• 多家头部 LSP 发布 AI 相关服务\n\n' +
            '📄 完整报告：https://github.com/erwinqyf/Claw-s-memory/blob/main/reports/language-service-monitor-20260313.md'
    };
    
    // 3. 发送消息
    console.log('2️⃣ 发送飞书消息...');
    
    const data = JSON.stringify({
      receive_id: 'ou_adcbc44a6fb7460391e585338f9e1e35',
      msg_type: 'text',
      content: JSON.stringify(messageContent)
    });

    const options = {
      hostname: 'open.feishu.cn',
      port: 443,
      path: '/open-apis/im/v1/messages?receive_id=ou_adcbc44a6fb7460391e585338f9e1e35',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };

    const result = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          const apiResult = JSON.parse(body);
          if (apiResult.code === 0) {
            resolve(apiResult);
          } else {
            reject(new Error(`发送失败：${apiResult.msg}`));
          }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
    
    console.log(`✅ 消息发送成功！`);
    console.log(`Message ID: ${result.data.message_id}`);
    
  } catch (err) {
    console.error('❌ 错误:', err.message);
    process.exit(1);
  }
}

main();
