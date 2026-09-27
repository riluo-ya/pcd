// ============================================================
// 站点缓存清理工具
// 目标：点了必须真的生效
//   1. 注销 Service Worker
//   2. 清空 Cache Storage
//   3. 删除 IndexedDB
//   4. 清空 localStorage（保留登录凭证）
//   5. 清空 sessionStorage
//   6. 绕过 HTTP 缓存强制重新加载页面
// ============================================================

/**
 * 清理后要保留的 localStorage key。
 *
 * - access_token：答题凭证，保留 = 清完不用重新答题
 * - pcd_source_selected：用户选的加速源。不保留的话清完会掉回 GitHub 直连，
 *   国内用户速度直接崩，还得手动再选一次 —— 这是要避免的。
 * - pcd_dns_selected：同理，用户选的 DNS / 线路偏好
 * - pcd_cache_epoch：CDN 缓存版本号。清缓存时会被 bump 成新值来强制 CDN 回源，
 *   删掉它就白 bump 了，所以必须留下。
 */
export const KEEP_STORAGE_KEYS: string[] = [
    'access_token',
    'pcd_source_selected',
    'pcd_dns_selected',
    'pcd_cache_epoch',
];

/** 需要保留的 key 前缀（例如 'pcd_keep_'），一般留空 */
export const KEEP_STORAGE_PREFIXES: string[] = [];

export interface ClearCacheReport {
    serviceWorker: number;
    cacheStorage: number;
    indexedDB: number;
    localStorage: number;
    sessionStorage: boolean;
}

function shouldKeep(key: string): boolean {
    if (KEEP_STORAGE_KEYS.includes(key)) return true;
    return KEEP_STORAGE_PREFIXES.some((p) => p && key.startsWith(p));
}

interface IDBDatabaseInfoLike {
    name?: string;
    version?: number;
}

/** 清理全部本地缓存，返回清理结果统计 */
export async function clearSiteCache(): Promise<ClearCacheReport> {
    const report: ClearCacheReport = {
        serviceWorker: 0,
        cacheStorage: 0,
        indexedDB: 0,
        localStorage: 0,
        sessionStorage: false,
    };

    // 1) 注销 Service Worker（有就清，没有就跳过）
    if ('serviceWorker' in navigator) {
        try {
            const regs = await navigator.serviceWorker.getRegistrations();
            report.serviceWorker = regs.length;
            await Promise.all(regs.map((r) => r.unregister()));
        } catch (e) {
            console.warn('[clearCache] Service Worker 注销失败', e);
        }
    }

    // 2) 清空 Cache Storage
    if (typeof caches !== 'undefined' && typeof caches.keys === 'function') {
        try {
            const keys = await caches.keys();
            report.cacheStorage = keys.length;
            await Promise.all(keys.map((k) => caches.delete(k)));
        } catch (e) {
            console.warn('[clearCache] Cache Storage 清空失败', e);
        }
    }

    // 3) 删除 IndexedDB（databases() 仅 Chromium 系支持，Safari 会静默跳过）
    try {
        const idb = window.indexedDB as unknown as IDBFactory & {
            databases?: () => Promise<IDBDatabaseInfoLike[]>;
        };
        if (idb && typeof idb.databases === 'function') {
            const dbs = await idb.databases();
            const names = (dbs || [])
                .map((d) => d && d.name)
                .filter((n): n is string => typeof n === 'string' && n.length > 0);
            report.indexedDB = names.length;
            await Promise.all(
                names.map(
                    (name) =>
                        new Promise<void>((resolve) => {
                            try {
                                const req = idb.deleteDatabase(name);
                                req.onsuccess = () => resolve();
                                req.onerror = () => resolve();
                                req.onblocked = () => resolve();
                            } catch (e) {
                                resolve();
                            }
                        })
                )
            );
        }
    } catch (e) {
        console.warn('[clearCache] IndexedDB 清理失败', e);
    }

    // 4) localStorage：清掉除白名单外的所有 key
    //    用标准 length + key(i) 快照遍历，边删边变也不会漏
    try {
        const store = window.localStorage;
        const keys: string[] = [];
        for (let i = 0; i < store.length; i += 1) {
            const k = store.key(i);
            if (typeof k === 'string' && k.length > 0) keys.push(k);
        }

        let removed = 0;
        for (const k of keys) {
            if (!shouldKeep(k)) {
                store.removeItem(k);
                removed += 1;
            }
        }
        report.localStorage = removed;
    } catch (e) {
        console.warn('[clearCache] localStorage 清理失败', e);
    }

    // 5) sessionStorage
    try {
        window.sessionStorage.clear();
        report.sessionStorage = true;
    } catch (e) {
        console.warn('[clearCache] sessionStorage 清理失败', e);
    }

    return report;
}

/**
 * 绕过 HTTP 缓存强制重新加载当前页。
 * 三重保险：
 *   a. fetch(cache:'reload') 让浏览器重新校验该文档，挤掉磁盘缓存
 *   b. 带一次性时间戳跳转，保证 HTML 文档 100% 重新拉取
 *   c. 极端环境（部分 WebView）replace 被拦时，延时兜底 reload
 */
export async function hardReload(fallbackDelay = 800): Promise<void> {
    let next = window.location.href;
    try {
        const url = new URL(window.location.href);
        url.searchParams.set('_nc', String(Date.now()));
        next = url.toString();
    } catch (e) {
        const sep = window.location.href.includes('?') ? '&' : '?';
        next = `${window.location.href}${sep}_nc=${Date.now()}`;
    }

    // a. 强制重新校验文档
    try {
        await Promise.race([
            fetch(next, { cache: 'reload', mode: 'same-origin', credentials: 'same-origin' }),
            new Promise((_, reject) => window.setTimeout(() => reject(new Error('timeout')), 2500)),
        ]);
    } catch (e) {
        /* 失败无所谓，后面还有兜底 */
    }

    // b. 带时间戳跳转
    try {
        window.location.replace(next);
    } catch (e) {
        window.location.href = next;
    }

    // c. 兜底强制刷新
    window.setTimeout(() => {
        try {
            window.location.reload();
        } catch (e) {
            /* 忽略 */
        }
    }, fallbackDelay);
}

/**
 * 清缓存 + 强制刷新，一步到位。
 *
 * onBeforeClear：在清理之前执行（建议用来 bump CDN 缓存版本号，
 * 这样刷新后数据请求会带新参数，强制 jsDelivr / gcore 等 CDN 回源取最新）。
 * 注意它写入的 key 必须在 KEEP_STORAGE_KEYS 里，否则会被随后的清理删掉。
 */
export async function clearCacheAndReload(
    onBeforeClear?: () => void | Promise<void>
): Promise<ClearCacheReport> {
    if (onBeforeClear) {
        try {
            await onBeforeClear();
        } catch (e) {
            console.warn('[clearCache] onBeforeClear 执行失败', e);
        }
    }
    const report = await clearSiteCache();
    await hardReload();
    return report;
}

/** 生成给用户的可读结果文案 */
export function describeReport(r: ClearCacheReport): string {
    const parts: string[] = [];
    if (r.serviceWorker) parts.push(`Service Worker ×${r.serviceWorker}`);
    if (r.cacheStorage) parts.push(`缓存存储 ×${r.cacheStorage}`);
    if (r.indexedDB) parts.push(`数据库 ×${r.indexedDB}`);
    if (r.localStorage) parts.push(`本地存储 ×${r.localStorage}`);
    if (r.sessionStorage) parts.push('会话存储');
    return parts.length ? parts.join('、') : '没有发现可清理的缓存';
}
