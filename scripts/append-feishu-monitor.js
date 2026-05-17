#!/usr/bin/env node
/**
 * 语言服务监控 - 追加内容到飞书文档
 * 使用 Feishu Open API 直接追加内容
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// 飞书应用凭证
const APP_ID = 'cli_a922b10c2362dbd3';
const APP_SECRET = 'NAcktALvcq9jPbZmWsUcyhQOhMlwlPdQ';

// 目标文档
const DOC_TOKEN = 'YAvmduy76ozX4bxLzOzcBA0Nnsb';

// 要追加的内容
const CONTENT_TO_APPEND = `
---

## 📅 2026 年 3 月 28 日 上午 11:04 更新

**本次发现:** 3 条新动态

### Phrase

- **Localization strategy** - Phrase 博客分类更新
  📅 2026-03-28 | https://phrase.com/blog/?query-1-category_name[0]=localization-strategy

- **Software localization** - Phrase 博客分类更新
  📅 2026-03-28 | https://phrase.com/blog/?query-1-category_name[0]=software-localization

- **Translation management** - Phrase 博客分类更新
  📅 2026-03-28 | https://phrase.com/blog/?query-1-category_name[0]=translation-management

---
`;

async function main() {
  console.log('📝 语言服务监控 - 追加飞书文档');
  console.log('================================\n');
  
  try {
    // 1. 获取 tenant_access_token
    console.log('1️⃣ 获取 tenant_access_token...');
    const token = await getTenantToken();
    console.log('✅ Token 获取成功\n');
    
    // 2. 直接追加内容 (使用 append 接口)
    console.log('2️⃣ 追加新内容到文档...');
    await appendDoc(token, DOC_TOKEN, CONTENT_TO_APPEND);
    console.log('✅ 追加成功\n');
    
    console.log('================================');
    console.log('✅ 飞书文档更新完成');
    console.log(`📄 文档链接：https://my.feishu.cn/docx/${DOC_TOKEN}`);
    
  } catch (err) {
    console.error('❌ 错误:', err.message);
    process.exit(1);
  }
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
        if (result.code === 0) {
          resolve(result.tenant_access_token);
        } else {
          reject(new Error(result.msg || 'Failed to get token'));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function readDoc(token, docToken) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'open.feishu.cn',
      port: 443,
      path: `/open-apis/docx/v1/documents/${docToken}/content`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const result = JSON.parse(body);
            // Feishu returns content in different formats, extract plain text
            if (result.data && result.data.content) {
              resolve(result.data.content);
            } else if (result.content) {
              resolve(result.content);
            } else {
              resolve(body);
            }
          } catch (e) {
            resolve(body);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function writeDoc(token, docToken, content) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ content: content });
    
    const req = https.request({
      hostname: 'open.feishu.cn',
      port: 443,
      path: `/open-apis/docx/v1/documents/${docToken}/content`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const result = JSON.parse(body);
            if (result.code === 0) {
              resolve(result);
            } else {
              resolve({ message: 'Content updated' });
            }
          } catch (e) {
            resolve({ message: 'Content updated' });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function appendDoc(token, docToken, content) {
  return new Promise((resolve, reject) => {
    // 先获取当前内容，然后追加
    // 使用 docx 内容接口
    const getData = JSON.stringify({});
    
    // 第一步：获取文档内容
    const req1 = https.request({
      hostname: 'open.feishu.cn',
      port: 443,
      path: `/open-apis/docx/v1/documents/${docToken}/raw_content`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('Read HTTP Status:', res.statusCode);
        
        let currentContent = '';
        if (res.statusCode === 200) {
          console.log('Read response:', body.slice(0, 500));
          try {
            const result = JSON.parse(body);
            currentContent = result.data?.content || result.content || body;
          } catch (e) {
            currentContent = body;
          }
        }
        
        // 第二步：使用 blocks API 追加内容
        // Feishu docx API 使用 blocks 格式
        const blocks = [
          {
            block_type: "text",
            text: {
              style: {},
              elements: [{ text_run: { text: content, style: {} } }]
            }
          }
        ];
        const postData = JSON.stringify({ blocks: blocks });
        
        // 使用 blocks 批量追加端点
        const req2 = https.request({
          hostname: 'open.feishu.cn',
          port: 443,
          path: `/open-apis/docx/v1/documents/${docToken}/blocks`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }, (res2) => {
          let body2 = '';
          res2.on('data', chunk => body2 += chunk);
          res2.on('end', () => {
            console.log('Write HTTP Status:', res2.statusCode);
            console.log('Response:', body2.slice(0, 300));
            
            if (res2.statusCode === 200) {
              resolve({ message: 'Content updated' });
            } else {
              reject(new Error(`HTTP ${res2.statusCode}: ${body2.slice(0, 200)}`));
            }
          });
        });
        req2.on('error', reject);
        req2.write(postData);
        req2.end();
      });
    });
    req1.on('error', reject);
    req1.write(getData);
    req1.end();
  });
}

main();
