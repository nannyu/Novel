# CLAUDE.md

此文件为 Claude Code（claude.ai/code）提供工作指导，帮助其在代码库中高效工作。

## Always respond in Chinese-simplified

## 项目概述

这是一个 cursor-claude 演示仓库，主要用于创意写作项目，包括小说生成和叙事开发。代码库包含多个小说写作子项目，并配有结构化的参考材料、SKILL 配置和文档。

## 常用命令

### Git 操作
- `git status` - 查看当前分支和未提交的更改
- `git log --oneline` - 查看最近的提交记录
- `git branch` - 列出本地和远程分支
- `git diff` - 查看已暂存和未暂存的更改

### 小说项目操作
- 进入 `novel/<项目名>/` 目录访问各个独立项目
- 每个项目都包含 `SKILL.md` 文件，其中包含具体的 agent 配置
- 检查 `references/` 目录以获取角色表、时间线和风格指南
- 查看 `reports/` 目录以获取质量保证（QA）和验证结果

## 仓库结构

- `.git/` - Git 元数据和配置
- `novel/` - 主内容工作区，包含多个小说写作子项目：
  - `ke-novel-continuation/` - 带有角色/时间线参考的续写叙事
  - `novel-outline-researcher/` - 大纲与研究生成
  - `novel-qa/` - 问题与答案验证报告
  - `novel-studio/` - 工作室风格协同写作
  - `novel-style-reference/` - 风格参考文档
  - `so-novel-downloader/` - 自动小说下载脚本
  - `yunhui-style-writer/` - 风格化写作工具
- `AI使用深度研究.docx` - 关于 AI 使用方法的研究文档

## 导航指南

在处理小说生成项目时，请首先查看相关 `novel/<项目名>/references/` 目录，获取角色表、时间线和风格指南。每个子项目都包含 `SKILL.md` 文件，其中详细说明了具体的 agent 配置和工作流程。

### 关键模式
- 各项目使用 `references/` 目录存储静态内容（角色、时间线、风格）
- `SKILL.md` 文件包含 agent 系统提示和操作指南
- `reports/` 目录包含质量验证和 QA 结果
- 在创建章节时，请遵循 `novel-studio/SKILL.md` 中记录的六步工作流

## 开发最佳实践

1. 在实现新功能前，务必先阅读已有的 `SKILL.md` 文件
2. 在做出内容决策前，先检查 `references/` 目录
3. 使用 `git status` 和 `git diff` 在提交前审查更改
4. 添加新项目时，请遵循现有的文件夹结构

## Completion Contract

每次最终回复都必须包含以下 3 个部分：

1. `Skills used`
   - 列出本次任务中实际使用的所有 skill
   - 如果没有使用任何 skill，明确写 `None`

2. `Workflow`
   - 用 3 到 6 个简短步骤总结本次实际执行的工作流
   - 只描述实际发生的步骤，不要写泛化模板

3. `Files touched`
   - 列出本次创建或修改的文件
   - 如果没有文件变更，明确写 `None`

规则：
- 这 3 个部分在每次最终回复中都是强制项
- 即使任务很小，也不能省略
- 只汇报本次实际使用的 skill，不要列出可用但未使用的 skill
- 只汇报本次实际执行的 workflow，不要写通用流程

## Progress Update Contract

在进行较为实质性的工作时，中途进度更新应包含：

- 当前目标
- 是否正在使用某个 skill
- 下一步的具体动作
