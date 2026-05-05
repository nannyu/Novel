#!/usr/bin/env python3
"""
Export feature list from Markdown to XLSX.
Usage: python export_to_xlsx.py <path-to-feature-list.md>
"""

import re
import sys
from pathlib import Path

try:
    from openpyxl import Workbook
    from openpyxl.styles import Font
except ImportError:
    print("Error: openpyxl is required. Install with: pip install openpyxl")
    sys.exit(1)


def parse_md_table(lines: list[str]) -> list[list[str]]:
    """Parse markdown table rows into list of cells."""
    rows = []
    for line in lines:
        line = line.strip()
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.split("|")[1:-1]]
        if cells and not all(re.match(r"^[-:\s]+$", c) for c in cells):
            rows.append(cells)
    return rows


def find_feature_list_table(content: str) -> list[list[str]] | None:
    """Find the feature list table (功能模块 | 功能点 | 功能描述 | ...)."""
    lines = content.splitlines()
    in_table = False
    table_lines = []

    for line in lines:
        stripped = line.strip()
        if not stripped.startswith("|"):
            if in_table:
                break
            continue
        cells = [c.strip() for c in stripped.split("|")[1:-1]]
        if not cells:
            continue
        if "功能点" in str(cells) or "功能模块" in str(cells):
            in_table = True
            table_lines = [line]
            continue
        if in_table:
            table_lines.append(line)

    if not table_lines:
        return None
    return parse_md_table(table_lines)


def export(md_path: str | Path) -> Path:
    md_path = Path(md_path)
    if not md_path.exists():
        raise FileNotFoundError(f"File not found: {md_path}")

    content = md_path.read_text(encoding="utf-8")
    rows = find_feature_list_table(content)
    if not rows:
        raise ValueError("No feature list table found in markdown (look for 功能点 or 功能模块 column)")

    xlsx_path = md_path.with_suffix(".xlsx")
    wb = Workbook()
    ws = wb.active
    ws.title = "功能清单"

    for r, row in enumerate(rows, 1):
        for c, val in enumerate(row, 1):
            cell = ws.cell(row=r, column=c, value=val)
            if r == 1:
                cell.font = Font(bold=True)

    for col in ws.columns:
        max_len = max(len(str(c.value or "")) for c in col)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 50)

    wb.save(xlsx_path)
    return xlsx_path


def main():
    if len(sys.argv) < 2:
        print("Usage: python export_to_xlsx.py <path-to-feature-list.md>")
        sys.exit(1)
    md_path = sys.argv[1]
    try:
        out = export(md_path)
        print(f"Exported to: {out}")
    except (FileNotFoundError, ValueError) as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
