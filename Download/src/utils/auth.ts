// ============================================================
// Token 验证模块 —— 必须与答题系统(index.html)的算法完全一致
// ============================================================

const TOKEN_KEY = 'access_token';
const TOKEN_VALID_MS = 60 * 60 * 1000; // 有效期 1 小时

/**
 * djb2 哈希算法（与答题系统 home.html 中的 simpleHash 完全一致）
 */
export function simpleHash(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
}

export interface TokenValidationResult {
    valid: boolean;
    reason?: string;
}

/**
 * 验证 localStorage 中的 access_token
 * 校验项：存在性、格式、时间戳(1小时内)、签名(djb2)
 */
export function verifyToken(): TokenValidationResult {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        return { valid: false, reason: '无凭证信息' };
    }

    let parts: string[];
    try {
        const payloadStr = atob(token);
        parts = payloadStr.split('|');
    } catch (e) {
        return { valid: false, reason: '凭证格式损坏' };
    }

    if (parts.length !== 3) {
        return { valid: false, reason: '凭证结构错误' };
    }

    const timestamp = parseInt(parts[0], 10);
    const uid = parts[1];
    const providedSig = parts[2];

    if (isNaN(timestamp)) {
        return { valid: false, reason: '凭证时间戳无效' };
    }

    const now = Date.now();
    const expirationTime = timestamp + TOKEN_VALID_MS;

    if (now > expirationTime) {
        localStorage.removeItem(TOKEN_KEY);
        return { valid: false, reason: '凭证已过期（超过1小时）' };
    }

    const signString = `${timestamp}|${uid}`;
    const expectedSig = simpleHash(signString);

    if (providedSig !== expectedSig) {
        return { valid: false, reason: '签名校验失败（凭证可能被篡改）' };
    }

    return { valid: true };
}

/** 清除本地 token */
export function clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
}

/**
 * 计算答完题后要回哪：null 表示不回跳（答题页会走默认的导航中心）。
 *
 * 下载站只在「分享链接」时才值得原路返回 —— 也就是带 ?song= 的那类地址，
 * 用户扫码就是为了看这一首。单纯被拦的下载站首页没有具体内容，
 * 送去导航中心更合适：从那儿能进谱面下载器，也不会困在空白曲库上。
 */
function buildReturnTarget(): string | null {
    try {
        const url = new URL(window.location.href);
        const file = url.pathname.split('/').pop();
        const isDownloader = file === '' || file === 'index.html';
        if (isDownloader && !url.searchParams.get('song')) return null;
        return url.href;
    } catch (e) {
        return null;
    }
}

/** 答完题是否会自动回到当前页，供界面提示文案使用 */
export function willReturnAfterQuiz(): boolean {
    return buildReturnTarget() !== null;
}

/**
 * 清除 token 并跳转到答题页。
 * 值得原路返回时才带 return_to（例如扫码打开的 ?song=xxx），
 * 否则直接去答题页，答完由它落到导航中心。
 */
export function redirectToQuiz(): void {
    clearToken();
    const back = buildReturnTarget();
    try {
        window.location.href = back
            ? `./quiz.html?return_to=${encodeURIComponent(back)}`
            : './quiz.html';
    } catch (e) {
        window.location.href = './quiz.html';
    }
}
