/**
 * GitHub 资源加速源工具
 * 下载站的全部歌曲数据、曲绘、音频、谱面文件均托管在 GitHub（raw.githubusercontent.com），
 * 国内直连较慢。通过本模块可在多个加速源之间切换，切换后由上层触发页面刷新重新加载。
 */

export interface ResourceSource {
    id: string;
    name: string;
    host: string;
    tag: string;
    desc: string;
    kind: 'raw' | 'gh' | 'prefix';
    base: string;
}

export const SOURCES: ResourceSource[] = [
    {
        id: 'github',
        name: 'GitHub 直连',
        host: 'raw.githubusercontent.com',
        tag: '官方 · 直连',
        desc: 'GitHub 官方源，无需代理转换，但国内访问可能较慢。',
        kind: 'raw',
        base: 'https://raw.githubusercontent.com',
    },
    {
        id: 'jsdelivr',
        name: 'jsDelivr CDN',
        host: 'cdn.jsdelivr.net',
        tag: '国内 · 推荐',
        desc: 'jsDelivr 官方 CDN，对 GitHub 仓库文件提供全球加速分发。',
        kind: 'gh',
        base: 'https://cdn.jsdelivr.net/gh',
    },
    {
        id: 'gcore',
        name: 'gcore CDN',
        host: 'gcore.jsdelivr.net',
        tag: '国内 · 推荐',
        desc: 'jsDelivr 的 Gcore 节点镜像，国内连接质量更佳。',
        kind: 'gh',
        base: 'https://gcore.jsdelivr.net/gh',
    },
    {
        id: 'ghproxy',
        name: 'ghproxy.net',
        host: 'ghproxy.net',
        tag: '代理 · 备用',
        desc: '通用 GitHub 加速代理，覆盖全部 raw 路径。',
        kind: 'prefix',
        base: 'https://ghproxy.net/',
    },
    {
        id: 'ghproxy2',
        name: 'gh-proxy.com',
        host: 'gh-proxy.com',
        tag: '代理 · 备用',
        desc: '通用 GitHub 加速代理，可作为备选。',
        kind: 'prefix',
        base: 'https://gh-proxy.com/',
    },
];

const STORAGE_KEY = 'pcd_source_selected';

/** 读取当前选择的源 id（无记录或记录非法时回退为 GitHub 直连） */
export function getSourceId(): string {
    try {
        const id = localStorage.getItem(STORAGE_KEY);
        if (id && SOURCES.some(s => s.id === id)) return id;
    } catch {
        /* 忽略存储异常 */
    }
    return 'github';
}

// ============================================================
// CDN 缓存版本号（cache epoch）
// ------------------------------------------------------------
// 背景：歌曲数据走 jsDelivr / gcore 等 CDN，上游更新后 CDN 边缘节点
// 仍可能返回旧内容，只清浏览器缓存没用（缓存在 CDN 侧）。
//
// 做法：给数据请求 URL 追加版本号参数，让 CDN 视作新 URL 并回源。
// - 首次访问：epoch 为空 → URL 不带参数 → 全站用户共享 CDN 缓存，最快
// - 点「清除缓存」：epoch 递增为当前时间戳 → URL 变化 → CDN 强制回源拿最新
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

/** 读取当前源对象 */
export function getSource(): ResourceSource {
    const id = getSourceId();
    return SOURCES.find(s => s.id === id) || SOURCES[0];
}

/** 保存选择的源 id（调用方随后应刷新页面以重新加载资源） */
export function setSourceId(id: string): void {
    try {
        localStorage.setItem(STORAGE_KEY, id);
    } catch {
        /* 忽略存储异常 */
    }
}

/**
 * 将 raw.githubusercontent.com 的完整 URL 按当前源转换为加速 URL。
 * - raw：原样返回
 * - gh（jsDelivr / gcore）：raw 的 refs/heads|tags/<branch> 路径转为 @<branch>
 * - prefix（ghproxy 类）：在原始 URL 前拼接代理前缀
 */
export function resolveRawUrl(rawUrl: string): string {
    const source = getSource();
    switch (source.kind) {
        case 'raw':
            return rawUrl;
        case 'gh': {
            const match = rawUrl.match(
                /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/refs\/(?:heads|tags)\/([^/]+)\/(.+)$/
            );
            if (!match) return rawUrl;
            return `${source.base}/${match[1]}/${match[2]}@${match[3]}/${match[4]}`;
        }
        case 'prefix':
            return source.base + rawUrl;
        default:
            return rawUrl;
    }
}

/** 按路径生成 GitHub raw 完整 URL，并自动按当前源转换 */
export function ghRaw(path: string): string {
    return resolveRawUrl('https://raw.githubusercontent.com/' + path);
}
