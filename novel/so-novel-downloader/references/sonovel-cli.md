# so-novel / sonovel CLI 说明与封装建议

本文档用于配合 `so-novel-downloader` Skill，帮助你理解并调整本地 **So Novel (so-novel)** 的启动方式与命令行封装方式，以便脚本 `scripts/sonovel_wrapper.py` 能够顺利调用。

> 官方仓库：`https://github.com/freeok/so-novel/so-novel`  
> 官方 README：`https://github.com/freeok/so-novel`  
> 图文使用介绍示例：[so-novel v1.7.11：开源免费小说下载器](https://www.souyuanzhan.com/2913.html)

## 1. 模式概览

so-novel 支持三种主要运行模式（通过 JVM 系统属性 `-Dmode` 控制）：

| 参数           | 说明                        | 默认值 |
|----------------|-----------------------------|--------|
| `-Dconfig.file`| 配置文件路径                | `./config.ini` |
| `-Dmode`       | 启动模式：`tui` \| `cli` \| `web` | `tui` |

- **tui**：文本终端界面（Text-based UI），适合本地交互使用；
- **cli**：命令行界面，通常仍带有交互菜单；
- **web**：Web UI，通过浏览器访问（默认容器镜像中端口为 `7765`）。

> 参考自官方 README：`README.md` 中的 “自定义 JVM 系统属性” 一节。

## 2. 常见安装与启动方式

### 2.1 普通安装

1. 从 Releases 下载最新版压缩包：  
   `https://github.com/freeok/so-novel/releases`
2. 解压后根据 `bundle/readme.txt` 内说明使用。

### 2.2 Scoop / Homebrew

- Windows（Scoop）：

```bash
scoop bucket add freeok https://github.com/freeok/scoop-bucket
scoop install freeok/so-novel
```

- macOS（Homebrew）：

```bash
brew tap ownia/homebrew-ownia
brew install so-novel
```

### 2.3 Docker

官方 README 示例（Web 模式）：

```yaml
services:
  sonovel:
    image: ghcr.io/freeok/sonovel:latest
    container_name: sonovel
    ports:
      - "7765:7765"
    environment:
      JAVA_OPTS: "-Dmode=web"
    volumes:
      - sonovel_data:/sonovel
    restart: unless-stopped

volumes:
  sonovel_data:
```

或直接运行容器：

```bash
docker run -d \
  --name sonovel \
  -v /sonovel/config.ini:/sonovel/config.ini \
  -v /sonovel/rules:/sonovel/rules \
  -v /sonovel/downloads:/sonovel/downloads \
  -p 7765:7765 \
  -e JAVA_OPTS='-Dmode=web' \
  ghcr.io/freeok/sonovel:latest
```

> 上述挂载路径便于持久化配置、规则与下载结果。

## 3. 将 so-novel 封装为 `sonovel` 命令的思路

`so-novel-downloader` Skill 中的脚本默认假定系统存在一个 `sonovel`（或 `so-novel`）命令，可直接从 PATH 调用。这个命令可以是：

- 官方提供的可执行文件（例如 `sonovel.exe`）；
- 你自定义的启动脚本（Windows `.cmd` / `.bat` 或 Linux/macOS 的 `.sh`）。

### 3.1 Windows 示例：自定义 CMD 启动脚本

假设解压后的目录结构类似：

```text
so-novel/
  app.jar
  config.ini
  rules/
  bundle/
  ...
```

你可以在该目录下创建一个 `sonovel.cmd` 脚本，例如：

```cmd
@echo off
REM 简单封装 so-novel CLI / TUI / Web 模式
REM TODO: 根据实际版本的使用文档调整参数

setlocal

REM 指定 JDK 路径（如已在 PATH 中，可省略）
set "JAVA_EXE=java"

REM 配置文件路径
set "CONFIG_FILE=%~dp0config.ini"

REM 运行模式，可改为 cli 或 web
set "MODE=cli"

REM 这里简单地将所有参数透传给 Java 程序
%JAVA_EXE% ^
  -Dconfig.file="%CONFIG_FILE%" ^
  -Dmode=%MODE% ^
  -jar "%~dp0app.jar" ^
  %*

endlocal
```

然后把 `so-novel` 目录加入系统 PATH，或将 `sonovel.cmd` 复制到 PATH 中的某个目录。  
此后，Skill 中的脚本调用 `sonovel` 时，就会实际运行上述 CMD。

### 3.2 Linux / macOS 示例：Shell 启动脚本

```bash
#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

JAVA_EXE="java"
CONFIG_FILE="$SCRIPT_DIR/config.ini"
MODE="cli"  # 或 web

"$JAVA_EXE" \
  -Dconfig.file="$CONFIG_FILE" \
  -Dmode="$MODE" \
  -jar "$SCRIPT_DIR/app.jar" \
  "$@"
```

同样将该脚本命名为 `sonovel` 并放入 PATH 即可。

## 4. 与 `sonovel_wrapper.py` 的参数衔接

`sonovel_wrapper.py` 中目前对下载命令的构造逻辑为（伪代码）：

```python
cmd = [
  sonovel_cmd,      # 例如 PATH 中的 sonovel
  "--url", url,     # 目标小说主页 URL
  "--output", str(output_path),
  "--format", "txt",
]
```

这是假设本地 `sonovel` 命令支持类似：

```bash
sonovel --url "https://example.com/novel/123" --output "/path/to/book.txt" --format txt
```

实际上你可以根据本地 so-novel 的真实用法调整：

1. **如果 so-novel 提供了直接的导出参数**  
   - 将上述 `build_download_command` 中的参数替换为真实参数即可；
2. **如果需要通过配置文件/任务文件驱动导出**  
   - 可以让 `sonovel` 脚本接收 `--url` 等参数，自己在脚本内部：
     - 修改某个任务配置文件；
     - 再调用 `java -jar app.jar` 启动导出流程；
3. **如果使用 Web 模式提供 HTTP 接口**  
   - 可以让 `sonovel` 封装为一个小工具：
     - 接收 URL 和输出路径；
     - 向本地 WebUI 后端发送 HTTP 请求创建下载任务；
     - 等待任务完成并在指定目录生成 TXT。

## 5. 推荐的适配步骤

1. **先手动使用 so-novel** 完成一次“从某站点下载小说并导出 TXT”的完整流程，确认：
   - 作品主页 URL；
   - 下载结果存放目录；
   - 需要的配置选项（如编码、章节合并方式等）。
2. 设计一个简单的 `sonovel` 命令行接口（可以是自写脚本），目标是：
   - 输入：`--url`、`--output`、`--format`（或你希望的参数集合）；
   - 输出：在指定路径生成 TXT 文件；
3. 修改 `sonovel_wrapper.py` 中 `build_download_command` 函数，把命令行参数改成与你设计的 `sonovel` 接口一致；
4. 在命令行测试：

```bash
python .cursor/skills/so-novel-downloader/scripts/sonovel_wrapper.py download \
  --url "https://example.com/novel/123" \
  --output-dir "D:/novels" \
  --file-name "示例小说.txt"
```

5. 若输出 JSON 中 `status` 为 `"ok"` 且 `file_path` 指向的 TXT 存在，则说明封装成功，可以在 Skill 中放心使用。

## 6. 注意事项

- **编码**：Windows 环境下建议确保 TXT 为 UTF-8 编码，避免 GBK/Big5 导致的乱码问题；
- **合法性**：只在合法合规场景下使用，尊重网站及作者的版权条款；
- **性能**：大部头小说下载时间较长，建议避免短时间内大量并发请求，以免对目标站点造成压力；
- **升级**：so-novel 升级后，如命令行参数或 Web API 有变动，记得同步更新 `sonovel` 封装脚本与 `sonovel_wrapper.py` 中的命令构造逻辑。

