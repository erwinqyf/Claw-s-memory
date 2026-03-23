#!/usr/bin/env python3
"""
小红书封面图生成器 - 通义万相版本
生成 3 个版本的封面图（3:4 竖屏比例）
"""

import os
import json
import requests
from datetime import datetime

# API 配置
DASHSCOPE_API_KEY = "sk-sp-2da1c944331b49c7b0bed33ca31e6830"
OUTPUT_DIR = "/home/admin/.openclaw/workspace/output/xiaohongshu/covers"

# 确保输出目录存在
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 通义万相 API endpoint
URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"

# 3 个封面设计方案
prompts = {
    "cover-a": {
        "name": "版本 A - 对比图",
        "prompt": "专业社交媒体封面图，竖屏 3:4 比例。左侧绿色上升箭头和文字'+18%'加微笑表情，右侧红色下降箭头和文字'-12%'加沮丧表情，中间用 AI 机器人图标分隔。深灰色渐变背景。顶部大字'AI 翻译生产力 +40%'，底部小字'不会用=少赚 12%'。科技蓝和警示橙作为强调色。干净现代的数据可视化风格，高清专业。",
        "size": "1242x1660"
    },
    "cover-b": {
        "name": "版本 B - 极简风",
        "prompt": "极简主义社交媒体封面，竖屏 3:4 比例。单个 AI 机器人手持翻译文档，背景放射光线。纯黑色背景。顶部霓虹蓝色大字'AI 翻译生产力'，中央超大'+40%'使用霓虹蓝和荧光绿渐变。底部现代无衬线字体'不会用=少赚 12%'。赛博朋克美学，干净大胆，高清专业。",
        "size": "1242x1660"
    },
    "cover-c": {
        "name": "版本 C - 数据图表风",
        "prompt": "数据图表风格社交媒体封面，竖屏 3:4 比例。柱状图对比，左侧高柱 18% 蓝绿渐变，右侧矮柱 -12% 红橙渐变。白色到浅灰渐变背景。顶部文字'2025 译员收入报告'，图表上方'你会用 AI 吗？'，底部'现在学习还不晚'。专业商务图表风格，干净排版，现代企业美学，高清专业。",
        "size": "1242x1660"
    }
}

def generate_image(name, config):
    """调用通义万相 API 生成图片"""
    print(f"\n🎨 正在生成 {config['name']}...")
    
    headers = {
        "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable"
    }
    
    payload = {
        "model": "wanx-v1",
        "input": {
            "prompt": config["prompt"]
        },
        "parameters": {
            "size": config["size"],
            "n": 1,
            "style": "<cartoon>",
            "format": "png"
        }
    }
    
    try:
        # 提交生成任务
        response = requests.post(URL, headers=headers, json=payload)
        response.raise_for_status()
        result = response.json()
        
        print(f"   提交成功，任务 ID: {result.get('request_id', 'N/A')}")
        
        # 通义万相是异步 API，需要轮询结果
        if "output" in result and "task_id" in result["output"]:
            task_id = result["output"]["task_id"]
            return poll_task(task_id, name)
        else:
            print(f"   ⚠️ 响应格式异常：{result}")
            return None
            
    except Exception as e:
        print(f"   ❌ 生成失败：{e}")
        return None

def poll_task(task_id, name):
    """轮询异步任务结果"""
    import time
    
    task_url = f"https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}"
    headers = {"Authorization": f"Bearer {DASHSCOPE_API_KEY}"}
    
    max_attempts = 30
    for i in range(max_attempts):
        time.sleep(2)
        
        try:
            response = requests.get(task_url, headers=headers)
            response.raise_for_status()
            result = response.json()
            
            task_status = result.get("output", {}).get("task_status", "")
            
            if task_status == "SUCCEEDED":
                # 获取图片 URL
                img_url = result.get("output", {}).get("results", [{}])[0].get("url", "")
                if img_url:
                    return download_image(img_url, name)
                else:
                    print(f"   ⚠️ 未找到图片 URL")
                    return None
            elif task_status in ["FAILED", "CANCELED"]:
                print(f"   ❌ 任务失败：{result.get('output', {}).get('message', 'Unknown error')}")
                return None
            else:
                print(f"   等待中... ({i+1}/{max_attempts})")
                
        except Exception as e:
            print(f"   ⚠️ 轮询失败：{e}")
            continue
    
    print(f"   ⚠️ 轮询超时")
    return None

def download_image(url, name):
    """下载图片到本地"""
    try:
        response = requests.get(url)
        response.raise_for_status()
        
        filename = f"{name}.png"
        filepath = os.path.join(OUTPUT_DIR, filename)
        
        with open(filepath, "wb") as f:
            f.write(response.content)
        
        print(f"   ✅ 保存成功：{filepath}")
        return filepath
        
    except Exception as e:
        print(f"   ❌ 下载失败：{e}")
        return None

def main():
    print("=" * 60)
    print("🎨 小红书封面图生成器 - 通义万相版本")
    print("=" * 60)
    
    results = {}
    
    for name, config in prompts.items():
        filepath = generate_image(name, config)
        results[name] = filepath
    
    # 生成结果报告
    report = generate_report(results)
    print(f"\n📊 生成报告已保存：{report}")
    
    print("\n" + "=" * 60)
    print("✅ 所有封面图生成完成！")
    print("=" * 60)

def generate_report(results):
    """生成结果报告"""
    report_path = os.path.join(OUTPUT_DIR, "wanx-results.md")
    
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("# 小红书封面图生成结果\n\n")
        f.write(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write("**工具**: 通义万相 (wanx-v1)\n\n")
        
        f.write("## 生成结果\n\n")
        for name, filepath in results.items():
            if filepath:
                f.write(f"### ✅ {name}\n")
                f.write(f"- 文件：`{filepath}`\n")
                f.write(f"- 状态：生成成功\n\n")
            else:
                f.write(f"### ❌ {name}\n")
                f.write(f"- 状态：生成失败\n\n")
        
        f.write("## 使用说明\n\n")
        f.write("1. 查看生成的封面图\n")
        f.write("2. 选择最喜欢的版本\n")
        f.write("3. 复制文案和标签到小红书发布\n\n")
        
        f.write("## 文案内容\n\n")
        f.write("```text\n")
        f.write("翻译行业正在经历大洗牌。有人收入暴涨，有人被迫转行，差距全在会不会用 AI。\n\n")
        f.write("1️⃣ 游戏本地化是最大风口\n\n")
        f.write("中国游戏出海本地化市场突破 120 亿美元，同比增长 35%。日本、韩国、东南亚是主战场。AI 辅助翻译渗透率已达 67%，但人工审校仍是刚需。\n\n")
        f.write("机会点：掌握\"AI 初译 + 人工精校\"工作流的译员，在游戏、医疗、法律领域溢价明显。纯人工翻译费率持续承压。\n\n")
        f.write("2️⃣ 收入两极分化触目惊心\n\n")
        f.write("2025 年 TOP 20% 译员平均收入增长 18%，底部 40% 反而下降 12%。差距在哪？会不会用 AI 工具。\n\n")
        f.write("投资 AI 工作流学习不是可选项，是生存必需。差异化定位=垂直领域+AI 工作流。\n\n")
        f.write("3️⃣ AI 工具实操建议\n\n")
        f.write("SDL Trados Studio 2026 原生集成 MCP 服务器，测试显示生产力提升 40%。Smartling 支持 50+ 平台实时翻译同步，内容更新 30 秒内完成多语言发布。\n\n")
        f.write("行动清单：学习提示词工程、建立审校流程、掌握后编辑技巧。欧盟新规 2027 年生效，AI 翻译必须标注 + 人工复核留痕。\n\n")
        f.write("翻译不会被 AI 取代，但会被会用 AI 的人取代。现在就开始投资自己的工作流。\n")
        f.write("```\n\n")
        
        f.write("## 标签\n\n")
        f.write("#翻译行业 #游戏本地化 #AI 翻译 #自由职业 #译员收入 #语言服务 #Trados #职业规划 #出海本地化 #人工智能\n")
    
    return report_path

if __name__ == "__main__":
    main()
