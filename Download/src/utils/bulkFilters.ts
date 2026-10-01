import { Song } from '../types';
import { isBlacklisted } from '../blacklist';
import { levelOf } from './shareCard';
import { ChartStats } from './chartStats';

export const DIFFS = ['EZ', 'HD', 'IN', 'AT'] as const;

/** 难度显示名，如需本地化可在此调整 */
export const DIFF_LABEL: Record<string, string> = { EZ: 'EZ', HD: 'HD', IN: 'IN', AT: 'AT' };

/**
 * 每首歌最多会抓取的文件数：3 张曲绘 + 音频 + 4 个难度谱面。
 * 实际请求数通常更少 —— 谱面只下真实存在的难度，
 * 而「每难度独立包」模式只需要 1 张曲绘，不下载低清与模糊版本。
 */
export const FILES_PER_SONG = 8;

/** 难度配色，沿用 Phigros 玩家熟悉的 EZ绿 / HD蓝 / IN紫 / AT红 */
export const DIFF_COLOR: Record<string, string> = {
    EZ: '#4ade80',
    HD: '#60a5fa',
    IN: '#c084fc',
    AT: '#f87171',
};

export type LevelScope = 'any' | 'highest' | 'specific';

/**
 * 解析「指定定数」输入框。
 * 支持逗号 / 顿号 / 空格分隔，也可只填一个：
 *   "17" → [17]      "15.3, 17.6" → [15.3, 17.6]
 * 带不带小数都行，非法片段直接丢弃。
 */
export function parseLevelList(input: string): number[] {
    if (!input || !input.trim()) return [];
    return input
        .split(/[,，、\s]+/)
        .map(t => t.trim())
        .filter(Boolean)
        .map(Number)
        .filter(n => Number.isFinite(n));
}

/**
 * 定数是否等于目标值。
 * 用容差而不是 ===：上游写 "17.6" 也有写 "17.60" 的，
 * 直接比较浮点会因精度问题漏掉。0.05 远小于定数最小间隔 0.1，不会误判。
 */
export function levelEquals(v: number, target: number): boolean {
    return Math.abs(v - target) < 0.05;
}

/** 按作用范围取出参与定数比较的数值池 */
export function levelPool(
    levels: { diff: string; level: number }[],
    scope: LevelScope,
    diffs: string[]
): number[] | null {
    if (levels.length === 0) return null;
    if (scope === 'highest') return [Math.max(...levels.map(l => l.level))];
    if (scope === 'specific') {
        const picked = levels.filter(l => diffs.includes(l.diff)).map(l => l.level);
        return picked.length > 0 ? picked : null;
    }
    return levels.map(l => l.level);
}

export interface Filters {
    keyword: string;
    /** 指定定数，逗号分隔的精确值，如 "15.3, 17.6" */
    levels: string;
    levelMin: string;
    levelMax: string;
    levelScope: LevelScope;
    levelDiffs: string[];
    requireDiffs: string[];
    charter: string;
    composer: string;
    excludeBlacklisted: boolean;
    useChartStats: boolean;
    notesMin: string;
    notesMax: string;
    bpmMin: string;
    bpmMax: string;
    durMin: string;
    durMax: string;
    linesMin: string;
    linesMax: string;
}

export const emptyFilters: Filters = {
    keyword: '',
    levels: '',
    levelMin: '',
    levelMax: '',
    levelScope: 'any',
    levelDiffs: [],
    requireDiffs: [],
    charter: '',
    composer: '',
    excludeBlacklisted: true,
    useChartStats: false,
    notesMin: '',
    notesMax: '',
    bpmMin: '',
    bpmMax: '',
    durMin: '',
    durMax: '',
    linesMin: '',
    linesMax: '',
};

export const num = (v: string): number | null => {
    if (v.trim() === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

export const inRange = (v: number | null, min: string, max: string): boolean => {
    if (v === null) return true; // 没有数据时不参与筛选
    const lo = num(min);
    const hi = num(max);
    if (lo !== null && v < lo) return false;
    if (hi !== null && v > hi) return false;
    return true;
};

export const songLevels = (song: Song): { diff: string; level: number }[] =>
    DIFFS.map(d => ({ diff: d, level: levelOf(song, d) }))
        .filter(x => x.level !== null)
        .map(x => ({ diff: x.diff, level: Number(x.level) }));

/** 该曲目是否有任何难度被列入黑名单 */
export const blacklistedDiffs = (song: Song): string[] =>
    DIFFS.filter(d => levelOf(song, d) !== null && isBlacklisted(song.id, d));

// ================= 筛选逻辑 =================

export function applyBaseFilters(songs: Song[], f: Filters): Song[] {
    const kw = f.keyword.trim().toLowerCase();
    const charterKw = f.charter.trim().toLowerCase();
    const composerKw = f.composer.trim().toLowerCase();

    return songs.filter(song => {
        // 关键词：曲名 / ID / 作曲家 / 谱师 任一命中
        if (kw) {
            const haystack = [
                song.name,
                song.id,
                song.composer,
                ...DIFFS.map(d => song.charters?.[d] || ''),
            ].join(' ').toLowerCase();
            if (!haystack.includes(kw)) return false;
        }
        if (composerKw && !(song.composer || '').toLowerCase().includes(composerKw)) return false;
        if (charterKw) {
            const hit = DIFFS.some(d => (song.charters?.[d] || '').toLowerCase().includes(charterKw));
            if (!hit) return false;
        }

        const levels = songLevels(song);

        // 必须存在的难度
        if (f.requireDiffs.length > 0) {
            const has = levels.map(l => l.diff);
            if (!f.requireDiffs.every(d => has.includes(d))) return false;
        }

        // 定数：区间与「指定定数」可同时用，两者都要满足
        const lo = num(f.levelMin);
        const hi = num(f.levelMax);
        const targets = parseLevelList(f.levels);
        if (lo !== null || hi !== null || targets.length > 0) {
            const pool = levelPool(levels, f.levelScope, f.levelDiffs);
            if (pool === null) return false;
            if (lo !== null || hi !== null) {
                const hit = pool.some(v =>
                    (lo === null || v >= lo) && (hi === null || v <= hi)
                );
                if (!hit) return false;
            }
            if (targets.length > 0) {
                const hit = pool.some(v => targets.some(t => levelEquals(v, t)));
                if (!hit) return false;
            }
        }

        // 黑名单
        if (f.excludeBlacklisted && blacklistedDiffs(song).length > 0) return false;

        return true;
    });
}

export function applyStatsFilters(songs: Song[], f: Filters, stats: Map<string, ChartStats> | null): Song[] {
    if (!f.useChartStats || !stats) return songs;
    return songs.filter(song => {
        const s = stats.get(song.id);
        if (!s) return false; // 解析不到就当作不满足，避免混进没数据的一批
        if (!inRange(s.notes, f.notesMin, f.notesMax)) return false;
        if (!inRange(s.bpm, f.bpmMin, f.bpmMax)) return false;
        if (!inRange(s.duration, f.durMin, f.durMax)) return false;
        if (!inRange(s.judgeLines, f.linesMin, f.linesMax)) return false;
        return true;
    });
}

// ================= 主页选歌的轻量筛选 =================
// 只做「难度 / 谱师 / 曲师」三项，不解析谱面，保证下拉列表秒开。

export interface QuickFilters {
    /** 必须存在的难度，如 ['AT']；空数组表示不限制 */
    requireDiffs: string[];
    /** 指定定数，逗号分隔的精确值，如 "15.3, 17.6" */
    levels: string;
    /** 定数下限 / 上限，空字符串表示不限 */
    levelMin: string;
    levelMax: string;
    /** 谱师名，完全匹配（从下拉里选，避免拼写问题） */
    charter: string;
    /** 曲师（作曲家）名，完全匹配 */
    composer: string;
}

export const emptyQuickFilters: QuickFilters = {
    requireDiffs: [],
    levels: '',
    levelMin: '',
    levelMax: '',
    charter: '',
    composer: '',
};

/** 有几项筛选正在生效，用于按钮上的角标 */
export function countActiveQuickFilters(f: QuickFilters): number {
    let n = 0;
    if (f.requireDiffs.length > 0) n++;
    if (f.levelMin.trim() || f.levelMax.trim()) n++;
    if (f.levels.trim()) n++;
    if (f.charter) n++;
    if (f.composer) n++;
    return n;
}

/** 按轻量筛选条件过滤曲目 */
export function applyQuickFilters(songs: Song[], f: QuickFilters): Song[] {
    const lo = num(f.levelMin);
    const hi = num(f.levelMax);
    const targets = parseLevelList(f.levels);
    const noLevelFilter = lo === null && hi === null && targets.length === 0;
    const noDiffFilter = f.requireDiffs.length === 0;

    // 三项都没设，直接返回原数组，避免无谓遍历
    if (noLevelFilter && noDiffFilter && !f.charter && !f.composer) return songs;

    return songs.filter(song => {
        // 必须存在的难度
        if (!noDiffFilter) {
            const has = DIFFS.filter(d => levelOf(song, d) !== null);
            if (!f.requireDiffs.every(d => has.includes(d))) return false;
        }

        // 定数：区间与「指定定数」都要满足，任一难度命中即可
        if (!noLevelFilter) {
            const levels = songLevels(song).map(l => l.level);
            if (levels.length === 0) return false;
            if (lo !== null || hi !== null) {
                if (!levels.some(v => (lo === null || v >= lo) && (hi === null || v <= hi))) return false;
            }
            if (targets.length > 0) {
                if (!levels.some(v => targets.some(t => levelEquals(v, t)))) return false;
            }
        }

        // 谱师：该曲任一难度的谱师命中即可（区分大小写完全匹配）
        if (f.charter) {
            const hit = DIFFS.some(d => song.charters?.[d] === f.charter);
            if (!hit) return false;
        }

        // 曲师（作曲家）
        if (f.composer && song.composer !== f.composer) return false;

        return true;
    });
}

/**
 * 收集曲库里出现过的全部谱师名，按作品数降序。
 *
 * 注意 count 按「歌曲」计，不按「难度条目」计：
 * 一首歌的四个难度可能都是同一位谱师，若按条目累加会显示成 37，
 * 而实际筛出来只有 24 首，下拉里的数字会对不上。
 */
export function collectCharters(songs: Song[]): { name: string; count: number }[] {
    const byName = new Map<string, Set<string>>();
    for (const song of songs) {
        for (const d of DIFFS) {
            const name = song.charters?.[d];
            if (!name) continue;
            let set = byName.get(name);
            if (!set) {
                set = new Set();
                byName.set(name, set);
            }
            // 同一首歌只计一次
            set.add(song.id);
        }
    }
    return [...byName.entries()]
        .map(([name, ids]) => ({ name, count: ids.size }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** 收集曲库里出现过的全部曲师名，按出现次数降序 */
export function collectComposers(songs: Song[]): { name: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const song of songs) {
        const name = song.composer;
        if (!name) continue;
        counts.set(name, (counts.get(name) || 0) + 1);
    }
    return [...counts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

// ================= 名称选择器（谱师 / 曲师）的纯逻辑 =================
// 抽出来单独测：这些规则靠手点很难覆盖，尤其是大小写和回退行为。

export interface NameOption {
    name: string;
    count: number;
}

/**
 * 按关键词过滤候选：前缀匹配的排前面，其余按作品数降序。
 * 返回前 limit 个，以及匹配总数（用于提示「还有 N 个未显示」）。
 */
export function filterNameOptions(
    options: NameOption[],
    keyword: string,
    limit = 100
): { list: NameOption[]; total: number } {
    const kw = keyword.trim().toLowerCase();
    const matched = kw
        ? options.filter(o => o.name.toLowerCase().includes(kw))
        : options;

    const list = kw
        ? [...matched].sort((a, b) => {
            const an = a.name.toLowerCase();
            const bn = b.name.toLowerCase();
            // 前缀匹配优先，其次作品数多的优先
            return (an.startsWith(kw) ? 0 : 1) - (bn.startsWith(kw) ? 0 : 1)
                || b.count - a.count;
        })
        : matched;

    return { list: list.slice(0, limit), total: matched.length };
}

/**
 * 输入框失焦时确认最终值：
 * - 空 → 清除筛选
 * - 精确命中某个候选 → 选中它
 * - 其它（打了一半或名字不存在）→ 回退到已选值
 *
 * 第三条很关键：否则会留下「筛不出东西但看不出原因」的死状态。
 * 注意这里是精确匹配（区分大小写），和输入时的「包含」匹配不同。
 */
export function resolveNameCommit(
    options: NameOption[],
    draft: string,
    currentValue: string
): string {
    const kw = draft.trim();
    if (!kw) return '';
    const exact = options.find(o => o.name === kw);
    return exact ? exact.name : currentValue;
}

/** 按导出范围算出某首歌实际要下几个难度的谱面 */
export function countExportDiffs(song: Song, scope: string[]): number {
    const actual = songLevels(song).map(l => l.diff);
    if (actual.length === 0) return 0;
    if (!scope || scope.length === 0) return actual.length;
    const picked = actual.filter(d => scope.includes(d));
    return picked.length > 0 ? picked.length : actual.length;
}
