import { Song } from '../types';
import { isBlacklisted } from '../blacklist';
import { levelOf } from './shareCard';
import { ChartStats } from './chartStats';

export const DIFFS = ['EZ', 'HD', 'IN', 'AT'] as const;

/** 难度显示名，如需本地化可在此调整 */
export const DIFF_LABEL: Record<string, string> = { EZ: 'EZ', HD: 'HD', IN: 'IN', AT: 'AT' };

/** 每首歌会尝试抓取的文件数：3 张曲绘 + 音频 + 4 个难度谱面 */
export const FILES_PER_SONG = 8;

export type LevelScope = 'any' | 'highest' | 'specific';

export interface Filters {
    keyword: string;
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

        // 定数区间
        const lo = num(f.levelMin);
        const hi = num(f.levelMax);
        if (lo !== null || hi !== null) {
            if (levels.length === 0) return false;
            let pool: number[];
            if (f.levelScope === 'highest') {
                const max = Math.max(...levels.map(l => l.level));
                pool = [max];
            } else if (f.levelScope === 'specific') {
                const picked = levels.filter(l => f.levelDiffs.includes(l.diff)).map(l => l.level);
                if (picked.length === 0) return false;
                pool = picked;
            } else {
                pool = levels.map(l => l.level);
            }
            const hit = pool.some(v =>
                (lo === null || v >= lo) && (hi === null || v <= hi)
            );
            if (!hit) return false;
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
