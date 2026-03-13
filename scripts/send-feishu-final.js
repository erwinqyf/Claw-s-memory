#!/usr/bin/env node
/**
 * 发送飞书消息 - 使用正确的 API 格式
 */

const https = require('https');

const APP_ID = 'cli_a922b10c2362dbd3';
const APP_SECRET = 'NAcktALvcq9jPbZmWsUcyhQOhMlwlPdQ';
const OPEN_ID = 'ou_adcbc44a6fb7460391e585338f9e1e35';

async function main() {
  console.log('📤 发送语言服务监控报告到飞书...\n');
  
  // 1. 获取 tenant_access_token
  console.log('1️⃣ 获取 tenant_access_token...');
  const token = await getTenantToken();
  console.log('✅ Token 获取成功\n');
  
  // 2. 发送卡片消息
  console.log('2️⃣ 发送卡片消息...');
  const card = {
    config: {
      wide_screen_mode: true
    },
    elements: [
      {
        tag: 'header',
        template: 'blue',
        title: {
          tag: 'plain_text',
          content: '📊 语言服务动态监控报告'
        }
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: '**日期:** 2026-03-13\n**监控范围:** 3 个组织 + 49 个公司\n**新增动态:** 40 条\n**成功率:** 90%+'
        }
      },
      {
        tag: 'divider'
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: '**重点新闻:**\n• TransPerfect 2025 年营收增长 7% 至 13.2 亿美元\n• Smartling 发布 LLM 翻译企业应用指南\n• 多家头部 LSP 发布 AI 相关服务'
        }
      },
      {
        tag: 'divider'
      },
      {
        tag: 'action',
        elements: [
          {
            tag: 'button',
            text: {
              tag: 'plain_text',
              content: '📄 查看完整报告'
            },
            url: 'https://github.com/erwinqyf/Claw-s-memory/blob/main/reports/language-service-monitor-20260313.md',
            type: 'default'
          }
        ]
      }
    ]
  };
  
  const result = await sendMessage(token, OPEN_ID, 'open_id', card);
  console.log('\n✅ 消息发送成功！');
  console.log(`Message ID: ${result.data.message_id}`);
}

function getTenantToken() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET });
    const req = https.request({
      hostname: 'open.feishu.cn',
      port: 443,
      path: '/open-apis/auth/v3/tenant_access_token/internal',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const result = JSON.parse(body);
        result.code === 0 ? resolve(result.tenant_access_token) : reject(new Error(result.msg));
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sendMessage(token, receiveId, idType, content) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      receive_id: receiveId,
      receive_id_type: idType,
      msg_type: 'interactive',
      content: JSON.stringify(content)
    });
    
    const req = https.request({
      hostname: 'open.feishu.cn',
      port: 443,
      path: '/open-apis/im/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const result = JSON.parse(body);
        result.code === 0 ? resolve(result) : reject(new Error(result.msg));
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

main().catch(err => {
  console.error('❌ 错误:', err.message);
  console.error('\n完整错误:', err);
  process.exit(1);
});
