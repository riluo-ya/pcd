
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Spinner } from './Spinner';
import { songNameAliases } from '../song-aliases';
import { useSettings } from '../contexts/SettingsContext';
import { getSongEffect } from '../song-effects';
import { Song, SortConfig, SortType, SortDirection } from '../types';
import { ChevronDownIcon, ErrorIcon, MagnifyingGlassIcon, ArrowsUpDownIcon, CheckIcon, FunnelIcon, XMarkIcon } from './Icons';
import { NameCombobox } from './NameCombobox';
import {
    QuickFilters,
    emptyQuickFilters,
    countActiveQuickFilters,
    applyQuickFilters,
    collectCharters,
    collectComposers,
    DIFFS,
} from '../utils/bulkFilters';

interface SongSelectorProps {
  isLoading: boolean;
  error: string | null;
  songs: Song[];
  selectedSong: Song | null;
  onSongSelect: (song: Song | null) => void;
  sortConfig: SortConfig;
  onSortConfigChange: (config: SortConfig) => void;
}

// Add characters to this regex to ignore them in search.
// For example, to ignore dots and dashes: /[.-]/g
const IGNORED_SEARCH_CHARS_REGEX = /\./g;

/**
 * Normalizes a string for searching by removing ignored characters and converting to lowercase.
 * @param str The string to normalize.
 * @returns The normalized string.
 */
const normalizeSearchString = (str: string): string => {
    return str.replace(IGNORED_SEARCH_CHARS_REGEX, '').toLowerCase();
};

export const SongSelector: React.FC<SongSelectorProps> = ({ isLoading, error, songs, selectedSong, onSongSelect, sortConfig, onSortConfigChange }) => {
    const { settings } = useSettings();
    const [isOpen, setIsOpen] = useState(false);
    const [isSortOpen, setIsSortOpen] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filters, setFilters] = useState<QuickFilters>(emptyQuickFilters);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const sortWrapperRef = useRef<HTMLDivElement>(null);
    const filterWrapperRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const parentRef = useRef<HTMLUListElement>(null);

    /** 曲库里出现过的谱师 / 曲师，用于筛选下拉 */
    const charterOptions = useMemo(() => collectCharters(songs), [songs]);
    const composerOptions = useMemo(() => collectComposers(songs), [songs]);
    const activeFilterCount = useMemo(() => countActiveQuickFilters(filters), [filters]);

    const setFilter = <K extends keyof QuickFilters>(key: K, value: QuickFilters[K]) =>
        setFilters(prev => ({ ...prev, [key]: value }));

    const toggleDiffFilter = (d: string) =>
        setFilters(prev => ({
            ...prev,
            requireDiffs: prev.requireDiffs.includes(d)
                ? prev.requireDiffs.filter(x => x !== d)
                : [...prev.requireDiffs, d],
        }));

    /** 筛选后的曲库，作为搜索的候选集 */
    const filteredSongs = useMemo(() => applyQuickFilters(songs, filters), [songs, filters]);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 200);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    const aliasList = useMemo(() => {
        const list: { alias: string, song: Song }[] = [];
        if (songs.length > 0) {
            for (const songName in songNameAliases) {
                const song = songs.find(s => s.name === songName);
                if (song) {
                    const aliases = songNameAliases[songName];
                    for (const alias of aliases) {
                        list.push({ alias: alias.toLowerCase(), song });
                    }
                }
            }
        }
        return list;
    }, [songs]);

    const { displayedSongs, isSuggestion } = useMemo(() => {
        if (!debouncedSearchTerm) {
            return { displayedSongs: filteredSongs, isSuggestion: false };
        }
        const normalizedSearchTerm = normalizeSearchString(debouncedSearchTerm);

        const directMatches = filteredSongs.filter(song =>
            normalizeSearchString(song.name).includes(normalizedSearchTerm)
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


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Close song selector if clicked outside of it AND outside of the sort button
            if (
                wrapperRef.current && 
                !wrapperRef.current.contains(event.target as Node) &&
                sortWrapperRef.current &&
                !sortWrapperRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
            
            // Close sort popup if clicked outside of it
            if (sortWrapperRef.current && !sortWrapperRef.current.contains(event.target as Node)) {
                setIsSortOpen(false);
            }

            // Close filter popup if clicked outside of it
            if (filterWrapperRef.current && !filterWrapperRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef, sortWrapperRef, filterWrapperRef]);

    // Esc 关闭当前打开的那个浮层，从最内层开始关
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            if (isSortOpen) { setIsSortOpen(false); return; }
            if (isFilterOpen) { setIsFilterOpen(false); return; }
            if (isOpen) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [isOpen, isSortOpen, isFilterOpen]);
    
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const rowVirtualizer = useVirtualizer({
        count: displayedSongs.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 44, // Approximate height of a list item (py-2.5 is 10px top/bottom + line height)
        overscan: 5, // Add a bit of overhead to prevent visual glitches
    });

    const handleSelectSong = (song: Song) => {
        onSongSelect(song);
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleSortTypeChange = (type: SortType) => {
        onSortConfigChange({ ...sortConfig, type });
        // setIsSortOpen(false); // Keep open to allow changing direction too if desired
    };

    const handleSortDirectionChange = (direction: SortDirection) => {
        onSortConfigChange({ ...sortConfig, direction });
        // setIsSortOpen(false);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center gap-3 text-slate-400 h-14 w-full max-w-lg">
                <Spinner />
                <span>正在加载歌曲列表...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 text-red-400 h-14 w-full max-w-lg">
                <div className="flex items-center gap-2">
                    <ErrorIcon className="w-6 h-6" />
                    <span className="font-semibold">加载歌曲失败</span>
                </div>
                <p className="text-xs text-red-500">{error}</p>
            </div>
        );
    }
    
    return (
        <div className="flex items-center gap-2 w-full max-w-lg mx-auto">
            <div ref={wrapperRef} className="relative flex-grow">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center justify-between w-full h-14 px-4 text-left rounded-xl border border-slate-700 bg-slate-800/50 shadow-lg backdrop-blur-sm hover:bg-slate-800/80 transition-colors duration-200"
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                >
                    <span className={`truncate ${selectedSong ? 'text-slate-100' : 'text-slate-400'}`}>
                        {selectedSong ? selectedSong.name : '选择歌曲'}
                    </span>
                    <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                    <div 
                        className="motion-dropdown absolute z-40 w-full mt-2 overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-2xl"
                    >
                        <div className="p-2 border-b border-slate-700">
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                    <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="搜索歌曲..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-700/50 rounded-lg border-none pl-10 pr-4 py-2 text-slate-200 focus:ring-2 focus:ring-brand-cyan focus:outline-none"
                                />
                            </div>
                        </div>
                        {activeFilterCount > 0 && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-brand-cyan/5 border-b border-slate-700">
                                <span className="text-[11px] text-slate-400 flex-shrink-0">筛选中</span>
                                <div className="flex flex-wrap gap-1 flex-1">
                                    {filters.requireDiffs.length > 0 && (
                                        <span className="px-1.5 py-0.5 rounded bg-brand-cyan/15 text-brand-cyan text-[10px] font-semibold">
                                            含 {filters.requireDiffs.join('/')}
                                        </span>
                                    )}
                                    {(filters.levelMin || filters.levelMax) && (
                                        <span className="px-1.5 py-0.5 rounded bg-brand-cyan/15 text-brand-cyan text-[10px] font-semibold">
                                            定数 {filters.levelMin || '不限'} ~ {filters.levelMax || '不限'}
                                        </span>
                                    )}
                                    {filters.charter && (
                                        <span className="px-1.5 py-0.5 rounded bg-brand-cyan/15 text-brand-cyan text-[10px] font-semibold truncate max-w-[9rem]">
                                            谱师 {filters.charter}
                                        </span>
                                    )}
                                    {filters.composer && (
                                        <span className="px-1.5 py-0.5 rounded bg-brand-cyan/15 text-brand-cyan text-[10px] font-semibold truncate max-w-[9rem]">
                                            曲师 {filters.composer}
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFilters(emptyQuickFilters)}
                                    className="text-slate-500 hover:text-slate-300 flex-shrink-0"
                                    aria-label="清除筛选"
                                >
                                    <XMarkIcon className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                        {isSuggestion && displayedSongs.length > 0 && (
                            <div className="px-4 pt-3 pb-1 text-xs font-semibold text-slate-400 tracking-wide bg-slate-800 border-b border-slate-700">
                                你是不是想找：
                            </div>
                        )}
                        <ul ref={parentRef} className="max-h-60 overflow-y-auto custom-scrollbar relative" role="listbox">
                            {displayedSongs.length > 0 ? (
                                <div
                                    style={{
                                        height: `${rowVirtualizer.getTotalSize()}px`,
                                        width: '100%',
                                        position: 'relative',
                                    }}
                                >
                                    {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                                        const song = displayedSongs[virtualItem.index];
                                        const hasEffect = settings.useNewUi && settings.newUiSongSpecificEffects && getSongEffect(song.name);
                                        return (
                                            <li
                                                key={virtualItem.key}
                                                className="px-4 py-2.5 cursor-pointer text-slate-300 hover:bg-brand-cyan/20 hover:text-white transition-colors duration-150 flex items-center justify-between absolute top-0 left-0 w-full"
                                                style={{
                                                    height: `${virtualItem.size}px`,
                                                    transform: `translateY(${virtualItem.start}px)`,
                                                }}
                                                onClick={() => handleSelectSong(song)}
                                                role="option"
                                                aria-selected={selectedSong?.id === song.id}
                                            >
                                                <span>{song.name}</span>
                                                {hasEffect && <span className="text-yellow-400 text-sm ml-2">✨</span>}
                                            </li>
                                        );
                                    })}
                                </div>
                            ) : (
                                <li className="px-4 py-4 text-center">
                                    <p className="text-slate-500 text-sm">未找到歌曲。</p>
                                    {/* 区分「搜不到」和「筛选太严」，给出对应的下一步 */}
                                    {activeFilterCount > 0 ? (
                                        <>
                                            <p className="text-xs text-slate-600 mt-1">
                                                当前筛选下还有 {filteredSongs.length} 首，可以放宽条件试试。
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => setFilters(emptyQuickFilters)}
                                                className="mt-2 text-xs text-brand-cyan hover:underline"
                                            >
                                                清除全部筛选
                                            </button>
                                        </>
                                    ) : (
                                        <p className="text-xs text-slate-600 mt-1">换个关键词试试。</p>
                                    )}
                                </li>
                            )}
                        </ul>
                    </div>
                )}
            </div>
            
            <div ref={filterWrapperRef} className="relative">
                <button
                    type="button"
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className={`relative flex items-center justify-center w-14 h-14 rounded-xl border shadow-lg backdrop-blur-sm transition-colors duration-200 flex-shrink-0 ${
                        activeFilterCount > 0
                            ? 'border-brand-cyan bg-brand-cyan/15 text-brand-cyan'
                            : isFilterOpen
                                ? 'border-slate-700 bg-slate-700 text-slate-200'
                                : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800/80 text-slate-400'
                    }`}
                    title="按难度 / 谱师 / 曲师筛选"
                    aria-haspopup="true"
                    aria-expanded={isFilterOpen}
                >
                    <FunnelIcon className="w-6 h-6" />
                    <span className="sr-only">筛选选项</span>
                    {activeFilterCount > 0 && (
                        <span
                            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-cyan text-slate-900 text-[11px] font-bold flex items-center justify-center"
                            aria-hidden="true"
                        >
                            {activeFilterCount}
                        </span>
                    )}
                </button>

                {isFilterOpen && (
                    <div className="motion-dropdown absolute right-0 z-50 mt-2 w-72 rounded-xl border border-slate-700 bg-slate-800 shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">筛选</span>
                            {activeFilterCount > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setFilters(emptyQuickFilters)}
                                    className="text-xs text-slate-400 hover:text-brand-cyan flex items-center gap-1"
                                >
                                    <XMarkIcon className="w-3.5 h-3.5" />
                                    清除
                                </button>
                            )}
                        </div>

                        <div className="p-3 space-y-3 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            {/* 难度 */}
                            <div>
                                <div className="px-1 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    必须含难度
                                </div>
                                <div className="flex gap-1.5 mt-1">
                                    {DIFFS.map(d => (
                                        <button
                                            key={d}
                                            type="button"
                                            onClick={() => toggleDiffFilter(d)}
                                            className={`flex-1 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                                                filters.requireDiffs.includes(d)
                                                    ? 'border-brand-cyan text-brand-cyan bg-brand-cyan/10'
                                                    : 'border-slate-600 text-slate-400 hover:border-slate-500'
                                            }`}
                                        >
                                            {d}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 定数区间 */}
                            <div>
                                <div className="px-1 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    定数区间
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        value={filters.levelMin}
                                        onChange={e => setFilter('levelMin', e.target.value)}
                                        placeholder="最低"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-cyan"
                                    />
                                    <span className="text-slate-600 text-xs flex-shrink-0">~</span>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        value={filters.levelMax}
                                        onChange={e => setFilter('levelMax', e.target.value)}
                                        placeholder="最高"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-cyan"
                                    />
                                </div>
                                <p className="text-[11px] text-slate-600 mt-1 px-1">
                                    任一难度落在区间内即命中
                                </p>
                            </div>

                            {/* 谱师 */}
                            <div>
                                <div className="flex items-center justify-between px-1 py-1">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        谱师
                                    </span>
                                    <span className="text-[10px] text-slate-600">
                                        共 {charterOptions.length} 位
                                    </span>
                                </div>
                                <div className="mt-1">
                                    <NameCombobox
                                        placeholder="输入或选择谱师"
                                        options={charterOptions}
                                        value={filters.charter}
                                        onChange={v => setFilter('charter', v)}
                                    />
                                </div>
                            </div>

                            {/* 曲师 */}
                            <div>
                                <div className="flex items-center justify-between px-1 py-1">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        曲师
                                    </span>
                                    <span className="text-[10px] text-slate-600">
                                        共 {composerOptions.length} 位
                                    </span>
                                </div>
                                <div className="mt-1">
                                    <NameCombobox
                                        placeholder="输入或选择曲师"
                                        options={composerOptions}
                                        value={filters.composer}
                                        onChange={v => setFilter('composer', v)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="px-3 py-2 border-t border-slate-700 text-xs text-slate-500">
                            命中 <span className="text-brand-cyan font-semibold">{filteredSongs.length}</span> / {songs.length} 首
                        </div>
                    </div>
                )}
            </div>

            <div ref={sortWrapperRef} className="relative">
                <button
                    type="button"
                    onClick={() => setIsSortOpen(!isSortOpen)}
                    className={`flex items-center justify-center w-14 h-14 rounded-xl border border-slate-700 shadow-lg backdrop-blur-sm transition-colors duration-200 flex-shrink-0 ${isSortOpen ? 'bg-slate-700 text-slate-200' : 'bg-slate-800/50 hover:bg-slate-800/80 text-slate-400'}`}
                    title="排序选项"
                    aria-haspopup="true"
                    aria-expanded={isSortOpen}
                >
                    <ArrowsUpDownIcon className="w-6 h-6" />
                    <span className="sr-only">排序选项</span>
                </button>

                {isSortOpen && (
                    <div className="motion-dropdown absolute right-0 z-50 mt-2 w-48 rounded-xl border border-slate-700 bg-slate-800 shadow-2xl overflow-hidden">
                        <div className="py-1">
                            <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                排序方式
                            </div>
                            <button
                                onClick={() => handleSortTypeChange('alphanumerical')}
                                className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center justify-between transition-colors duration-150"
                            >
                                <span>字母数字排序</span>
                                {sortConfig.type === 'alphanumerical' && <CheckIcon className="w-4 h-4 text-brand-cyan" />}
                            </button>
                            <button
                                onClick={() => handleSortTypeChange('unsorted')}
                                className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center justify-between transition-colors duration-150"
                            >
                                <span>不排序</span>
                                {sortConfig.type === 'unsorted' && <CheckIcon className="w-4 h-4 text-brand-cyan" />}
                            </button>
                            
                            <div className="my-1 border-t border-slate-700"></div>
                            
                            <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                顺序
                            </div>
                            <button
                                onClick={() => handleSortDirectionChange('asc')}
                                className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center justify-between transition-colors duration-150"
                            >
                                <span>升序</span>
                                {sortConfig.direction === 'asc' && <CheckIcon className="w-4 h-4 text-brand-cyan" />}
                            </button>
                            <button
                                onClick={() => handleSortDirectionChange('desc')}
                                className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center justify-between transition-colors duration-150"
                            >
                                <span>降序</span>
                                {sortConfig.direction === 'desc' && <CheckIcon className="w-4 h-4 text-brand-cyan" />}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
