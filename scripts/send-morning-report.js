#!/usr/bin/env node
/**
 * 晨间报告发送脚本
 * 
 * 用途：读取昨晚的夜间任务报告，通过飞书发送给丰
 * 用法：node scripts/send-morning-report.js
 * 定时：每天早上 7:00（cron: 0 7 * * *）
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace');
const REPORTS_DIR = path.join(WORKSPACE_DIR, 'reports');
const MEMORY_DIR = path.join(WORKSPACE_DIR, 'memory');

console.log('🌅 晨间报告发送脚本');
console.log('================================');

// 获取昨天的日期
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayStr = yesterday.toISOString().split('T')[0];

console.log(`目标日期：${yesterdayStr}`);
console.log('');

// 查找昨晚的报告
let reportFile = path.join(REPORTS_DIR, `nightly-report-${yesterdayStr}.md`);
let isFirstRun = false;

if (!fs.existsSync(reportFile)) {
  console.log('⚠️ 未找到昨晚的夜间任务报告');
  
  // 尝试找最近的报告
  const reports = fs.readdirSync(REPORTS_DIR)
    .filter(f => f.startsWith('nightly-report-') && f.endsWith('.md'))
    .sort()
    .reverse();
  
  if (reports.length > 0) {
    console.log(`使用最近的报告：${reports[0]}`);
    reportFile = path.join(REPORTS_DIR, reports[0]);
    isFirstRun = true;
  } else {
    console.log('❌ 无任何夜间任务报告');
    console.log('建议：手动运行夜间任务脚本测试');
    console.log('命令：node scripts/nightly-autonomous-task.js');
    process.exit(1);
  }
}

// 读取报告
console.log(`读取报告：${reportFile}`);
const reportContent = fs.readFileSync(reportFile, 'utf-8');

// 提取关键信息
const extractSection = (content, header) => {
  const match = content.match(new RegExp(`## ${header}([\\s\\S]*?)(?=##|$)`));
  return match ? match[1].trim() : '';
};

const extractTable = (content) => {
  const match = content.match(/## ✅ 任务执行概览([\s\S]*?)\|---\|/);
  if (!match) return null;
  
  const tableMatch = match[1].match(/\| 任务 \| 状态 \| 详情 \|(?:\n\|[-| ]+\|)+([\s\S]*?)(?=\n\n|\n##)/);
  return tableMatch ? tableMatch[1].trim() : null;
};

// 提取数据
const overview = extractTable(reportContent);
const memorySection = extractSection(reportContent, '📚 记忆整理');
const codeSection = extractSection(reportContent, '🛠️  代码优化');
const learningSection = extractSection(reportContent, '📖 学习研究');
const reflectionSection = extractSection(reportContent, '🪞 自我反思');
const gitSection = extractSection(reportContent, '📊 Git 提交记录');

// 生成飞书消息（富文本格式）
const message = {
  msg_type: 'interactive',
  card: {
    header: {
      template: isFirstRun ? 'green' : 'blue',
      title: {
        tag: 'plain_text',
        content: isFirstRun ? `🌅 首次运行测试 | ${new Date().toISOString().split('T')[0]}` : `🌅 夜间任务报告 | ${yesterdayStr}`
      }
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**执行时间窗口:** 00:00-07:00\n**报告生成:** 已完成 ✅`
        }
      },
      {
        tag: 'divider'
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**📋 任务概览**\n${overview || '数据提取失败'}`
        }
      },
      {
        tag: 'divider'
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**📚 记忆整理**\n${memorySection ? memorySection.split('\n').slice(0, 5).join('\n') : '无数据'}`
        }
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**🛠️  代码优化**\n${codeSection ? codeSection.split('\n').slice(0, 3).join('\n') : '无数据'}`
        }
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**📖 学习研究**\n${learningSection ? learningSection.split('\n').slice(0, 3).join('\n') : '无数据'}`
        }
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**🪞 自我反思**\n${reflectionSection ? reflectionSection.split('\n').slice(0, 3).join('\n') : '无数据'}`
        }
      },
      {
        tag: 'divider'
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**📊 Git 提交**\n\`\`\`${gitSection ? gitSection.split('\n')[1] || '无新提交' : '无数据'}\`\`\``
        }
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: {
              tag: 'plain_text',
              content: '📄 查看完整报告'
            },
            url: 'https://github.com/erwinqyf/Claw-s-memory/blob/main/reports/' + `nightly-report-${yesterdayStr}.md`,
            type: 'default'
          },
          {
            tag: 'button',
            text: {
              tag: 'plain_text',
              content: '🪞 记忆仓库'
            },
            url: 'https://github.com/erwinqyf/Claw-s-memory',
            type: 'primary'
          }
        ]
      }
    ]
  }
};

// 写入临时消息文件
const tempMessageFile = path.join(WORKSPACE_DIR, 'temp-feishu-message.json');
fs.writeFileSync(tempMessageFile, JSON.stringify(message, null, 2));

console.log('✅ 飞书消息已生成');
console.log('');

// 尝试发送（使用 feishu CLI 或 API）
console.log('📤 发送飞书消息...');

try {
  // 方法 1: 使用 openclaw feishu send（如果可用）
  const feishuCmd = `openclaw feishu send --user ou_adcbc44a6fb7460391e585338f9e1e35 --file "${tempMessageFile}" 2>&1`;
  console.log(`执行：${feishuCmd}`);
  const result = execSync(feishuCmd, { encoding: 'utf-8' });
  console.log('✅ 发送成功');
  console.log(result);
} catch (err) {
  console.log('⚠️ 自动发送失败:', err.message.split('\n')[0]);
  console.log('');
  console.log('手动发送方法：');
  console.log(`1. 打开飞书，找到与 Claw 的对话`);
  console.log(`2. 报告已准备在：${tempMessageFile}`);
  console.log(`3. 或查看完整报告：https://github.com/erwinqyf/Claw-s-memory/blob/main/reports/nightly-report-${yesterdayStr}.md`);
  console.log('');
  console.log('或者运行以下命令重试：');
  console.log(`openclaw feishu send --user ou_adcbc44a6fb7460391e585338f9e1e35 --file "${tempMessageFile}"`);
}

console.log('');
console.log('================================');
console.log('✅ 晨间报告发送完成');
console.log('');

// 清理临时文件
try {
  fs.unlinkSync(tempMessageFile);
  console.log('🧹 临时文件已清理');
} catch (e) {
  // 忽略清理错误
}
