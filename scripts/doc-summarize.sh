#!/usr/bin/env bash
# 文档摘要工具 - 基于 doc-summarize-pro
# 用法：bash doc-summarize.sh <mode> "文本内容"
# mode: summarize|bullet|executive|chapter|compare|action|timeline

set -euo pipefail

MODE="${1:-summarize}"
shift || true
INPUT="${*:-}"

if [ -z "$INPUT" ]; then
  echo "用法：bash doc-summarize.sh <mode> \"文本内容\""
  echo "mode: summarize|bullet|executive|chapter|compare|action|timeline"
  exit 1
fi

python3 - "$MODE" "$INPUT" << 'PYEOF'
import sys
import textwrap
import re

mode = sys.argv[1]
inp = sys.argv[2] if len(sys.argv) > 2 else ""

def print_header(title):
    print("=" * 60)
    print(f"  {title}")
    print("=" * 60)
    print()

if mode == "summarize":
    print_header("DOCUMENT SUMMARY")
    print(f"Input length: {len(inp)} characters")
    print("-" * 40)
    print(textwrap.fill(inp[:500], width=70))
    if len(inp) > 500:
        print("... [truncated]")
    print()
    print("SUMMARY:")
    print("-" * 40)
    sentences = [s.strip() for s in inp.replace("!", ".").replace("?", ".").split(".") if s.strip()]
    total = len(sentences)
    keep = max(1, total // 3)
    for s in sentences[:keep]:
        print(textwrap.fill(s + ".", width=70))
    print()
    print(f"Word count: {len(inp.split())} -> ~{len(' '.join(sentences[:keep]).split())}")

elif mode == "bullet":
    print_header("KEY POINTS EXTRACTION")
    sentences = [s.strip() for s in inp.replace("!", ".").replace("?", ".").split(".") if len(s.strip()) > 5]
    for i, s in enumerate(sentences[:10], 1):
        print(f"  {i}. {s.strip()}")
    print()
    print(f"Total points extracted: {min(len(sentences), 10)}")

elif mode == "executive":
    print_header("EXECUTIVE SUMMARY")
    sentences = [s.strip() for s in inp.replace("!", ".").replace("?", ".").split(".") if s.strip()]
    print("[CONCLUSION]")
    if sentences:
        print(textwrap.fill(sentences[-1] + ".", width=70))
    print()
    print("[KEY FINDINGS]")
    for s in sentences[:3]:
        print(f"  - {s}")
    print()
    print("[RECOMMENDATION]")
    print("  Based on the above findings, further review is recommended.")
    print()
    print(f"Document stats: {len(inp.split())} words | {len(sentences)} sentences")

elif mode == "chapter":
    print_header("CHAPTER BREAKDOWN")
    paragraphs = [p.strip() for p in inp.split("\n\n") if p.strip()]
    if len(paragraphs) <= 1:
        paragraphs = [p.strip() for p in inp.split("\n") if p.strip()]
    for i, p in enumerate(paragraphs[:8], 1):
        print(f"Chapter {i}:")
        summary = p[:120] + ("..." if len(p) > 120 else "")
        print(f"  {summary}")
        print()
    print(f"Total chapters identified: {min(len(paragraphs), 8)}")

elif mode == "action":
    print_header("ACTION ITEMS EXTRACTION")
    keywords = ["need", "should", "must", "will", "todo", "action", "follow up",
                "deadline", "assign", "complete", "deliver", "review", "approve"]
    sentences = [s.strip() for s in inp.replace("!", ".").replace("?", ".").split(".") if s.strip()]
    actions = [s for s in sentences if any(k in s.lower() for k in keywords)]
    if not actions:
        actions = sentences[:3]
    print(f"Action Items Found: {len(actions)}")
    print("-" * 40)
    for i, a in enumerate(actions[:10], 1):
        print(f"  [ ] {i}. {a}")

elif mode == "timeline":
    print_header("TIMELINE EXTRACTION")
    date_pattern = re.compile(r'\d{4}[-/]\d{1,2}[-/]\d{1,2}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}')
    sentences = inp.split(".")
    events = [(date_pattern.findall(s)[0], s.strip()) for s in sentences if date_pattern.findall(s)]
    if events:
        for date, event in events[:15]:
            print(f"  [{date}] {event[:80]}")
    else:
        print("  No dates detected. Showing sequential events:")
        lines = [l.strip() for l in inp.split("\n") if l.strip()]
        for i, l in enumerate(lines[:10], 1):
            print(f"  [Event {i}] {l[:80]}")
    print(f"\nTotal events: {len(events) if events else min(len(inp.split(chr(10))), 10)}")

else:
    print("Unknown mode. Available: summarize|bullet|executive|chapter|compare|action|timeline")
    sys.exit(1)

print()
print("Powered by BytesAgain | bytesagain.com | hello@bytesagain.com")
PYEOF
