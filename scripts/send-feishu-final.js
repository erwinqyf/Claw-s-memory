#!/usr/bin/env node
/**
 * 发送飞书消息 - 语言服务监控报告 v2.1
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
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: '# 📊 语言服务动态监控周报\n**日期:** 2026-03-14 | **版本:** v2.1 增强版'
        }
      },
      {
        tag: 'hr'
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: '**📈 监控概况**\n• 新增动态：37 条\n• 趋势发现：TransPerfect (AI/ML 相关度高)\n• 抓取成功：6 个网站\n• 抓取失败：3 个网站'
        }
      },
      {
        tag: 'hr'
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: '**🔥 重点动态**\n• Slator: 7 条行业活动和资源\n• TransPerfect: 10 条 (AI 翻译、视频翻译)\n• RWS: 7 条 (AI 服务、本地化)\n• Rask AI: 10 条 (免费翻译工具)'
        }
      },
      {
        tag: 'hr'
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: '**⚠️ 监控问题**\n• Nimdzi: 404\n• Multilingual: 403\n• DeepL: URL 错误'
        }
      },
      {
        tag: 'action',
        elements: [
          {
            tag: 'button',
            text: {
              tag: 'plain_text',
              content: '📄 GitHub 完整报告'
            },
            url: 'https://github.com/erwinqyf/Claw-s-memory/blob/main/reports/language-service-monitor-20260314-v2.md',
            type: 'primary'
          },
          {
            tag: 'button',
            text: {
              tag: 'plain_text',
              content: '🪞 飞书文档'
            },
            url: 'https://my.feishu.cn/wiki/J2Zhwn3mxiT6LckgkNbcyGvinid',
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
      msg_type: 'interactive',
      content: JSON.stringify(content)
    });
    
    const req = https.request({
      hostname: 'open.feishu.cn',
      port: 443,
      path: '/open-apis/im/v1/messages?receive_id_type=' + idType,
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
        if (result.code === 0) {
          resolve(result);
        } else {
          console.log('API Response:', JSON.stringify(result, null, 2));
          reject(new Error(result.msg || 'Unknown error'));
        }
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
