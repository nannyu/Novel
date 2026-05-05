/**
 * PRD Markdown -> Word 导出工具（product-planner 专用）
 *
 * 复用 project-solution-generator/scripts/md-to-docx.js 的核心逻辑。
 * 适配 PRD 文档命名（产品名称-PRD-vN.docx）。
 *
 * 用法：
 *   node scripts/md_to_docx.js <input.md> [output.docx] [--no-toc]
 *
 * 输出命名：未指定 output 时，按「产品名称-PRD-vN.docx」版本管理，不覆盖旧文件。
 * 名称从 MD 的「基本信息」表（产品名称）或首行 H1 解析。
 */

const fs = require("fs");
const path = require("path");

// 复用 project-solution-generator 的 md-to-docx 核心模块
// 优先：.cursor/skills/ 下兄弟目录；备选：工作区根目录
const CANDIDATE_PATHS = [
  path.resolve(__dirname, "../../project-solution-generator/scripts/md-to-docx.js"),
  path.resolve(__dirname, "../../../project-solution-generator/scripts/md-to-docx.js"),
];

let core;
for (const p of CANDIDATE_PATHS) {
  try {
    if (fs.existsSync(p)) {
      core = require(p);
      break;
    }
  } catch (_) {}
}
if (!core) {
  console.error(
    "无法加载 md-to-docx 核心模块，请确保 project-solution-generator 存在。尝试路径：",
    CANDIDATE_PATHS.join("；")
  );
  process.exit(1);
}

const {
  buildDocFromSolution,
  extractSolutionName,
  getNextVersion,
} = core;

const { Packer } = require("docx");

/* ── 解析 PRD 产品名称 ─────────────────────────────────── */

function extractProductName(content) {
  const lines = content.split("\n");
  // 从「基本信息」表格查找「产品名称」行
  let inMeta = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes("基本信息") || trimmed.includes("文档信息")) {
      inMeta = true;
      continue;
    }
    if (inMeta && trimmed.startsWith("|")) {
      const cells = trimmed
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      if (cells[0] === "产品名称" && cells[1] && cells[1] !== "") {
        return cells[1];
      }
    }
    if (inMeta && trimmed.startsWith("## ") && !trimmed.includes("信息")) break;
  }
  // 回退：从首行 H1 提取
  const h1 = lines.find(
    (l) => /^#\s+.+/.test(l.trim()) && !l.trim().startsWith("## ")
  );
  if (h1) {
    return h1.replace(/^#\s+/, "").replace(/产品需求文档.*$/, "").replace(/PRD.*$/, "").trim();
  }
  return null;
}

/* ── 版本号工具（复用） ─────────────────────────────────── */

function getNextPrdVersion(dir, productName) {
  const baseName = `${productName}-PRD`;
  const escaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${escaped}-v(\\d+)\\.docx$`, "i");
  let max = 0;
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir)
      .filter((f) => re.test(f))
      .forEach((f) => {
        const m = f.match(re);
        if (m) max = Math.max(max, parseInt(m[1], 10));
      });
  }
  return max + 1;
}

/* ── 命令行入口 ─────────────────────────────────────────── */

if (require.main === module) {
  const args = process.argv.slice(2);
  const noToc = args.includes("--no-toc");
  const argv = args.filter((a) => a !== "--no-toc");

  if (!argv[0]) {
    console.error("用法: node scripts/md_to_docx.js <input.md> [output.docx] [--no-toc]");
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), argv[0]);
  if (!fs.existsSync(inputPath)) {
    console.error("文件不存在:", inputPath);
    process.exit(1);
  }

  let outputPath;
  if (argv[1]) {
    outputPath = path.resolve(process.cwd(), argv[1]);
  } else {
    const content = fs.readFileSync(inputPath, "utf-8");
    const productName =
      extractProductName(content) ||
      extractSolutionName(content) ||
      path.basename(inputPath, ".md");
    const outDir = path.dirname(inputPath);
    const ver = getNextPrdVersion(outDir, productName);
    outputPath = path.join(outDir, `${productName}-PRD-v${ver}.docx`);
  }

  console.log("正在解析 Markdown 并构建 PRD 文档…");
  const doc = buildDocFromSolution(inputPath, noToc);

  (async () => {
    try {
      console.log("正在生成 Word 文档…");
      const buf = await Packer.toBuffer(doc);
      fs.writeFileSync(outputPath, buf);
      console.log("已导出:", outputPath);
    } catch (err) {
      console.error("导出失败:", err.message || err);
      process.exit(1);
    }
  })();
}
