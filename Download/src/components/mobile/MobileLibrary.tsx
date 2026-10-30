import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Spinner } from '../Spinner';
import { ErrorIcon, MagnifyingGlassIcon, ChevronDownIcon, ArrowsUpDownIcon } from '../Icons';
import { Song, SortConfig } from '../../types';
import { SongFilter } from '../../hooks/useSongFilter';
import { ghRaw } from '../../utils/sources';

interface MobileLibraryProps {
    filter: SongFilter;
    isLoading: boolean;
    error: string | null;
    selectedSong: Song | null;
    onOpenSong: (song: Song) => void;
    sortConfig: SortConfig;
    onSortConfigChange: (config: SortConfig) => void;
    onOpenMenu: () => void;
    onOpenRange: () => void;
    /** 批量下载模式：替换掉列表、筛选和搜索框 */
    bulkPanel?: React.ReactNode;
}

const ROW_HEIGHT = 60;

/** 列表里的曲绘缩略图，加载失败时留一个斜纹占位，不出现破图 */
const SongThumbnail: React.FC<{ src: string }> = ({ src }) => {
    const [loaded, setLoaded] = React.useState(false);
    const [failed, setFailed] = React.useState(false);
    return (
        <span className="relative w-16 h-9 flex-none rounded-md overflow-hidden bg-[repeating-linear-gradient(135deg,#1e293b_0_4px,#172033_4px_8px)]">
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
        </span>
    );
};

const chip = 'flex-none h-[34px] rounded-[17px] border flex items-center transition-colors';

/**
 * 手机端的曲库列表：整屏高度，顶部标题栏 + 筛选 chips，中间虚拟列表，底部常驻搜索框。
 * 与上游 MobileLibrary 同构，但筛选沿用本站的完整条件（难度 / 定数 / 谱师 / 曲师）。
 */
export const MobileLibrary: React.FC<MobileLibraryProps> = ({
    filter,
    isLoading,
    error,
    selectedSong,
    onOpenSong,
    sortConfig,
    onSortConfigChange,
    onOpenMenu,
    onOpenRange,
    bulkPanel,
}) => {
    const {
        searchTerm, setSearchTerm,
        onlyHasAt, setOnlyHasAt,
        isRangeActive, rangeLabel,
        displayedSongs, isSuggestion,
    } = filter;
    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: displayedSongs.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: 6,
    });

    const cycleSort = () =>
        onSortConfigChange({ type: sortConfig.type, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' });

    const renderList = () => {
        if (isLoading) {
            return (
                <div className="flex items-center justify-center gap-3 py-12 text-sm text-slate-400">
                    <Spinner />
                    <span>正在载入曲库…</span>
                </div>
            );
        }
        if (error) {
            return (
                <div className="flex flex-col items-center gap-2 text-center px-6 py-12">
                    <span className="flex items-center gap-2 text-[#f87171] text-sm font-semibold">
                        <ErrorIcon className="w-5 h-5" />
                        曲库加载失败
                    </span>
                    <p className="font-mono text-[11px] text-slate-500 break-all">{error}</p>
                </div>
            );
        }
        if (displayedSongs.length === 0) {
            return <p className="px-4 py-12 text-center text-sm text-slate-500">没有匹配的曲目。</p>;
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
                            onClick={() => onOpenSong(song)}
                            className={`absolute left-0 top-0 w-full h-[60px] flex items-center gap-3 px-2.5 rounded-[10px] text-left ${selected ? 'bg-[rgba(34,211,238,0.10)]' : 'active:bg-white/[.04]'}`}
                            style={{ transform: `translateY(${virtualItem.start}px)` }}
                        >
                            <SongThumbnail src={ghRaw(`7aGiven/Phigros_Resource/refs/heads/illustration/${song.id}.png`)} />
                            <span className="flex-1 min-w-0 flex flex-col gap-px">
                                <span className={`text-[15px] leading-[1.25] truncate ${selected ? 'text-white' : 'text-slate-300'}`}>
                                    {song.name}
                                </span>
                                <span className="text-xs leading-[1.3] text-slate-500 truncate">{song.composer}</span>
                            </span>
                        </button>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="absolute inset-0 flex flex-col bg-[#0d1118]">
            <div className="flex-none bg-[#090c11] border-b border-white/[.1]">
                <header className="h-[52px] flex items-center justify-between gap-3 pl-[18px] pr-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                        {/* 返回导航中心：手机端没有顶栏导航，这里给一个常驻出口 */}
                        <a
                            href="./home.html"
                            aria-label="返回导航中心"
                            title="返回导航中心"
                            className="w-9 h-9 -ml-1.5 flex-none flex items-center justify-center rounded-lg text-slate-400 active:bg-white/[.06]"
                        >
                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                            </svg>
                        </a>
                        <span className="w-4 h-4 flex-none bg-[#22d3ee] -skew-x-[14deg]" aria-hidden="true" />
                        <h1 className="font-semibold text-[13px] tracking-[.16em] text-slate-100 truncate">
                            PHIGROS 谱面下载器
                        </h1>
                    </div>
                    <button
                        type="button"
                        onClick={onOpenMenu}
                        aria-label="菜单"
                        className="w-11 h-11 flex-none flex items-center justify-center rounded-xl text-slate-300 active:bg-white/[.05]"
                    >
                        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                        </svg>
                    </button>
                </header>

                {!bulkPanel && (
                    <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto">
                        <button
                            type="button"
                            aria-pressed={onlyHasAt}
                            onClick={() => setOnlyHasAt(v => !v)}
                            className={`${chip} gap-1.5 px-3 font-mono text-xs font-semibold ${onlyHasAt ? 'border-[rgba(74,222,128,.35)] bg-[rgba(74,222,128,.12)] text-[#4ade80]' : 'border-white/[.08] text-slate-200'}`}
                        >
                            有 AT
                        </button>
                        <button
                            type="button"
                            onClick={onOpenRange}
                            aria-label={`定数区间 ${rangeLabel}`}
                            className={`${chip} gap-1 pl-3 pr-2.5 font-mono text-xs font-medium ${isRangeActive ? 'border-[rgba(34,211,238,.4)] bg-[rgba(34,211,238,.1)] text-[#22d3ee]' : 'border-white/[.08] text-slate-400'}`}
                        >
                            Lv {rangeLabel}
                            <ChevronDownIcon className="w-3 h-3 [stroke-width:2]" />
                        </button>
                        <button
                            type="button"
                            onClick={cycleSort}
                            aria-label="切换排序"
                            className={`${chip} gap-[5px] px-3 border-white/[.08] text-xs font-medium text-slate-400`}
                        >
                            {sortConfig.direction === 'asc' ? '升序' : '降序'}
                            <ArrowsUpDownIcon className="w-3 h-3" />
                        </button>
                        <span className="flex-1" />
                        <span className="flex-none font-mono text-[10px] font-medium tracking-[.12em] text-slate-600 whitespace-nowrap">
                            {isSuggestion && <span className="text-[#22d3ee]">别名匹配 · </span>}
                            {isLoading ? '—' : `${displayedSongs.length} 首`}
                        </span>
                    </div>
                )}
            </div>

            {bulkPanel ? (
                <div className="flex-1 min-h-0 overflow-y-auto thin-scroll">{bulkPanel}</div>
            ) : (
                <>
                    <div
                        ref={parentRef}
                        role="listbox"
                        aria-label="歌曲列表"
                        className="flex-1 min-h-0 overflow-y-auto thin-scroll px-2 pt-1.5 pb-6"
                    >
                        {renderList()}
                    </div>

                    <div className="flex-none px-4 pt-2.5 pb-[calc(16px+env(safe-area-inset-bottom))] bg-[#05070a] border-t border-white/[.1]">
                        <label className="h-12 flex items-center gap-2.5 px-3.5 rounded-[14px] bg-white/[.05] border border-white/[.08] focus-within:border-[rgba(34,211,238,.45)] transition-colors">
                            <MagnifyingGlassIcon className="w-[18px] h-[18px] flex-none text-slate-500" />
                            <input
                                type="text"
                                enterKeyHint="search"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.currentTarget.blur();
                                        if (displayedSongs.length > 0) onOpenSong(displayedSongs[0]);
                                    }
                                }}
                                placeholder="搜索曲名或曲师"
                                aria-label="搜索曲名、曲师或别名"
                                className="flex-1 min-w-0 bg-transparent text-base text-slate-200 placeholder:text-slate-500 focus:outline-none"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    aria-label="清除搜索"
                                    className="w-8 h-8 -mr-1.5 flex-none flex items-center justify-center text-slate-500"
                                >
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </label>
                    </div>
                </>
            )}
        </div>
    );
};
