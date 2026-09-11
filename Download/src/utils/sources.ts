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
