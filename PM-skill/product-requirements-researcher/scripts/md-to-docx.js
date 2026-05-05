/**
 * 将调研报告 md 转为 docx（按 product-requirements-researcher 规范格式）
 * 用法: node scripts/md-to-docx.js <input.md> [output.docx]
 */
const fs = require("fs");
const path = require("path");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
} = require("docx");

const border = { style: BorderStyle.SINGLE, size: 1, color: "000000" };
const borders = { top: border, bottom: border, left: border, right: border };
const w1 = 2340; // 4列时每列宽度
const w2 = 4680; // 2列时每列宽度

function cell(text, width = w2, opts = {}) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    ...opts,
    children: [new Paragraph({ children: [new TextRun(String(text || ""))] })],
  });
}

function infoRow4(aLabel, aVal, bLabel, bVal) {
  return new TableRow({
    children: [cell(aLabel, w1), cell(aVal, w1), cell(bLabel, w1), cell(bVal, w1)],
  });
}

function infoRow2(label, val) {
  return new TableRow({
    children: [cell(label, w2), cell(val, w2)],
  });
}

function buildDocFromReport(mdPath) {
  const content = fs.readFileSync(mdPath, "utf-8");
  const lines = content.split("\n");

  // 解析基本信息表格（从 ## 0. 基本信息 下的表格提取）
  const info = {};
  const infoRegex = /\|\s*([^|]+)\s*\|\s*([^|]*)\s*\|/;
  let inInfo = false;
  for (const line of lines) {
    if (line.includes("## 0. 基本信息")) continue; // 跳过标题行
    if (line.includes("|") && line.includes("字段") && line.includes("内容")) {
      inInfo = true;
      continue;
    }
    if (inInfo && line.startsWith("|") && !line.includes("---")) {
      const m = line.match(infoRegex);
      if (m) {
        const k = m[1].trim();
        const v = m[2].trim();
        if (k !== "字段") info[k] = v;
      }
    } else if (inInfo && line.trim() !== "" && !line.startsWith("|")) break; // 遇到非表格行退出
  }

  // 提取调研内容问题（含回答要点）
  const questions = [];
  const alt = content.match(/### 1\.1 问题清单与回答[\s\S]*?(?=### 1\.2|## 2\.)/);
  if (alt) {
    const blocks = alt[0].split(/\n(?=\d+\.\s+\*\*问题\*\*)/);
    for (const block of blocks) {
      const qMatch = block.match(/\d+\.\s*\*\*问题\*\*[：:]\s*(.+?)(?=\s+-\s+\*\*|$)/s);
      const aMatch = block.match(/\*\*回答要点\*\*[：:]\s*(.+?)(?=\s+-\s+\*\*|$)/s);
      if (qMatch) {
        const q = qMatch[1].trim().replace(/\s+/g, " ");
        const a = aMatch ? aMatch[1].trim().replace(/\s+/g, " ") : "";
        questions.push({ q, a });
      }
    }
  }

  // 提取调研成果（2.1 现状 + 2.2~2.5 其他）
  const statusItems = [];
  const statusMatch = content.match(/### 2\.1 现状\s+([\s\S]*?)(?=### 2\.2|$)/);
  if (statusMatch) {
    const block = statusMatch[1];
    const items = block.match(/^\d+\.\s+(.+)$/gm);
    if (items) statusItems.push(...items.map((s) => s.replace(/^\d+\.\s+/, "").trim()));
  }
  const section22 = content.match(/### 2\.2 痛点与问题根因\s+([\s\S]*?)(?=### 2\.3|$)/);
  const section23 = content.match(/### 2\.3 本次达成的共识[\s\S]*?\n\s*([\s\S]*?)(?=### 2\.4|$)/);
  const section24 = content.match(/### 2\.4 本次发现的风险与依赖\s+([\s\S]*?)(?=### 2\.5|$)/);
  const extraItems = [];
  [section22, section23, section24].forEach((m) => {
    if (m) {
      const lines = m[1].trim().split(/\n/).filter((l) => l.trim());
      extraItems.push(...lines.map((l) => l.replace(/^-\s*\*\*[^*]+\*\*[：:]\s*/, "").replace(/^-\s*/, "").trim()));
    }
  });

  const children = [
    new Paragraph({
      text: "项目需求调研报告",
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "项目需求调研报告", bold: true, size: 32 })],
    }),
    new Paragraph({ text: "" }),

    // 基本信息表（两列：字段 | 内容）
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [w2, w2],
      rows: [
        new TableRow({
          children: [
            cell("项目名称", w2),
            cell(info.项目名称 || "", w2),
          ],
        }),
        new TableRow({
          children: [
            cell("项目编号", w2),
            cell(info.项目编号 || "（空）", w2),
          ],
        }),
        new TableRow({
          children: [
            cell("调研开始时间", w2),
            cell(info.调研开始时间 || "", w2),
          ],
        }),
        new TableRow({
          children: [
            cell("调研结束时间", w2),
            cell(info.调研结束时间 || "", w2),
          ],
        }),
        new TableRow({
          children: [
            cell("调研小组", w2),
            cell(info.调研小组 || "", w2),
          ],
        }),
        new TableRow({
          children: [
            cell("调研地点", w2),
            cell(info.调研地点 || "", w2),
          ],
        }),
        new TableRow({
          children: [
            cell("调研目的", w2),
            cell(info.调研目的 || "", w2),
          ],
        }),
        new TableRow({
          children: [
            cell("调研人员", w2),
            cell(info.调研人员 || "", w2),
          ],
        }),
        new TableRow({
          children: [
            cell("被调研方/参与人员", w2),
            cell(info["被调研方/参与人员"] || info.被调研方 || "", w2),
          ],
        }),
        new TableRow({
          children: [
            cell("本次调研轮次", w2),
            cell(info["本次调研轮次"] || "", w2),
          ],
        }),
        new TableRow({
          children: [
            cell("关联历史报告", w2),
            cell(info["关联历史报告"] || "无", w2),
          ],
        }),
      ],
    }),
    new Paragraph({ text: "" }),

    // 调研内容：一个大表格（标题在表内第一行）
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [2340, 7020],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders,
              columnSpan: 2,
              width: { size: 9360, type: WidthType.DXA },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: "调研内容", bold: true, size: 28 })] })],
            }),
          ],
        }),
        new TableRow({
          children: [cell("序号", 2340), cell("问题与回答", 7020)],
        }),
        ...questions.map((item, i) =>
          new TableRow({
            children: [
              cell(String(i + 1), 2340),
              cell(typeof item === "string" ? item : `${item.q}\n回答要点：${item.a || "（无）"}`, 7020),
            ],
          })
        ),
      ],
    }),
    new Paragraph({ text: "" }),

    // 调研成果：一个大表格（标题、现状、全部内容都在同一表内）
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [9360],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders,
              width: { size: 9360, type: WidthType.DXA },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: "调研成果", bold: true, size: 28 })] })],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              borders,
              width: { size: 9360, type: WidthType.DXA },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: "现状", bold: true })] })],
            }),
          ],
        }),
        ...statusItems.map((s) =>
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: 9360, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun(s)] })],
              }),
            ],
          })
        ),
        ...extraItems.filter(Boolean).map((s) =>
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: 9360, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun(s)] })],
              }),
            ],
          })
        ),
      ],
    }),
  ];

  return new Document({
    styles: {
      default: { document: { run: { font: "宋体", size: 24 } } },
      paragraphStyles: [
        {
          id: "Title",
          name: "Title",
          basedOn: "Normal",
          run: { size: 32, bold: true, font: "黑体" },
          paragraph: { spacing: { before: 240, after: 120 }, alignment: AlignmentType.CENTER },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          run: { size: 28, bold: true, font: "黑体" },
          paragraph: { spacing: { before: 180, after: 120 } },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });
}

const inputPath = process.argv[2] || path.join(__dirname, "../reports/jiceng-zhili-zhinengti/2026-02-27-session-01.md");
const outputPath = process.argv[3] || inputPath.replace(/\.md$/i, ".docx");

if (!fs.existsSync(inputPath)) {
  console.error("文件不存在:", inputPath);
  process.exit(1);
}

const doc = buildDocFromReport(inputPath);
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(outputPath, buf);
  console.log("已导出:", outputPath);
});
