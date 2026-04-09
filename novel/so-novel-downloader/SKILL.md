---
name: so-novel-downloader
description: 使用 So Novel (so-novel) 工具按用户意图搜索并下载网络小说或网页文章内容，将其导出为纯文本（TXT）并保存到指定本地目录的工具。当用户提到“下载小说/网文/电子书”、“从网站抓取连载小说”、“保存为 txt/文本文件”等需求时使用。本 Skill 会先帮用户根据书名/作者/关键词筛选候选作品，经用户确认后再调用本地安装的 so-novel 进行下载与导出。
---

# So Novel 小说下载 Skill

使用本 Skill，可以在对话中按以下流程工作：

1. 根据用户自然语言意图（书名、作者、关键词、网站链接等）先**搜索候选小说/文章**。
2. 将候选列表（标题、作者、站点等）展示给用户，让用户**确认目标作品**。
3. 用户确认后，调用本地安装的 **So Novel (so-novel)** 工具，将目标作品**下载并导出为 TXT 文本文件**，保存到指定目录。
4. 将本地生成的 TXT 文件路径返回给用户，便于后续阅读或处理。

> ⚠️ 重要说明  
> so-novel 官方目前主要以交互式 TUI / WebUI / CLI 菜单形式工作，没有完全公开稳定的“单次命令行 API”。  
> 本 Skill 的脚本部分给出了一套**推荐的封装方式**，假定本地存在一个可通过 `sonovel` 命令调用的 CLI，并支持按 URL 导出 TXT。  
> 若你的实际安装方式或参数不同，请根据 `references/sonovel-cli.md` 及本地 `readme.txt` / `config.ini` 适当修改脚本中的命令构造逻辑。

## 前置依赖：安装 so-novel

本 Skill 会按以下顺序查找 so-novel：

1. **系统 PATH** 中的 `sonovel` 或 `so-novel` 命令  
2. **本项目本地安装**：`skill/tools/sonovel/` 下的 **SoNovel.exe**（推荐，无需改 PATH）

### 方式一：本项目内安装（推荐）

- 在项目根目录下执行安装脚本（需能访问 GitHub）：
  ```powershell
  cd d:\zhengyunhui\skill\tools\sonovel
  .\install.ps1
  ```
- 若无法访问 GitHub：从 [Releases](https://github.com/freeok/so-novel/releases) 下载 **sonovel-windows.tar.gz**，解压到 `skill/tools/sonovel/`，保证 **SoNovel.exe** 在该目录或其一层子目录下即可。详见 [tools/sonovel/README.md](../../../tools/sonovel/README.md)。

### 方式二：系统级安装

- Windows（Scoop）：`scoop bucket add freeok https://github.com/freeok/scoop-bucket` → `scoop install freeok/so-novel`
- macOS（Homebrew）：`brew tap ownia/homebrew-ownia` → `brew install so-novel`
- 或从 [Releases](https://github.com/freeok/so-novel/releases) 下载对应平台包，解压后将可执行文件加入 PATH。

安装后需有 `config.ini` 与 `rules` 等配置（官方包内通常已带），确保常用书源可解析。  
更多封装方式见 `references/sonovel-cli.md`。

## 工作流程（对话级）

### 1. 解析用户需求并搜索候选作品

- 从用户输入中提取以下信息：
  - 书名或关键词（必需）
  - 作者名（如有）
  - 期望的网站/书源（如“起点”、“笔趣阁”等，如有）
  - 语言、是否完结、字数范围等附加偏好（如有）
- 使用通用 Web 搜索（或用户提供的站点搜索）查找可能匹配的小说/文章页面：
  - 优先选择 so-novel 已支持的站点（即本地 `rules` 配置中的站点）。
  - 为每个候选项记录：
    - 标题
    - 作者
    - 站点名称 / 域名
    - 作品主页 URL
- 将候选列表以**编号形式**展示给用户，例如：

  - `1. 《xxx》 作者：A，站点：example.com`
  - `2. 《xxx（同名）》 作者：B，站点：other.com`

- 让用户显式确认：
  - 选择编号（如“选 1”）
  - 或者要求重新筛选 / 限定站点 / 修改关键词

> 注意：**搜索步骤由对话 Agent 完成**，并不强制通过 so-novel 实现。  
> Skill 的脚本更专注于“给定已选 URL 后如何调用 so-novel 导出 TXT”。

### 2. 默认下载目录

- **默认输出目录**：本项目根目录下的 `downloads/so-novel`（即 `skill/downloads/so-novel`）。脚本会在首次下载时自动创建该文件夹。
- **后续下载**：所有通过本 Skill 下载的小说，**一律默认保存到上述目录**，无需每次询问用户。
- **仅当用户明确指定其他目录时**（如「下载到 D:\books」），才使用用户指定的路径作为 `--output-dir`。

### 3. 下载与导出 TXT

当用户确认具体作品（即确定了作品主页 URL）后：

1. 确定输出目录：若用户未指定，则使用默认目录（本项目下的 `downloads/so-novel`）。
2. 构造调用脚本的命令（`--output-dir` 未指定时使用本项目下的 `downloads/so-novel`），例如：

   ```bash
   python .cursor/skills/so-novel-downloader/scripts/sonovel_wrapper.py download \
     --url "<小说主页 URL>" \
     --output-dir "<本项目根路径>/downloads/so-novel" \
     --file-name "书名_作者.txt"
   ```

3. 脚本会：检查 `sonovel` 命令是否可用；按约定调用 so-novel；等待下载完成并输出生成的 TXT 路径（JSON 或可解析文本）。
4. 将生成的 TXT 文件完整路径返回给用户。

## 脚本说明：`scripts/sonovel_wrapper.py`

该脚本为一个**轻量封装器**，统一对 so-novel 的调用入口，当前主要支持以下模式：

- `search` 模式（接口占位，实际搜索仍建议由对话代理完成）：
  - 用法示例：

    ```bash
    python sonovel_wrapper.py search --query "某某小说" --max-results 10
    ```

  - 当前实现只会输出一段结构化 JSON，记录查询词和期望返回条数，方便未来扩展；
  - 实际站点搜索、候选列表构建仍建议由上层 Agent 使用 Web 搜索或 so-novel WebUI 完成。

- `download` 模式（核心功能）：
  - 用法示例：

    ```bash
    python sonovel_wrapper.py download \
      --url "https://example.com/novel/123" \
      --output-dir "D:/novels" \
      --file-name "某某小说_作者.txt"
    ```

  - 参数：
    - `--url`：小说或文章主页 URL（必需）。
    - `--output-dir`：输出目录（可选）。**本 Skill 约定**：默认使用本项目根目录下的 `downloads/so-novel`，脚本会自动创建；用户明确指定时才传入其他路径。
    - `--file-name`：输出 TXT 文件名（可选，默认由脚本生成一个安全文件名）。
  - 行为：
    - 检查系统中是否存在 `sonovel` 或 `so-novel` 命令；
    - 基于 URL、输出目录和文件名构造调用 so-novel 的命令；
    - 执行命令并监控返回码；
    - 成功时以 JSON 输出 `{"status": "ok", "file_path": ".../xxx.txt"}`；
    - 失败时输出错误信息和返回码，便于排查。

> **重要：命令行参数适配**  
> 由于 so-novel 官方文档目前并未详细公开“单次命令行下载接口”的所有参数，本脚本中对命令格式做了一些**合理假设**。  
> 如果你的本地 so-novel 实际调用方式不同（例如通过 HTTP API、脚本包装等），请根据 `references/sonovel-cli.md` 中的说明修改脚本中构造命令的函数。

## 何时阅读 `references/sonovel-cli.md`

在以下场景下，应加载并参考 `references/sonovel-cli.md`：

- 需要了解 so-novel 在 TUI / CLI / Web 模式下的不同启动方式；
- 希望将当前脚本中的命令构造逻辑改为：
  - 调用本地 `app.jar`；
  - 使用 Docker 容器中的 sonovel；
  - 或通过 Web 模式提供的 HTTP 接口进行下载；
- 需要根据本地 `config.ini` 与 `rules` 调优行为（如默认导出格式、字符编码等）。

## 使用注意事项

1. **合法性与版权**  
   - 仅在法律允许的范围内使用本工具；  
   - 尊重作者与网站的版权政策，不要用于任何侵权用途。
2. **站点兼容性**  
   - 并非所有小说网站都在本地 `rules` 中有规则；  
   - 如遇解析失败，可尝试更换站点或更新 so-novel 版本 / 规则。
3. **编码与格式**  
   - 默认导出为 UTF-8 编码的 TXT；  
   - 如需 EPUB/PDF 等格式，可在 so-novel 的配置或后续处理环节中转换。
4. **性能与稳定性**  
   - 长篇连载小说下载时间可能较长；  
   - 建议合理设置并发下载数量，避免对目标站点造成过大压力。

## 参考资料

- so-novel 官方仓库与文档：`https://github.com/freeok/so-novel`
- 使用介绍与图文说明示例：[so-novel v1.7.11：开源免费小说下载器](https://www.souyuanzhan.com/2913.html)

