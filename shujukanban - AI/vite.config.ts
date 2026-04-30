import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type AiModelConfig = {
  requestPath?: string;
  upstreamBaseUrl?: string;
  apiKeyEnvName?: string;
  referer?: string;
  title?: string;
};

const defaultAiModelConfig = {
  requestPath: '/api/openrouter/chat/completions',
  upstreamBaseUrl: 'https://openrouter.ai/api/v1',
  apiKeyEnvName: 'OPENROUTER_API_KEY',
  referer: 'http://localhost',
  title: 'shujukanban-ai',
};

function loadAiModelConfig(): Required<AiModelConfig> {
  try {
    const configPath = resolve(process.cwd(), 'public', 'ai-model-config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as AiModelConfig;

    return {
      requestPath: config.requestPath?.trim() || defaultAiModelConfig.requestPath,
      upstreamBaseUrl: config.upstreamBaseUrl?.trim() || defaultAiModelConfig.upstreamBaseUrl,
      apiKeyEnvName: config.apiKeyEnvName?.trim() || defaultAiModelConfig.apiKeyEnvName,
      referer: config.referer?.trim() || defaultAiModelConfig.referer,
      title: config.title?.trim() || defaultAiModelConfig.title,
    };
  } catch {
    return defaultAiModelConfig;
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function extractArticleContent(html: string) {
  const imageCount = (html.match(/<img\b/gi) ?? []).length;
  const candidates = [
    html.match(/<article[\s\S]*?<\/article>/i)?.[0],
    html.match(/<main[\s\S]*?<\/main>/i)?.[0],
    html.match(/<div[^>]+id=["']js_content["'][\s\S]*?<\/div>/i)?.[0],
    html.match(/<body[\s\S]*?<\/body>/i)?.[0],
    html,
  ].filter(Boolean) as string[];
  const raw = candidates[0]
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/h[1-6]>|<\/li>|<\/section>|<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  const text = decodeHtmlEntities(raw)
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    text,
    wordCount: Array.from(text.replace(/\s+/g, '')).length,
    imageCount,
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const aiModelConfig = loadAiModelConfig();
  const aiProxyPrefix = aiModelConfig.requestPath.split('/chat/completions')[0];
  const openRouterApiKey = env[aiModelConfig.apiKeyEnvName];

  return {
    plugins: [
      react(),
      {
        name: 'article-content-api',
        configureServer(server) {
          server.middlewares.use('/api/article-content', async (req, res) => {
            try {
              const requestUrl = new URL(req.url ?? '', 'http://localhost');
              const targetUrl = requestUrl.searchParams.get('url');

              if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify({ error: '缺少有效文章 URL，无法读取正文。' }));
                return;
              }

              const response = await fetch(targetUrl, {
                headers: {
                  'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
                },
              });

              if (!response.ok) {
                res.statusCode = 502;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify({ error: `文章页面读取失败：${response.status}` }));
                return;
              }

              const html = await response.text();
              const content = extractArticleContent(html);

              if (content.text.length < 80) {
                res.statusCode = 422;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify({ error: '没有读取到足够正文内容。' }));
                return;
              }

              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify(content));
            } catch (error) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ error: error instanceof Error ? error.message : '正文读取失败。' }));
            }
          });
        },
      },
    ],
    server: {
      proxy: {
        [aiProxyPrefix]: {
          target: aiModelConfig.upstreamBaseUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(new RegExp(`^${aiProxyPrefix}`), ''),
          headers: {
            ...(openRouterApiKey ? { Authorization: `Bearer ${openRouterApiKey}` } : {}),
            'HTTP-Referer': aiModelConfig.referer,
            'X-Title': aiModelConfig.title,
          },
        },
      },
    },
  };
});
