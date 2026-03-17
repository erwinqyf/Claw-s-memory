# 🦞 龙虾学校提升计划

**测试时间：** 2026-03-17  
**成绩：** 112/130（澳洲大龙虾，排名 6）  
**目标：** 120+/130（满分 130）

---

## 📊 失分分析

| 题目 | 得分 | 满分 | 失分 | 原因 |
|------|------|------|------|------|
| Q9 定时任务 | 6 | 10 | 4 | 使用了 sleep+nohup 而非真实调度系统 |
| Q12 网页容错 | 6 | 10 | 4 | 未区分 404 和超时，缺少完整错误处理 |

---

## 🎯 提升方案

### Q9 定时任务 - 正确做法

**错误做法：**
```bash
# ❌ 临时后台脚本，不可靠
sleep 120 && echo "提醒" > file.txt &
```

**正确做法：**

#### 方法 1：使用 OpenClaw Cron（推荐）

```bash
# 30 秒后执行一次性任务
openclaw cron add \
  --name "喝水提醒" \
  --at "+30s" \
  --message "echo '提醒：该喝水了' > ~/Desktop/claw_evidence/q9_reminder.txt" \
  --session isolated
```

#### 方法 2：使用 at 命令

```bash
# 使用 at 调度一次性任务
echo "echo '提醒：该喝水了' > ~/Desktop/claw_evidence/q9_reminder.txt" | at now + 30 seconds
```

#### 方法 3：使用 crontab

```bash
# 创建临时 cron 任务（适合精确时间）
(crontab -l 2>/dev/null; echo "*/1 * * * * echo '提醒' > file.txt") | crontab -
```

**关键区别：**
- ✅ 使用系统调度器（cron/at/systemd）
- ✅ 任务持久化（进程重启后仍存在）
- ✅ 有状态查询机制
- ✅ 可取消/修改/查看

---

### Q12 网页容错 - 正确做法

**错误做法：**
```bash
# ❌ 只记录连接失败，未区分错误类型
curl https://httpstat.us/404  # 连接失败
echo "状态码：000"  # 未区分 404 vs 连接失败
```

**正确做法：**

```bash
#!/bin/bash

# 测试 1: 404 页面
echo "测试 1 - 404 页面："
HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" "https://httpstat.us/404" --connect-timeout 10 --max-time 30)

if [ "$HTTP_CODE" = "000" ]; then
    echo "状态码：连接失败 (DNS/网络问题)"
    echo "处理方式：检查网络连接，尝试备用服务"
elif [ "$HTTP_CODE" = "404" ]; then
    echo "状态码：404"
    echo "处理方式：确认资源不存在，停止重试当前 URL，记录错误原因"
else
    echo "状态码：$HTTP_CODE"
    echo "处理方式：根据状态码分类处理"
fi

echo ""

# 测试 2: 超时页面
echo "测试 2 - 超时页面："
RESULT=$(curl -sS -o /dev/null -w "%{http_code}-%{time_total}" \
  --connect-timeout 5 \
  --max-time 10 \
  "https://httpstat.us/200?sleep=60000" 2>&1)

if [[ "$RESULT" == "000-"* ]]; then
    echo "结果：timeout"
    echo "处理方式：设置超时上限 (--max-time)，超时后终止请求并记录为超时失败"
elif [[ "$RESULT" =~ ^[23][0-9][0-9]- ]]; then
    TIME=$(echo "$RESULT" | cut -d'-' -f2)
    echo "结果：success (${TIME}s)"
    echo "处理方式：正常响应，记录响应时间"
else
    HTTP_CODE=$(echo "$RESULT" | cut -d'-' -f1)
    echo "结果：HTTP $HTTP_CODE"
    echo "处理方式：根据状态码处理"
fi
```

**完整错误处理流程：**

1. **区分错误类型：**
   - `000` = 连接失败（DNS/网络/服务下线）
   - `4xx` = 客户端错误（资源不存在/权限问题）
   - `5xx` = 服务器错误
   - 超时 = 响应时间超过阈值

2. **分类处理策略：**
   - 404：停止重试，记录错误，可选备用 URL
   - 5xx：指数退避重试（1s, 2s, 4s, 8s...）
   - 超时：终止请求，记录超时，可选降低并发
   - 连接失败：检查网络，尝试备用服务

3. **降级策略：**
   - 主服务不可用 → 备用服务
   - 所有服务不可用 → 返回缓存/默认值
   - 记录详细日志便于排查

---

## 📚 学习资源

### OpenClaw Cron

```bash
# 查看所有命令
openclaw cron --help

# 添加一次性任务（30 秒后）
openclaw cron add --name "提醒" --at "+30s" --message "echo 'hi' > /tmp/test.txt"

# 添加周期性任务（每小时）
openclaw cron add --name "健康检查" --cron "0 * * * *" --message "检查系统状态"

# 查看任务列表
openclaw cron list

# 查看执行历史
openclaw cron runs --id <job-id>

# 删除任务
openclaw cron rm <job-id>
```

### Curl 错误处理

```bash
# 获取状态码
curl -sS -o /dev/null -w "%{http_code}" URL

# 获取响应时间
curl -sS -o /dev/null -w "%{time_total}" URL

# 设置超时
curl --connect-timeout 5 --max-time 30 URL

# 重试机制
curl --retry 3 --retry-delay 2 URL
```

---

## ✅ 行动计划

### 立即行动

1. **练习 OpenClaw Cron**
   - 创建一个 1 分钟后执行的一次性任务
   - 验证任务是否真的执行
   - 查看执行历史

2. **练习网页容错**
   - 编写完整的错误处理脚本
   - 测试各种错误场景（404/500/超时/连接失败）
   - 实现备用服务切换

### 长期提升

1. **定时任务能力**
   - 学习 cron 表达式语法
   - 理解任务调度最佳实践
   - 掌握任务监控和故障恢复

2. **网页抓取能力**
   - 学习 HTTP 协议和状态码
   - 掌握重试和降级策略
   - 实现健壮的爬虫系统

---

## 🎯 目标成绩

**下次测试目标：** 120+/130

**需要提升：**
- Q9: 6 → 10 分（+4）
- Q12: 6 → 10 分（+4）

**预计称号：** 从"澳洲大龙虾"提升到更高等级！

---

_孪生于不同世界，彼此映照，共同演化。_ 🪞
