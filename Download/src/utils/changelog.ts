// ============================================================
// 更新日志：从外部 changelog.json 拉取并渲染
// 改完推送 changelog.json 就能更新，不用动代码重新构建
//
// 文件格式（超简单，只要时间和内容）：
// {
//   "notice": "置顶公告，不需要就留空字符串或删掉",
//   "logs": [
//     { "date": "2026-09-27", "content": "第一行\n第二行\n第三行" }
//   ]
// }
// content 里用 \n 换行，一行 = 一个列表项；也可以直接写 HTML，会原样渲染。
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { updateLogs as bundledLogs, UpdateLog } from '../aboutData';

/** 部署基础路径（Vite 的 base，默认 '/'） */
function getBaseUrl(): string {
    try {
        const env = (import.meta as unknown as { env?: Record<string, string> }).env;
        if (env && typeof env.BASE_URL === 'string' && env.BASE_URL) return env.BASE_URL;
    } catch (e) {
        /* 忽略 */
    }
    return '/';
}

export interface ChangelogSource {
    url: string;
    label: string;
}

/**
 * 数据源按优先级排列，前一个失败自动换下一个：
 * 1. 本站（GitHub Pages）—— 国内最快最稳
 * 2. jsDelivr CDN —— 备用
 * 3. GitHub Raw —— 备用（部分地区连不上）
 */
export const DEFAULT_CHANGELOG_SOURCES: ChangelogSource[] = [
    { url: `${getBaseUrl()}changelog.json`, label: '本站' },
    { url: 'https://cdn.jsdelivr.net/gh/riluo-ya/pcd@main/Download/public/changelog.json', label: 'CDN' },
    { url: 'https://raw.githubusercontent.com/riluo-ya/pcd/main/Download/public/changelog.json', label: 'GitHub' },
];

function escapeHtml(str: string): string {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** 允许的排版标签白名单，命中就按 HTML 原样渲染 */
const HTML_ALLOWED =
    /<\/?(ul|ol|li|p|br|b|strong|i|em|code|span|div|a|small|u)\b[^>]*>/i;

/** 危险特征：命中就一律当纯文本转义，避免注入 */
const HTML_DANGEROUS =
    /<\s*(script|iframe|style|object|embed|link|meta|form|svg)\b|javascript\s*:|on[a-z]+\s*=/i;

/** 判断是不是安全的排版 HTML */
function looksLikeHtml(str: string): boolean {
    if (HTML_DANGEROUS.test(str)) return false;
    return HTML_ALLOWED.test(str);
}

/** 纯文本按换行转成列表 */
function textToHtml(str: string): string {
    const lines = str
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    if (lines.length === 0) return '';
    if (lines.length === 1) return `<p>${escapeHtml(lines[0])}</p>`;

    const lis = lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('');
    return `<ul class="list-disc list-inside space-y-1">${lis}</ul>`;
}

/** 把 JSON 里的 content 渲染成安全的 HTML */
function renderContent(content: unknown): string {
    if (typeof content !== 'string') return '';
    const trimmed = content.trim();
    if (!trimmed) return '';
    // 作者自己写的 HTML 直接信任；纯文本就按换行转列表
    return looksLikeHtml(trimmed) ? trimmed : textToHtml(trimmed);
}

interface RawLog {
    date?: string;
    content?: string;
}

/** 兼容写法：{ logs: [...] } 或直接是数组 [...] */
export function normalizeLogs(data: unknown): UpdateLog[] {
    if (!data) return [];

    let arr: unknown;
    if (Array.isArray(data)) {
        arr = data;
    } else if (typeof data === 'object') {
        arr = (data as Record<string, unknown>).logs;
    } else {
        return [];
    }

    if (!Array.isArray(arr)) return [];

    return (arr as RawLog[])
        .map((log): UpdateLog | null => {
            if (!log || typeof log !== 'object') return null;
            const content = renderContent(log.content);
            if (!content) return null;
            return { date: log.date ? String(log.date) : '', content };
        })
        .filter((x): x is UpdateLog => x !== null);
}

export interface ChangelogResult {
    logs: UpdateLog[];
    notice: string;
    sourceLabel: string;
    loading: boolean;
    error: string;
    reload: () => void;
}

/**
 * 拉取并解析更新日志。
 * 所有数据源都失败时，回退到 aboutData.ts 里打包的旧日志 —— 保证「关于」永远不会空白。
 */
export function useChangelog(customSources?: ChangelogSource[]): ChangelogResult {
    const sources = customSources ?? DEFAULT_CHANGELOG_SOURCES;

    const [logs, setLogs] = useState<UpdateLog[]>(bundledLogs);
    const [notice, setNotice] = useState('');
    const [sourceLabel, setSourceLabel] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [nonce, setNonce] = useState(0);

    const reload = useCallback(() => setNonce((n) => n + 1), []);

    useEffect(() => {
        let alive = true;

        const load = async () => {
            setLoading(true);
            setError('');

            for (const src of sources) {
                try {
                    // 加时间戳绕过浏览器 / CDN 缓存，改完立刻能看到
                    const url = new URL(src.url, window.location.href);
                    url.searchParams.set('_t', String(Date.now()));

                    const res = await fetch(url.toString(), { cache: 'no-store' });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);

                    const data = await res.json();
                    const parsed = normalizeLogs(data);
                    if (parsed.length === 0) throw new Error('日志内容为空');

                    if (!alive) return;

                    setLogs(parsed);
                    setNotice(
                        typeof (data as Record<string, unknown>)?.notice === 'string'
                            ? String((data as Record<string, unknown>).notice)
                            : ''
                    );
                    setSourceLabel(src.label);
                    setLoading(false);
                    return;
                } catch (e) {
                    if (!alive) return;
                    console.warn(`[changelog] 从「${src.label}」加载失败`, e);
                }
            }

            // 全部失败：用打包的兜底数据
            if (!alive) return;
            setLogs(bundledLogs);
            setSourceLabel('');
            setError('在线日志加载失败，当前显示的是内置版本');
            setLoading(false);
        };

        load();
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nonce]);

    return { logs, notice, sourceLabel, loading, error, reload };
}
