
export type ProxySource = 'github' | 'jsdelivr' | 'jsdelivr-gcore' | 'ghproxy-net' | 'ghfast-top' | 'gh-proxy-com';

export interface ProxySourceOption {
    id: ProxySource;
    label: string;
    description: string;
}

export const PROXY_SOURCES: ProxySourceOption[] = [
    { id: 'github', label: 'GitHub', description: 'GitHub 官方服务器。若所在地区能直连 GitHub，它是最快也最稳的选择。' },
    { id: 'jsdelivr', label: 'jsDelivr', description: '全球 GitHub CDN 镜像，国内可用性较好。' },
    { id: 'jsdelivr-gcore', label: 'jsDelivr - Gcore', description: 'jsDelivr 的 Gcore 节点，国内连接质量更佳。' },
    { id: 'ghproxy-net', label: 'ghproxy.net', description: '社区维护的 GitHub 加速代理。' },
    { id: 'ghfast-top', label: 'ghfast.top', description: '另一个社区 GitHub 加速代理。' },
    { id: 'gh-proxy-com', label: 'gh-proxy.com', description: '社区 GitHub 加速代理，可作为额外备选。' },
];

const REPO = '7aGiven/Phigros_Resource';

export function getResourceUrl(proxySource: ProxySource, branch: string, path: string): string {
    const rawUrl = `https://raw.githubusercontent.com/${REPO}/refs/heads/${branch}/${path}`;
    switch (proxySource) {
        case 'jsdelivr':
            return `https://cdn.jsdelivr.net/gh/${REPO}@${branch}/${path}`;
        case 'jsdelivr-gcore':
            return `https://gcore.jsdelivr.net/gh/${REPO}@${branch}/${path}`;
        case 'ghproxy-net':
            return `https://ghproxy.net/${rawUrl}`;
        case 'ghfast-top':
            return `https://ghfast.top/${rawUrl}`;
        case 'gh-proxy-com':
            return `https://gh-proxy.com/${rawUrl}`;
        case 'github':
        default:
            return rawUrl;
    }
}

// ============================================================
// CDN 缓存版本号（cache epoch）
// ------------------------------------------------------------
// 背景：歌曲数据走 jsDelivr / gcore 等 CDN，上游更新后 CDN 边缘节点
// 仍可能返回旧内容，只清浏览器缓存没用（缓存在 CDN 侧）。
//
// 做法：给数据请求 URL 追加版本号参数，让 CDN 视作新 URL 并回源。
// - 首次访问：epoch 为空 → URL 不带参数 → 全站用户共享 CDN 缓存，最快
// - 点「清除缓存」或切换加速源：epoch 递增为当前时间戳 → CDN 强制回源
// - 之后 epoch 不变 → 新版本重新被 CDN 缓存，速度恢复
//
// 该 key 必须列入 clearCache 的保留名单，否则清缓存时被删掉就白 bump 了。
// ============================================================

export const CACHE_EPOCH_KEY = 'pcd_cache_epoch';

/** 读取当前 epoch，未设置时返回空串（表示不加参数，走共享缓存） */
export function getCacheEpoch(): string {
    try {
        return localStorage.getItem(CACHE_EPOCH_KEY) || '';
    } catch {
        return '';
    }
}

/** 递增 epoch 并返回新值，用于强制 CDN 回源 */
export function bumpCacheEpoch(): string {
    const next = String(Date.now());
    try {
        localStorage.setItem(CACHE_EPOCH_KEY, next);
    } catch {
        /* 存储不可用时至少让本次生效 */
    }
    return next;
}

/**
 * 给 URL 追加缓存版本号参数。
 * 只给「索引类数据」用（version.txt / info.tsv / difficulty.tsv）；
 * 曲绘、音频、谱面等内容文件不要加 —— 内容固定，加了会白白回源变慢。
 */
export function withCacheBust(url: string, epoch?: string): string {
    const v = epoch !== undefined ? epoch : getCacheEpoch();
    if (!v) return url;
    try {
        const u = new URL(url, typeof window !== 'undefined' ? window.location.href : undefined);
        u.searchParams.set('_cb', v);
        return u.toString();
    } catch {
        const sep = url.includes('?') ? '&' : '?';
        return `${url}${sep}_cb=${encodeURIComponent(v)}`;
    }
}

// Songs whose illustration differs per difficulty (stored as `${songId}_${diff}.png`).
const PER_DIFFICULTY_ILLUSTRATION_SONGS = new Set([
    'WhatdoyouwantmorethanaHappyending.Apo11oHALOprogramft安月名莉子大瀬良あい',
]);

export const ILLUSTRATION_DIFFICULTIES = ['EZ', 'HD', 'IN', 'AT'];

export function hasPerDifficultyIllustrations(songId: string): boolean {
    return PER_DIFFICULTY_ILLUSTRATION_SONGS.has(songId);
}

// Blur thumbnail for the song list; per-difficulty songs use their AT variant.
export function getBlurIllustrationUrl(proxySource: ProxySource, songId: string): string {
    const name = hasPerDifficultyIllustrations(songId) ? `${songId}_AT.png` : `${songId}.png`;
    return getResourceUrl(proxySource, 'illustrationBlur', name);
}

export function getDifficultyIllustrationUrl(proxySource: ProxySource, songId: string, difficulty: string): string {
    return getResourceUrl(proxySource, 'illustration', `${songId}_${difficulty}.png`);
}
