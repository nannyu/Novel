# 功能清单归档目录

本目录用于存放根据调研报告、解决方案或原有功能清单扩展生成的**项目功能清单**。

## 目录结构

项目功能清单现统一存放在 `projects/<project-slug>/功能点整理/`。

```
projects/<project-slug>/功能点整理/
└── YYYY-MM-DD-feature-list.md    # 功能清单
```

## 命名规则

| 类型 | 命名格式 | 示例 |
| --- | --- | --- |
| 功能清单 | `YYYY-MM-DD-feature-list.md` | `2026-03-10-feature-list.md` |
| Excel 导出 | `YYYY-MM-DD-feature-list.xlsx` | `2026-03-10-feature-list.xlsx` |

## 输入来源

- **调研报告**：`projects/<project-slug>/调研/`
- **解决方案**：`projects/<project-slug>/解决方案/`
- **原有功能清单**：`projects/<project-slug>/功能点整理/` 下已有的 feature-list.md（扩展模式）

`project-slug` 与 product-requirements-researcher 一致（小写拼音或英文短横线）。

## 表格列结构

| 列名 | 说明 |
| --- | --- |
| 序号 | 功能编号 |
| 功能模块 | 所属模块/子系统 |
| 功能点 | 具体功能名称 |
| 功能描述 | 详细说明（输入、处理、输出） |
| 优先级 | P0/P1/P2 |
| 备注 | 依赖、来源等 |

完整规范见 SKILL.md 与 references/feature-list-example.md。

## 导出 Excel

```bash
python .cursor/skills/project-feature-list-generator/scripts/export_to_xlsx.py projects/<project-slug>/功能点整理/YYYY-MM-DD-feature-list.md
```

导出文件保存在同目录下，文件名相同，扩展名为 `.xlsx`。
