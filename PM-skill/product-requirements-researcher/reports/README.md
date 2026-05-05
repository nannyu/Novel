# 调研报告归档目录

本目录用于存放各项目的**单次调研报告**和**最终调研报告**。

## 目录结构

```
reports/
├── <project-slug>/           # 项目目录（项目名称拼音/英文短横线）
│   ├── YYYY-MM-DD-session-01.md   # 第 1 次调研
│   ├── YYYY-MM-DD-session-02.md   # 第 2 次调研
│   └── YYYY-MM-DD-final-report.md # 最终汇总报告
└── README.md
```

## 命名规则

| 类型 | 命名格式 | 示例 |
| --- | --- | --- |
| 单次调研 | `YYYY-MM-DD-session-NN.md` | `2026-02-27-session-01.md` |
| 最终报告 | `YYYY-MM-DD-final-report.md` | `2026-02-27-final-report.md` |

## 使用说明

- **续研**：开始新一轮调研前，先读取该项目目录下的历史报告，基于未决问题继续追问。
- **留底**：每次用户说「先这样生成报告吧」时，将单次报告写入对应 `session-NN.md`。
- **收口**：用户说「调研结束了」时，基于所有单次报告生成并写入 `final-report.md`。
