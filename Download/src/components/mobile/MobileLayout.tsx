import React, { useCallback, useEffect, useState } from 'react';
import { Song, SortConfig, FileInfo } from '../../types';
import { MobileLibrary } from './MobileLibrary';
import { MobileSongView } from './MobileSongView';
import { BottomSheet } from './BottomSheet';
import { SongFilterPanel } from '../SongFilterPanel';
import { SongFilter } from '../../hooks/useSongFilter';

// 推入歌曲页时打的 history 标记，让系统返回手势能回到列表
const HISTORY_KEY = 'pcdSongView';

type Sheet = 'menu' | 'filter';

interface MobileLayoutProps {
    songs: Song[];
    filter: SongFilter;
    isLoadingSongs: boolean;
    errorSongs: string | null;
    selectedSong: Song | null;
    onSongSelect: (song: Song | null) => void;
    sortConfig: SortConfig;
    onSortConfigChange: (config: SortConfig) => void;

    version: string | null;
    isLoadingVersion: boolean;
    versionError: string | null;
    onRetryVersion: () => void;
    onAboutClick: () => void;
    onFaqClick: () => void;
    onSettingsClick: () => void;
    onSourceClick: () => void;

    bgImage: string | null;
    isBgLoaded: boolean;
    audio: HTMLAudioElement | null;
    files: FileInfo[];
    isLoadingFiles: boolean;
    difficulties: string[];
    selectedDifficulty: string | null;
    onSelectDifficulty: (difficulty: string | null) => void;
    onFilesFound: (files: FileInfo[]) => void;
    exportState: { type: 'phira' | 'chart' | null; progress: number };
    onExportChart: () => void;
    onExportAllAssets: () => void;
    onShareCard: () => void;
    shareCardEnabled: boolean;

    bulkPanel: React.ReactNode | null;
}

const eyebrow = 'font-mono text-[10px] font-medium tracking-[.16em] text-[#22d3ee]';

/**
 * 手机布局：曲库占满整屏，点一首歌把详情页从右侧推入。
 * 与上游 MobileLayout 同构，菜单走底部抽屉；额外加了「返回导航」入口。
 */
export const MobileLayout: React.FC<MobileLayoutProps> = ({
    songs,
    filter,
    isLoadingSongs,
    errorSongs,
    selectedSong,
    onSongSelect,
    sortConfig,
    onSortConfigChange,
    version,
    isLoadingVersion,
    versionError,
    onRetryVersion,
    onAboutClick,
    onFaqClick,
    onSettingsClick,
    onSourceClick,
    audio,
    bulkPanel,
    ...songViewProps
}) => {
    const [songOpen, setSongOpen] = useState(selectedSong !== null);
    const [sheet, setSheet] = useState<Sheet | null>(null);
    // 抽屉收起时保留上一份内容，否则滑出动画期间内容会先消失
    const [lastSheet, setLastSheet] = useState<Sheet>('menu');

    const openSheet = (s: Sheet) => {
        setLastSheet(s);
        setSheet(s);
    };
    const closeSheet = useCallback(() => setSheet(null), []);

    // 从别处选中歌曲（比如 ?song= 分享链接）时也要推出详情页
    useEffect(() => {
        if (selectedSong) setSongOpen(true);
    }, [selectedSong]);

    // 音频只在歌曲页播放，回到列表就停
    useEffect(() => {
        if (!songOpen) audio?.pause();
    }, [audio, songOpen]);

    const closeSong = useCallback(() => setSongOpen(false), []);

    useEffect(() => {
        const handlePop = () => closeSong();
        window.addEventListener('popstate', handlePop);
        return () => window.removeEventListener('popstate', handlePop);
    }, [closeSong]);

    const openSong = (song: Song) => {
        if (!songOpen) window.history.pushState({ [HISTORY_KEY]: true }, '');
        if (song.id === selectedSong?.id) {
            // 同一首歌再次打开：音频元素被复用，手动重新开始
            if (audio) {
                audio.currentTime = 0;
                audio.play().catch(() => {});
            }
        } else {
            onSongSelect(song);
        }
        setSongOpen(true);
    };

    const goBack = () => {
        if (window.history.state?.[HISTORY_KEY]) window.history.back();
        else closeSong();
    };

    const openDialog = (open: () => void) => {
        setSheet(null);
        open();
    };

    const dot = versionError ? '#f87171' : isLoadingVersion ? '#fbbf24' : '#4ade80';
    const versionLabel = versionError ? '失败 · 重试' : isLoadingVersion ? '加载中 …' : `Phigros v${version}`;

    const menuItems: { label: string; meta: string; onClick: () => void }[] = [
        { label: '设置', meta: '', onClick: () => openDialog(onSettingsClick) },
        { label: '加速源', meta: '', onClick: () => openDialog(onSourceClick) },
        { label: '常见问题', meta: '', onClick: () => openDialog(onFaqClick) },
        { label: '关于', meta: '', onClick: () => openDialog(onAboutClick) },
    ];

    const renderMenu = () => (
        <div className="flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
                <span id="mobile-sheet-title" className={eyebrow}>菜单</span>
                <button
                    type="button"
                    onClick={versionError ? onRetryVersion : undefined}
                    disabled={!versionError}
                    title={versionError ?? '资源解包自该游戏版本'}
                    className="flex items-center gap-2 px-3 py-[5px] rounded-full border border-white/[.08] font-mono text-[11px] font-medium text-slate-400 whitespace-nowrap"
                >
                    <span
                        className={`w-1.5 h-1.5 rounded-full ${isLoadingVersion ? 'animate-pulse' : ''}`}
                        style={{ background: dot, boxShadow: `0 0 8px ${dot}` }}
                    />
                    {versionLabel}
                </button>
            </div>
            <div className="flex flex-col rounded-[14px] border border-white/[.07] bg-white/[.02] overflow-hidden">
                {menuItems.map((item, i) => (
                    <button
                        key={item.label}
                        type="button"
                        onClick={item.onClick}
                        className={`h-14 flex items-center gap-3.5 px-4 text-left text-[15px] text-slate-200 active:bg-white/[.04] ${i ? 'border-t border-white/[.06]' : ''}`}
                    >
                        <span className="flex-1">{item.label}</span>
                        <span className="font-mono text-[11px] font-medium text-slate-500">{item.meta}</span>
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#475569">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                    </button>
                ))}
            </div>
            {/* 返回导航中心：手机端没有顶栏导航，这是唯一的出口 */}
            <a
                href="./home.html"
                className="h-12 rounded-[10px] border border-white/[.12] flex items-center justify-center gap-2 text-sm font-semibold text-slate-300 active:bg-white/[.05]"
            >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                返回导航中心
            </a>
            <p className="text-xs leading-[1.5] text-slate-500 text-center">
                本工具非官方项目，所有素材归各自版权方所有。
            </p>
        </div>
    );

    const renderFilter = () => (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
                <span className={eyebrow}>筛选</span>
                <span id="mobile-sheet-title" className="text-[21px] font-semibold text-slate-100">
                    按难度 / 定数 / 谱师 / 曲师
                </span>
            </div>
            <SongFilterPanel
                filter={filter}
                songs={songs}
                filteredCount={filter.displayedSongs.length}
            />
            <button
                type="button"
                onClick={closeSheet}
                className="h-12 rounded-[10px] bg-[#22d3ee] text-[#06141a] text-sm font-bold"
            >
                查看 {filter.displayedSongs.length} 首
            </button>
        </div>
    );

    const sheetContent = sheet ?? lastSheet;

    return (
        <div className="relative flex-1 min-h-0 overflow-hidden">
            <MobileLibrary
                filter={filter}
                isLoading={isLoadingSongs}
                error={errorSongs}
                selectedSong={selectedSong}
                onOpenSong={openSong}
                sortConfig={sortConfig}
                onSortConfigChange={onSortConfigChange}
                onOpenMenu={() => openSheet('menu')}
                onOpenFilter={() => openSheet('filter')}
                bulkPanel={bulkPanel}
            />

            {!bulkPanel && (
                // audio 在解构里被单独取出，不会进 songViewProps，必须显式回传，
                // 否则歌曲页的 audio 恒为 undefined，音频播放器永远渲染不出来
                <MobileSongView
                    open={songOpen && selectedSong !== null}
                    onBack={goBack}
                    song={selectedSong}
                    {...songViewProps}
                    audio={audio}
                />
            )}

            <BottomSheet open={sheet !== null} onClose={closeSheet} labelledBy="mobile-sheet-title">
                {sheetContent === 'menu' ? renderMenu() : renderFilter()}
            </BottomSheet>
        </div>
    );
};
