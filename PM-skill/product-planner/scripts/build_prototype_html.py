#!/usr/bin/env python3
"""
MD 原型描述 -> HTML 交互原型生成器

读取页面原型 Markdown 描述文件，生成基于 Tailwind CSS 的多页面可交互 HTML 原型。
自动生成侧边导航栏、页面间跳转链接，模拟真实产品体验。

用法：
  python scripts/build_prototype_html.py <pages.md> [--out <output-dir>]

输出：
  <output-dir>/index.html      - 主页（重定向至第一个页面）
  <output-dir>/pages/p01.html  - 各页面文件
  <output-dir>/nav.html        - 导航框架（可嵌入）

依赖：Python 标准库，无需额外安装
"""

import re
import sys
import argparse
from pathlib import Path
from datetime import datetime


# ── Tailwind CDN 与基础样式 ─────────────────────────────────
TAILWIND_CDN = '<script src="https://cdn.tailwindcss.com"></script>'

BASE_STYLES = """
<style>
  body { font-family: "Microsoft YaHei", "微软雅黑", sans-serif; }
  .sidebar { min-height: 100vh; }
  .page-active { background-color: #EFF6FF; color: #1D4ED8; font-weight: 600; }
  .nav-item:hover { background-color: #F3F4F6; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #E5E7EB; padding: 8px 12px; text-align: left; }
  th { background-color: #F9FAFB; font-weight: 600; }
  tr:nth-child(even) { background-color: #F9FAFB; }
  .badge-p0 { background: #FEE2E2; color: #DC2626; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
  .badge-p1 { background: #FEF3C7; color: #D97706; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
  .badge-p2 { background: #D1FAE5; color: #059669; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
  .element-card { border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px; margin-bottom: 8px; }
  .flow-arrow { color: #6B7280; margin: 0 8px; }
</style>
"""


# ── 解析页面 MD ─────────────────────────────────────────────

def parse_pages_md(content: str) -> dict:
    """解析 prototype-page.md，返回结构化页面数据。"""
    result = {
        "product_name": "",
        "product_version": "v1",
        "date": "",
        "pages": [],
        "nav_structure": "",
        "common_rules": [],
    }

    lines = content.splitlines()
    i = 0

    # 从 H1 提取产品名
    for line in lines:
        m = re.match(r"^#\s+(.+?)(?:\s+页面原型.*)?$", line.strip())
        if m:
            result["product_name"] = m.group(1).strip()
            break

    # 提取基本信息表
    for j, line in enumerate(lines):
        if "基本信息" in line:
            for k in range(j + 1, min(j + 20, len(lines))):
                cells = _parse_table_row(lines[k])
                if cells and len(cells) >= 2:
                    if "产品名称" in cells[0]:
                        result["product_name"] = cells[1]
                    elif "版本" in cells[0]:
                        result["product_version"] = cells[1]
                    elif "日期" in cells[0]:
                        result["date"] = cells[1]
            break

    # 提取页面流转图
    in_flow = False
    flow_lines = []
    for line in lines:
        if "页面流转" in line and "```" not in line:
            in_flow = True
            continue
        if in_flow:
            if line.strip().startswith("```"):
                if flow_lines:
                    break
            elif line.strip():
                flow_lines.append(line)
    result["nav_structure"] = "\n".join(flow_lines)

    # 解析各页面（以 ### Pxx - 或 ### P\d 开头）
    current_page = None
    current_section = None

    for line in lines:
        # 页面标题
        m = re.match(r"^###\s+(P\d+)\s*[-–]\s*(.+)$", line.strip())
        if m:
            if current_page:
                result["pages"].append(current_page)
            current_page = {
                "id": m.group(1).lower(),
                "name": m.group(2).strip(),
                "module": "",
                "purpose": "",
                "url": "",
                "elements": [],
                "interactions": [],
                "data_fields": [],
                "from_pages": [],
                "to_pages": [],
                "notes": "",
                "raw_sections": {},
            }
            current_section = None
            continue

        if current_page is None:
            continue

        stripped = line.strip()

        # 4 级标题 → section
        m4 = re.match(r"^####\s+(.+)$", stripped)
        if m4:
            current_section = m4.group(1).strip()
            continue

        # 字段提取
        if "所属模块" in stripped and "**" not in stripped:
            val = _extract_value(stripped)
            if val:
                current_page["module"] = val
        elif re.match(r"\*\*所属模块\*\*", stripped):
            current_page["module"] = stripped.split("：", 1)[-1].split(":", 1)[-1].strip()
        elif re.match(r"\*\*页面地址\*\*|页面路由", stripped):
            url = re.search(r"`([^`]+)`", stripped)
            current_page["url"] = url.group(1) if url else ""
        elif re.match(r"\*\*页面用途\*\*|页面功能", stripped):
            current_page["purpose"] = stripped.split("：", 1)[-1].split(":", 1)[-1].strip().lstrip("*").strip()
        elif re.match(r"\*\*进入来源\*\*", stripped):
            current_page["from_pages"] = [s.strip() for s in re.split(r"[,，、]", stripped.split("：", 1)[-1].split(":", 1)[-1].strip()) if s.strip()]
        elif re.match(r"\*\*离开去向\*\*", stripped):
            current_page["to_pages"] = [s.strip() for s in re.split(r"[,，、]", stripped.split("：", 1)[-1].split(":", 1)[-1].strip()) if s.strip()]

        # 按 section 归类原始内容
        if current_section:
            if current_section not in current_page["raw_sections"]:
                current_page["raw_sections"][current_section] = []
            if stripped and not re.match(r"^#{1,6}\s", stripped):
                current_page["raw_sections"][current_section].append(stripped)

    if current_page:
        result["pages"].append(current_page)

    return result


def _parse_table_row(line: str) -> list[str]:
    stripped = line.strip()
    if not stripped.startswith("|"):
        return []
    cells = [c.strip() for c in stripped.split("|")[1:-1]]
    if all(re.match(r"^[-:\s]+$", c) for c in cells):
        return []
    return cells


def _extract_value(line: str) -> str:
    parts = re.split(r"[：:]", line, 1)
    return parts[-1].strip() if len(parts) > 1 else ""


# ── HTML 生成 ───────────────────────────────────────────────

def build_nav_html(pages: list[dict], active_id: str, product_name: str) -> str:
    nav_items = ""
    for page in pages:
        active_cls = "page-active" if page["id"] == active_id else ""
        nav_items += f"""
        <a href="{page['id']}.html"
           class="nav-item block px-3 py-2 rounded text-sm text-gray-700 {active_cls}">
          <span class="text-gray-400 mr-1">{page['id'].upper()}</span>
          {page['name']}
        </a>"""

    return f"""
    <aside class="sidebar w-56 bg-white border-r border-gray-200 flex-shrink-0 p-3">
      <div class="text-xs text-gray-400 uppercase tracking-wider mb-3 px-2">
        {product_name}
      </div>
      <nav class="space-y-0.5">{nav_items}
      </nav>
    </aside>"""


def _render_section_content(section_name: str, lines: list[str]) -> str:
    """将原始 section 内容渲染为 HTML 片段。"""
    html_parts = [f'<h4 class="text-sm font-semibold text-gray-700 mt-4 mb-2">{section_name}</h4>']

    # 检测是否为表格行
    table_lines = [l for l in lines if l.startswith("|")]
    non_table_lines = [l for l in lines if not l.startswith("|")]

    if table_lines:
        rows = []
        for l in table_lines:
            cells = [c.strip() for c in l.split("|")[1:-1]]
            if cells and not all(re.match(r"^[-:\s]+$", c) for c in cells):
                rows.append(cells)
        if rows:
            header = rows[0]
            data = rows[1:]
            th_cells = "".join(f"<th>{c}</th>" for c in header)
            body_rows = ""
            for row in data:
                tds = "".join(f"<td>{c}</td>" for c in row)
                body_rows += f"<tr>{tds}</tr>"
            html_parts.append(f'<div class="overflow-x-auto mb-3"><table><thead><tr>{th_cells}</tr></thead><tbody>{body_rows}</tbody></table></div>')

    if non_table_lines:
        for l in non_table_lines:
            if l.startswith("- ") or l.startswith("* "):
                html_parts.append(f'<li class="text-sm text-gray-600 ml-4 list-disc">{l[2:]}</li>')
            elif l:
                html_parts.append(f'<p class="text-sm text-gray-600">{l}</p>')

    return "\n".join(html_parts)


def build_page_html(page: dict, all_pages: list[dict], product_name: str, product_version: str) -> str:
    nav = build_nav_html(all_pages, page["id"], product_name)

    # 页面 header
    module_badge = f'<span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{page["module"]}</span>' if page["module"] else ""
    url_badge = f'<code class="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{page["url"]}</code>' if page["url"] else ""

    # 页面正文
    content_sections = ""
    for sec_name, sec_lines in page.get("raw_sections", {}).items():
        if sec_lines:
            content_sections += _render_section_content(sec_name, sec_lines)

    if not content_sections:
        content_sections = f'<p class="text-gray-400 text-sm">（页面内容待完善）</p>'

    # 页面流转
    flow_html = ""
    if page.get("from_pages") or page.get("to_pages"):
        from_str = " / ".join(page["from_pages"]) if page["from_pages"] else "—"
        to_str = " / ".join(page["to_pages"]) if page["to_pages"] else "—"
        flow_html = f"""
        <div class="mt-6 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm">
          <span class="font-medium text-gray-700">页面流转：</span>
          <span class="text-gray-500">从 [{from_str}]</span>
          <span class="flow-arrow">→</span>
          <span class="font-medium text-blue-600">{page['name']}</span>
          <span class="flow-arrow">→</span>
          <span class="text-gray-500">[{to_str}]</span>
        </div>"""

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{page['name']} - {product_name} 原型</title>
  {TAILWIND_CDN}
  {BASE_STYLES}
</head>
<body class="bg-gray-50">
  <!-- 顶部导航栏 -->
  <header class="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
    <div class="flex items-center gap-3">
      <span class="font-semibold text-gray-800">{product_name}</span>
      <span class="text-xs text-gray-400">{product_version}</span>
      <span class="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">原型 Demo</span>
    </div>
    <div class="flex items-center gap-2 text-sm text-gray-500">
      <span>用户名</span>
      <span class="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">U</span>
    </div>
  </header>

  <!-- 主体区域 -->
  <div class="flex">
    {nav}

    <!-- 内容区 -->
    <main class="flex-1 p-6 overflow-auto">
      <!-- 页面标题 -->
      <div class="mb-5">
        <div class="flex items-center gap-2 mb-1">
          <h1 class="text-xl font-bold text-gray-900">{page['name']}</h1>
          {module_badge}
          {url_badge}
        </div>
        <p class="text-sm text-gray-500">{page.get('purpose', '')}</p>
      </div>

      <!-- 页面内容 -->
      <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        {content_sections}
      </div>

      {flow_html}
    </main>
  </div>
</body>
</html>"""


def build_index_html(pages: list[dict], product_name: str, product_version: str, date: str) -> str:
    first_page = f"{pages[0]['id']}.html" if pages else "#"
    page_cards = ""
    for page in pages:
        page_cards += f"""
        <a href="pages/{page['id']}.html"
           class="block p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-sm transition-all">
          <div class="flex items-start justify-between">
            <div>
              <span class="text-xs text-gray-400">{page['id'].upper()}</span>
              <h3 class="text-sm font-semibold text-gray-800 mt-0.5">{page['name']}</h3>
              <p class="text-xs text-gray-500 mt-1">{page.get('module', '')} {' · ' + page.get('purpose', '')[:40] + '…' if page.get('purpose') else ''}</p>
            </div>
            <span class="text-blue-400 text-lg">→</span>
          </div>
        </a>"""

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{product_name} - 产品原型 Demo</title>
  {TAILWIND_CDN}
  {BASE_STYLES}
</head>
<body class="bg-gray-50 min-h-screen">
  <div class="max-w-3xl mx-auto py-12 px-4">
    <div class="text-center mb-10">
      <div class="inline-block bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full mb-3">产品原型 Demo</div>
      <h1 class="text-3xl font-bold text-gray-900">{product_name}</h1>
      <p class="text-gray-500 mt-2">{product_version}  ·  {date or datetime.now().strftime('%Y-%m-%d')}</p>
      <a href="pages/{first_page}"
         class="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
        进入原型
      </a>
    </div>

    <h2 class="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">页面清单（{len(pages)} 个页面）</h2>
    <div class="grid grid-cols-2 gap-3">
      {page_cards}
    </div>
  </div>
</body>
</html>"""


# ── 主函数 ──────────────────────────────────────────────────

def build(md_path: str | Path, out_dir: str | Path | None = None) -> Path:
    md_path = Path(md_path)
    if not md_path.exists():
        raise FileNotFoundError(f"文件不存在: {md_path}")

    content = md_path.read_text(encoding="utf-8")
    data = parse_pages_md(content)

    if not data["pages"]:
        raise ValueError("未解析到任何页面（需以 '### Pxx - 页面名' 格式定义页面）")

    # 确定输出目录
    date_str = datetime.now().strftime("%Y-%m-%d")
    if out_dir is None:
        out_dir = md_path.parent / f"{date_str}-demo-v1"
    out_dir = Path(out_dir)

    # 处理版本递增
    if out_dir.exists():
        parent = out_dir.parent
        base = out_dir.name
        m = re.match(r"(.+-demo-v)(\d+)$", base)
        if m:
            prefix, ver = m.group(1), int(m.group(2))
            while out_dir.exists():
                ver += 1
                out_dir = parent / f"{prefix}{ver}"

    pages_dir = out_dir / "pages"
    pages_dir.mkdir(parents=True, exist_ok=True)

    product_name = data["product_name"] or "产品原型"
    product_version = data["product_version"]
    date = data["date"]

    # 生成 index.html
    index_html = build_index_html(data["pages"], product_name, product_version, date)
    (out_dir / "index.html").write_text(index_html, encoding="utf-8")

    # 生成各页面 HTML
    for page in data["pages"]:
        page_html = build_page_html(page, data["pages"], product_name, product_version)
        (pages_dir / f"{page['id']}.html").write_text(page_html, encoding="utf-8")

    return out_dir


def main():
    parser = argparse.ArgumentParser(description="MD 原型描述 -> HTML 交互原型生成器")
    parser.add_argument("md_path", help="页面原型 Markdown 文件路径")
    parser.add_argument("--out", help="输出目录路径（默认自动命名）")
    args = parser.parse_args()

    try:
        out = build(args.md_path, args.out)
        index = out / "index.html"
        print(f"原型已生成: {out}")
        print(f"打开方式: 用浏览器打开 {index}")
    except (FileNotFoundError, ValueError) as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
