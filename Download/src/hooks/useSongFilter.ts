import { useEffect, useMemo, useState } from 'react';
import { Song } from '../types';
import { songNameAliases } from '../song-aliases';
import { DIFFS } from '../utils/bulkFilters';
import { levelOf } from '../utils/shareCard';

/**
 * 曲库筛选 + 搜索。
 *
 * 与上游保持完全一致：只有「搜索 / 仅有 AT / 定数区间」三项。
 * 抽成 hook 是为了让桌面端（SongSelector）和手机端（MobileLibrary）共用同一份状态：
 * 否则两个组件各自持有筛选条件，旋转屏幕或切换布局时条件会莫名其妙地丢掉。
 */

// Add characters to this regex to ignore them in search.
const IGNORED_SEARCH_CHARS_REGEX = /\./g;

/**
 * Normalizes a string for searching by removing ignored characters and converting to lowercase.
 * @param str The string to normalize.
 * @returns The normalized string.
 */
export const normalizeSearchString = (str: string): string =>
    str.replace(IGNORED_SEARCH_CHARS_REGEX, '').toLowerCase();

/**
 * 取某个难度的定数。
 * 上游用 parseFloat 直读 difficulties，这里走 levelOf 是为了顺带过滤掉
 * 上游数据里的 '—' / '?' 这类占位值 —— 否则会被当成 0 参与区间比较。
 */
const parseDifficulty = (song: Song, level: string): number | null => {
    const raw = levelOf(song, level);
    if (raw === null) return null;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : null;
};

// Sort button cycles through these in order.
export const SORT_CYCLE: { type: 'alphanumerical' | 'unsorted'; direction: 'asc' | 'desc'; label: string }[] = [
    { type: 'alphanumerical', direction: 'asc', label: 'A–Z' },
    { type: 'alphanumerical', direction: 'desc', label: 'Z–A' },
    { type: 'unsorted', direction: 'asc', label: 'Default' },
    { type: 'unsorted', direction: 'desc', label: 'Reverse' },
];

export const getSortIndex = (sortConfig: { type: string; direction: string }): number =>
    Math.max(0, SORT_CYCLE.findIndex(s => s.type === sortConfig.type && s.direction === sortConfig.direction));

const hasAt = (song: Song): boolean => !!(song.charters?.AT || song.difficulties?.AT);

/** Search, "Has AT" and difficulty range filtering for the song list. */
export const useSongFilter = (songs: Song[]) => {
    const [minInput, setMinInput] = useState('');
    const [maxInput, setMaxInput] = useState('');
    const [onlyHasAt, setOnlyHasAt] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 200);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    // Overall difficulty bounds from difficulty.tsv, used for the filter inputs.
    const difficultyBounds = useMemo(() => {
        let min = Infinity;
        let max = -Infinity;
        for (const song of songs) {
            for (const level of DIFFS) {
                const d = parseDifficulty(song, level);
                if (d === null) continue;
                if (d < min) min = d;
                if (d > max) max = d;
            }
        }
        if (min === Infinity) return null;
        return { min, max };
    }, [songs]);

    const parsedMin = minInput.trim() === '' ? null : Number(minInput);
    const parsedMax = maxInput.trim() === '' ? null : Number(maxInput);
    const validMin = parsedMin !== null && Number.isFinite(parsedMin) ? parsedMin : null;
    const validMax = parsedMax !== null && Number.isFinite(parsedMax) ? parsedMax : null;

    const isRangeActive = difficultyBounds !== null && (
        (validMin !== null && validMin > difficultyBounds.min) ||
        (validMax !== null && validMax < difficultyBounds.max)
    );
    const isFilterActive = onlyHasAt || isRangeActive;

    const filteredSongs = useMemo(() => {
        if (!isFilterActive) return songs;
        const lo = validMin ?? -Infinity;
        const hi = validMax ?? Infinity;
        // A song is kept if it passes the AT toggle and at least one level has a difficulty within range.
        return songs.filter(song => {
            if (onlyHasAt && !hasAt(song)) return false;
            if (!isRangeActive) return true;
            return DIFFS.some(level => {
                const d = parseDifficulty(song, level);
                return d !== null && d >= lo && d <= hi;
            });
        });
    }, [songs, isFilterActive, isRangeActive, validMin, validMax, onlyHasAt]);

    /**
     * 别名表必须在「筛选后」的曲库里查，不能用完整曲库。
     * 否则筛选 + 搜别名时，别名会命中一首不满足筛选条件的曲子并直接显示出来，
     * 表现就是「筛了跟没筛一样」。
     */
    const aliasList = useMemo(() => {
        const list: { alias: string; song: Song }[] = [];
        if (filteredSongs.length > 0) {
            for (const songName in songNameAliases) {
                const song = filteredSongs.find(s => s.name === songName);
                if (song) {
                    const aliases = songNameAliases[songName];
                    for (const alias of aliases) {
                        list.push({ alias: alias.toLowerCase(), song });
                    }
                }
            }
        }
        return list;
    }, [filteredSongs]);

    const { displayedSongs, isSuggestion } = useMemo(() => {
        if (!debouncedSearchTerm) {
            return { displayedSongs: filteredSongs, isSuggestion: false };
        }
        const normalizedSearchTerm = normalizeSearchString(debouncedSearchTerm);

        const directMatches = filteredSongs.filter(song =>
            normalizeSearchString(song.name).includes(normalizedSearchTerm) ||
            normalizeSearchString(song.composer || '').includes(normalizedSearchTerm)
        );

        if (directMatches.length > 0) {
            return { displayedSongs: directMatches, isSuggestion: false };
        }

        // No direct matches, check aliases.
        const aliasMatches = aliasList
            .filter(item => normalizeSearchString(item.alias).includes(normalizedSearchTerm))
            .map(item => item.song);

        if (aliasMatches.length > 0) {
            const uniqueAliasMatches = Array.from(new Map(aliasMatches.map(song => [song.id, song])).values());
            return { displayedSongs: uniqueAliasMatches, isSuggestion: true };
        }

        return { displayedSongs: [], isSuggestion: false };
    }, [filteredSongs, debouncedSearchTerm, aliasList]);

    const rangeLabel = difficultyBounds
        ? `${(validMin ?? difficultyBounds.min).toFixed(1)}–${(validMax ?? difficultyBounds.max).toFixed(1)}`
        : '–';

    return {
        searchTerm, setSearchTerm,
        minInput, setMinInput,
        maxInput, setMaxInput,
        onlyHasAt, setOnlyHasAt,
        difficultyBounds, isRangeActive, rangeLabel,
        filteredSongs,
        displayedSongs, isSuggestion,
    };
};

export type SongFilter = ReturnType<typeof useSongFilter>;
