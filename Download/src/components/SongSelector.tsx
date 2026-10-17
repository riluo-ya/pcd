import React, { useState, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Spinner } from './Spinner';
import { useSettings } from '../contexts/SettingsContext';
import { Song, SortConfig } from '../types';
import { ErrorIcon, MagnifyingGlassIcon } from './Icons';
import { getBlurIllustrationUrl } from '../utils/resourceUrls';
import { useSongFilter, SORT_CYCLE, getSortIndex } from '../hooks/useSongFilter';

interface SongSelectorProps {
  isLoading: boolean;
  error: string | null;
  songs: Song[];
  selectedSong: Song | null;
  onSongSelect: (song: Song | null) => void;
  sortConfig: SortConfig;
  onSortConfigChange: (config: SortConfig) => void;
}

const SongThumbnail: React.FC<{ src: string }> = ({ src }) => {
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);
    return (
        <div className="relative w-11 h-[26px] flex-none rounded overflow-hidden bg-[repeating-linear-gradient(135deg,#1e293b_0_4px,#172033_4px_8px)]">
            {!failed && (
                <img
                    src={src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onLoad={() => setLoaded(true)}
                    onError={() => setFailed(true)}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                />
            )}
        </div>
    );
};

export const SongSelector: React.FC<SongSelectorProps> = ({ isLoading, error, songs, selectedSong, onSongSelect, sortConfig, onSortConfigChange }) => {
    const { settings } = useSettings();
    const [isRangeOpen, setIsRangeOpen] = useState(false);
    const {
        searchTerm, setSearchTerm,
        minInput, setMinInput,
        maxInput, setMaxInput,
        onlyHasAt, setOnlyHasAt,
        difficultyBounds, isRangeActive, rangeLabel,
        displayedSongs, isSuggestion,
    } = useSongFilter(songs);
    const rangeWrapperRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const parentRef = useRef<HTMLDivElement>(null);

    // "/" focuses the search box from anywhere on the page.
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
            e.preventDefault();
            searchInputRef.current?.focus();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (rangeWrapperRef.current && !rangeWrapperRef.current.contains(event.target as Node)) {
                setIsRangeOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const rowVirtualizer = useVirtualizer({
        count: displayedSongs.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 50,
        overscan: 6,
    });

    // Keep the selected song in view when it changes from outside the list (e.g. ?song= in the URL).
    useEffect(() => {
        if (!selectedSong) return;
        const index = displayedSongs.findIndex(s => s.id === selectedSong.id);
        if (index >= 0) rowVirtualizer.scrollToIndex(index, { align: 'auto' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSong]);

    const sortIndex = getSortIndex(sortConfig);
    const cycleSort = () => onSortConfigChange(SORT_CYCLE[(sortIndex + 1) % SORT_CYCLE.length].config);

    const renderList = () => {
        if (isLoading) {
            return (
                <div className="flex items-center justify-center gap-3 text-slate-400 text-sm py-10">
                    <Spinner />
                    <span>正在加载曲库…</span>
                </div>
            );
        }
        if (error) {
            return (
                <div className="flex flex-col items-center gap-2 text-center px-6 py-10">
                    <span className="flex items-center gap-2 text-[#f87171] text-sm font-semibold"><ErrorIcon className="w-5 h-5" />曲库加载失败</span>
                    <p className="font-mono text-[11px] text-slate-500 break-all">{error}</p>
                </div>
            );
        }
        if (displayedSongs.length === 0) {
            return <p className="px-4 py-10 text-center text-sm text-slate-500">没有找到匹配的曲目。</p>;
        }
        return (
            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map(virtualItem => {
                    const song = displayedSongs[virtualItem.index];
                    const selected = selectedSong?.id === song.id;
                    return (
                        <button
                            key={song.id}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onClick={() => onSongSelect(song)}
                            className={`absolute left-0 top-0 w-full h-12 flex items-center gap-3 px-2.5 rounded-lg text-left transition-colors ${
                                selected ? 'bg-[rgba(34,211,238,0.10)]' : 'hover:bg-white/[.04]'
                            }`}
                            style={{ transform: `translateY(${virtualItem.start}px)` }}
                        >
                            <SongThumbnail src={getBlurIllustrationUrl(settings.proxySource, song.id)} />
                            <span className="flex-1 min-w-0 flex flex-col">
                                <span className={`text-sm leading-[1.2] truncate ${selected ? 'text-white' : 'text-slate-300'}`}>
                                    {song.name}
                                </span>
                                <span className="text-[11px] leading-[1.3] text-slate-500 truncate">{song.composer}</span>
                            </span>
                        </button>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="flex flex-col min-h-0 h-full bg-[#0d1118]">
            <div className="flex-none bg-[#090c11] border-b border-white/[.1]">
            <div className="p-4 flex flex-col gap-3">
                <label className="h-[42px] flex items-center gap-2.5 px-3 rounded-[10px] bg-white/[.04] border border-white/[.08] focus-within:border-[rgba(34,211,238,.45)] transition-colors">
                    <MagnifyingGlassIcon className="w-4 h-4 text-slate-500 flex-none" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && displayedSongs.length > 0) onSongSelect(displayedSongs[0]);
                            if (e.key === 'Escape') { setSearchTerm(''); e.currentTarget.blur(); }
                        }}
                        placeholder="搜索曲名 / 曲师 / 别名"
                        aria-label="搜索曲名、曲师或别名"
                        className="flex-1 min-w-0 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
                    />
                    {searchTerm ? (
                        <button type="button" onClick={() => setSearchTerm('')} aria-label="清空搜索" className="text-slate-500 hover:text-slate-300">
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    ) : (
                        <kbd className="font-mono text-[10px] font-medium text-slate-500 px-1.5 py-0.5 border border-white/10 rounded">/</kbd>
                    )}
                </label>
            </div>

            <div className="px-4 pb-2 flex items-center gap-1.5">
                <span className="flex-1 min-w-0 truncate font-mono text-[10px] font-medium tracking-[.12em] text-slate-600">
                    {isLoading ? '— 首 | ' : `${displayedSongs.length} 首 | `}
                    {isSuggestion && <span className="text-[#22d3ee]"> · 你是不是要找</span>}
                </span>
                <button
                    type="button"
                    aria-pressed={onlyHasAt}
                    onClick={() => setOnlyHasAt(v => !v)}
                    title={onlyHasAt ? '只看有 AT 谱面的曲目' : '只看有 AT 谱面的曲目'}
                    className={`font-mono text-[11px] font-semibold px-2 py-1 rounded-md transition-colors ${onlyHasAt ? 'text-green-400 bg-green-400/[.12]' : 'text-white hover:bg-white/[.06]'}`}
                >
                    有 AT
                </button>
                <div ref={rangeWrapperRef} className="relative">
                    <button
                        type="button"
                        onClick={() => setIsRangeOpen(o => !o)}
                        aria-expanded={isRangeOpen}
                        title="按定数范围筛选"
                        className={`font-mono text-[11px] font-medium px-1.5 py-1 rounded-md transition-colors hover:bg-white/[.04] ${isRangeActive ? 'text-[#22d3ee]' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        {rangeLabel}
                    </button>
                    {isRangeOpen && (
                        <div className="motion-dropdown absolute right-0 z-40 mt-2 w-56 p-3 rounded-xl border border-white/[.08] bg-[rgba(12,15,22,.98)] shadow-[0_20px_50px_rgba(0,0,0,.5)] flex flex-col gap-2.5">
                            <span className="font-mono text-[10px] font-medium tracking-[.14em] text-slate-500">难度范围</span>
                            <div className="flex items-center gap-2">
                                {[
                                    { value: minInput, set: setMinInput, placeholder: difficultyBounds?.min, label: '最低定数' },
                                    { value: maxInput, set: setMaxInput, placeholder: difficultyBounds?.max, label: '最高定数' },
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
                                重置范围
                            </button>
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    onClick={cycleSort}
                    title="切换排序方式"
                    className="flex items-center gap-1 px-1.5 py-1 rounded-md text-xs text-slate-400 hover:text-slate-200 hover:bg-white/[.04] transition-colors"
                >
                    {SORT_CYCLE[sortIndex].label}
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" /></svg>
                </button>
            </div>

            </div>

            <div ref={parentRef} role="listbox" aria-label="曲目列表" className="flex-1 min-h-0 overflow-y-auto thin-scroll px-2 py-2">
                {renderList()}
            </div>
        </div>
    );
};
