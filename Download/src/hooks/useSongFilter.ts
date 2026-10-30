import { useState, useEffect, useMemo } from 'react';
import { Song } from '../types';
import { songNameAliases } from '../song-aliases';
import {
    QuickFilters,
    emptyQuickFilters,
    applyQuickFilters,
    countActiveQuickFilters,
    collectCharters,
    collectComposers,
} from '../utils/bulkFilters';

const IGNORED_SEARCH_CHARS_REGEX = /[\s'’"“”\-_.]/g;

export const normalizeSearchString = (str: string): string =>
    str.replace(IGNORED_SEARCH_CHARS_REGEX, '').toLowerCase();

export interface SongFilter {
    /** 当前生效的筛选条件 */
    filters: QuickFilters;
    setFilters: React.Dispatch<React.SetStateAction<QuickFilters>>;
    setFilter: <K extends keyof QuickFilters>(key: K, value: QuickFilters[K]) => void;
    toggleDiffFilter: (d: string) => void;
    resetFilters: () => void;

    /** 搜索词（未防抖） */
    searchTerm: string;
    setSearchTerm: (v: string) => void;

    /** 最终要渲染的曲库，以及「是否来自别名猜测」 */
    displayedSongs: Song[];
    isSuggestion: boolean;
    isSearching: boolean;

    /** 筛选面板的选项来源 */
    charterOptions: { name: string; count: number }[];
    composerOptions: { name: string; count: number }[];
    activeFilterCount: number;
}

/**
 * 曲库筛选 + 搜索。
 *
 * 抽成 hook 是为了让桌面端（SongSelector）和手机端（MobileLibrary）共用同一份状态：
 * 否则两个组件各自持有筛选条件，旋转屏幕或切换布局时条件会莫名其妙地丢掉。
 */
export function useSongFilter(songs: Song[]): SongFilter {
    const [filters, setFilters] = useState<QuickFilters>(emptyQuickFilters);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    const setFilter = <K extends keyof QuickFilters>(key: K, value: QuickFilters[K]) =>
        setFilters(prev => ({ ...prev, [key]: value }));

    const toggleDiffFilter = (d: string) =>
        setFilters(prev => ({
            ...prev,
            requireDiffs: prev.requireDiffs.includes(d)
                ? prev.requireDiffs.filter(x => x !== d)
                : [...prev.requireDiffs, d],
        }));

    const resetFilters = () => setFilters(emptyQuickFilters);

    /** 筛选后的曲库，作为搜索的候选集 */
    const filteredSongs = useMemo(() => applyQuickFilters(songs, filters), [songs, filters]);

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearchTerm(searchTerm), 200);
        return () => clearTimeout(handler);
    }, [searchTerm]);

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

        // 曲名或曲师命中都算直接命中（与上游一致）
        const directMatches = filteredSongs.filter(song =>
            normalizeSearchString(song.name).includes(normalizedSearchTerm) ||
            normalizeSearchString(song.composer || '').includes(normalizedSearchTerm)
        );
        if (directMatches.length > 0) {
            return { displayedSongs: directMatches, isSuggestion: false };
        }

        // 没直接命中，退回别名表（比如搜缩写）
        const aliasMatches = aliasList
            .filter(item => normalizeSearchString(item.alias).includes(normalizedSearchTerm))
            .map(item => item.song);
        if (aliasMatches.length > 0) {
            const unique = Array.from(new Map(aliasMatches.map(song => [song.id, song])).values());
            return { displayedSongs: unique, isSuggestion: true };
        }

        return { displayedSongs: [], isSuggestion: false };
    }, [filteredSongs, debouncedSearchTerm, aliasList]);

    const charterOptions = useMemo(() => collectCharters(songs), [songs]);
    const composerOptions = useMemo(() => collectComposers(songs), [songs]);
    const activeFilterCount = useMemo(() => countActiveQuickFilters(filters), [filters]);

    return {
        filters,
        setFilters,
        setFilter,
        toggleDiffFilter,
        resetFilters,
        searchTerm,
        setSearchTerm,
        displayedSongs,
        isSuggestion,
        isSearching: searchTerm !== debouncedSearchTerm,
        charterOptions,
        composerOptions,
        activeFilterCount,
    };
}
