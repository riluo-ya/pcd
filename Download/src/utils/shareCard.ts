import { Song } from '../types';
import { makeQrMatrix, drawQrToCanvas } from './qrcode';

/* ============================================================
   谱面分享卡片：纯 Canvas 绘制，不依赖后端，可直接导出 PNG
   ============================================================ */

export type CardThemeId =
    | 'midnight'
    | 'aurora'
    | 'sunset'
    | 'forest'
    | 'sakura'
    | 'ocean'
    | 'gold'
    | 'magma'
    | 'glacier'
    | 'mono'
    | 'cyber'
    | 'mint'
    | 'nebula'
    | 'mocha'
    | 'lime'
    | 'coral'
    | 'ivory';

export interface CardTheme {
    id: CardThemeId;
    name: string;
    /** 背景渐变（上 → 下） */
    bg: [string, string, string];
    /** 强调色 */
    accent: string;
    text: string;
    sub: string;
    /** 卡片面板底色 */
    panel: string;
    /** 装饰光斑配色，缺省时沿用 accent */
    glow?: string;
}

export const CARD_THEMES: CardTheme[] = [
    {
        id: 'midnight',
        name: '暗夜',
        bg: ['#0b1120', '#111c33', '#0d1526'],
        accent: '#22d3ee',
        text: '#f1f5f9',
        sub: '#94a3b8',
        panel: 'rgba(255,255,255,0.06)',
        glow: '#38bdf8',
    },
    {
        id: 'aurora',
        name: '极光',
        bg: ['#2a1050', '#4c1d95', '#1e1b4b'],
        accent: '#c084fc',
        text: '#faf5ff',
        sub: '#c9b8e8',
        panel: 'rgba(255,255,255,0.08)',
        glow: '#a855f7',
    },
    {
        id: 'sunset',
        name: '暖阳',
        bg: ['#3b1220', '#7c2d12', '#431407'],
        accent: '#fbbf24',
        text: '#fffbeb',
        sub: '#e7c9a8',
        panel: 'rgba(255,255,255,0.08)',
        glow: '#f97316',
    },
    {
        id: 'forest',
        name: '青林',
        bg: ['#062b28', '#0f3d33', '#08201d'],
        accent: '#4ade80',
        text: '#f0fdf4',
        sub: '#a7c4b5',
        panel: 'rgba(255,255,255,0.07)',
        glow: '#22c55e',
    },
    {
        id: 'sakura',
        name: '樱雪',
        bg: ['#3b0d2e', '#831843', '#2a0a22'],
        accent: '#f9a8d4',
        text: '#fff1f7',
        sub: '#e3b6cd',
        panel: 'rgba(255,255,255,0.08)',
        glow: '#ec4899',
    },
    {
        id: 'ocean',
        name: '深海',
        bg: ['#04202e', '#075985', '#052c42'],
        accent: '#38bdf8',
        text: '#f0f9ff',
        sub: '#a5c9dd',
        panel: 'rgba(255,255,255,0.07)',
        glow: '#0ea5e9',
    },
    {
        id: 'gold',
        name: '曜金',
        bg: ['#1c1507', '#4a3406', '#231a08'],
        accent: '#facc15',
        text: '#fffbeb',
        sub: '#dcc79a',
        panel: 'rgba(255,255,255,0.07)',
        glow: '#d97706',
    },
    {
        id: 'magma',
        name: '熔岩',
        bg: ['#2b0a0a', '#7f1d1d', '#3b0c0c'],
        accent: '#fb7185',
        text: '#fff1f2',
        sub: '#dfa6ae',
        panel: 'rgba(255,255,255,0.07)',
        glow: '#ef4444',
    },
    {
        id: 'glacier',
        name: '冰川',
        bg: ['#0d2334', '#1e4a63', '#10293d'],
        accent: '#7dd3fc',
        text: '#f5fbff',
        sub: '#a8c6d8',
        panel: 'rgba(255,255,255,0.07)',
        glow: '#38bdf8',
    },
    {
        id: 'mono',
        name: '石墨',
        bg: ['#111318', '#23262e', '#16181d'],
        accent: '#e2e8f0',
        text: '#f8fafc',
        sub: '#a1a8b5',
        panel: 'rgba(255,255,255,0.06)',
        glow: '#94a3b8',
    },
    {
        id: 'cyber',
        name: '霓虹',
        bg: ['#0a0014', '#2d0036', '#08001a'],
        accent: '#ff3ea5',
        text: '#ffe9f7',
        sub: '#d6a3cd',
        panel: 'rgba(255,255,255,0.07)',
        glow: '#8b00ff',
    },
    {
        id: 'mint',
        name: '薄荷',
        bg: ['#052e2c', '#0a4f49', '#062824'],
        accent: '#5eead4',
        text: '#effffb',
        sub: '#9dc9c0',
        panel: 'rgba(255,255,255,0.07)',
        glow: '#14b8a6',
    },
    {
        id: 'nebula',
        name: '星海',
        bg: ['#070b26', '#1b1b52', '#0a0e30'],
        accent: '#a5b4fc',
        text: '#eef1ff',
        sub: '#a9b0d8',
        panel: 'rgba(255,255,255,0.07)',
        glow: '#6366f1',
    },
    {
        id: 'mocha',
        name: '摩卡',
        bg: ['#1d1410', '#3f2a1d', '#241811'],
        accent: '#d6a56f',
        text: '#fdf6ee',
        sub: '#c2a287',
        panel: 'rgba(255,255,255,0.06)',
        glow: '#b45309',
    },
    {
        id: 'lime',
        name: '青柠',
        bg: ['#182a06', '#314d0a', '#1b2c08'],
        accent: '#a3e635',
        text: '#f7fee7',
        sub: '#b3c894',
        panel: 'rgba(255,255,255,0.07)',
        glow: '#65a30d',
    },
    {
        id: 'coral',
        name: '珊瑚',
        bg: ['#2c1418', '#5b2b3a', '#2a1119'],
        accent: '#ffa8a8',
        text: '#fff5f5',
        sub: '#ddb0b6',
        panel: 'rgba(255,255,255,0.07)',
        glow: '#f43f5e',
    },
    // 浅色主题：ink 会自动切换成深色，保证描边与文字可读
    {
        id: 'ivory',
        name: '素白',
        bg: ['#eef1f6', '#f8fafc', '#e2e8f0'],
        accent: '#2563eb',
        text: '#0f172a',
        sub: '#55637a',
        panel: 'rgba(15,23,42,0.05)',
        glow: '#60a5fa',
    },
];

export const DIFF_COLORS: Record<string, string> = {
    EZ: '#4fc3f7',
    HD: '#66de93',
    IN: '#ff6b6b',
    AT: '#c792ea',
};

const DIFF_ORDER = ['EZ', 'HD', 'IN', 'AT'];

/** BPM 显示：整数直接显示，小数保留一位 */
function formatBpm(bpm: number): string {
    return Number.isInteger(bpm) ? String(bpm) : bpm.toFixed(1);
}

/** 秒 → m:ss */
function formatDuration(sec: number): string {
    const s = Math.max(0, Math.round(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * 取某难度的定数，不存在则返回 null。
 * 上游数据里空值形态很多（缺列、空串、'—'、'?'、0），统一在这里判掉，
 * 避免把「没有这个难度」当成「难度是 —」渲染出来。
 */
export function levelOf(song: Song, diff: string): string | null {
    const raw = song.difficulties?.[diff as keyof NonNullable<Song['difficulties']>];
    const s = typeof raw === 'string' ? raw.trim() : '';
    if (!s || s === '—' || s === '-' || s === '?') return null;
    const n = parseFloat(s);
    if (Number.isNaN(n) || n <= 0) return null;
    return s;
}

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1440;

/** 曲目级谱面信息，从谱面 JSON 解析得到 */
export interface ChartInfo {
    bpm: number | null;
    judgeLines: number | null;
    /** 时长（秒） */
    duration: number | null;
}

export interface ShareCardInput {
    song: Song;
    /** 已加载好的曲绘，可为 null（会画占位图） */
    illustration: HTMLImageElement | null;
    theme: CardTheme;
    /** 各难度物量，可选；有的话会显示在难度徽章里 */
    noteCounts?: Record<string, number>;
    /** BPM / 判定线 / 时长，可选 */
    chartInfo?: ChartInfo;
    /** 二维码内容 */
    qrText: string;
    /** 底部站点名 */
    siteName?: string;
    /** 底部副标题（一般是域名） */
    siteUrl?: string;
}

const FONT_STACK = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const FONT_MONO = '"SF Mono", "JetBrains Mono", "Menlo", "Consolas", monospace';

function roundRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
): void {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    ctx.lineTo(x + rr, y + h);
    ctx.arcTo(x, y + h, x, y + h - rr, rr);
    ctx.lineTo(x, y + rr);
    ctx.arcTo(x, y, x + rr, y, rr);
    ctx.closePath();
}

/** 画一个圆角矩形（填充 / 描边通用） */
function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill?: string | CanvasGradient,
    stroke?: string,
    lineWidth = 1
): void {
    roundRectPath(ctx, x, y, w, h, r);
    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
}

/** #rgb / #rrggbb → rgba(...) */
function hexToRgba(hex: string, alpha: number): string {
    let h = (hex || '').replace('#', '').trim();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (h.length !== 6) return `rgba(255,255,255,${alpha})`;
    const num = parseInt(h, 16);
    if (Number.isNaN(num)) return `rgba(255,255,255,${alpha})`;
    return `rgba(${(num >> 16) & 255},${(num >> 8) & 255},${num & 255},${alpha})`;
}

/** 粗判一个 hex 色是否偏亮，用于浅色主题自动切换描边/面板配色 */
function isLightColor(hex: string): boolean {
    let h = (hex || '').replace('#', '').trim();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (h.length !== 6) return false;
    const num = parseInt(h, 16);
    if (Number.isNaN(num)) return false;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150;
}

/** 逐字绘制，模拟字间距（比 ctx.letterSpacing 兼容性更好）；支持右对齐 */
function drawSpacedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    spacing: number
): number {
    if (!spacing) {
        ctx.fillText(text, x, y);
        return ctx.measureText(text).width;
    }
    const right = ctx.textAlign === 'right';
    const prev = ctx.textAlign;
    let cx = x;
    if (right) {
        ctx.textAlign = 'left';
        cx = x - measureSpacedText(ctx, text, spacing);
    }
    for (const ch of text) {
        ctx.fillText(ch, cx, y);
        cx += ctx.measureText(ch).width + spacing;
    }
    ctx.textAlign = prev;
    return measureSpacedText(ctx, text, spacing);
}

function measureSpacedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    spacing: number
): number {
    if (!spacing) return ctx.measureText(text).width;
    let w = 0;
    for (const ch of text) w += ctx.measureText(ch).width + spacing;
    return w - spacing;
}

/** 按空格优先分词，过长的词再按字符拆，中英混排都友好 */
function tokenize(text: string): string[] {
    const out: string[] = [];
    text.split(/\s+/).forEach((word, i, arr) => {
        if (word.length > 12) {
            out.push(...word.split(''));
        } else {
            out.push(word);
        }
        if (i < arr.length - 1) out.push(' ');
    });
    return out;
}

/**
 * 自动换行。返回的数组带一个 truncated 标记：
 * 当 maxLines 行仍装不下全文时为 true，此时末行会加省略号，避免内容被静默吞掉。
 */
function wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxLines: number
): string[] & { truncated?: boolean } {
    const tokens = tokenize(text);
    const lines: string[] = [];
    let cur = '';
    let truncated = false;

    for (const tk of tokens) {
        if (tk === ' ' && cur === '') continue;
        const test = cur + tk;
        if (ctx.measureText(test).width > maxWidth && cur !== '') {
            // 已经是最后一行却还要再开一行 —— 说明装不下了
            if (lines.length >= maxLines - 1) { truncated = true; break; }
            lines.push(cur.trimEnd());
            cur = tk === ' ' ? '' : tk;
        } else {
            cur = test;
        }
    }
    if (!truncated && lines.length < maxLines && cur.trim()) lines.push(cur.trimEnd());

    if (truncated) {
        let last = lines[lines.length - 1] || '';
        while (last.length > 1 && ctx.measureText(last + '…').width > maxWidth) {
            last = last.slice(0, -1);
        }
        lines[lines.length - 1] = (last || '…') + '…';
    }

    const out = lines as string[] & { truncated?: boolean };
    out.truncated = truncated;
    return out;
}

/** cover 方式把图片画进矩形 */
function drawImageCover(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number
): void {
    const ir = img.width / img.height;
    const tr = w / h;
    let sw = img.width;
    let sh = img.height;
    let sx = 0;
    let sy = 0;
    if (ir > tr) {
        sw = img.height * tr;
        sx = (img.width - sw) / 2;
    } else {
        sh = img.width / tr;
        sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/** 是否支持 ctx.filter（Safari 旧版不支持，需要降级方案） */
function supportsCanvasFilter(): boolean {
    try {
        const probe = document.createElement('canvas');
        probe.width = probe.height = 1;
        const c = probe.getContext('2d');
        if (!c) return false;
        c.filter = 'blur(2px)';
        return c.filter !== 'none' && c.filter !== '';
    } catch (e) {
        return false;
    }
}

/**
 * 把曲绘以「模糊 + cover 裁剪」的方式画进目标矩形。
 *
 * 模糊用两级策略，保证任何浏览器都有效果：
 *   1) 先把曲绘缩到极小的离屏画布（约 24px 宽），再放大回来 —— 双线性插值天然产生模糊，
 *      不依赖任何新 API，全兼容（包括不支持 ctx.filter 的旧 Safari）；
 *   2) 若支持 ctx.filter，再叠一层真高斯模糊，边缘更柔和。
 */
function drawBlurredCover(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
    blurPx: number
): void {
    if (!img || img.width <= 0 || w <= 0 || h <= 0) return;

    // 1) 低分辨率离屏：越小越糊
    const small = document.createElement('canvas');
    const SW = 24;
    const SH = Math.max(1, Math.round(SW * (h / w)));
    small.width = SW;
    small.height = SH;
    const sctx = small.getContext('2d');
    if (!sctx) {
        // 拿不到离屏上下文就退回普通绘制，至少保证有底图
        drawImageCover(ctx, img, x, y, w, h);
        return;
    }

    // cover 方式把曲绘塞进小画布
    const ir = img.width / img.height;
    const tr = SW / SH;
    let sw = img.width;
    let sh = img.height;
    let sx = 0;
    let sy = 0;
    if (ir > tr) {
        sw = img.height * tr;
        sx = (img.width - sw) / 2;
    } else {
        sh = img.width / tr;
        sy = (img.height - sh) / 2;
    }
    sctx.drawImage(img, sx, sy, sw, sh, 0, 0, SW, SH);

    // 2) 支持 filter 时再柔化一次（在小画布上做，开销极低）
    if (supportsCanvasFilter()) {
        const tmp = document.createElement('canvas');
        tmp.width = SW;
        tmp.height = SH;
        const tctx = tmp.getContext('2d');
        if (tctx) {
            tctx.filter = `blur(${Math.max(1, Math.min(6, blurPx / 12))}px)`;
            tctx.drawImage(small, 0, 0);
            sctx.clearRect(0, 0, SW, SH);
            sctx.drawImage(tmp, 0, 0);
        }
    }

    // 3) 放大回目标区域：浏览器插值 + 可选真模糊
    const prevSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) {
        (ctx as CanvasRenderingContext2D & { imageSmoothingQuality: ImageSmoothingQuality })
            .imageSmoothingQuality = 'high';
    }
    if (supportsCanvasFilter()) {
        ctx.save();
        ctx.filter = `blur(${blurPx}px)`;
        ctx.drawImage(small, x, y, w, h);
        ctx.restore();
    } else {
        ctx.drawImage(small, x, y, w, h);
    }
    ctx.imageSmoothingEnabled = prevSmoothing;
}

/** 柔和光斑：给背景加一层呼吸感 */
function drawGlow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    color: string,
    alpha: number
): void {
    if (r <= 0 || alpha <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexToRgba(color, alpha));
    g.addColorStop(0.55, hexToRgba(color, alpha * 0.35));
    g.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
}

/** 玻璃质感面板：渐变底 + 细描边 + 顶部高光 + 投影。light 为浅色主题时改用深色 ink */
function drawGlassPanel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    opts?: { shadow?: boolean; tint?: string; light?: boolean }
): void {
    const light = !!opts?.light;
    const ink = (a: number) => (light ? `rgba(15,23,42,${a})` : `rgba(255,255,255,${a})`);

    // 投影（单独画一层，避免影响后续绘制）
    if (opts?.shadow !== false) {
        ctx.save();
        ctx.shadowColor = light ? 'rgba(15,23,42,0.16)' : 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = light ? 34 : 46;
        ctx.shadowOffsetY = 18;
        ctx.fillStyle = light ? 'rgba(15,23,42,0.12)' : 'rgba(0,0,0,0.35)';
        roundRectPath(ctx, x, y, w, h, r);
        ctx.fill();
        ctx.restore();
    }

    // 主体渐变
    const g = ctx.createLinearGradient(x, y, x, y + h);
    if (light) {
        g.addColorStop(0, 'rgba(255,255,255,0.88)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.72)');
        g.addColorStop(1, 'rgba(255,255,255,0.60)');
    } else {
        g.addColorStop(0, 'rgba(255,255,255,0.10)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.055)');
        g.addColorStop(1, 'rgba(255,255,255,0.03)');
    }
    roundRect(ctx, x, y, w, h, r, g);

    // 斜向纹理（很轻，只为去掉「一片死板的纯色」）
    ctx.save();
    roundRectPath(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.strokeStyle = ink(light ? 0.03 : 0.028);
    ctx.lineWidth = 1;
    const step = 26;
    for (let i = -h; i < w + h; i += step) {
        ctx.beginPath();
        ctx.moveTo(x + i, y);
        ctx.lineTo(x + i + h, y + h);
        ctx.stroke();
    }
    // 左上角高光
    const hl = ctx.createLinearGradient(x, y, x + w * 0.75, y + h * 0.4);
    hl.addColorStop(0, ink(light ? 0.05 : 0.10));
    hl.addColorStop(1, ink(0));
    ctx.fillStyle = hl;
    ctx.fillRect(x, y, w, h * 0.55);
    ctx.restore();

    // 细描边
    roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, r, undefined, ink(light ? 0.12 : 0.14), 1.5);
}

/** 带阴影的圆角块（徽章、二维码底等通用） */
function drawShadowBlock(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: string | CanvasGradient,
    stroke?: string
): void {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    roundRect(ctx, x, y, w, h, r, fill);
    ctx.restore();
    if (stroke) roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, r, undefined, stroke, 1.5);
}

/** 胶囊标签 */
function drawPill(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
    text: string,
    color: string,
    font: string
): void {
    roundRect(ctx, x, y, w, h, h / 2, fill);
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2 + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
}

export function renderShareCard(input: ShareCardInput): HTMLCanvasElement {
    const { song, illustration, theme, noteCounts, qrText, chartInfo } = input;
    const siteName = input.siteName ?? 'PCD';
    const siteUrl = input.siteUrl ?? 'pcd.bot.cd';
    const glow = theme.glow || theme.accent;

    const canvas = document.createElement('canvas');
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建画布');

    const W = CARD_WIDTH;
    const H = CARD_HEIGHT;
    const PAD = 72;
    const contentW = W - PAD * 2;

    // 浅色主题自动切换：描边/面板/柔光等硬编码白色在浅底上会看不见
    const LIGHT = isLightColor(theme.bg[1]);
    const ink = (a: number) => (LIGHT ? `rgba(15,23,42,${a})` : `rgba(255,255,255,${a})`);

    /* ================= 背景 ================= */
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, theme.bg[0]);
    grad.addColorStop(0.55, theme.bg[1]);
    grad.addColorStop(1, theme.bg[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 曲绘做背景：模糊铺满 + 半透明
    if (illustration && illustration.width > 0) {
        ctx.save();
        ctx.globalAlpha = 0.42;
        drawBlurredCover(ctx, illustration, -W * 0.08, -H * 0.06, W * 1.16, H * 1.12, 46);
        ctx.restore();
    }

    // 主题色再染一层，保证 4 套主题仍有明显区分度
    ctx.save();
    ctx.globalAlpha = 0.38;
    const tint = ctx.createLinearGradient(0, 0, 0, H);
    tint.addColorStop(0, theme.bg[0]);
    tint.addColorStop(0.55, theme.bg[1]);
    tint.addColorStop(1, theme.bg[2]);
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // 装饰光斑（浅色主题下调淡，避免叠加过曝）
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gA = LIGHT ? 0.10 : 0.20;
    const gB = LIGHT ? 0.07 : 0.14;
    drawGlow(ctx, W * 0.92, H * 0.10, 520, glow, gA);
    drawGlow(ctx, W * 0.06, H * 0.86, 460, glow, gB);
    drawGlow(ctx, W * 0.72, H * 0.62, 380, theme.accent, LIGHT ? 0.05 : 0.10);
    ctx.restore();

    // 遮罩，保证文字可读（浅色主题改用提亮遮罩）
    const mask = ctx.createLinearGradient(0, 0, 0, H);
    if (LIGHT) {
        mask.addColorStop(0, 'rgba(255,255,255,0.30)');
        mask.addColorStop(0.5, 'rgba(255,255,255,0.42)');
        mask.addColorStop(1, 'rgba(255,255,255,0.58)');
    } else {
        mask.addColorStop(0, 'rgba(4,8,18,0.52)');
        mask.addColorStop(0.5, 'rgba(4,8,18,0.66)');
        mask.addColorStop(1, 'rgba(4,8,18,0.86)');
    }
    ctx.fillStyle = mask;
    ctx.fillRect(0, 0, W, H);

    // 四周轻微压暗，聚焦中心
    const vign = ctx.createRadialGradient(W / 2, H * 0.46, H * 0.24, W / 2, H * 0.5, H * 0.8);
    vign.addColorStop(0, LIGHT ? 'rgba(15,23,42,0)' : 'rgba(0,0,0,0)');
    vign.addColorStop(1, LIGHT ? 'rgba(15,23,42,0.14)' : 'rgba(0,0,0,0.42)');
    ctx.fillStyle = vign;
    ctx.fillRect(0, 0, W, H);

    // 海报内框
    roundRect(ctx, 26, 26, W - 52, H - 52, 32, undefined, ink(LIGHT ? 0.10 : 0.07), 2);

    /* ================= 顶部品牌条 ================= */
    roundRect(ctx, PAD, 86, 84, 8, 4, theme.accent);

    ctx.fillStyle = theme.accent;
    ctx.font = `600 25px ${FONT_STACK}`;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText('PHIGROS CHART', PAD, 132);
    const tagW = ctx.measureText('PHIGROS CHART').width;
    ctx.fillStyle = theme.sub;
    ctx.font = `400 22px ${FONT_STACK}`;
    ctx.fillText('· 谱面卡片', PAD + tagW + 12, 132);

    // 右上角域名胶囊
    ctx.font = `500 21px ${FONT_STACK}`;
    const pillW = ctx.measureText(siteUrl).width + 44;
    const pillX = W - PAD - pillW;
    drawPill(
        ctx,
        pillX,
        88,
        pillW,
        46,
        ink(LIGHT ? 0.06 : 0.08),
        siteUrl,
        LIGHT ? 'rgba(15,23,42,0.72)' : 'rgba(255,255,255,0.78)',
        `500 21px ${FONT_STACK}`
    );
    roundRect(ctx, pillX + 0.5, 88.5, pillW - 1, 45, 22.5, undefined, ink(LIGHT ? 0.14 : 0.16), 1);

    /* ================= 主面板 ================= */
    const INNER = 40;
    const artSize = 440;

    // 难度横条：一行一个难度，含定数、物量与谱师
    const ROW_H = 88;
    const ROW_GAP = 14;
    const FOOT_H = 200;
    const FOOT_GAP = 42;
    const AREA_TOP_MIN = 168;   // 顶部品牌条之下
    const AREA_BOTTOM = H - 56; // 海报内框之内

    // 行集合：只渲染真实存在定数的难度。
    // 注意不能拿 charters 兜底——上游 info.tsv 的 AT 列即使没有 AT 难度也常常有值，
    // 以谱师为准会让没有 AT 的曲子平白多出一行「AT —」。
    const hasAnyLevel = DIFF_ORDER.some(d => levelOf(song, d) !== null);
    const rows = DIFF_ORDER.filter(d => {
        if (levelOf(song, d) !== null) return true;
        // 难度表整体缺失时（接口拉取失败）才退回按谱师列，至少不至于一片空白
        return !hasAnyLevel && !!(song.charters?.[d as keyof Song['charters']] || '').trim();
    });
    const rowsArea = rows.length ? rows.length * ROW_H + (rows.length - 1) * ROW_GAP : ROW_H;

    const PANEL_X = PAD;
    const PANEL_H = INNER + artSize + 52 + rowsArea + INNER;
    // 整体内容块在可用区域内垂直居中，行数不同也不会溢出
    const blockH = PANEL_H + FOOT_GAP + FOOT_H;
    const PANEL_Y = AREA_TOP_MIN + Math.max(0, (AREA_BOTTOM - AREA_TOP_MIN - blockH) / 2);

    const artX = PANEL_X + INNER;
    const artY = PANEL_Y + INNER;
    const artBottom = artY + artSize;
    const rowTop = artBottom + 52;

    drawGlassPanel(ctx, PANEL_X, PANEL_Y, contentW, PANEL_H, 36, { light: LIGHT });

    /* ---------- 曲绘 ---------- */
    // 曲绘背后的强调色光晕
    ctx.save();
    roundRectPath(ctx, PANEL_X, PANEL_Y, contentW, PANEL_H, 36);
    ctx.clip();
    drawGlow(ctx, artX + artSize / 2, artY + artSize / 2, artSize * 0.95, glow, LIGHT ? 0.14 : 0.30);
    ctx.restore();

    // 投影
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 48;
    ctx.shadowOffsetY = 22;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRectPath(ctx, artX, artY, artSize, artSize, 28);
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundRectPath(ctx, artX, artY, artSize, artSize, 28);
    ctx.clip();
    if (illustration && illustration.width > 0) {
        drawImageCover(ctx, illustration, artX, artY, artSize, artSize);
    } else {
        // 占位：渐变 + 音符
        const pg = ctx.createLinearGradient(artX, artY, artX + artSize, artY + artSize);
        pg.addColorStop(0, ink(LIGHT ? 0.06 : 0.12));
        pg.addColorStop(1, ink(LIGHT ? 0.02 : 0.03));
        ctx.fillStyle = pg;
        ctx.fillRect(artX, artY, artSize, artSize);
        ctx.fillStyle = ink(LIGHT ? 0.14 : 0.24);
        ctx.font = `400 150px ${FONT_STACK}`;
        ctx.textAlign = 'center';
        ctx.fillText('♪', artX + artSize / 2, artY + artSize / 2 + 52);
        ctx.textAlign = 'left';
    }
    // 底部渐隐，托住 ID 标签
    const artFade = ctx.createLinearGradient(0, artBottom - 130, 0, artBottom);
    artFade.addColorStop(0, 'rgba(0,0,0,0)');
    artFade.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = artFade;
    ctx.fillRect(artX, artBottom - 130, artSize, 130);
    ctx.restore();

    // 曲绘 ID 标签（等宽字体，测量与绘制保持一致）
    ctx.font = `500 21px ${FONT_MONO}`;
    const idText = wrapText(ctx, song.id, artSize - 56, 1)[0] || '';
    const idW = ctx.measureText(idText).width + 32;
    roundRect(ctx, artX + 20, artBottom - 58, idW, 38, 19, 'rgba(0,0,0,0.42)', ink(0.20), 1);
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.fillText(idText, artX + 36, artBottom - 32);
    ctx.font = `400 28px ${FONT_STACK}`;

    // 曲绘内描边 + 外描边
    roundRect(ctx, artX + 1.5, artY + 1.5, artSize - 3, artSize - 3, 26.5, undefined, ink(LIGHT ? 0.10 : 0.22), 3);
    roundRect(ctx, artX - 1, artY - 1, artSize + 2, artSize + 2, 29, undefined, LIGHT ? 'rgba(15,23,42,0.18)' : 'rgba(0,0,0,0.25)', 2);

    /* ---------- 右侧：曲名 / 作曲家 ---------- */
    const infoX = artX + artSize + 48;
    const infoW = PANEL_X + contentW - INNER - infoX;

    // 有 BPM/判定线/时长时，右栏还要多占一行半，曲名最多排 2 行才放得下
    const hasMeta = !!(chartInfo?.bpm || chartInfo?.judgeLines || chartInfo?.duration);

    // 小标签
    ctx.fillStyle = hexToRgba(theme.accent, 0.9);
    ctx.font = `600 20px ${FONT_STACK}`;
    drawSpacedText(ctx, 'SONG', infoX, artY + 26, 4);

    // 曲名自适应：字号从 62 逐级下调，行数上限跟着剩余高度走。
    // 长曲名会自动多行 + 缩小，而不是被硬截断成省略号。
    const nameTop = artY + 26;
    // 曲名下方必须留给作曲家、分隔线，有 BPM 行时还要多留一截（实测占用约 116px）
    const nameReserve = hasMeta ? 156 : 48;
    const nameAvailH = Math.max(120, artBottom - nameTop - nameReserve);

    let nameSize = 62;
    let nameLines: string[] = [];
    let lineH = nameSize * 1.24;
    for (; nameSize >= 20; nameSize -= 2) {
        ctx.font = `700 ${nameSize}px ${FONT_STACK}`;
        lineH = nameSize * 1.24;
        // 第一行基线落在 nameTop + nameSize，这段高度也要扣掉
        const usable = nameAvailH - nameSize;
        // 字号越小能塞的行数越多；上限 5 行，够超长曲名用，又不至于挤成一片小字
        const maxLines = Math.max(1, Math.min(5, Math.floor(usable / lineH)));
        nameLines = wrapText(ctx, song.name || '未命名', infoW, maxLines);
        if (!nameLines.truncated) break;
    }
    if (nameSize < 20) nameSize = 20;

    ctx.font = `700 ${nameSize}px ${FONT_STACK}`;
    ctx.fillStyle = theme.text;
    ctx.textAlign = 'left';
    // 顶部对齐，紧跟 SONG 标签；下方留白由作曲家与分隔线自然填充
    const ty = nameTop + nameSize;
    nameLines.forEach((ln, i) => {
        ctx.fillText(ln, infoX, ty + i * lineH);
    });

    // 作曲家
    const composerY = ty + nameLines.length * lineH + 40;
    ctx.fillStyle = theme.sub;
    ctx.font = `400 28px ${FONT_STACK}`;
    const composerText = (song.composer && song.composer !== 'TBA') ? song.composer : '未知作曲家';
    ctx.fillText(wrapText(ctx, composerText, infoW, 1)[0] || '', infoX, composerY);

    // 分隔细线（渐变，由强调色淡出）
    const sepY = composerY + 28;
    const sep = ctx.createLinearGradient(infoX, 0, infoX + infoW, 0);
    sep.addColorStop(0, hexToRgba(theme.accent, 0.75));
    sep.addColorStop(0.6, hexToRgba(theme.accent, 0.15));
    sep.addColorStop(1, 'rgba(255,255,255,0)');
    roundRect(ctx, infoX, sepY, infoW, 3, 1.5, sep);

    // BPM / 判定线 / 时长：等距排布的一组数据，勾选后才画
    const metaY = sepY + 46;
    const meta = [
        { label: 'BPM', value: chartInfo?.bpm ? formatBpm(chartInfo.bpm) : null },
        { label: 'LINES', value: chartInfo?.judgeLines ? String(chartInfo.judgeLines) : null },
        { label: 'TIME', value: chartInfo?.duration ? formatDuration(chartInfo.duration) : null },
    ].filter(m => m.value !== null);

    if (meta.length > 0) {
        // 每格宽度固定，标签与数值左对齐，视觉上成列
        const colW = Math.min(150, infoW / meta.length);
        meta.forEach((m, i) => {
            const mx = infoX + i * colW;
            ctx.textAlign = 'left';
            ctx.fillStyle = ink(LIGHT ? 0.45 : 0.38);
            ctx.font = `600 16px ${FONT_STACK}`;
            drawSpacedText(ctx, m.label, mx, metaY, 2.5);

            ctx.fillStyle = theme.text;
            ctx.font = `700 30px ${FONT_MONO}`;
            ctx.fillText(m.value as string, mx, metaY + 34);
        });
        ctx.font = `400 28px ${FONT_STACK}`;
    }

    // 右下角装饰音符（低透明度，仅做底纹，不抢主体）
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = theme.accent;
    ctx.font = `700 190px ${FONT_STACK}`;
    ctx.textAlign = 'right';
    ctx.fillText('♪', infoX + infoW, artBottom - 26);
    ctx.restore();
    ctx.textAlign = 'left';

    /* ---------- 难度 / 定数 / 谱师 横条 ---------- */
    const rowW = contentW - INNER * 2;

    if (rows.length === 0) {
        ctx.fillStyle = theme.sub;
        ctx.font = `400 28px ${FONT_STACK}`;
        ctx.textAlign = 'left';
        ctx.fillText('暂无难度信息', artX, rowTop + 56);
    }

    rows.forEach((d, i) => {
        const bx = artX;
        const by = rowTop + i * (ROW_H + ROW_GAP);
        const key = d as keyof NonNullable<Song['difficulties']>;
        const level = levelOf(song, d) ?? (song.difficulties?.[key] || '—');
        const charter = (song.charters?.[d as keyof Song['charters']] || '').trim();
        const color = DIFF_COLORS[d] || '#94a3b8';
        const cy = by + ROW_H / 2;

        // 横条底：难度色渐变，从左到右淡出
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.28)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 8;
        const bg = ctx.createLinearGradient(bx, by, bx + rowW, by);
        bg.addColorStop(0, hexToRgba(color, 0.30));
        bg.addColorStop(0.45, hexToRgba(color, 0.12));
        bg.addColorStop(1, ink(LIGHT ? 0.05 : 0.035));
        roundRect(ctx, bx, by, rowW, ROW_H, 22, bg);
        ctx.restore();
        roundRect(ctx, bx + 0.75, by + 0.75, rowW - 1.5, ROW_H - 1.5, 21.5, undefined, ink(LIGHT ? 0.10 : 0.12), 1.5);

        // 顶部高光
        ctx.save();
        roundRectPath(ctx, bx, by, rowW, ROW_H, 22);
        ctx.clip();
        const bh = ctx.createLinearGradient(bx, by, bx + rowW * 0.5, by + ROW_H * 0.6);
        bh.addColorStop(0, ink(LIGHT ? 0.05 : 0.09));
        bh.addColorStop(1, ink(0));
        ctx.fillStyle = bh;
        ctx.fillRect(bx, by, rowW, ROW_H * 0.62);
        ctx.restore();

        // 左侧色条
        ctx.save();
        roundRectPath(ctx, bx, by, rowW, ROW_H, 22);
        ctx.clip();
        roundRect(ctx, bx, by + 16, 6, ROW_H - 32, 3, color);
        ctx.restore();

        // 难度胶囊
        ctx.font = `700 24px ${FONT_STACK}`;
        const dPillW = ctx.measureText(d).width + 44;
        const dPillH = 48;
        drawPill(
            ctx,
            bx + 24,
            cy - dPillH / 2,
            dPillW,
            dPillH,
            hexToRgba(color, 0.95),
            d,
            '#0b1120',
            `700 24px ${FONT_STACK}`
        );

        // 定数
        ctx.fillStyle = theme.text;
        ctx.font = `800 46px ${FONT_STACK}`;
        ctx.textAlign = 'left';
        const lvX = bx + 24 + dPillW + 26;
        ctx.fillText(String(level), lvX, cy + 16);

        // 物量（可选）
        const nc = noteCounts?.[d];
        let leftEnd = lvX + ctx.measureText(String(level)).width;
        if (typeof nc === 'number') {
            ctx.fillStyle = theme.sub;
            ctx.font = `400 21px ${FONT_STACK}`;
            const ncTxt = `${nc.toLocaleString('en-US')} Notes`;
            ctx.fillText(ncTxt, leftEnd + 18, cy + 15);
            leftEnd += 18 + ctx.measureText(ncTxt).width;
        }

        // 谱师（右对齐）
        const rightX = bx + rowW - 26;
        const charterMaxW = Math.max(90, rightX - leftEnd - 40);
        ctx.textAlign = 'right';
        ctx.fillStyle = ink(LIGHT ? 0.42 : 0.34);
        ctx.font = `500 17px ${FONT_STACK}`;
        drawSpacedText(ctx, 'CHARTER', rightX, cy - 14, 3);
        ctx.fillStyle = charter ? theme.text : theme.sub;
        ctx.font = `500 27px ${FONT_STACK}`;
        ctx.fillText(
            wrapText(ctx, charter || '未标注', charterMaxW, 1)[0] || '',
            rightX,
            cy + 22
        );
        ctx.textAlign = 'left';
    });

    /* ================= 底部：站点 + 二维码 ================= */
    const FOOT_Y = PANEL_Y + PANEL_H + FOOT_GAP;
    drawGlassPanel(ctx, PANEL_X, FOOT_Y, contentW, FOOT_H, 30, { light: LIGHT });

    const qrBox = 176;
    const qrX = PANEL_X + contentW - 38 - qrBox;
    const qrY = FOOT_Y + (FOOT_H - qrBox) / 2;

    // 站点名 / 域名 / 提示（无 logo，左起排布并整体垂直居中）
    const textX = PANEL_X + 38;
    const textW = qrX - 30 - textX;
    const textTop = FOOT_Y + (FOOT_H - 122) / 2;

    ctx.textAlign = 'left';
    ctx.fillStyle = theme.text;
    ctx.font = `700 40px ${FONT_STACK}`;
    ctx.fillText(wrapText(ctx, siteName, textW, 1)[0] || '', textX, textTop + 34);

    ctx.fillStyle = theme.accent;
    ctx.font = `500 26px ${FONT_STACK}`;
    ctx.fillText(wrapText(ctx, siteUrl, textW, 1)[0] || '', textX, textTop + 76);

    ctx.fillStyle = theme.sub;
    ctx.font = `400 21px ${FONT_STACK}`;
    ctx.fillText(wrapText(ctx, '扫码查看该曲目', textW, 1)[0] || '', textX, textTop + 114);

    // 二维码（白底圆角，扫描成功率更高）
    drawShadowBlock(ctx, qrX, qrY, qrBox, qrBox, 22, '#ffffff', 'rgba(255,255,255,0.35)');

    try {
        const matrix = makeQrMatrix(qrText, 'M');
        const qrPad = 14;
        const moduleSize = Math.max(1, Math.floor((qrBox - qrPad * 2) / matrix.size));
        const draw = moduleSize * matrix.size;
        const ox = qrX + (qrBox - draw) / 2;
        const oy = qrY + (qrBox - draw) / 2;
        drawQrToCanvas(ctx, matrix, ox, oy, moduleSize, '#0b1120', '#ffffff');
    } catch (e) {
        // 二维码生成失败不应阻断整张卡片
        ctx.fillStyle = '#94a3b8';
        ctx.font = `400 20px ${FONT_STACK}`;
        ctx.textAlign = 'center';
        ctx.fillText('二维码生成失败', qrX + qrBox / 2, qrY + qrBox / 2);
        ctx.textAlign = 'left';
    }

    return canvas;
}

/** 触发 canvas 下载 */
/**
 * 触发 canvas 下载。
 * 返回 Promise，图片编码完成后 resolve，便于调用方显示「正在下载…」之类的状态。
 */
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        canvas.toBlob(blob => {
            if (!blob) {
                reject(new Error('图片生成失败'));
                return;
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1200);
            resolve();
        }, 'image/png');
    });
}

/** 复制图片到剪贴板（不支持时返回 false，由调用方降级提示） */
export async function copyCanvas(canvas: HTMLCanvasElement): Promise<boolean> {
    if (!navigator.clipboard || !window.isSecureContext || typeof ClipboardItem === 'undefined') {
        return false;
    }
    try {
        const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
        if (!blob) return false;
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        return true;
    } catch {
        return false;
    }
}

/** 生成建议的文件名 */
export function cardFileName(song: Song): string {
    const safe = (song.name || 'chart').replace(/[\\/:*?"<>|]/g, '_').slice(0, 48);
    return `${safe}_卡片.png`;
}
