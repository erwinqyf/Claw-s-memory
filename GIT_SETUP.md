# Git 远程仓库配置指南

## 🎯 目标
配置 GitHub 认证，推送记忆仓库到远程

---

## 方案一：Personal Access Token（推荐）

### 1. 创建 Token
1. 访问：https://github.com/settings/tokens
2. 点击 **Generate new token (classic)**
3. 填写：
   - **Note**: `OpenClaw Memory Sync - Claw AI Assistant`
   - **Expiration**: `No expiration`（或选择合适期限）
   - **Scopes**: 勾选 `repo`（完整仓库权限）
4. 点击 **Generate token**
5. **复制 Token**（只显示一次！）格式：`ghp_xxxxxxxxxxxx`

### 2. 配置凭证
```bash
# 设置全局凭证（替换 YOUR_TOKEN）
git config --global credential.helper store

# 推送时会提示输入用户名和 Token
cd ~/.openclaw/workspace
git push -u origin master

# 用户名：erwinqyf
# 密码：粘贴刚才复制的 Token（ghp_开头）
```

### 3. 验证
```bash
git push
# 如果成功，说明配置完成
```

---

## 方案二：SSH Key（更安全）

### 1. 生成 SSH Key
```bash
ssh-keygen -t ed25519 -C "claw@openclaw.local"
# 一路回车即可
```

### 2. 添加公钥到 GitHub
```bash
# 查看公钥
cat ~/.ssh/id_ed25519.pub
# 复制输出内容
```

1. 访问：https://github.com/settings/keys
2. 点击 **New SSH key**
3. 填写：
   - **Title**: `OpenClaw Server - Claw AI`
   - **Key**: 粘贴刚才复制的公钥
4. 点击 **Add SSH key**

### 3. 切换远程为 SSH
```bash
cd ~/.openclaw/workspace
git remote set-url origin git@github.com:erwinqyf/Claw-s-memory.git
git push -u origin master
```

---

## 方案三：GitHub CLI（最简单）

### 1. 安装 gh
```bash
# Ubuntu/Debian
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh -y

# 验证
gh --version
```

### 2. 认证
```bash
gh auth login
# 选择：
# - GitHub.com
# - SSH 或 HTTPS
# - 按提示完成浏览器认证
```

### 3. 推送
```bash
cd ~/.openclaw/workspace
git push -u origin master
```

---

## ✅ 验证配置

```bash
# 查看远程仓库
git remote -v

# 推送测试
git push

# 查看 GitHub 仓库
# 访问：https://github.com/erwinqyf/Claw-s-memory
# 应该能看到提交历史
```

---

## 🔧 故障排查

### 问题：认证失败
```bash
# 清除旧凭证
git credential reject
# 输入：
protocol=https
host=github.com

# 重新推送
git push
```

### 问题：权限不足
- 确认 Token 有 `repo` 权限
- 确认你是仓库所有者或有写入权限

### 问题：仓库不存在
```bash
# 在 GitHub 创建仓库后重试
# 或本地创建：
gh repo create erwinqyf/Claw-s-memory --private --source=. --push
```

---

## 📝 下一步

配置完成后，记忆系统会自动：
1. ✅ 会话开始同步远程变更
2. ✅ 记忆更新自动提交推送
3. ✅ 每周日 consolidating 记忆
4. ✅ 多设备记忆保持一致

---

**配置完成后告诉我，我会验证远程同步是否成功！** 🪞
