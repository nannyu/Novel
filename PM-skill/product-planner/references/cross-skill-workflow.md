# 跨 Skill 协作说明

> 本文件说明 product-planner 与 pm-skill 体系中其他 skill 的协作关系和数据流。

---

## 1. 整体数据流

```
product-requirements-researcher
        ↓ 调研报告（projects/<slug>/调研/）
        
project-solution-generator  ←──── 外部文档（docx/pptx/pdf）
        ↓ 解决方案（projects/<slug>/解决方案/）
        
project-feature-list-generator
        ↓ 项目级功能清单（projects/<slug>/功能点整理/）
        
        ↓ ↓ ↓ 所有输入汇集到 ↓ ↓ ↓
        
       [product-planner]
       ↓ 功能清单（projects/<slug>/需求分析/<product>/feature-list/）
       ↓ 页面原型（projects/<slug>/需求分析/<product>/prototypes/）
       ↓ PRD（projects/<slug>/需求分析/<product>/prd/）
```

---

## 2. 各上游 Skill 的输入方式

### 2.1 product-requirements-researcher（调研报告）

**文件位置**：`projects/<project-slug>/调研/`

**优先读取**：
- `YYYY-MM-DD-final-report.md`（最终调研报告，优先）
- `YYYY-MM-DD-session-NN.md`（单次调研报告，按时间倒序）

**从调研报告中提取的内容**：
- 目标用户角色及核心诉求 → 功能清单的优先级判断 + PRD 第 2 章
- 业务痛点与现状 → PRD 第 1 章产品背景
- 功能需求结论（R-01, R-02...） → 功能清单的功能点来源
- 数据实体与字段 → PRD 第 5 章数据需求
- 非功能需求 → PRD 第 7 章

### 2.2 project-solution-generator（解决方案）

**文件位置**：`projects/<project-slug>/解决方案/`

**优先读取**：
- `YYYY-MM-DD-solution.md`（完整方案）
- `YYYY-MM-DD-outline.md`（方案大纲）

**从解决方案中提取的内容**：
- 功能模块划分 → 功能清单的一级模块
- 系统架构/技术路线 → PRD 第 7 章非功能需求
- 接口设计/集成方案 → PRD 第 6 章接口需求
- 实施计划/里程碑 → PRD 第 8 章发布策略

### 2.3 project-feature-list-generator（项目级功能清单）

**文件位置**：`projects/<project-slug>/功能点整理/`

**使用方式**：作为参考输入，不直接复用（product-planner 生成的是产品级功能清单，粒度更细，含一二级结构）

**从项目功能清单中提取的内容**：
- 已有功能点作为初始参考，再细化为一二级结构
- 核对遗漏的功能点

---

## 3. 跨 Skill 扫描工具

### 使用方法

```bash
# 扫描某项目在所有 skill 下的最新内容
python scripts/scan_cross_skill.py <project-slug>

# 指定 pm-skill 根目录（可选）
python scripts/scan_cross_skill.py <project-slug> --base-dir "D:/path/to/pm-skill"
```

### 输出格式

```json
{
  "project_slug": "jiceng-zhili",
  "scan_time": "2026-03-13T10:00:00",
  "total_files": 8,
  "sources": [
    {
      "skill": "product-requirements-researcher",
      "path": "projects/jiceng-zhili/调研/2026-03-10-final-report.md",
      "mtime": "2026-03-10T14:30:00",
      "size_kb": 45.2,
      "type": "调研报告"
    },
    {
      "skill": "project-solution-generator",
      "path": "projects/jiceng-zhili/解决方案/2026-03-08-solution.md",
      "mtime": "2026-03-08T09:00:00",
      "size_kb": 128.5,
      "type": "解决方案"
    }
  ]
}
```

### 在准备阶段的使用规则

1. 准备阶段自动执行扫描
2. 将扫描结果中 `mtime` 最新的同类文件作为主要输入
3. 告知用户发现了哪些上游内容，并说明打算如何使用
4. 若发现多个版本，询问用户是否需要指定某一版本

---

## 4. project-slug 规范

所有项目型 skill 使用统一的 `project-slug`，确保跨 skill 扫描能正确关联。

**命名规则**：
- 小写拼音或英文，单词间用短横线连接
- 长度建议 ≤ 30 个字符
- 示例：
  - 基层治理中心 → `jiceng-zhili`
  - 水务环境企业 → `shuiwu-huanjing`
  - 智慧园区管理 → `zhihui-yuanqu`

**确认方式**：
- 若用户未指定，先列出 `projects/` 目录下已有项目供选择
- 若是新项目，根据项目名称建议 slug，经用户确认后使用

---

## 5. 产品间关联关系管理

### product-relationships.md 文件结构

```markdown
# [项目名称] 产品关联关系

## 产品清单

| 产品名称 | 产品 slug | 状态 | 简介 |
| --- | --- | --- | --- |
| 产品A | product-a | 设计中 | |
| 产品B | product-b | 规划中 | |

## 关联关系

| 产品 | 关联方向 | 关联产品 | 关联类型 | 说明 |
| --- | --- | --- | --- | --- |
| 产品B | 依赖 | 产品A | 数据来源 | 产品B的用户数据来自产品A |
| 产品A | 提供 | 产品B | 接口服务 | 产品A提供 /api/users 接口 |

## 共享资源

- 共享用户体系：产品A + 产品B
- 共享数据字典：[路径]
- 共享组件库：[说明]
```

### 迭代时的关联产品检查

当某产品发生迭代时，检查 `product-relationships.md`：

1. 找到所有「依赖」此产品的其他产品
2. 评估本次变更是否影响下游产品（数据结构变化、接口变化等）
3. 若有影响，在迭代记录中注明，并提示用户是否需要同步更新关联产品文档

---

## 6. 与 skill-evolution-manager 的协作

### 触发进化的时机

在以下情况主动询问用户是否记录：
- 用户要求调整功能清单的列结构（如增加「工作量估算」列）
- 用户要求 PRD 的某章节用不同写法
- 用户反复在某类产品中添加相同的模块（如所有产品都要「操作日志」模块）
- 用户纠正了行业术语写法

### 进化记录命令

```bash
# 将经验写入 evolution.json
python ../skill-evolution-manager/scripts/merge_evolution.py \
  pm-skill/product-planner \
  '{"preferences": ["<具体偏好描述>"]}'

# 缝合到 SKILL.md
python ../skill-evolution-manager/scripts/smart_stitch.py \
  pm-skill/product-planner
```

### evolution.json 字段分类

| 字段 | 用途 | 示例 |
| --- | --- | --- |
| `preferences` | 格式偏好、文档风格、命名习惯 | 「功能清单中增加『工作量估算（人天）』列」 |
| `fixes` | 技术问题修复 | 「Windows 下路径使用正斜杠，openpyxl 版本需 ≥ 3.1」 |
| `contexts` | 项目特有上下文 | 「本项目的「网格员」对应系统中的 role=GRID_WORKER」 |
| `patterns` | 常用产品设计模式 | 「政务类产品功能清单需增加『等保合规』模块」 |
