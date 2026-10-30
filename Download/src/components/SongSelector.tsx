
import React, { useState, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Spinner } from './Spinner';
import { useSettings } from '../contexts/SettingsContext';
import { getSongEffect } from '../song-effects';
import { Song, SortConfig, SortType, SortDirection } from '../types';
import { ErrorIcon, MagnifyingGlassIcon, ArrowsUpDownIcon, CheckIcon, XMarkIcon } from './Icons';
import { useSongFilter } from '../hooks/useSongFilter';

interface SongSelectorProps {
  isLoading: boolean;
  error: string | null;
  songs: Song[];
  selectedSong: Song | null;
  onSongSelect: (song: Song | null) => void;
  sortConfig: SortConfig;
  onSortConfigChange: (config: SortConfig) => void;
}

export const SongSelector: React.FC<SongSelectorProps> = ({ isLoading, error, songs, selectedSong, onSongSelect, sortConfig, onSortConfigChange }) => {
    const { settings } = useSettings();
    const [isOpen, setIsOpen] = useState(false);
    const [isSortOpen, setIsSortOpen] = useState(false);
    const [isRangeOpen, setIsRangeOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const sortWrapperRef = useRef<HTMLDivElement>(null);
    const rangeWrapperRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const parentRef = useRef<HTMLUListElement>(null);

    /**
     * 筛选与搜索全部交给 useSongFilter，与手机端（MobileLibrary）共用同一份实现。
     * 之前这里抄了一份独立逻辑，导致两端行为不一致：
     * 归一化规则不同（这里还多去掉了空格引号连字符），
     * 别名表也查错了曲库（见 hook 里的注释）。
     *
     * 筛选条件与上游一致：只有「搜索 / 仅有 AT / 定数区间」三项。
     */
    const {
        searchTerm, setSearchTerm,
        minInput, setMinInput,
        maxInput, setMaxInput,
        onlyHasAt, setOnlyHasAt,
        difficultyBounds, isRangeActive, rangeLabel,
        displayedSongs, isSuggestion,
    } = useSongFilter(songs);


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

            // Close range popup if clicked outside of it
            if (rangeWrapperRef.current && !rangeWrapperRef.current.contains(event.target as Node)) {
                setIsRangeOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef, sortWrapperRef, rangeWrapperRef]);

    // Esc 关闭当前打开的那个浮层，从最内层开始关
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            if (isSortOpen) { setIsSortOpen(false); return; }
            if (isRangeOpen) { setIsRangeOpen(false); return; }
            if (isOpen) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [isOpen, isSortOpen, isRangeOpen]);
    
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
            <div className="flex flex-col min-h-0 h-full bg-[#0d1118]">
                <div className="flex-1 flex items-center justify-center gap-3 text-slate-400 text-sm">
                    <Spinner />
                    <span>正在加载歌曲列表…</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col min-h-0 h-full bg-[#0d1118]">
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
                    <span className="flex items-center gap-2 text-[#f87171] text-sm font-semibold">
                        <ErrorIcon className="w-5 h-5" />
                        加载歌曲失败
                    </span>
                    <p className="font-mono text-[11px] text-slate-500 break-all">{error}</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="flex flex-col min-h-0 h-full bg-[#0d1118]">
            <div className="flex-none bg-[#090c11] border-b border-white/[.1]">
                <div className="p-3 flex items-center gap-2">
                    <label className="h-[42px] flex-1 min-w-0 flex items-center gap-2.5 px-3 rounded-[10px] bg-white/[.04] border border-white/[.08] focus-within:border-[rgba(34,211,238,.45)] transition-colors">
                        <MagnifyingGlassIcon className="w-4 h-4 text-slate-500 flex-none" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="搜索歌曲…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 min-w-0 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
                        />
                        {searchTerm && (
                            <button type="button" onClick={() => setSearchTerm('')} aria-label="清除搜索" className="text-slate-500 hover:text-slate-300">
                                <XMarkIcon className="w-4 h-4" />
                            </button>
                        )}
                    </label>

                <div ref={sortWrapperRef} className="relative flex-none">
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

                {/* 计数 + Has AT + 定数区间：与上游一致的筛选行 */}
                <div className="px-4 pb-2 flex items-center gap-1.5">
                    <span className="flex-1 min-w-0 truncate font-mono text-[10px] font-medium tracking-[.12em] text-slate-600">
                        {isLoading ? '— SONGS | ' : `${displayedSongs.length} SONGS | `}
                        {isSuggestion && <span className="text-[#22d3ee]"> · DID YOU MEAN</span>}
                    </span>
                    <button
                        type="button"
                        aria-pressed={onlyHasAt}
                        onClick={() => setOnlyHasAt(v => !v)}
                        title={onlyHasAt ? 'Showing only songs with an AT chart' : 'Show only songs with an AT chart'}
                        className={`font-mono text-[11px] font-semibold px-2 py-1 rounded-md transition-colors ${onlyHasAt ? 'text-green-400 bg-green-400/[.12]' : 'text-white hover:bg-white/[.06]'}`}
                    >
                        Has AT
                    </button>
                    <div ref={rangeWrapperRef} className="relative">
                        <button
                            type="button"
                            onClick={() => setIsRangeOpen(o => !o)}
                            aria-expanded={isRangeOpen}
                            title="Filter by difficulty range"
                            className={`font-mono text-[11px] font-medium px-1.5 py-1 rounded-md transition-colors hover:bg-white/[.04] ${isRangeActive ? 'text-[#22d3ee]' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            {rangeLabel}
                        </button>
                        {isRangeOpen && (
                            <div className="motion-dropdown absolute right-0 z-40 mt-2 w-56 p-3 rounded-xl border border-white/[.08] bg-[rgba(12,15,22,.98)] shadow-[0_20px_50px_rgba(0,0,0,.5)] flex flex-col gap-2.5">
                                <span className="font-mono text-[10px] font-medium tracking-[.14em] text-slate-500">DIFFICULTY RANGE</span>
                                <div className="flex items-center gap-2">
                                    {[
                                        { value: minInput, set: setMinInput, placeholder: difficultyBounds?.min, label: 'Minimum difficulty' },
                                        { value: maxInput, set: setMaxInput, placeholder: difficultyBounds?.max, label: 'Maximum difficulty' },
                                    ].map((field, i) => (
                                        <React.Fragment key={field.label}>
                                            {i === 1 && <span className="text-slate-600">–</span>}
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                step={0.1}
                                                min={difficultyBounds?.min}
                                                max={difficultyBounds?.max}
                                                placeholder={field.placeholder !== undefined ? String(field.placeholder) : ''}
                                                value={field.value}
                                                onChange={e => field.set(e.target.value)}
                                                disabled={!difficultyBounds}
                                                aria-label={field.label}
                                                className="w-full min-w-0 h-8 rounded-lg bg-white/[.04] border border-white/[.08] text-center font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[rgba(34,211,238,.45)] disabled:opacity-50"
                                            />
                                        </React.Fragment>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => { setMinInput(''); setMaxInput(''); }}
                                    disabled={!minInput && !maxInput}
                                    className="self-start text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-40 disabled:hover:text-slate-400"
                                >
                                    Reset range
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ul ref={parentRef} className="h-[62vh] md:h-auto md:flex-1 md:min-h-0 overflow-y-auto thin-scroll px-2 py-2 relative" role="listbox">
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
                                                className="px-2.5 cursor-pointer rounded-lg flex items-center gap-3 absolute top-0 left-0 w-full transition-colors"
                                                style={{
                                                    height: `${virtualItem.size}px`,
                                                    transform: `translateY(${virtualItem.start}px)`,
                                                    background: selectedSong?.id === song.id ? 'rgba(34,211,238,.10)' : undefined,
                                                }}
                                                onClick={() => handleSelectSong(song)}
                                                role="option"
                                                aria-selected={selectedSong?.id === song.id}
                                            >
                                                <span className="flex-1 min-w-0 flex flex-col">
                                                    <span className={`text-sm leading-[1.2] truncate ${selectedSong?.id === song.id ? 'text-white' : 'text-slate-300'}`}>
                                                        {song.name}
                                                    </span>
                                                    <span className="text-[11px] leading-[1.3] text-slate-500 truncate">{song.composer}</span>
                                                </span>
                                                {hasEffect && <span className="text-yellow-400 text-sm flex-none">✨</span>}
                                            </li>
                                        );
                                    })}
                                </div>
                            ) : (
                                <li className="px-4 py-4 text-center">
                                    <p className="text-slate-500 text-sm">未找到歌曲。</p>
                                    {/* 区分「搜不到」和「筛选太严」，给出对应的下一步 */}
                                    {(onlyHasAt || isRangeActive) ? (
                                        <>
                                            <p className="text-xs text-slate-600 mt-1">
                                                当前筛选下没有匹配的歌曲，可以放宽条件试试。
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => { setOnlyHasAt(false); setMinInput(''); setMaxInput(''); }}
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
    );
};
