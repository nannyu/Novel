"""
跨 Skill 同项目内容扫描器（product-planner 专用）

优先扫描 projects/<project-slug>/ 统一结构；若不存在则回退到按 skill 分散目录扫描。

用法：
  python scripts/scan_cross_skill.py <project-slug> [--base-dir <pm-skill路径>]

输出：JSON 格式的文件清单，包含每个文件的来源、路径、修改时间和类型推断。
"""

import sys
import json
import argparse
from pathlib import Path
from datetime import datetime

# 新结构：projects/<slug>/ 下的子目录 -> 类型
PROJECT_SUBDIR_TYPE = {
    "调研": "调研报告",
    "工作清单": "工作清单",
    "功能点整理": "功能清单",
    "需求分析": "产品规划",
    "解决方案": "解决方案",
}

# 旧结构（兼容）：skill -> subdir -> type
SKILL_TYPE_MAP = {
    "product-requirements-researcher": {"subdir": "reports", "type": "调研报告"},
    "project-work-list-generator": {"subdir": "checklists", "type": "工作清单"},
    "project-feature-list-generator": {"subdir": "feature-lists", "type": "功能清单"},
    "project-solution-generator": {"subdir": "solutions", "type": "解决方案"},
    "product-planner": {"subdir": "products", "type": "产品规划"},
}

SCAN_EXTENSIONS = {".md", ".docx", ".pptx", ".pdf", ".xlsx", ".xls", ".txt", ".json", ".html"}

IGNORE_DIRS = {
    "node_modules", ".venv", "__pycache__", ".git", "digest-cache",
    "evolution-log", ".pnpm", ".parcel-cache", "pages",
}


def find_project_files(base_dir: Path, project_slug: str) -> list[dict]:
    results = []

    # 优先使用 projects/<slug>/ 新结构
    projects_dir = base_dir / "projects" / project_slug
    if projects_dir.is_dir():
        for subdir_name, file_type in PROJECT_SUBDIR_TYPE.items():
            subdir = projects_dir / subdir_name
            if not subdir.is_dir():
                continue
            try:
                for f in subdir.rglob("*"):
                    if f.is_file() and f.suffix.lower() in SCAN_EXTENSIONS and not any(
                        p in IGNORE_DIRS for p in f.parts
                    ):
                        results.append(_file_entry(f, subdir_name, file_type, base_dir))
            except OSError:
                pass
    else:
        # 回退到按 skill 分散目录扫描
        for skill_dir in sorted(base_dir.iterdir()):
            if not skill_dir.is_dir() or skill_dir.name.startswith("."):
                continue
            if any(p in IGNORE_DIRS for p in skill_dir.parts):
                continue
            skill_name = skill_dir.name
            if skill_name in SKILL_TYPE_MAP:
                info = SKILL_TYPE_MAP[skill_name]
                project_path = skill_dir / info["subdir"] / project_slug
                if project_path.is_dir():
                    try:
                        for f in project_path.rglob("*"):
                            if f.is_file() and f.suffix.lower() in SCAN_EXTENSIONS and not any(
                                p in IGNORE_DIRS for p in f.parts
                            ):
                                results.append(_file_entry(f, skill_name, info["type"], base_dir))
                    except OSError:
                        pass
            else:
                try:
                    for candidate in skill_dir.rglob(project_slug):
                        if not candidate.is_dir() or any(p in IGNORE_DIRS for p in candidate.parts):
                            continue
                        try:
                            for f in candidate.rglob("*"):
                                if f.is_file() and f.suffix.lower() in SCAN_EXTENSIONS and not any(
                                    p in IGNORE_DIRS for p in f.parts
                                ):
                                    results.append(
                                        _file_entry(f, skill_name, _infer_type(f), base_dir)
                                    )
                        except OSError:
                            continue
                except OSError:
                    continue

    results.sort(key=lambda x: x["mtime"], reverse=True)
    return results


def _file_entry(filepath: Path, skill_name: str, file_type: str, base_dir: Path) -> dict:
    stat = filepath.stat()
    mtime = datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds")
    return {
        "skill": skill_name,
        "path": str(filepath.relative_to(base_dir)),
        "mtime": mtime,
        "size_kb": round(stat.st_size / 1024, 1),
        "type": file_type,
    }


def _infer_type(filepath: Path) -> str:
    suffix = filepath.suffix.lower()
    name = filepath.name.lower()
    if "report" in name or "调研" in name or "session" in name or "final" in name:
        return "调研报告"
    if "checklist" in name or "清单" in name or "work-list" in name:
        return "工作清单"
    if "solution" in name or "方案" in name:
        return "解决方案"
    if "outline" in name or "大纲" in name:
        return "大纲"
    if "feature" in name or "功能" in name:
        return "功能清单"
    if "prd" in name or "需求" in name:
        return "PRD"
    if "prototype" in name or "pages" in name or "原型" in name:
        return "原型"
    if "iteration" in name or "iter" in name or "迭代" in name:
        return "迭代记录"
    type_map = {
        ".docx": "Word文档", ".pptx": "PPT文件", ".pdf": "PDF文件",
        ".xlsx": "Excel文件", ".xls": "Excel文件", ".md": "Markdown文件",
        ".json": "JSON数据", ".html": "HTML文件",
    }
    return type_map.get(suffix, "其他文件")


def main():
    parser = argparse.ArgumentParser(description="跨 Skill 同项目内容扫描器")
    parser.add_argument("project_slug", help="项目标识（如 jiceng-zhili）")
    parser.add_argument(
        "--base-dir",
        default=None,
        help="pm-skill 根目录路径（默认为脚本所在目录的父级父目录）",
    )
    args = parser.parse_args()

    if args.base_dir:
        base_dir = Path(args.base_dir)
    else:
        # scripts/ -> product-planner/ -> pm-skill/
        base_dir = Path(__file__).resolve().parent.parent.parent

    if not base_dir.is_dir():
        print(f"ERROR: 目录不存在: {base_dir}", file=sys.stderr)
        sys.exit(1)

    files = find_project_files(base_dir, args.project_slug)

    output = {
        "project_slug": args.project_slug,
        "scan_time": datetime.now().isoformat(timespec="seconds"),
        "base_dir": str(base_dir),
        "total_files": len(files),
        "sources": files,
    }

    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
