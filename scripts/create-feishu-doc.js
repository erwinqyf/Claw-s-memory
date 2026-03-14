#!/usr/bin/env node
/**
 * 创建并写入飞书文档 - 语言服务监控报告 v2.1
 */

const https = require('https');
const fs = require('fs');

const APP_ID = 'cli_a922b10c2362dbd3';
const APP_SECRET = 'NAcktALvcq9jPbZmWsUcyhQOhMlwlPdQ';

async function main() {
  console.log('📝 创建飞书文档...\n');
  
  // 1. 获取 tenant_access_token
  console.log('1️⃣ 获取 tenant_access_token...');
  const token = await getTenantToken();
  console.log('✅ Token 获取成功\n');
  
  // 2. 创建文档
  console.log('2️⃣ 创建文档...');
  const docInfo = await createDoc(token, '语言服务动态监控周报_20260314');
  console.log('✅ 文档创建成功');
  console.log(`   Doc Token: ${docInfo.obj_token}`);
  console.log(`   链接：https://my.feishu.cn/docs/${docInfo.obj_token}\n`);
  
  // 3. 读取 Markdown 内容
  console.log('3️⃣ 读取 Markdown 内容...');
  const markdown = fs.readFileSync('/home/admin/.openclaw/workspace/reports/language-service-feishu-summary.md', 'utf-8');
  console.log(`✅ 读取成功 (${markdown.length} 字符)\n`);
  
  // 4. 写入文档内容
  console.log('4️⃣ 写入文档内容...');
  await writeDocContent(token, docInfo.obj_token, markdown);
  console.log('✅ 内容写入成功\n');
  
  console.log('🎉 完成！');
  console.log(`📄 文档链接：https://my.feishu.cn/docs/${docInfo.obj_token}`);
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

function createDoc(token, title) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      title: title
    });
    
    const req = https.request({
      hostname: 'open.feishu.cn',
      port: 443,
      path: '/open-apis/docx/v1/documents',
      method: 'POST',
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
            if (result.code === 0 && result.data) {
              console.log('Data keys:', Object.keys(result.data));
              // 修复：document_id 在嵌套的 document 对象中
              const docToken = result.data.document?.document_id || result.data.obj_token;
              resolve({ obj_token: docToken, ...result.data });
            } else {
              reject(new Error(result.msg || 'Create failed'));
            }
          } catch (e) {
            console.log('Parse error:', e.message);
            reject(new Error('Invalid JSON'));
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

function writeDocContent(token, docToken, content) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      content: content
    });
    
    console.log('Writing to:', `/open-apis/docx/v1/documents/${docToken}/raw_content`);
    
    const req = https.request({
      hostname: 'open.feishu.cn',
      port: 443,
      path: `/open-apis/docx/v1/documents/${docToken}/raw_content`,
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
        if (res.statusCode === 200 || res.statusCode === 204) {
          resolve({ message: 'Content updated' });
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
  if (err.message.includes('403') || err.message.includes('permission')) {
    console.log('\n💡 可能需要在飞书开放平台添加权限：');
    console.log('   - docx:document');
    console.log('   - docx:document:create');
    console.log('   - docx:document:write_only');
  }
  process.exit(1);
});
