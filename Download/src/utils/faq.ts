// ============================================================
// 常见问题：从外部 faq.json 拉取
// 改完推送 faq.json 就能更新，不用动代码重新构建
//
// 文件格式：
// {
//   "notice": "置顶公告，不需要就留空字符串或删掉",
//   "faqs": [
//     { "question": "问题", "answer": "答案", "link": { "text": "链接文字", "url": "https://..." } }
//   ]
// }
// link 可省略；也可以直接写数组 [{ "question": ..., "answer": ... }]。
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { faqData as bundledFaq, FAQEntry } from '../faqData';

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

/**
 * 规范化链接地址：去掉首尾空白；没写协议时补 https；
 * 非 http(s)（如 javascript:、data:）一律判为无效返回空串。
 */
export function normalizeUrl(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    let u = raw.trim();
    if (!u) return '';
    if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = `https://${u}`;
    return /^https?:\/\//i.test(u) ? u : '';
}

/** 取域名用于卡片副标题，取不到就退回完整地址 */
export function linkHost(url: string): string {
    try {
        return new URL(url).host.replace(/^www\./, '');
    } catch (e) {
        return url;
    }
}

interface RawLink {
    text?: string;
    url?: string;
}

interface RawFaq {
    question?: string;
    answer?: string;
    link?: { text?: string; url?: string } | { text?: string; url?: string }[];
    links?: { text?: string; url?: string }[];
}

/** 兼容写法：{ faqs: [...] } 或直接是数组 [...] */
export function normalizeFaqs(data: unknown): FAQEntry[] {
    if (!data) return [];

    let arr: unknown;
    if (Array.isArray(data)) {
        arr = data;
    } else if (typeof data === 'object') {
        arr = (data as Record<string, unknown>).faqs;
    } else {
        return [];
    }

    if (!Array.isArray(arr)) return [];

    return (arr as RawFaq[])
        .map((item): FAQEntry | null => {
            if (!item || typeof item !== 'object') return null;
            const question = typeof item.question === 'string' ? item.question.trim() : '';
            const answer = typeof item.answer === 'string' ? item.answer.trim() : '';
            if (!question || !answer) return null;

            const entry: FAQEntry = { question, answer };

            // 链接：links 数组优先，其次单条 link（两者都写时以 links 为准）
            const rawList: unknown[] | null = Array.isArray(item.links)
                ? item.links
                : Array.isArray(item.link)
                    ? item.link
                    : item.link && typeof item.link === 'object'
                        ? [item.link]
                        : null;

            if (rawList) {
                const list: { text: string; url: string }[] = [];
                for (const lk of rawList) {
                    if (!lk || typeof lk !== 'object') continue;
                    const text = typeof (lk as RawLink).text === 'string' ? (lk as RawLink).text!.trim() : '';
                    const url = normalizeUrl((lk as RawLink).url);
                    // 只放行 http(s) 链接，避免 javascript: 之类的注入
                    if (text && url) list.push({ text, url });
                }
                if (list.length) {
                    entry.links = list;
                    entry.link = list[0];
                }
            }
            return entry;
        })
        .filter((x): x is FAQEntry => x !== null);
}

export interface FaqResult {
    faqs: FAQEntry[];
    notice: string;
    sourceLabel: string;
    loading: boolean;
    error: string;
    reload: () => void;
}

// 多个组件同时挂载时共用一个请求，别重复拉三次
let cachedFaqs: FAQEntry[] | null = null;
let cachedNotice = '';
let inflight: Promise<{ faqs: FAQEntry[]; notice: string; label: string } | null> | null = null;

async function fetchFaqs(sources: FaqSource[]): Promise<{ faqs: FAQEntry[]; notice: string; label: string } | null> {
    for (const src of sources) {
        try {
            const url = new URL(src.url, window.location.href);
            url.searchParams.set('_t', String(Date.now()));
            const res = await fetch(url.toString(), { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const parsed = normalizeFaqs(data);
            if (parsed.length === 0) throw new Error('内容为空');
            const notice =
                data && typeof data === 'object' && typeof (data as Record<string, unknown>).notice === 'string'
                    ? String((data as Record<string, unknown>).notice)
                    : '';
            return { faqs: parsed, notice, label: src.label };
        } catch (e) {
            console.warn(`[faq] 从「${src.label}」加载失败`, e);
        }
    }
    return null;
}

/**
 * 拉取常见问题。所有数据源都失败时回退到 faqData.ts 里打包的内容 —— 保证页面永远不会空白。
 */
export function useFaq(customSources?: FaqSource[]): FaqResult {
    const sources = customSources ?? DEFAULT_FAQ_SOURCES;

    const [faqs, setFaqs] = useState<FAQEntry[]>(cachedFaqs ?? bundledFaq);
    const [notice, setNotice] = useState<string>(cachedNotice);
    const [sourceLabel, setSourceLabel] = useState('');
    const [loading, setLoading] = useState(cachedFaqs === null);
    const [error, setError] = useState('');
    const [nonce, setNonce] = useState(0);

    const reload = useCallback(() => {
        // 强制重新拉取：清掉缓存与在途请求
        cachedFaqs = null;
        cachedNotice = '';
        inflight = null;
        setNonce(n => n + 1);
    }, []);

    useEffect(() => {
        let alive = true;

        if (cachedFaqs && nonce === 0) {
            setFaqs(cachedFaqs);
            setNotice(cachedNotice);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError('');

        if (!inflight) inflight = fetchFaqs(sources);

        inflight
            .then(result => {
                if (!alive) return;
                if (result) {
                    cachedFaqs = result.faqs;
                    cachedNotice = result.notice;
                    setFaqs(result.faqs);
                    setNotice(result.notice);
                    setSourceLabel(result.label);
                    setError('');
                } else {
                    setFaqs(bundledFaq);
                    setNotice('');
                    setSourceLabel('');
                    setError('在线问答加载失败，当前显示的是内置版本');
                }
                setLoading(false);
            })
            .catch(() => {
                if (!alive) return;
                setFaqs(bundledFaq);
                setError('在线问答加载失败，当前显示的是内置版本');
                setLoading(false);
            });

        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nonce]);

    return { faqs, notice, sourceLabel, loading, error, reload };
}
