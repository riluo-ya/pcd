// 谱面 JSON 解析：物量 / BPM / 判定线 / 时长
// 卡片与批量下载共用同一套逻辑，避免两处各写一份。

import { Song } from '../types';
import { ghRaw } from './sources';
import { levelOf } from './shareCard';

export interface ChartStats {
    /** 物量 */
    notes: number;
    /** BPM，取第一条判定线 */
    bpm: number | null;
    /** 判定线数量 */
    judgeLines: number;
    /** 时长（秒），按 1/32 拍换算 */
    duration: number | null;
}

const DIFF_PRIORITY = ['AT', 'IN', 'HD', 'EZ'];

/** 该曲目信息量最全的难度（AT > IN > HD > EZ），BPM/时长这类曲目级数据取它 */
export function primaryDifficulty(song: Song): string | null {
    return DIFF_PRIORITY.find(d => levelOf(song, d) !== null) || null;
}

/**
 * 下载并解析一个谱面 JSON。
 *
 * 时长换算：谱面里 time 的单位是 1/32 拍，配合判定线 bpm 换算成秒。
 * 用 Credits(1:38) / Dlyrotz(2:01) 比对过实际曲长，误差在几秒内。
 */
export async function fetchChartStats(
    songId: string,
    diff: string,
    signal?: AbortSignal
): Promise<ChartStats | null> {
    try {
        const url = ghRaw(`7aGiven/Phigros_Resource/refs/heads/chart/${songId}.0/${diff}.json`);
        const res = await fetch(url, { cache: 'no-store', signal });
        if (!res.ok) return null;
        const data = await res.json();
        const lines = data?.judgeLineList;
        if (!Array.isArray(lines) || lines.length === 0) return null;

        let notes = 0;
        let lastTime = 0;
        for (const line of lines) {
            for (const key of ['notesAbove', 'notesBelow'] as const) {
                const arr = line?.[key];
                if (!Array.isArray(arr)) continue;
                notes += arr.length;
                for (const n of arr) {
                    const t = typeof n?.time === 'number' ? n.time : 0;
                    if (t > lastTime) lastTime = t;
                }
            }
        }

        // BPM：各判定线通常一致，取第一条非零的
        let bpm: number | null = null;
        for (const line of lines) {
            const b = typeof line?.bpm === 'number' ? line.bpm : 0;
            if (b > 0) { bpm = b; break; }
        }

        // time 单位为 1/32 拍 → 拍数 = lastTime / 32 → 秒 = 拍数 / bpm * 60
        const duration = bpm && lastTime > 0 ? (lastTime / 32) * (60 / bpm) : null;

        return { notes, bpm, judgeLines: lines.length, duration };
    } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') throw e;
        return null;
    }
}

/** 并发池：同时最多 limit 个任务 */
async function pool<T, R>(
    items: T[],
    limit: number,
    workerFn: (item: T) => Promise<R>,
    onOneDone?: () => void
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let cursor = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (cursor < items.length) {
            const i = cursor++;
            results[i] = await workerFn(items[i]);
            onOneDone?.();
        }
    });
    await Promise.all(runners);
    return results;
}

export interface ScanProgress {
    done: number;
    total: number;
}

/**
 * 批量解析一批曲目的谱面数据（只取信息量最全的那个难度）。
 * 返回 Map<songId, ChartStats>；被取消时抛出 AbortError。
 */
export async function scanChartStats(
    songs: Song[],
    opts: {
        concurrency?: number;
        onProgress?: (p: ScanProgress) => void;
        signal?: AbortSignal;
    } = {}
): Promise<Map<string, ChartStats>> {
    const { concurrency = 6, onProgress, signal } = opts;
    const map = new Map<string, ChartStats>();
    let done = 0;

    await pool(
        songs,
        concurrency,
        async song => {
            if (signal?.aborted) return;
            const diff = primaryDifficulty(song);
            if (!diff) return;
            const stats = await fetchChartStats(song.id, diff, signal);
            if (stats) map.set(song.id, stats);
            done++;
            onProgress?.({ done, total: songs.length });
        },
        undefined
    );

    if (signal?.aborted) {
        const err = new Error('已取消');
        err.name = 'AbortError';
        throw err;
    }
    return map;
}
