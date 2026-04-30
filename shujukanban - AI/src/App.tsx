import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as echarts from 'echarts';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

type Platform = 'wechat' | 'xiaohongshu';
type RawRow = Record<string, string>;

type ContentItem = {
  title: string;
  publishDate: string;
  primaryCount: number;
  shareCount: number;
  followCount: number;
  deliveredCount: number;
  deliveryRate: number;
  completionRate: number;
  exposureCount: number;
  likeCount: number;
  commentCount: number;
  favoriteCount: number;
  clickRate: number;
  type: string;
  url: string;
};

type PlatformConfig = {
  id: Platform;
  name: string;
  eyebrow: string;
  title: string;
  source: string;
  defaultFile: string;
  uploadLabel: string;
  primaryLabel: string;
  topTitle: string;
  shareTitle: string;
  completionTitle: string;
  tableTitleLabel: string;
};

type ChartProps = {
  option: echarts.EChartsOption;
  className?: string;
  chartKey: string;
};

type TrendMetric = {
  key: keyof Pick<ContentItem, 'primaryCount' | 'likeCount' | 'favoriteCount' | 'commentCount' | 'shareCount'>;
  label: string;
};

type SortDirection = 'asc' | 'desc';
type SortKey =
  | 'publishDate'
  | 'title'
  | 'primaryCount'
  | 'shareCount'
  | 'likeCount'
  | 'favoriteCount'
  | 'commentCount'
  | 'followCount'
  | 'deliveredCount'
  | 'deliveryRate'
  | 'completionRate'
  | 'type'
  | 'exposureCount'
  | 'clickRate';

type SortState = {
  key: SortKey;
  direction: SortDirection;
};

type SortableHeaderProps = {
  label: string;
  sortKey: SortKey;
  activeSort: SortState;
  onSort: (key: SortKey) => void;
};

type SectionAnchor = 'hero' | 'metrics' | 'dashboard' | 'table';

type StoredDashboardState = {
  platform: Platform;
  itemsByPlatform: Record<Platform, ContentItem[]>;
  sourceNames: Record<Platform, string>;
};

type ImportedData = {
  platform: Platform;
  items: ContentItem[];
  warning?: string;
};

type TitleCategory = {
  name: string;
  readCount: number;
  itemCount: number;
  titles: string[];
  topTitle: string;
  topTitleReadCount: number;
};

type TitleCategoryAnalysis = {
  categories: TitleCategory[];
};

type TitleAnalysisItem = {
  id: number;
  title: string;
  readCount: number;
};

type CompletionAnalysisItem = {
  id: number;
  title: string;
  completionRate: number;
  readCount: number;
  shareCount: number;
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  url: string;
  articleText: string;
  articleWordCount: number;
  imageCount: number;
};

type CompletionRadarGroup = {
  scores: number[];
  points: string[];
};

type CompletionRateAnalysis = {
  dimensions: string[];
  top: CompletionRadarGroup;
  bottom: CompletionRadarGroup;
  recommendations: string[];
};

type NextArticleSuggestion = {
  theme: {
    topic: string;
    basis: string;
  };
  titles: Array<{
    title: string;
    basis: string;
  }>;
  cover: string;
  outline: string[];
};

type AiModelConfig = {
  provider: string;
  requestPath: string;
  model: string;
  apiKeyEnvName: string;
  upstreamBaseUrl: string;
  referer: string;
  title: string;
  requestTimeoutMs: number;
};

type PlatformSummary = {
  platformId: Platform;
  platform: string;
  primaryMetricName: string;
  totalPrimary: number;
  averageCompletion: number;
  topByPrimary: Array<{
    title: string;
    primaryCount: number;
    completionRate: number;
    followCount: number;
    likeCount: number;
    commentCount: number;
    favoriteCount: number;
    shareCount: number;
  }>;
};

const AI_REQUIREMENTS_PATH = '/ai-analysis-requirements.md';
const AI_MODEL_CONFIG_PATH = '/ai-model-config.json';
// 配置以 public/ai-model-config.json 为准，此处仅为加载失败时的兜底默认值。
const DEFAULT_AI_MODEL_CONFIG: AiModelConfig = {
  provider: 'OpenRouter',
  requestPath: '/api/openrouter/chat/completions',
  model: 'tencent/hy3-preview:free',
  apiKeyEnvName: 'OPENROUTER_API_KEY',
  upstreamBaseUrl: 'https://openrouter.ai/api/v1',
  referer: 'http://localhost',
  title: 'shujukanban-ai',
  requestTimeoutMs: 90000,
};
const STORAGE_KEY = 'shujukanban.dashboard.v1';
const defaultTableSort: SortState = { key: 'publishDate', direction: 'desc' };
const wechatRequiredFields = [
  '内容标题',
  '发表日期',
  '阅读人数',
  '分享人数',
  '阅读后关注人数',
  '送达人数',
  '送达完成率',
  '阅读完成率',
  '内容url',
] as const;
const xiaohongshuRequiredFields = ['笔记标题', '首次发布时间', '观看量'] as const;
const wechatDownloadTip =
  '导入成功。\n\n当前文件字段不完整，部分指标可能无法展示，会影响看板体验。\n\n如需导入完整明细，请在公众号后台（mp.weixin.qq.com）进入「数据分析 - 内容分析 - 已发表内容 - 已通知内容」，下载数据明细后再导入。';

const platformConfigs: Record<Platform, PlatformConfig> = {
  wechat: {
    id: 'wechat',
    name: '公众号',
    eyebrow: 'WeChat Analytics',
    title: '数据分析看板',
    source: '/default.csv',
    defaultFile: 'total_1774668963_1777260963.csv',
    uploadLabel: '导入公众号文件',
    primaryLabel: '阅读人数',
    topTitle: '阅读量 Top10',
    shareTitle: '分享次数 Top10',
    completionTitle: '阅读完成率 Top10',
    tableTitleLabel: '内容标题',
  },
  xiaohongshu: {
    id: 'xiaohongshu',
    name: '小红书',
    eyebrow: 'RED Note Analytics',
    title: '数据分析看板',
    source: '/xiaohongshu.csv',
    defaultFile: '笔记列表明细表.csv',
    uploadLabel: '导入小红书文件',
    primaryLabel: '观看量',
    topTitle: '观看量 Top10',
    shareTitle: '分享次数 Top10',
    completionTitle: '人均观看时长 Top10',
    tableTitleLabel: '笔记标题',
  },
};

const trendMetrics: Record<Platform, TrendMetric[]> = {
  wechat: [
    { key: 'primaryCount', label: '阅读人数' },
    { key: 'likeCount', label: '点赞量' },
    { key: 'favoriteCount', label: '收藏量' },
    { key: 'commentCount', label: '留言量' },
    { key: 'shareCount', label: '转发量' },
  ],
  xiaohongshu: [
    { key: 'primaryCount', label: '观看量' },
    { key: 'likeCount', label: '点赞' },
    { key: 'favoriteCount', label: '收藏' },
    { key: 'commentCount', label: '评论' },
    { key: 'shareCount', label: '分享' },
  ],
};

const numberFormatter = new Intl.NumberFormat('zh-CN');
const percentFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'percent',
  maximumFractionDigits: 1,
});

function formatDuration(seconds: number): string {
  const totalSeconds = Math.round(seconds);
  if (totalSeconds < 60) return `${numberFormatter.format(totalSeconds)}秒`;

  const minutes = Math.floor(totalSeconds / 60);
  const restSeconds = totalSeconds % 60;
  return restSeconds > 0
    ? `${numberFormatter.format(minutes)}分${numberFormatter.format(restSeconds)}秒`
    : `${numberFormatter.format(minutes)}分`;
}

function emptyItemsByPlatform(): Record<Platform, ContentItem[]> {
  return {
    wechat: [],
    xiaohongshu: [],
  };
}

function emptySourceNames(): Record<Platform, string> {
  return {
    wechat: '未导入数据',
    xiaohongshu: '未导入数据',
  };
}

function loadStoredDashboard(): StoredDashboardState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDashboardState;
    if (!parsed.itemsByPlatform || !parsed.sourceNames) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveStoredDashboard(state: StoredDashboardState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function dedupeItems(items: ContentItem[]): ContentItem[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = [
      item.publishDate,
      item.title,
      item.primaryCount,
      item.shareCount,
      item.followCount,
      item.deliveredCount,
      item.deliveryRate,
      item.completionRate,
      item.exposureCount,
      item.likeCount,
      item.commentCount,
      item.favoriteCount,
      item.clickRate,
      item.type,
      item.url,
    ].join('\u001f');

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getField(row: RawRow, names: string[]): string {
  for (const name of names) {
    const value = row[name];
    if (value !== undefined && value !== null) return String(value).trim();
  }
  return '';
}

function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  const normalized = value.trim().replace(/,/g, '').replace(/\+/g, '');
  if (!normalized) return 0;

  if (/万|w/i.test(normalized)) {
    return Math.round(Number.parseFloat(normalized.replace(/万|w/gi, '')) * 10000);
  }

  return Number.parseFloat(normalized) || 0;
}

function formatDate(value: string | undefined): string {
  if (!value) return '';
  const text = value.trim();
  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }

  const chineseDate = text.match(/^(\d{4})年(\d{2})月(\d{2})日/);
  if (chineseDate) {
    return `${chineseDate[1]}-${chineseDate[2]}-${chineseDate[3]}`;
  }

  return text;
}

function skipIntroLine(chunk: string): string {
  const lines = chunk.split(/\r?\n/);
  const firstLine = lines[0]?.replace(/^\uFEFF/, '').trim() ?? '';
  const isIntro =
    firstLine.startsWith('数据来源概况') ||
    firstLine.startsWith('最多导出排序后前1000条笔记');

  return isIntro ? lines.slice(1).join('\n') : chunk;
}

function parseRows(rows: RawRow[], platform: Platform): ContentItem[] {
  return rows
    .map((row) => {
      if (platform === 'xiaohongshu') {
        const title = getField(row, ['笔记标题']);
        return {
          title: title || '未命名笔记',
          publishDate: formatDate(getField(row, ['首次发布时间'])),
          primaryCount: parseNumber(getField(row, ['观看量'])),
          shareCount: parseNumber(getField(row, ['分享'])),
          followCount: parseNumber(getField(row, ['涨粉'])),
          deliveredCount: 0,
          deliveryRate: 0,
          completionRate: parseNumber(getField(row, ['人均观看时长'])),
          exposureCount: parseNumber(getField(row, ['曝光'])),
          likeCount: parseNumber(getField(row, ['点赞'])),
          commentCount: parseNumber(getField(row, ['评论'])),
          favoriteCount: parseNumber(getField(row, ['收藏'])),
          clickRate: parseNumber(getField(row, ['封面点击率'])),
          type: getField(row, ['体裁']),
          url: '',
        };
      }

      return {
        title: getField(row, ['内容标题']),
        publishDate: formatDate(getField(row, ['发表日期'])),
        primaryCount: parseNumber(getField(row, ['阅读人数'])),
        shareCount: parseNumber(getField(row, ['转发量', '转发人数', '分享量', '分享人数'])),
        followCount: parseNumber(getField(row, ['阅读后关注人数'])),
        deliveredCount: parseNumber(getField(row, ['送达人数'])),
        deliveryRate: parseNumber(getField(row, ['送达完成率'])),
        completionRate: parseNumber(getField(row, ['阅读完成率'])),
        exposureCount: 0,
        likeCount: parseNumber(getField(row, ['点赞量', '点赞人数', '点赞'])),
        commentCount: parseNumber(getField(row, ['留言量', '留言人数', '评论量', '评论人数'])),
        favoriteCount: parseNumber(getField(row, ['收藏量', '收藏人数', '收藏'])),
        clickRate: 0,
        type: '',
        url: getField(row, ['内容url']),
      };
    })
    .filter((item) => item.title && item.publishDate);
}

function validateRows(rows: RawRow[], platform: Platform): string | undefined {
  const fields = new Set(rows.flatMap((row) => Object.keys(row)));
  const requiredFields = platform === 'wechat' ? wechatRequiredFields : xiaohongshuRequiredFields;
  const missingFields = requiredFields.filter((field) => !fields.has(field));

  if (missingFields.length === 0) return undefined;

  if (platform === 'wechat' && fields.has('内容标题')) {
    return `${wechatDownloadTip}\n\n缺少字段：${missingFields.join('、')}`;
  }

  throw new Error(`文件字段不完整，缺少字段：${missingFields.join('、')}`);
}

function parseCsv(csvText: string, platform: Platform): ImportedData {
  const parsed = Papa.parse<RawRow>(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.replace(/^\uFEFF/, '').trim(),
    beforeFirstChunk: skipIntroLine,
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors.map((error) => error.message).join('；'));
  }

  return {
    platform,
    items: parseRows(parsed.data, platform),
    warning: validateRows(parsed.data, platform),
  };
}

function normalizeCell(value: unknown): string {
  return String(value ?? '').replace(/^\uFEFF/, '').trim();
}

function detectPlatformFromText(text: string): Platform {
  const normalizedText = skipIntroLine(text).slice(0, 1200);

  if (normalizedText.includes('笔记标题') || normalizedText.includes('观看量') || normalizedText.includes('封面点击率')) {
    return 'xiaohongshu';
  }

  return 'wechat';
}

function detectPlatformFromRows(rows: RawRow[]): Platform {
  const headers = rows
    .slice(0, 5)
    .flatMap((row) => Object.keys(row).concat(Object.values(row)))
    .join('\n');

  return detectPlatformFromText(headers);
}

function rowsFromWorksheet(sheet: XLSX.WorkSheet): RawRow[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false });
  const headerIndex = rows.findIndex(
    (row) => row.some((cell) => normalizeCell(cell) === '笔记标题') || row.some((cell) => normalizeCell(cell) === '内容标题'),
  );

  if (headerIndex < 0) return [];

  const headerRow = rows[headerIndex].map(normalizeCell);

  return rows.slice(headerIndex + 1).map((row) => {
    return headerRow.reduce<RawRow>((record, header, index) => {
      if (header) record[header] = normalizeCell(row[index]);
      return record;
    }, {});
  });
}

function parseExcel(buffer: ArrayBuffer): ImportedData {
  const workbook = XLSX.read(buffer, { type: 'array' });

  for (const sheetName of workbook.SheetNames) {
    const rows = rowsFromWorksheet(workbook.Sheets[sheetName]);
    if (rows.length === 0) continue;

    const platform = detectPlatformFromRows(rows);
    const items = parseRows(rows, platform);
    if (items.length > 0) return { platform, items, warning: validateRows(rows, platform) };
  }

  throw new Error('没有读取到有效数据');
}

function parseImportedFile(buffer: ArrayBuffer, fileName: string): ImportedData {
  const extension = fileName.split('.').pop()?.toLowerCase();

  if (extension === 'xlsx' || extension === 'xls') {
    return parseExcel(buffer);
  }

  const text = decodeCsv(buffer);
  const platform = detectPlatformFromText(text);
  return parseCsv(text, platform);
}

function compareItems(a: ContentItem, b: ContentItem, sort: SortState): number {
  const direction = sort.direction === 'asc' ? 1 : -1;
  const aValue = a[sort.key];
  const bValue = b[sort.key];

  if (typeof aValue === 'number' && typeof bValue === 'number') {
    return (aValue - bValue) * direction;
  }

  return String(aValue).localeCompare(String(bValue), 'zh-CN', { numeric: true }) * direction;
}

function decodeCsv(buffer: ArrayBuffer): string {
  const utf8Text = new TextDecoder('utf-8').decode(buffer);
  const firstLine = utf8Text.split(/\r?\n/)[0] ?? '';

  if (!firstLine.includes('�')) {
    return utf8Text;
  }

  return new TextDecoder('gb18030').decode(buffer);
}

function shortTitle(title: string, maxLength = 18): string {
  return title.length > maxLength ? `${title.slice(0, maxLength)}...` : title;
}

function Chart({ option, className, chartKey }: ChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const chart = echarts.init(containerRef.current, undefined, { renderer: 'canvas' });
    chart.clear();
    chart.setOption(option, { notMerge: true, lazyUpdate: false });

    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
    };
  }, [option, chartKey]);

  return <div className={className ?? 'chart'} ref={containerRef} />;
}

function platformColors(platform: Platform) {
  if (platform === 'xiaohongshu') {
    return {
      main: '#FF2442',
      deep: '#3D0B13',
      soft: '#FFE8EC',
      grid: '#F5CCD3',
      palette: ['#FF2442', '#FF6A7C', '#D91F3A', '#FFB3BD', '#7B2E37', '#FF8A00', '#A83745', '#F7A6B2', '#6F6B7A', '#F05D5E', '#C94F64'],
    };
  }

  return {
    main: '#07C160',
    deep: '#123C2C',
    soft: '#E7F8EF',
    grid: '#CDECDD',
    palette: ['#07C160', '#2E7D5B', '#1AAD19', '#82DFA7', '#176B48', '#5DD39E', '#009688', '#A6E7C5', '#4B8063', '#00A870', '#B8EACB'],
  };
}

function buildTopOption(items: ContentItem[], config: PlatformConfig): echarts.EChartsOption {
  const reversed = [...items].reverse();
  const colors = platformColors(config.id);

  return {
    grid: { top: 18, right: 22, bottom: 10, left: 128, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const item = Array.isArray(params) ? params[0] : params;
        const content = reversed[item.dataIndex];
        return `${content.title}<br/>${config.primaryLabel}：${numberFormatter.format(content.primaryCount)}`;
      },
    },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#6C747C' },
      splitLine: { lineStyle: { color: colors.grid } },
    },
    yAxis: {
      type: 'category',
      data: reversed.map((item) => shortTitle(item.title, 14)),
      axisLabel: { color: colors.deep, fontSize: 12 },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: reversed.map((item) => item.primaryCount),
        barWidth: 14,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: colors.deep },
            { offset: 1, color: colors.main },
          ]),
          borderRadius: [0, 8, 8, 0],
        },
      },
    ],
  };
}

function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);

  return text;
}

function getAiResponseContent(data: unknown): string {
  const response = data as {
    choices?: Array<{
      text?: unknown;
      message?: {
        content?: unknown;
        reasoning?: unknown;
      };
    }>;
  };
  const choice = response.choices?.[0];
  const content = choice?.message?.content;

  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) return String(part.text ?? '');
        return '';
      })
      .join('')
      .trim();
  }
  if (typeof choice?.text === 'string') return choice.text.trim();
  return '';
}

async function loadAiRequirements(): Promise<string> {
  try {
    const response = await fetch(AI_REQUIREMENTS_PATH, { cache: 'no-store' });
    if (!response.ok) return '';
    return response.text();
  } catch {
    return '';
  }
}

async function loadAiModelConfig(): Promise<AiModelConfig> {
  try {
    const response = await fetch(AI_MODEL_CONFIG_PATH, { cache: 'no-store' });
    if (!response.ok) return DEFAULT_AI_MODEL_CONFIG;
    const config = (await response.json()) as Partial<AiModelConfig>;

    return {
      ...DEFAULT_AI_MODEL_CONFIG,
      ...config,
      requestPath: config.requestPath?.trim() || DEFAULT_AI_MODEL_CONFIG.requestPath,
      model: config.model?.trim() || DEFAULT_AI_MODEL_CONFIG.model,
      requestTimeoutMs: Number(config.requestTimeoutMs) || DEFAULT_AI_MODEL_CONFIG.requestTimeoutMs,
    };
  } catch {
    return DEFAULT_AI_MODEL_CONFIG;
  }
}

function describeAiError(status: number, message: string): string {
  const lowerMessage = message.toLowerCase();
  if (status === 401 || lowerMessage.includes('unauthorized') || lowerMessage.includes('user not found')) {
    return 'AI 请求失败：API Key 无效、过期或不属于当前 OpenRouter 账号。请检查 ai-model-config.json 中的 apiKeyEnvName 和 .env.local 中对应的密钥。';
  }
  if (status === 402 || lowerMessage.includes('credit') || lowerMessage.includes('balance')) {
    return 'AI 请求失败：账号余额或免费额度不足。';
  }
  if (status === 429 || lowerMessage.includes('rate limit') || lowerMessage.includes('quota')) {
    return 'AI 请求失败：模型调用次数、频率或免费额度已达到限制，可以稍后再试或切换模型。';
  }
  if (status >= 500) {
    return `AI 请求失败：模型服务或 OpenRouter 上游异常（${status}）。`;
  }

  return `AI 请求失败：${status}${message ? `，${message.slice(0, 160)}` : ''}`;
}

async function readAiError(response: Response): Promise<Error> {
  const rawMessage = await response.text().catch(() => '');
  let message = rawMessage.trim();

  try {
    const parsed = JSON.parse(rawMessage) as { error?: { message?: string }; message?: string };
    message = parsed.error?.message || parsed.message || message;
  } catch {
    // Keep raw text when the provider does not return JSON.
  }

  return new Error(describeAiError(response.status, message));
}

async function fetchAiChat(aiConfig: AiModelConfig, body: unknown, label = 'AI'): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), aiConfig.requestTimeoutMs);
  const startTime = performance.now();

  try {
    const response = await fetch(aiConfig.requestPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
    console.log(`[AI] ${label} — ${elapsed}s, status ${response.status}`);
    return response;
  } catch (error) {
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.log(`[AI] ${label} — ${elapsed}s, TIMEOUT`);
      throw new Error('AI 请求超时：大模型反馈超过预期，可以稍后重试，或在 ai-model-config.json 中切换响应更快的模型。');
    }
    console.log(`[AI] ${label} — ${elapsed}s, ERROR`);
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function readArticleContent(item: ContentItem): Promise<Pick<CompletionAnalysisItem, 'articleText' | 'articleWordCount' | 'imageCount'>> {
  if (!item.url) {
    throw new Error(`《${item.title}》缺少文章 URL，无法读取正文。请导入包含内容url的明细后再分析。`);
  }

  const startTime = performance.now();
  const response = await fetch(`/api/article-content?url=${encodeURIComponent(item.url)}`);
  const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
  console.log(`[AI] 正文抓取《${item.title}》— ${elapsed}s, status ${response.status}`);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || `《${item.title}》正文读取失败。`);
  }

  const articleText = String(data?.text ?? '').trim();
  if (articleText.length < 80) {
    throw new Error(`《${item.title}》没有读取到足够正文内容，已停止 AI 分析。`);
  }

  return {
    articleText: articleText.slice(0, 5000),
    articleWordCount: Number(data?.wordCount) || articleText.length,
    imageCount: Number(data?.imageCount) || 0,
  };
}

function normalizeTitleAnalysis(raw: unknown, items: TitleAnalysisItem[]): TitleCategoryAnalysis {
  const itemMap = new Map(items.map((item, index) => [String(index + 1), item]));
  const bucket = new Map<string, TitleCategory>();
  const parsed = raw as { assignments?: Array<{ id?: number | string; category?: string }> };

  for (const assignment of parsed.assignments ?? []) {
    const item = itemMap.get(String(assignment.id ?? ''));
    const category = String(assignment.category ?? '').trim();
    if (!item || !category) continue;

    const current = bucket.get(category) ?? {
      name: category,
      readCount: 0,
      itemCount: 0,
      titles: [],
      topTitle: '',
      topTitleReadCount: 0,
    };
    current.readCount += item.readCount;
    current.itemCount += 1;
    current.titles.push(item.title);
    if (item.readCount > current.topTitleReadCount) {
      current.topTitle = item.title;
      current.topTitleReadCount = item.readCount;
    }
    bucket.set(category, current);
  }

  return {
    categories: [...bucket.values()].sort((a, b) => b.readCount - a.readCount),
  };
}

async function analyzeTitleCategories(items: ContentItem[], config: PlatformConfig): Promise<TitleCategoryAnalysis> {
  const requirements = await loadAiRequirements();
  const aiConfig = await loadAiModelConfig();
  const analyzableItems =
    config.id === 'xiaohongshu'
      ? items.filter((item) => item.title.trim() !== '未命名笔记')
      : items;

  if (analyzableItems.length === 0) {
    throw new Error('没有可用于标题类型分析的命名内容。');
  }

  const payloadItems: TitleAnalysisItem[] = analyzableItems
    .slice()
    .sort((a, b) => b.primaryCount - a.primaryCount)
    .slice(0, 200)
    .map((item, index) => ({
      id: index + 1,
      title: item.title,
      readCount: item.primaryCount,
    }));

  const response = await fetchAiChat(aiConfig, {
      model: aiConfig.model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You classify Chinese content titles into 3 to 5 concise business-readable categories. Return JSON only.\n\nEditable requirements:\n' +
            requirements,
        },
        {
          role: 'user',
          content: JSON.stringify({
            task:
              'Classify every title into 3 to 5 categories. Use short Chinese category names. Return exactly {"assignments":[{"id":1,"category":"类别"}]}.',
            metricName: config.primaryLabel,
            items: payloadItems,
          }),
        },
      ],
  }, '标题类型分析');

  if (!response.ok) {
    throw await readAiError(response);
  }

  const data = await response.json();
  const content = getAiResponseContent(data);
  if (!content) throw new Error('AI response is empty');

  const parsed = JSON.parse(extractJsonObject(content));
  const analysis = normalizeTitleAnalysis(parsed, payloadItems);
  if (analysis.categories.length < 1) throw new Error('AI did not return valid categories');

  return analysis;
}

function buildTitleCategoryOption(analysis: TitleCategoryAnalysis, config: PlatformConfig): echarts.EChartsOption {
  const colors = platformColors(config.id);
  const total = analysis.categories.reduce((sum, category) => sum + category.readCount, 0);
  const totalItems = analysis.categories.reduce((sum, category) => sum + category.itemCount, 0);

  return {
    color: colors.palette,
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '38%',
        style: {
          text: numberFormatter.format(total),
          fill: colors.deep,
          fontSize: 28,
          fontWeight: 900,
        },
        silent: true,
      },
      {
        type: 'text',
        left: 'center',
        top: '48%',
        style: {
          text: `${numberFormatter.format(totalItems)}篇标题`,
          fill: '#6C747C',
          fontSize: 13,
          fontWeight: 700,
        },
        silent: true,
      },
    ],
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const category = analysis.categories[params.dataIndex];
        return [
          category.name,
          `文章数量: ${numberFormatter.format(category.itemCount)}篇`,
          `${config.primaryLabel}: ${numberFormatter.format(category.readCount)}`,
          `占比: ${params.percent}%`,
          `最高: ${shortTitle(category.topTitle, 18)} (${numberFormatter.format(category.topTitleReadCount)})`,
        ].join('<br/>');
      },
    },
    legend: {
      bottom: 0,
      type: 'scroll',
      textStyle: { color: '#4B5563' },
    },
    series: [
      {
        type: 'pie',
        radius: ['44%', '70%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: '#FFFFFF',
          borderWidth: 3,
        },
        label: {
          color: colors.deep,
          formatter: (params) => {
            const category = analysis.categories[params.dataIndex];
            return `${category.name}\n${numberFormatter.format(category.itemCount)}篇 / ${numberFormatter.format(category.readCount)}\n${params.percent}%`;
          },
        },
        data: analysis.categories.map((category) => ({
          name: category.name,
          value: category.readCount,
        })),
      },
    ],
  };
}

function buildTitleCategoryRecommendations(analysis: TitleCategoryAnalysis, config: PlatformConfig): string[] {
  const categories = analysis.categories;
  const totalRead = categories.reduce((sum, category) => sum + category.readCount, 0);
  const totalItems = categories.reduce((sum, category) => sum + category.itemCount, 0);
  const leader = categories[0];

  if (!leader || totalRead <= 0 || totalItems <= 0) return ['当前样本不足，建议先导入更多文章后再判断标题类型带来的阅读变化。'];

  const leaderShare = leader.readCount / totalRead;
  const leaderAverage = leader.readCount / leader.itemCount;
  const otherRead = totalRead - leader.readCount;
  const otherItems = totalItems - leader.itemCount;
  const otherAverage = otherItems > 0 ? otherRead / otherItems : 0;
  const topTitleShareInCategory = leader.topTitleReadCount / leader.readCount;
  const suggestions = [
    `${leader.name}类标题贡献了${percentFormatter.format(leaderShare)}的${config.primaryLabel}，共${numberFormatter.format(leader.itemCount)}篇，平均每篇${numberFormatter.format(Math.round(leaderAverage))}。`,
  ];

  if (leader.itemCount === 1 || topTitleShareInCategory >= 0.65) {
    suggestions.push(
      `这个类型里主要由《${shortTitle(leader.topTitle, 24)}》拉高，占该类型${percentFormatter.format(topTitleShareInCategory)}的${config.primaryLabel}；建议继续做同方向标题，但先小批量复测，避免把单篇爆发误判为稳定规律。`,
    );
    if (otherAverage > 0) {
      suggestions.push(
        `除这篇高阅读文章外，其他标题类型的单篇水平大约在${numberFormatter.format(Math.round(otherAverage))}左右，差距没有总占比看起来那么大。`,
      );
    }
  } else if (otherAverage > 0 && leaderAverage >= otherAverage * 1.25) {
    suggestions.push(
      `${leader.name}类标题的单篇阅读明显高于其他类型，建议提高这类标题占比，并围绕读者明确收益、场景痛点和可操作方法继续拆选题。`,
    );
  } else {
    suggestions.push(
      `各类型单篇阅读差距不大，建议不要只按类型扩量，优先复盘 Top10 里的具体表达方式，再测试标题关键词、数字化承诺和受众场景。`,
    );
  }

  if (/工具|教程|指南|方法|实操|入门|AI/i.test(leader.name + leader.titles.join(' '))) {
    suggestions.push('工具类、教程类标题已经表现出优势，可以继续多写，但每篇都要强化“能解决什么问题”和“读完能做什么”。');
  } else {
    suggestions.push('下一轮可以专门增加工具类教程或实操指南标题，和当前高阅读类型做 A/B 对比，看阅读量提升来自标题类型还是单篇选题。');
  }

  return suggestions;
}

function clampScore(value: unknown): number {
  const score = Number(value);
  if (!Number.isFinite(score)) return 50;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeCompletionAnalysis(raw: unknown): CompletionRateAnalysis {
  const parsed = raw as Partial<CompletionRateAnalysis>;
  const fallbackDimensions = ['篇幅适配', '表达清晰', '结构节奏', '配图支撑', '标题匹配'];
  const dimensions =
    Array.isArray(parsed.dimensions) && parsed.dimensions.length >= 3
      ? parsed.dimensions.slice(0, 5).map((item) => String(item).trim()).filter(Boolean)
      : fallbackDimensions;

  function normalizeGroup(group: unknown, fallbackPoints: string[]): CompletionRadarGroup {
    const value = group as Partial<CompletionRadarGroup>;
    return {
      scores:
        Array.isArray(value.scores) && value.scores.length > 0
          ? dimensions.map((_, index) => clampScore(value.scores?.[index] ?? 50))
          : dimensions.map(() => 50),
      points:
        Array.isArray(value.points) && value.points.length > 0
          ? value.points.slice(0, 3).map((point) => String(point).trim()).filter(Boolean)
          : fallbackPoints,
    };
  }

  const recommendations =
    Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0
      ? parsed.recommendations.slice(0, 3).map((item) => String(item).trim()).filter(Boolean)
      : ['建议补充正文篇幅、配图数量和正文结构信息，再复测阅读完成率差异。'];

  return {
    dimensions,
    top: normalizeGroup(parsed.top, ['前5名通常在标题承诺、内容节奏和读者预期匹配上更稳定。']),
    bottom: normalizeGroup(parsed.bottom, ['后5名可能存在篇幅、表达节奏或配图支撑不足的问题。']),
    recommendations,
  };
}

function normalizeNextArticleSuggestion(raw: unknown): NextArticleSuggestion {
  const parsed = raw as Partial<NextArticleSuggestion>;
  const theme = parsed.theme && typeof parsed.theme === 'object' ? parsed.theme : undefined;
  const topic = String(theme?.topic ?? '').trim();
  const basis = String(theme?.basis ?? '').trim();
  const titles = Array.isArray(parsed.titles)
    ? parsed.titles
        .slice(0, 3)
        .map((item) => ({
          title: String(item?.title ?? '').trim(),
          basis: String(item?.basis ?? '').trim(),
        }))
        .filter((item) => item.title && item.basis)
    : [];
  const outline = Array.isArray(parsed.outline)
    ? parsed.outline
        .slice(0, 6)
        .map((item) => String(item).trim())
        .filter(Boolean)
    : [];
  const cover = String(parsed.cover ?? '').trim();

  if (!topic || !basis || titles.length === 0 || !cover || outline.length === 0) {
    throw new Error('AI 返回内容不完整：没有生成有效的主题、标题、封面图或写作思路。');
  }

  return {
    theme: {
      topic,
      basis,
    },
    titles,
    cover,
    outline,
  };
}

function formatNextArticleMetric(summary: PlatformSummary, value: number): string {
  return summary.platformId === 'wechat' ? percentFormatter.format(value) : formatDuration(value);
}

function buildNextArticleBrief(platformSummaries: PlatformSummary[]): string {
  return platformSummaries
    .map((summary) => {
      const metricLabel = summary.platformId === 'wechat' ? '平均完成率' : '平均观看时长';
      const topItems = summary.topByPrimary
        .map((item, index) => {
          if (summary.platformId === 'wechat') {
            return `${index + 1}. ${item.title || '未命名'} | 阅读${numberFormatter.format(item.primaryCount)} 完成率${percentFormatter.format(item.completionRate)} 关注${numberFormatter.format(item.followCount)} 分享${numberFormatter.format(item.shareCount)}`;
          }

          return `${index + 1}. ${item.title || '未命名'} | 观看${numberFormatter.format(item.primaryCount)} 时长${formatDuration(item.completionRate)} 赞${numberFormatter.format(item.likeCount)} 评${numberFormatter.format(item.commentCount)} 藏${numberFormatter.format(item.favoriteCount)} 转${numberFormatter.format(item.shareCount)}`;
        })
        .join('\n');

      return `【${summary.platform}】总${summary.primaryMetricName}${numberFormatter.format(summary.totalPrimary)} ${metricLabel}${formatNextArticleMetric(summary, summary.averageCompletion)}\n${topItems || '暂无'}`;
    })
    .join('\n\n');
}

function extractNamedSection(text: string, currentName: string, nextNames: string[]): string {
  const bold = '\\*{0,2}';
  const current = new RegExp(`(?:^|\\n)\\s*(?:#{1,3}\\s*)?${bold}${currentName}${bold}\\s*[:：]?\\s*`, 'i');
  const startMatch = current.exec(text);
  if (!startMatch) return '';

  const start = (startMatch.index ?? 0) + startMatch[0].length;
  const rest = text.slice(start);
  if (nextNames.length === 0) return rest.trim();

  const next = new RegExp(`\\n\\s*(?:#{1,3}\\s*)?${bold}(?:${nextNames.join('|')})${bold}\\s*[:：]?`, 'i');
  const nextMatch = next.exec(rest);
  return (nextMatch ? rest.slice(0, nextMatch.index) : rest).trim();
}

function parseNextArticleSuggestionText(content: string): NextArticleSuggestion {
  const cleanContent = content.replace(/```(?:json|markdown)?|```/gi, '').trim();
  const themeText = extractNamedSection(cleanContent, '主题', ['标题', '封面图', '写作思路']);
  const titleText = extractNamedSection(cleanContent, '标题', ['封面图', '写作思路']);
  const coverText = extractNamedSection(cleanContent, '封面图', ['写作思路']);
  const outlineText = extractNamedSection(cleanContent, '写作思路', []);
  if (!themeText || !titleText || !coverText || !outlineText) {
    throw new Error('AI 返回内容不完整：需要包含“主题、标题、封面图、写作思路”四段。');
  }
  const themeLines = themeText
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•\d.、\s]+/, '').replace(/\*\*/g, '').trim())
    .filter(Boolean);
  const rawTitleLines = titleText
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•\d.、\s]+/, '').trim())
    .filter(Boolean);
  const titles = rawTitleLines
    .slice(0, 3)
    .map((line) => {
      const [title, ...basisParts] = line.split(/[：:]/);
      return {
        title: title.replace(/\*\*/g, '').replace(/[《》"]/g, '').trim(),
        basis: basisParts.join('：').trim() || 'AI 根据当前跨平台数据表现给出的标题方向。',
      };
    })
    .filter((item) => item.title);
  const outline = outlineText
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•\d.、\s]+/, '').replace(/\*\*/g, '').trim())
    .filter(Boolean)
    .slice(0, 6);

  return normalizeNextArticleSuggestion({
    theme: {
      topic: themeLines[0] || cleanContent.slice(0, 60),
      basis: themeLines.slice(1).join(' ') || themeText,
    },
    titles,
    cover: coverText,
    outline,
  });
}

async function analyzeNextArticleSuggestion(
  itemsByPlatform: Record<Platform, ContentItem[]>,
): Promise<NextArticleSuggestion> {
  const allRequirements = await loadAiRequirements();
  const requirements = extractNamedSection(allRequirements, '下一篇文章写作建议', ['阅读完成率分析']);
  const aiConfig = await loadAiModelConfig();
  const platformSummaries: PlatformSummary[] = (Object.keys(platformConfigs) as Platform[]).map((platformId) => {
    const config = platformConfigs[platformId];
    const platformItems = itemsByPlatform[platformId];
    const totalPrimary = platformItems.reduce((sum, item) => sum + item.primaryCount, 0);
    const averageCompletion = platformItems.length
      ? platformItems.reduce((sum, item) => sum + item.completionRate, 0) / platformItems.length
      : 0;

    return {
      platformId,
      platform: config.name,
      primaryMetricName: config.primaryLabel,
      totalPrimary,
      averageCompletion,
      topByPrimary: platformItems
        .slice()
        .sort((a, b) => b.primaryCount - a.primaryCount)
        .slice(0, 5)
        .map((item) => ({
          title: item.title,
          primaryCount: item.primaryCount,
          completionRate: item.completionRate,
          followCount: item.followCount,
          likeCount: item.likeCount,
          commentCount: item.commentCount,
          favoriteCount: item.favoriteCount,
          shareCount: item.shareCount,
        })),
    };
  });

  const dataBrief = buildNextArticleBrief(platformSummaries);
  const prompt = `基于以下数据，给出下一篇文章写作建议。用自然语言输出，不要返回 JSON，按"主题、标题、封面图、写作思路"四个小标题组织。如果某方向只是单篇拉高，要直接说明。

补充要求：
${requirements}

数据：
${dataBrief}`;

  const response = await fetchAiChat(aiConfig, {
      model: aiConfig.model,
      temperature: 0.7,
      max_tokens: 1200,
      messages: [
        {
          role: 'system',
          content:
            '你是中文内容选题顾问。你的任务是根据公众号和小红书数据，给作者下一篇文章的选题、标题、封面图和写作思路建议。请说人话，给明确依据。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
  }, '写作建议');

  if (!response.ok) {
    throw await readAiError(response);
  }

  const data = await response.json();
  const content = getAiResponseContent(data);
  if (!content) throw new Error('AI response is empty');

  try {
    return normalizeNextArticleSuggestion(JSON.parse(extractJsonObject(content)));
  } catch {
    return parseNextArticleSuggestionText(content);
  }
}

async function analyzeCompletionRates(items: ContentItem[], config: PlatformConfig): Promise<CompletionRateAnalysis> {
  const requirements = await loadAiRequirements();
  const aiConfig = await loadAiModelConfig();
  const sorted = items
    .filter((item) => item.completionRate > 0)
    .sort((a, b) => b.completionRate - a.completionRate);
  const selectedItems = [...sorted.slice(0, 5), ...sorted.slice(-5).reverse()];
  const pickedItems: CompletionAnalysisItem[] = await Promise.all(
    selectedItems.map(async (item, index) => ({
      id: index + 1,
      title: item.title,
      completionRate: item.completionRate,
      readCount: item.primaryCount,
      shareCount: item.shareCount,
      likeCount: item.likeCount,
      favoriteCount: item.favoriteCount,
      commentCount: item.commentCount,
      url: item.url,
      ...(await readArticleContent(item)),
    })),
  );

  const response = await fetchAiChat(aiConfig, {
      model: aiConfig.model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You analyze Chinese content completion performance. Return JSON only. Article body text is mandatory and has already been fetched before this request. Do not analyze completion rate without using articleText.\n\nEditable requirements:\n' +
            requirements,
        },
        {
          role: 'user',
          content: JSON.stringify({
            task:
              'Compare completion-rate top 5 and bottom 5 articles. You must base the analysis on the provided articleText, articleWordCount, imageCount, title, and metrics. Use 3 to 5 concrete, asymmetric dimensions. Do not reuse the same vague dimensions for good and bad articles just with different scores. The bottom group can have only 3 clear problem dimensions if that is more truthful. Name specific avoidable issues such as filler writing, AI-like generic writing, weak opening, overlong body, poor image support, or title-body mismatch when supported by the article text. Keep points concise: top points max 3, bottom points max 3, recommendations max 3. If no useful recommendation can be inferred, say so directly. Return exactly {"dimensions":["维度"],"top":{"scores":[0-100],"points":["前五优点"]},"bottom":{"scores":[0-100],"points":["后五缺点"]},"recommendations":["建议"]}.',
            metricName: config.completionTitle,
            primaryMetricName: config.primaryLabel,
            top5: pickedItems.slice(0, 5),
            bottom5: pickedItems.slice(5),
          }),
        },
      ],
  }, '完成率分析');

  if (!response.ok) {
    throw await readAiError(response);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('AI response is empty');

  return normalizeCompletionAnalysis(JSON.parse(extractJsonObject(content)));
}

function buildCompletionRadarOption(
  analysis: CompletionRateAnalysis,
  group: CompletionRadarGroup,
  title: string,
  config: PlatformConfig,
): echarts.EChartsOption {
  const colors = platformColors(config.id);

  return {
    color: [colors.main],
    tooltip: { trigger: 'item' },
    radar: {
      indicator: analysis.dimensions.map((dimension) => ({ name: dimension, max: 100 })),
      radius: '62%',
      axisName: { color: colors.deep, fontSize: 11 },
      splitLine: { lineStyle: { color: colors.grid } },
      splitArea: { areaStyle: { color: ['rgba(255,255,255,0.92)', colors.soft] } },
      axisLine: { lineStyle: { color: colors.grid } },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            name: title,
            value: group.scores,
            areaStyle: { color: config.id === 'wechat' ? 'rgba(7, 193, 96, 0.22)' : 'rgba(255, 36, 66, 0.18)' },
            lineStyle: { width: 3, color: colors.main },
            symbolSize: 5,
          },
        ],
      },
    ],
  };
}

function buildTrendOption(items: ContentItem[], config: PlatformConfig, metric: TrendMetric): echarts.EChartsOption {
  const sorted = [...items].sort((a, b) => a.publishDate.localeCompare(b.publishDate));
  const colors = platformColors(config.id);

  return {
    grid: { top: 24, right: 28, bottom: 56, left: 56, containLabel: true },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const item = Array.isArray(params) ? params[0] : params;
        const content = sorted[item.dataIndex];
        return `${content.publishDate}<br/>${content.title}<br/>${metric.label}：${numberFormatter.format(Number(content[metric.key]) || 0)}`;
      },
    },
    xAxis: {
      type: 'category',
      data: sorted.map((item) => item.publishDate.slice(5)),
      axisLabel: { color: '#6C747C', rotate: 35 },
      axisLine: { lineStyle: { color: colors.grid } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#6C747C' },
      splitLine: { lineStyle: { color: colors.grid } },
    },
    series: [
      {
        type: 'line',
        data: sorted.map((item) => Number(item[metric.key]) || 0),
        smooth: true,
        symbolSize: 7,
        lineStyle: { width: 3, color: colors.deep },
        itemStyle: { color: colors.main, borderWidth: 2, borderColor: '#FFFFFF' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: config.id === 'wechat' ? 'rgba(7, 193, 96, 0.22)' : 'rgba(255, 36, 66, 0.2)' },
            { offset: 1, color: 'rgba(255, 255, 255, 0)' },
          ]),
        },
      },
    ],
  };
}

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <section className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </section>
  );
}

function SortableHeader({ label, sortKey, activeSort, onSort }: SortableHeaderProps) {
  const isActive = activeSort.key === sortKey;
  const indicator = isActive && activeSort.direction === 'asc' ? '↑' : '↓';

  return (
    <th aria-sort={isActive ? (activeSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button className={isActive ? 'sort-button active' : 'sort-button'} type="button" onClick={() => onSort(sortKey)}>
        <span>{label}</span>
        <span aria-hidden="true">{indicator}</span>
      </button>
    </th>
  );
}

function PlatformSwitch({
  platform,
  onChange,
  className,
  ariaLabel,
}: {
  platform: Platform;
  onChange: (platform: Platform) => void;
  className: string;
  ariaLabel: string;
}) {
  return (
    <div className={className} aria-label={ariaLabel}>
      {(Object.keys(platformConfigs) as Platform[]).map((mode) => (
        <button
          className={platform === mode ? 'active' : ''}
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
        >
          {platformConfigs[mode].name}
        </button>
      ))}
    </div>
  );
}

function BackToTopButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="floating-top-button" type="button" onClick={onClick} aria-label="回到顶部" title="回到顶部">
      ↑
    </button>
  );
}

function AiBadge() {
  return <span className="ai-badge">AI</span>;
}

function RankedList({
  title,
  items,
  getValue,
  formatValue,
  className,
  sortDirection = 'desc',
  action,
}: {
  title: string;
  items: ContentItem[];
  getValue: (item: ContentItem) => number;
  formatValue: (value: number) => string;
  className?: string;
  sortDirection?: SortDirection;
  action?: ReactNode;
}) {
  return (
    <section className={className ? `panel compact-panel ${className}` : 'panel compact-panel'}>
      <div className="panel-heading">
        <h2>{title}</h2>
        {action}
      </div>
      <div className="rank-list">
        {items
          .filter((item) => getValue(item) > 0)
          .sort((a, b) => (sortDirection === 'desc' ? getValue(b) - getValue(a) : getValue(a) - getValue(b)))
          .slice(0, 10)
          .map((item, index) => (
            <article className="rank-item" key={`${title}-${index}-${item.publishDate}-${item.title}`}>
              <span className="rank-number">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <strong>{item.title}</strong>
                <small>{item.publishDate}</small>
              </div>
              <b>{formatValue(getValue(item))}</b>
            </article>
          ))}
      </div>
    </section>
  );
}

function App() {
  const [platform, setPlatform] = useState<Platform>('wechat');
  const [trendMetricKeys, setTrendMetricKeys] = useState<Record<Platform, TrendMetric['key']>>({
    wechat: 'primaryCount',
    xiaohongshu: 'primaryCount',
  });
  const [tableSort, setTableSort] = useState<SortState>(defaultTableSort);
  const [itemsByPlatform, setItemsByPlatform] = useState<Record<Platform, ContentItem[]>>(emptyItemsByPlatform);
  const [sourceNames, setSourceNames] = useState<Record<Platform, string>>(emptySourceNames);
  const [error, setError] = useState('');
  const [titleAnalyses, setTitleAnalyses] = useState<Partial<Record<Platform, TitleCategoryAnalysis>>>({});
  const [completionAnalyses, setCompletionAnalyses] = useState<Partial<Record<Platform, CompletionRateAnalysis>>>({});
  const [nextArticleSuggestion, setNextArticleSuggestion] = useState<NextArticleSuggestion | null>(null);
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [aiError, setAiError] = useState('');
  const [completionAiStatus, setCompletionAiStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [completionAiError, setCompletionAiError] = useState('');
  const [nextArticleAiStatus, setNextArticleAiStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [nextArticleAiError, setNextArticleAiError] = useState('');
  const [completionSortDirection, setCompletionSortDirection] = useState<SortDirection>('desc');
  const [showFloatingControls, setShowFloatingControls] = useState(false);
  const heroRef = useRef<HTMLElement | null>(null);
  const topSwitchRef = useRef<HTMLDivElement | null>(null);
  const metricsRef = useRef<HTMLElement | null>(null);
  const dashboardRef = useRef<HTMLElement | null>(null);
  const tableRef = useRef<HTMLElement | null>(null);

  const config = platformConfigs[platform];
  const items = itemsByPlatform[platform];
  const currentTrendMetrics = trendMetrics[platform];
  const activeTrendMetric =
    currentTrendMetrics.find((metric) => metric.key === trendMetricKeys[platform]) ?? currentTrendMetrics[0];
  const currentTitleAnalysis = titleAnalyses[platform];
  const currentCompletionAnalysis = completionAnalyses[platform];

  useEffect(() => {
    const stored = loadStoredDashboard();
    if (!stored) return;

    setItemsByPlatform({
      ...emptyItemsByPlatform(),
      wechat: dedupeItems(stored.itemsByPlatform.wechat ?? []),
      xiaohongshu: dedupeItems(stored.itemsByPlatform.xiaohongshu ?? []),
    });
    setSourceNames({
      ...emptySourceNames(),
      ...stored.sourceNames,
    });
  }, []);

  useEffect(() => {
    const topSwitch = topSwitchRef.current;
    if (!topSwitch) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowFloatingControls(!entry.isIntersecting);
      },
      { threshold: 0 },
    );

    observer.observe(topSwitch);
    return () => observer.disconnect();
  }, []);

  const stats = useMemo(() => {
    const totalPrimary = items.reduce((sum, item) => sum + item.primaryCount, 0);
    const totalShares = items.reduce((sum, item) => sum + item.shareCount, 0);
    const totalFollows = items.reduce((sum, item) => sum + item.followCount, 0);
    const totalExposure = items.reduce((sum, item) => sum + item.exposureCount, 0);
    const maxPrimary = Math.max(...items.map((item) => item.primaryCount), 0);
    const highCount = items.filter((item) => item.primaryCount >= 100000).length;
    const totalInteractions = items.reduce(
      (sum, item) => sum + item.likeCount + item.commentCount + item.favoriteCount + item.shareCount,
      0,
    );

    return {
      totalPrimary,
      totalShares,
      totalFollows,
      totalExposure,
      totalInteractions,
      maxPrimary,
      highCount,
      averagePrimary: items.length ? Math.round(totalPrimary / items.length) : 0,
      highRate: items.length ? highCount / items.length : 0,
    };
  }, [items]);

  const topItems = useMemo(
    () => [...items].sort((a, b) => b.primaryCount - a.primaryCount).slice(0, 10),
    [items],
  );

  const sortedItems = useMemo(() => [...items].sort((a, b) => compareItems(a, b, tableSort)), [items, tableSort]);

  function handleTableSort(key: SortKey) {
    setTableSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
  }

  function getActiveSectionAnchor(): SectionAnchor {
    const entries: Array<[SectionAnchor, HTMLElement | null]> = [
      ['hero', heroRef.current],
      ['metrics', metricsRef.current],
      ['dashboard', dashboardRef.current],
      ['table', tableRef.current],
    ];

    const visibleSections = entries
      .filter(([, element]) => element)
      .map(([anchor, element]) => [anchor, element!.getBoundingClientRect().top] as const)
      .filter(([, top]) => top <= 120);
    const current = visibleSections[visibleSections.length - 1];

    return current?.[0] ?? 'hero';
  }

  function scrollToSection(anchor: SectionAnchor) {
    const sectionMap: Record<SectionAnchor, HTMLElement | null> = {
      hero: heroRef.current,
      metrics: metricsRef.current,
      dashboard: dashboardRef.current,
      table: tableRef.current,
    };

    sectionMap[anchor]?.scrollIntoView({ block: 'start' });
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handlePlatformChange(nextPlatform: Platform) {
    const activeSection = getActiveSectionAnchor();
    setPlatform(nextPlatform);
    setTableSort(defaultTableSort);
    requestAnimationFrame(() => scrollToSection(activeSection));
  }

  function handleUpload(file: File | undefined) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (!(reader.result instanceof ArrayBuffer)) {
          throw new Error('文件读取失败');
        }
        const { platform: detectedPlatform, items, warning } = parseImportedFile(reader.result, file.name);
        const nextItems = dedupeItems(items);

        if (nextItems.length === 0) {
          throw new Error('没有读取到有效数据');
        }

        setPlatform(detectedPlatform);
        setTableSort(defaultTableSort);
        setItemsByPlatform((current) => {
          const nextItemsByPlatform = { ...current, [detectedPlatform]: nextItems };
          const nextSourceNames = { ...sourceNames, [detectedPlatform]: file.name };
          saveStoredDashboard({
            platform: detectedPlatform,
            itemsByPlatform: nextItemsByPlatform,
            sourceNames: nextSourceNames,
          });
          return nextItemsByPlatform;
        });
        setSourceNames((current) => ({ ...current, [detectedPlatform]: file.name }));
        setTitleAnalyses((current) => ({ ...current, [detectedPlatform]: undefined }));
        setCompletionAnalyses((current) => ({ ...current, [detectedPlatform]: undefined }));
        setNextArticleSuggestion(null);
        setAiStatus('idle');
        setAiError('');
        setCompletionAiStatus('idle');
        setCompletionAiError('');
        setNextArticleAiStatus('idle');
        setNextArticleAiError('');
        setError('');
        if (warning) {
          window.alert(warning);
        }
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : '文件解析失败');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleAnalyzeTitles() {
    if (items.length === 0 || aiStatus === 'loading') return;

    setAiStatus('loading');
    setAiError('');

    try {
      const analysis = await analyzeTitleCategories(items, config);
      setTitleAnalyses((current) => ({ ...current, [platform]: analysis }));
      setAiStatus('ready');
    } catch (analysisError) {
      setAiStatus('error');
      setAiError(analysisError instanceof Error ? analysisError.message : 'AI title analysis failed');
    }
  }

  async function handleAnalyzeCompletionRates() {
    if (items.length === 0 || completionAiStatus === 'loading') return;

    setCompletionAiStatus('loading');
    setCompletionAiError('');

    try {
      const analysis = await analyzeCompletionRates(items, config);
      setCompletionAnalyses((current) => ({ ...current, [platform]: analysis }));
      setCompletionAiStatus('ready');
    } catch (analysisError) {
      setCompletionAiStatus('error');
      setCompletionAiError(analysisError instanceof Error ? analysisError.message : 'AI completion analysis failed');
    }
  }

  async function handleAnalyzeNextArticle() {
    if (nextArticleAiStatus === 'loading') return;

    const hasAnyData = (Object.keys(itemsByPlatform) as Platform[]).some((platformId) => itemsByPlatform[platformId].length > 0);
    if (!hasAnyData) return;

    setNextArticleAiStatus('loading');
    setNextArticleAiError('');

    try {
      const suggestion = await analyzeNextArticleSuggestion(itemsByPlatform);
      setNextArticleSuggestion(suggestion);
      setNextArticleAiStatus('ready');
    } catch (analysisError) {
      setNextArticleAiStatus('error');
      setNextArticleAiError(analysisError instanceof Error ? analysisError.message : 'AI next article suggestion failed');
    }
  }

  return (
    <main className={`app-shell theme-${platform}`}>
      <div className={showFloatingControls ? 'floating-controls visible' : 'floating-controls'} aria-hidden={!showFloatingControls}>
        <PlatformSwitch
          platform={platform}
          onChange={handlePlatformChange}
          className="floating-mode-tabs"
          ariaLabel="浮动看板切换"
        />
        <BackToTopButton onClick={scrollToTop} />
      </div>
      <section className="hero" ref={heroRef}>
        <div>
          <div ref={topSwitchRef}>
            <PlatformSwitch
              platform={platform}
              onChange={handlePlatformChange}
              className="mode-tabs"
              ariaLabel="看板切换"
            />
          </div>
          <p className="eyebrow">{config.eyebrow}</p>
          <h1>{config.title}</h1>
          <div className="import-guide" aria-label="导入操作说明">
            <p>
              公众号：在公众号后台（mp.weixin.qq.com）- 数据分析 - 内容分析 - 已发表内容 - 已通知内容中，下载数据明细，导入进去即可。
            </p>
            <p>
              小红书：在小红书创作服务平台（creator.xiaohongshu.com）- 数据看板 - 内容分析 - 笔记数据，导出数据，导入进去即可。
            </p>
          </div>
        </div>
        <div className="upload-area">
          <label className="upload-button">
            <input accept=".csv,.xls,.xlsx,text/csv" type="file" onChange={(event) => handleUpload(event.target.files?.[0])} />
            {config.uploadLabel}
          </label>
          <p className="source-name">数据源：{sourceNames[platform]}</p>
        </div>
      </section>

      {error ? <div className="error-banner">{error}</div> : null}

      {items.length === 0 ? (
        <section className="empty-panel">
          <h2>{config.name}看板暂无数据</h2>
          <p>请导入对应平台的 CSV、XLS 或 XLSX 文件。导入后页面会自动识别字段、切换看板，并在下次打开时恢复这台电脑上的上次数据。</p>
        </section>
      ) : null}

      <section className="metric-grid" ref={metricsRef}>
        <MetricCard label="内容数" value={`${items.length}`} note="已导入有效内容" />
        <MetricCard label={`总${config.primaryLabel}`} value={numberFormatter.format(stats.totalPrimary)} note={`${config.primaryLabel}加总`} />
        <MetricCard label={`平均${config.primaryLabel}`} value={numberFormatter.format(stats.averagePrimary)} note="单篇平均水平" />
        <MetricCard label={`最高${config.primaryLabel}`} value={numberFormatter.format(stats.maxPrimary)} note="单篇峰值" />
        {platform === 'wechat' ? (
          <>
            <MetricCard label="总分享人数" value={numberFormatter.format(stats.totalShares)} note="分享人数加总" />
            <MetricCard label="阅读后关注" value={numberFormatter.format(stats.totalFollows)} note="关注转化线索" />
          </>
        ) : (
          <>
            <MetricCard label="总曝光" value={numberFormatter.format(stats.totalExposure)} note="曝光加总" />
            <MetricCard label="总互动" value={numberFormatter.format(stats.totalInteractions)} note="赞评藏转合计" />
          </>
        )}
      </section>

      {items.length > 0 ? (
      <>
      <section className="dashboard-grid" ref={dashboardRef}>
        <section className="panel wide-panel">
          <div className="panel-heading">
            <h2>{config.topTitle}</h2>
            <span>按{config.primaryLabel}降序</span>
          </div>
          <Chart chartKey={`${platform}-top-${sourceNames[platform]}`} option={buildTopOption(topItems, config)} />
        </section>

        <section className="panel title-analysis-panel">
          <div className="panel-heading">
            <h2>标题类型分析 <AiBadge /></h2>
            <button className="ai-action-button" type="button" onClick={handleAnalyzeTitles} disabled={aiStatus === 'loading'}>
              {aiStatus === 'loading' ? '分析中...' : currentTitleAnalysis ? '重新分析' : '开始分析'}
            </button>
          </div>
          {currentTitleAnalysis ? (
            <>
              <Chart
                chartKey={`${platform}-ai-title-${sourceNames[platform]}-${currentTitleAnalysis.categories.map((category) => category.name).join('|')}`}
                option={buildTitleCategoryOption(currentTitleAnalysis, config)}
                className="title-analysis-chart"
              />
              <div className="ai-recommendations">
                <strong>分析建议</strong>
                {buildTitleCategoryRecommendations(currentTitleAnalysis, config).map((recommendation) => (
                  <p key={recommendation}>{recommendation}</p>
                ))}
              </div>
            </>
          ) : (
            <div className="ai-empty-state">
              <strong>待分析</strong>
              <span>点击后由 OpenRouter 模型将标题归为 3-5 类，并按文章数量和{config.primaryLabel}分析标题类型带来的阅读量变化。</span>
              {aiStatus === 'loading' ? <small>由于大模型反馈较慢，请耐心等待。</small> : null}
              {aiStatus === 'error' ? <small>{aiError}</small> : null}
            </div>
          )}
        </section>

        <RankedList
          title={config.completionTitle}
          items={items}
          getValue={(item) => item.completionRate}
          formatValue={(value) => (platform === 'wechat' ? percentFormatter.format(value) : formatDuration(value))}
          className="completion-rank-panel"
          sortDirection={completionSortDirection}
          action={
            <button
              className="mini-toggle-button"
              type="button"
              onClick={() => setCompletionSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))}
            >
              {completionSortDirection === 'desc' ? '高到低' : '低到高'}
            </button>
          }
        />

        {platform === 'wechat' ? (
          <section className="panel completion-analysis-panel">
            <div className="panel-heading">
              <h2>阅读完成率分析 <AiBadge /></h2>
              <button
                className="ai-action-button"
                type="button"
                onClick={handleAnalyzeCompletionRates}
                disabled={completionAiStatus === 'loading'}
              >
                {completionAiStatus === 'loading' ? '分析中...' : currentCompletionAnalysis ? '重新分析' : '开始分析'}
              </button>
            </div>
            {currentCompletionAnalysis ? (
              <>
                <div className="completion-radar-grid">
                  <div>
                    <h3>前5名优点</h3>
                    <Chart
                      chartKey={`${platform}-completion-top-${sourceNames[platform]}-${currentCompletionAnalysis.dimensions.join('|')}`}
                      option={buildCompletionRadarOption(currentCompletionAnalysis, currentCompletionAnalysis.top, '前5名', config)}
                      className="completion-radar-chart"
                    />
                    <ul>
                      {currentCompletionAnalysis.top.points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3>后5名缺点</h3>
                    <Chart
                      chartKey={`${platform}-completion-bottom-${sourceNames[platform]}-${currentCompletionAnalysis.dimensions.join('|')}`}
                      option={buildCompletionRadarOption(currentCompletionAnalysis, currentCompletionAnalysis.bottom, '后5名', config)}
                      className="completion-radar-chart"
                    />
                    <ul>
                      {currentCompletionAnalysis.bottom.points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="ai-recommendations">
                  <strong>优化建议</strong>
                  {currentCompletionAnalysis.recommendations.map((recommendation) => (
                    <p key={recommendation}>{recommendation}</p>
                  ))}
                </div>
              </>
            ) : (
              <div className="ai-empty-state">
                <strong>待分析</strong>
                <span>点击后由 OpenRouter 模型对阅读完成率前5和后5进行对比，围绕篇幅、文字风格、配图支撑和结构节奏生成雷达图与建议。</span>
                {completionAiStatus === 'loading' ? <small>由于大模型反馈较慢，请耐心等待。</small> : null}
                {completionAiStatus === 'error' ? <small>{completionAiError}</small> : null}
              </div>
            )}
          </section>
        ) : (
          <RankedList
            title={config.shareTitle}
            items={items}
            getValue={(item) => item.shareCount}
            formatValue={(value) => numberFormatter.format(value)}
            className="completion-rank-panel"
          />
        )}

        <section className="panel full-panel">
          <div className="panel-heading">
            <h2>{activeTrendMetric.label}趋势</h2>
            <div className="trend-toolbar" aria-label="趋势指标切换">
              {currentTrendMetrics.map((metric) => (
                <button
                  className={activeTrendMetric.key === metric.key ? 'active' : ''}
                  key={metric.key}
                  type="button"
                  onClick={() => setTrendMetricKeys((current) => ({ ...current, [platform]: metric.key }))}
                >
                  {metric.label}
                </button>
              ))}
            </div>
          </div>
          <Chart
            chartKey={`${platform}-trend-${String(activeTrendMetric.key)}-${sourceNames[platform]}`}
            option={buildTrendOption(items, config, activeTrendMetric)}
            className="trend-chart"
          />
        </section>

        {platform === 'wechat' ? (
          <RankedList
            title={config.shareTitle}
            items={items}
            getValue={(item) => item.shareCount}
            formatValue={(value) => numberFormatter.format(value)}
            className="completion-rank-panel"
          />
        ) : null}

        {platform === 'wechat' ? (
          <section className="panel next-article-panel">
            <div className="panel-heading">
              <h2>下一篇文章写作建议 <AiBadge /></h2>
              <button
                className="ai-action-button"
                type="button"
                onClick={handleAnalyzeNextArticle}
                disabled={nextArticleAiStatus === 'loading'}
              >
                {nextArticleAiStatus === 'loading' ? '分析中...' : nextArticleSuggestion ? '重新分析' : '开始分析'}
              </button>
            </div>
            {nextArticleSuggestion ? (
              <div className="next-article-content">
                <section>
                  <h3>主题</h3>
                  <strong>{nextArticleSuggestion.theme.topic}</strong>
                  <p>{nextArticleSuggestion.theme.basis}</p>
                </section>
                <section>
                  <h3>标题</h3>
                  {nextArticleSuggestion.titles.map((item) => (
                    <article key={item.title}>
                      <strong>{item.title}</strong>
                      <p>{item.basis}</p>
                    </article>
                  ))}
                </section>
                <section>
                  <h3>封面图</h3>
                  <p>{nextArticleSuggestion.cover}</p>
                </section>
                <section>
                  <h3>写作思路</h3>
                  <ul>
                    {nextArticleSuggestion.outline.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              </div>
            ) : (
              <div className="ai-empty-state next-article-empty">
                <strong>待生成</strong>
                <span>基于公众号和小红书的数据表现，生成下一篇文章的主题、标题、封面图和写作思路建议。</span>
                {nextArticleAiStatus === 'loading' ? <small>由于大模型反馈较慢，请耐心等待。</small> : null}
                {nextArticleAiStatus === 'error' ? <small>{nextArticleAiError}</small> : null}
              </div>
            )}
          </section>
        ) : null}
      </section>

      <section className="panel table-panel" ref={tableRef}>
        <div className="panel-heading">
          <h2>原始数据预览</h2>
          <span>{items.length} 条</span>
        </div>
        <div className="table-wrap">
          <table key={`${platform}-${sourceNames[platform]}`}>
            <thead>
              <tr>
                <SortableHeader label="发布时间" sortKey="publishDate" activeSort={tableSort} onSort={handleTableSort} />
                <SortableHeader label={config.tableTitleLabel} sortKey="title" activeSort={tableSort} onSort={handleTableSort} />
                <SortableHeader label={config.primaryLabel} sortKey="primaryCount" activeSort={tableSort} onSort={handleTableSort} />
                {platform === 'wechat' ? (
                  <>
                    <SortableHeader label="转发量" sortKey="shareCount" activeSort={tableSort} onSort={handleTableSort} />
                    <SortableHeader label="点赞量" sortKey="likeCount" activeSort={tableSort} onSort={handleTableSort} />
                    <SortableHeader label="收藏量" sortKey="favoriteCount" activeSort={tableSort} onSort={handleTableSort} />
                    <SortableHeader label="留言量" sortKey="commentCount" activeSort={tableSort} onSort={handleTableSort} />
                    <SortableHeader label="阅读后关注" sortKey="followCount" activeSort={tableSort} onSort={handleTableSort} />
                    <SortableHeader label="送达人数" sortKey="deliveredCount" activeSort={tableSort} onSort={handleTableSort} />
                    <SortableHeader label="送达完成率" sortKey="deliveryRate" activeSort={tableSort} onSort={handleTableSort} />
                    <SortableHeader label="阅读完成率" sortKey="completionRate" activeSort={tableSort} onSort={handleTableSort} />
                  </>
                ) : (
                  <>
                    <SortableHeader label="曝光" sortKey="exposureCount" activeSort={tableSort} onSort={handleTableSort} />
                    <SortableHeader label="封面点击率" sortKey="clickRate" activeSort={tableSort} onSort={handleTableSort} />
                    <SortableHeader label="涨粉" sortKey="followCount" activeSort={tableSort} onSort={handleTableSort} />
                    <SortableHeader label="人均观看时长" sortKey="completionRate" activeSort={tableSort} onSort={handleTableSort} />
                    <SortableHeader label="点赞" sortKey="likeCount" activeSort={tableSort} onSort={handleTableSort} />
                    <SortableHeader label="评论" sortKey="commentCount" activeSort={tableSort} onSort={handleTableSort} />
                    <SortableHeader label="收藏" sortKey="favoriteCount" activeSort={tableSort} onSort={handleTableSort} />
                    <SortableHeader label="分享" sortKey="shareCount" activeSort={tableSort} onSort={handleTableSort} />
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item, index) => (
                <tr key={`${platform}-${index}-${item.publishDate}-${item.title}`}>
                  <td>{item.publishDate}</td>
                  <td>
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer">
                        {item.title}
                      </a>
                    ) : (
                      item.title
                    )}
                  </td>
                  <td>{numberFormatter.format(item.primaryCount)}</td>
                  {platform === 'wechat' ? (
                    <>
                      <td>{numberFormatter.format(Number(item.shareCount) || 0)}</td>
                      <td>{numberFormatter.format(Number(item.likeCount) || 0)}</td>
                      <td>{numberFormatter.format(Number(item.favoriteCount) || 0)}</td>
                      <td>{numberFormatter.format(Number(item.commentCount) || 0)}</td>
                      <td>{numberFormatter.format(Number(item.followCount) || 0)}</td>
                      <td>{numberFormatter.format(Number(item.deliveredCount) || 0)}</td>
                      <td>{percentFormatter.format(item.deliveryRate)}</td>
                      <td>{percentFormatter.format(item.completionRate)}</td>
                    </>
                ) : (
                  <>
                      <td>{numberFormatter.format(item.exposureCount)}</td>
                      <td>{percentFormatter.format(item.clickRate)}</td>
                      <td>{numberFormatter.format(item.followCount)}</td>
                      <td>{formatDuration(item.completionRate)}</td>
                      <td>{numberFormatter.format(item.likeCount)}</td>
                      <td>{numberFormatter.format(item.commentCount)}</td>
                      <td>{numberFormatter.format(item.favoriteCount)}</td>
                      <td>{numberFormatter.format(item.shareCount)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      </>
      ) : null}
    </main>
  );
}

export default App;
