#!/usr/bin/env python3
"""
内容验证工具 - 批量检查链接可访问性
"""

import sys
import requests
import re
from concurrent.futures import ThreadPoolExecutor, as_completed

def extract_links(markdown_file):
    """从 Markdown 文件中提取链接"""
    with open(markdown_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 匹配 Markdown 链接格式 [text](url)
    pattern = r'\[([^\]]+)\]\(([^)]+)\)'
    links = re.findall(pattern, content)
    return links

def check_link(url, timeout=10):
    """检查单个链接的 HTTP 状态码"""
    try:
        # 使用 HEAD 请求减少流量
        response = requests.head(url, timeout=timeout, allow_redirects=True)
        return {
            'url': url,
            'status': response.status_code,
            'accessible': response.status_code == 200,
            'error': None
        }
    except requests.exceptions.RequestException as e:
        return {
            'url': url,
            'status': None,
            'accessible': False,
            'error': str(e)
        }

def main():
    if len(sys.argv) < 2:
        print("用法：python3 verify-links.py <markdown 文件>")
        sys.exit(1)
    
    markdown_file = sys.argv[1]
    
    print(f"🔍 正在检查文件：{markdown_file}")
    print("=" * 60)
    
    links = extract_links(markdown_file)
    
    if not links:
        print("❌ 未找到任何链接")
        sys.exit(0)
    
    print(f"📊 找到 {len(links)} 个链接，开始验证...\n")
    
    results = []
    
    # 并发检查（最多 5 个线程）
    with ThreadPoolExecutor(max_workers=5) as executor:
        future_to_url = {executor.submit(check_link, url): url for text, url in links}
        
        for future in as_completed(future_to_url):
            result = future.result()
            results.append(result)
            
            status_icon = "✅" if result['accessible'] else "❌"
            status_code = result['status'] if result['status'] else "N/A"
            
            print(f"{status_icon} [{status_code}] {result['url']}")
            
            if result['error']:
                print(f"   错误：{result['error']}")
    
    # 汇总统计
    print("\n" + "=" * 60)
    print("📊 验证结果汇总")
    print("=" * 60)
    
    accessible_count = sum(1 for r in results if r['accessible'])
    failed_count = len(results) - accessible_count
    
    print(f"总链接数：{len(results)}")
    print(f"✅ 可访问：{accessible_count}")
    print(f"❌ 失效：{failed_count}")
    
    if failed_count > 0:
        print(f"\n⚠️ 警告：{failed_count} 个链接失效，请检查后再发布！")
        sys.exit(1)
    else:
        print(f"\n✅ 所有链接均可访问，可以发布！")
        sys.exit(0)

if __name__ == "__main__":
    main()
