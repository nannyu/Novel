#!/usr/bin/env python3
"""
So Novel (so-novel) 命令行封装脚本

提供统一的命令行接口，用于：
- （占位）search：记录搜索查询信息，方便上层 Agent 统一处理搜索逻辑
- download：给定小说/文章主页 URL，调用本地安装的 so-novel 将内容导出为 TXT

注意：
- 由于 so-novel 官方目前未详细公开“单次命令行下载接口”的稳定参数，
  本脚本中的命令构造逻辑基于合理假设，实际部署时可根据本地情况调整。
"""

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple


def _project_root() -> Path:
    """本项目（skill）根目录：scripts -> so-novel-downloader -> skills -> .cursor -> skill（共 5 层）"""
    return Path(__file__).resolve().parent.parent.parent.parent.parent


def _local_sonovel_exe() -> Optional[Path]:
    """本项目 tools/sonovel 下的本地安装（SoNovel.exe 或 sonovel.exe）。"""
    root = _project_root()
    for exe_name in ("SoNovel.exe", "sonovel.exe"):
        # 直接放在 tools/sonovel/ 或 tools/sonovel/SoNovel/
        exe = root / "tools" / "sonovel" / exe_name
        if exe.is_file():
            return exe
    # 或解压后在一层子目录中，如 tools/sonovel/SoNovel/sonovel.exe
    tools_dir = root / "tools" / "sonovel"
    if tools_dir.is_dir():
        for child in tools_dir.iterdir():
            if child.is_dir():
                for exe_name in ("SoNovel.exe", "sonovel.exe"):
                    candidate = child / exe_name
                    if candidate.is_file():
                        return candidate
    return None


def find_sonovel_command() -> Optional[str]:
    """
    查找 so-novel 可执行文件。

    优先级：
    1. PATH 中的 sonovel / so-novel
    2. 本项目 tools/sonovel 下的 SoNovel.exe（本地安装）
    """
    for name in ("sonovel", "so-novel"):
        cmd = shutil.which(name)
        if cmd:
            return cmd
    local_exe = _local_sonovel_exe()
    if local_exe is not None:
        return str(local_exe)
    return None


def safe_filename(name: str) -> str:
    """将任意字符串转换为较安全的文件名。"""
    invalid_chars = '<>:"/\\|?*'
    result = "".join("_" if c in invalid_chars else c for c in name)
    # 去除前后空白，并避免完全为空
    result = result.strip() or "novel"
    return result


def _sonovel_work_dir(sonovel_cmd: str) -> Optional[Path]:
    """so-novel 的工作目录（含 config.ini、rules 的目录）。"""
    exe_path = Path(sonovel_cmd).resolve()
    if exe_path.name.lower() in ("sonovel.exe", "sonovel"):
        # 如 tools/sonovel/SoNovel/sonovel.exe -> tools/sonovel/SoNovel
        return exe_path.parent
    return None


def build_download_command(
    sonovel_cmd: str,
    url: str,
    output_path: Path,
) -> List[str]:
    """
    构造调用 so-novel 的命令。

    so-novel 实际 CLI 用法：-u <URL> -e txt
    输出路径由 config.ini 的 download-path 决定，脚本会在下载后复制到目标路径。
    """
    cmd = [
        sonovel_cmd,
        "-u",
        url,
        "-e",
        "txt",
    ]
    return cmd


def run_command(cmd: List[str], cwd: Optional[str] = None) -> Tuple[int, str, str]:
    """运行外部命令并捕获输出。"""
    try:
        completed = subprocess.run(
            cmd,
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=cwd,
        )
        return completed.returncode, completed.stdout, completed.stderr
    except FileNotFoundError as e:
        return 1, "", f"命令未找到: {e}"
    except Exception as e:  # noqa: BLE001
        return 1, "", f"执行命令出错: {e}"


def _find_newest_txt_in_dir(dir_path: Path) -> Optional[Path]:
    """在目录及子目录中查找最新修改的 .txt 文件。"""
    txts = list(dir_path.rglob("*.txt"))
    if not txts:
        return None
    return max(txts, key=lambda p: p.stat().st_mtime)


def handle_search(mode_args: argparse.Namespace) -> int:
    """
    search 模式（当前为占位接口）。

    设计目的：
    - 为上层 Agent 提供统一的“搜索调用点”，未来如需直接对接 so-novel 的搜索能力，
      可在此处实现真正的搜索逻辑。
    - 当前实现仅回显查询参数，提示应由上层通过 Web 搜索 / so-novel WebUI 完成实际搜索。
    """
    query = mode_args.query
    max_results = mode_args.max_results

    payload: Dict[str, object] = {
        "mode": "search",
        "query": query,
        "max_results": max_results,
        "note": (
            "当前 search 模式仅用于记录查询参数，建议由上层 Agent 通过 Web 搜索或 so-novel "
            "WebUI 完成实际站点搜索，并生成候选列表。"
        ),
    }

    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


def handle_download(mode_args: argparse.Namespace) -> int:
    """
    download 模式：调用本地 so-novel 导出 TXT。
    """
    url: str = mode_args.url
    output_dir = Path(mode_args.output_dir or "./downloads/so-novel")
    file_name_arg: Optional[str] = mode_args.file_name

    output_dir.mkdir(parents=True, exist_ok=True)

    if file_name_arg:
        file_name = safe_filename(file_name_arg)
    else:
        # 若未指定文件名，基于 URL 简单生成
        file_name = safe_filename(url.split("/")[-1] or "novel") + ".txt"

    if not file_name.lower().endswith(".txt"):
        file_name += ".txt"

    output_path = output_dir / file_name

    sonovel_cmd = find_sonovel_command()
    if not sonovel_cmd:
        error_payload = {
            "mode": "download",
            "status": "error",
            "error": "未在 PATH 中找到 'sonovel' 或 'so-novel' 命令，请确认 so-novel 已正确安装并配置。",
        }
        print(json.dumps(error_payload, ensure_ascii=False, indent=2), file=sys.stderr)
        return 1

    cmd = build_download_command(sonovel_cmd, url=url, output_path=output_path)
    work_dir = _sonovel_work_dir(sonovel_cmd)

    result_code, stdout_text, stderr_text = run_command(
        cmd, cwd=str(work_dir) if work_dir else None
    )

    if result_code == 0:
        # so-novel 输出到 work_dir/downloads/，复制到目标路径
        downloads_dir = (work_dir or Path(sonovel_cmd).resolve().parent) / "downloads"
        newest_txt = _find_newest_txt_in_dir(downloads_dir) if downloads_dir.is_dir() else None
        if newest_txt and newest_txt.exists():
            shutil.copy2(newest_txt, output_path)
        payload = {
            "mode": "download",
            "status": "ok",
            "url": url,
            "file_path": str(output_path),
            "stdout": stdout_text.strip(),
        }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0

    # 失败时输出详细错误信息
    error_payload = {
        "mode": "download",
        "status": "error",
        "url": url,
        "file_path": str(output_path),
        "return_code": result_code,
        "stdout": stdout_text.strip(),
        "stderr": stderr_text.strip(),
    }
    print(json.dumps(error_payload, ensure_ascii=False, indent=2), file=sys.stderr)
    return result_code or 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="封装 So Novel (so-novel) 的命令行接口，用于下载小说/文章为 TXT。",
    )

    subparsers = parser.add_subparsers(dest="mode", required=True)

    # search 子命令
    search_parser = subparsers.add_parser(
        "search",
        help="记录搜索查询信息（占位接口，实际搜索建议由上层完成）",
    )
    search_parser.add_argument(
        "--query",
        required=True,
        help="搜索关键词（书名、作者或其他描述）",
    )
    search_parser.add_argument(
        "--max-results",
        type=int,
        default=10,
        help="期望的最大候选数量（默认 10）",
    )
    search_parser.set_defaults(func=handle_search)

    # download 子命令
    download_parser = subparsers.add_parser(
        "download",
        help="给定 URL，调用 so-novel 下载并导出为 TXT 文件",
    )
    download_parser.add_argument(
        "--url",
        required=True,
        help="小说或文章主页 URL",
    )
    download_parser.add_argument(
        "--output-dir",
        help="输出目录（默认 ./downloads/so-novel）",
    )
    download_parser.add_argument(
        "--file-name",
        help="输出 TXT 文件名（可选，不含路径）",
    )
    download_parser.set_defaults(func=handle_download)

    return parser


def main() -> None:
    # Windows 控制台默认 GBK，确保 JSON 输出使用 UTF-8
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:  # noqa: S110
            pass

    parser = build_parser()
    args = parser.parse_args()

    func = getattr(args, "func", None)
    if func is None:
        parser.print_help()
        sys.exit(1)

    exit_code = func(args)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()

