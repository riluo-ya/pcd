// ============================================================
// 常见问题：从外部 faq.json 拉取，改完推送即可生效，不用重新构建
//
// 文件格式（与数据管理器导出的结构一致）：
// {
//   "notice": "置顶公告，不需要就留空",
//   "faqs": [
//     {
//       "question": "问题？",
//       "answer": "答案，支持换行",
//       "links": [ { "text": "链接文字", "url": "https://…" } ]
//     }
//   ]
// }
// links 可选；同时写 link 与 links 时以 links 为准，取第一条填 link 兼容旧解析。
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { faqData as bundledFaqs } from '../faqData';

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

export interface FaqLink {
    text: string;
    url: string;
}

export interface FaqEntry {
    question: string;
    answer: string;
    links: FaqLink[];
}

export interface FaqSource {
    url: string;
    label: string;
}

/** 数据源按优先级排列，前一个失败自动换下一个 */
export const DEFAULT_FAQ_SOURCES: FaqSource[] = [
    { url: `${getBaseUrl()}faq.json`, label: '本站' },
    { url: 'https://cdn.jsdelivr.net/gh/riluo-ya/pcd@main/Download/public/faq.json', label: 'CDN' },
    { url: 'https://raw.githubusercontent.com/riluo-ya/pcd/main/Download/public/faq.json', label: 'GitHub' },
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
const HTML_ALLOWED = /<\/?(ul|ol|li|p|br|b|strong|i|em|code|span|div|a|small|u)\b[^>]*>/i;

/** 危险特征：命中一律当纯文本转义，避免注入 */
const HTML_DANGEROUS = /<\s*(script|iframe|style|object|embed|link|meta|form|svg)\b|javascript\s*:|on[a-z]+\s*=/i;

/** 答案渲染成安全的 HTML：纯文本按换行分段，安全的排版 HTML 原样保留 */
export function renderAnswer(answer: unknown): string {
    if (typeof answer !== 'string') return '';
    const trimmed = answer.trim();
    if (!trimmed) return '';

    if (HTML_DANGEROUS.test(trimmed)) return escapeHtml(trimmed).replace(/\r?\n/g, '<br>');
    if (HTML_ALLOWED.test(trimmed)) return trimmed;

    return escapeHtml(trimmed).replace(/\r?\n/g, '<br>');
}

/** 没写协议时补 https；非 http(s)（javascript:、data: 等）判为无效 */
export function normalizeUrl(url: unknown): string {
    const v = String(url ?? '').trim();
    if (!v) return '';
    const withProto = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
    return /^https?:\/\//i.test(withProto) ? withProto : '';
}

/** 取域名做链接卡片副标题 */
export function urlHost(url: string): string {
    const m = normalizeUrl(url).match(/^https?:\/\/([^/]+)/i);
    return m ? m[1].replace(/^www\./, '') : '';
}

interface RawFaq {
    question?: string;
    q?: string;
    title?: string;
    answer?: string;
    a?: string;
    content?: string;
    link?: unknown;
    links?: unknown;
}

/** 收集链接：links 数组优先，其次单条 link */
function collectLinks(raw: RawFaq): FaqLink[] {
    let list: unknown[] | null = null;

    if (Array.isArray(raw.links)) list = raw.links as unknown[];
    else if (raw.link && Array.isArray(raw.link)) list = raw.link as unknown[];
    else if (raw.link && typeof raw.link === 'object') list = [raw.link];

    if (!list) return [];

    const out: FaqLink[] = [];
    for (const item of list) {
        if (!item || typeof item !== 'object') continue;
        const rec = item as Record<string, unknown>;
        const text = String(rec.text ?? rec.label ?? rec.title ?? '').trim();
        const url = normalizeUrl(rec.url ?? rec.href);
        // 文字和地址要成对，缺一个就跳过，避免渲染出空链接
        if (!text || !url) continue;
        out.push({ text, url });
    }
    return out;
}

/** 兼容写法：{ faqs: [...] } 或直接是数组 [...] */
export function normalizeFaqs(data: unknown): { notice: string; faqs: FaqEntry[] } {
    if (!data) return { notice: '', faqs: [] };

    let arr: unknown;
    let notice = '';

    if (Array.isArray(data)) {
        arr = data;
    } else if (typeof data === 'object') {
        const rec = data as Record<string, unknown>;
        arr = rec.faqs ?? rec.faq ?? rec.items ?? rec.list ?? rec.questions;
        if (typeof rec.notice === 'string') notice = rec.notice;
    } else {
        return { notice: '', faqs: [] };
    }

    if (!Array.isArray(arr)) return { notice, faqs: [] };

    const faqs: FaqEntry[] = [];
    for (const raw of arr as RawFaq[]) {
        if (!raw || typeof raw !== 'object') continue;
        const question = String(raw.question ?? raw.q ?? raw.title ?? '').trim();
        const answer = renderAnswer(raw.answer ?? raw.a ?? raw.content);
        if (!question && !answer) continue;
        faqs.push({ question, answer, links: collectLinks(raw) });
    }

    return { notice, faqs };
}

export interface FaqResult {
    faqs: FaqEntry[];
    notice: string;
    sourceLabel: string;
    loading: boolean;
    error: string;
    reload: () => void;
}

/**
 * 拉取并解析常见问题。
 * 所有数据源都失败时回退到 faqData.ts 里打包的旧问答 —— 保证「常见问题」永远不会空白。
 */
export function useFaq(customSources?: FaqSource[]): FaqResult {
    const sources = customSources ?? DEFAULT_FAQ_SOURCES;

    const [faqs, setFaqs] = useState<FaqEntry[]>(bundledFaqs);
    const [notice, setNotice] = useState('');
    const [sourceLabel, setSourceLabel] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [nonce, setNonce] = useState(0);

    const reload = useCallback(() => setNonce(n => n + 1), []);

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
                    const parsed = normalizeFaqs(data);
                    if (parsed.faqs.length === 0) throw new Error('问答内容为空');

                    if (!alive) return;
                    setFaqs(parsed.faqs);
                    setNotice(parsed.notice);
                    setSourceLabel(src.label);
                    setLoading(false);
                    return;
                } catch (e) {
                    if (!alive) return;
                    console.warn(`[faq] 从「${src.label}」加载失败`, e);
                }
            }

            // 全部失败：用打包的兜底数据
            if (!alive) return;
            setFaqs(bundledFaqs);
            setNotice('');
            setSourceLabel('');
            setError('在线问答加载失败，当前显示的是内置版本');
            setLoading(false);
        };

        load();
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nonce]);

    return { faqs, notice, sourceLabel, loading, error, reload };
}
