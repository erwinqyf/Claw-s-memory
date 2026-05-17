#!/usr/bin/env node
/**
 * 写入飞书文档 - 语言服务监控报告 v2.1
 */

const https = require('https');
const fs = require('fs');

const APP_ID = 'cli_a922b10c2362dbd3';
const APP_SECRET = 'NAcktALvcq9jPbZmWsUcyhQOhMlwlPdQ';
const DOC_TOKEN = 'IuVJdqS6uoYWOWxEz60cgfWXnh7';

async function main() {
  console.log('📝 写入飞书文档...\n');
  
  // 1. 获取 tenant_access_token
  console.log('1️⃣ 获取 tenant_access_token...');
  const token = await getTenantToken();
  console.log('✅ Token 获取成功\n');
  
  // 2. 读取 Markdown 内容
  console.log('2️⃣ 读取 Markdown 内容...');
  const markdown = fs.readFileSync('/home/admin/.openclaw/workspace/reports/language-service-feishu-summary.md', 'utf-8');
  console.log(`✅ 读取成功 (${markdown.length} 字符)\n`);
  
  // 3. 写入飞书文档
  console.log('3️⃣ 写入飞书文档...');
  const result = await writeDoc(token, DOC_TOKEN, markdown);
  console.log('\n✅ 文档写入成功！');
  console.log(`Doc Token: ${DOC_TOKEN}`);
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

function writeDoc(token, docToken, content) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      content: content
    });
    
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
        console.log('HTTP Status:', res.statusCode);
        console.log('Response:', body.slice(0, 500));
        
        if (res.statusCode === 200) {
          try {
            const result = JSON.parse(body);
            result.code === 0 ? resolve(result) : reject(new Error(result.msg));
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

main().catch(err => {
  console.error('❌ 错误:', err.message);
  console.error('\n完整错误:', err);
  process.exit(1);
});
