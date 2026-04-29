import { useEffect, useMemo, useRef, useState } from 'react';
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

function buildShareOption(items: ContentItem[], config: PlatformConfig): echarts.EChartsOption {
  const sorted = [...items].sort((a, b) => b.primaryCount - a.primaryCount);
  const top = sorted.slice(0, 10);
  const otherTotal = sorted.slice(10).reduce((sum, item) => sum + item.primaryCount, 0);
  const totalPrimary = sorted.reduce((sum, item) => sum + item.primaryCount, 0);
  const colors = platformColors(config.id);
  const data = top.map((item) => ({
    name: shortTitle(item.title, 12),
    value: item.primaryCount,
  }));

  if (otherTotal > 0) {
    data.push({ name: '其他', value: otherTotal });
  }

  return {
    color: colors.palette,
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '38%',
        style: {
          text: numberFormatter.format(totalPrimary),
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
          text: `总${config.primaryLabel}`,
          fill: '#6C747C',
          fontSize: 13,
          fontWeight: 700,
        },
        silent: true,
      },
    ],
    tooltip: {
      trigger: 'item',
      formatter: `{b}<br/>${config.primaryLabel}：{c}<br/>占比：{d}%`,
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
          formatter: '{b}\n{d}%',
        },
        data,
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

function RankedList({
  title,
  items,
  getValue,
  formatValue,
}: {
  title: string;
  items: ContentItem[];
  getValue: (item: ContentItem) => number;
  formatValue: (value: number) => string;
}) {
  return (
    <section className="panel compact-panel">
      <div className="panel-heading">
        <h2>{title}</h2>
      </div>
      <div className="rank-list">
        {items
          .filter((item) => getValue(item) > 0)
          .sort((a, b) => getValue(b) - getValue(a))
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

        <section className="panel">
          <div className="panel-heading">
            <h2>{config.primaryLabel}占比</h2>
            <span>Top10 + 其他</span>
          </div>
          <Chart chartKey={`${platform}-share-${sourceNames[platform]}`} option={buildShareOption(items, config)} />
        </section>

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

        <RankedList
          title={config.shareTitle}
          items={items}
          getValue={(item) => item.shareCount}
          formatValue={(value) => numberFormatter.format(value)}
        />

        <RankedList
          title={config.completionTitle}
          items={items}
          getValue={(item) => item.completionRate}
          formatValue={(value) => (platform === 'wechat' ? percentFormatter.format(value) : formatDuration(value))}
        />
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
