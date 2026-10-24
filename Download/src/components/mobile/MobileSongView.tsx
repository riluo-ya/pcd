import React, { useEffect, useRef, useState } from 'react';
import { Song, FileInfo } from '../../types';
import { Spinner } from '../Spinner';
import { FileTable } from '../FileTable';
import { AudioPlayerControl } from '../AudioPlayerControl';
import { ArrowDownTrayIcon, ChevronDownIcon } from '../Icons';
import { DifficultySelector } from '../DifficultySelector';
import { useSettings } from '../../contexts/SettingsContext';

interface MobileSongViewProps {
    open: boolean;
    onBack: () => void;
    song: Song | null;
    bgImage: string | null;
    isBgLoaded: boolean;
    audio: HTMLAudioElement | null;
    files: FileInfo[];
    isLoadingFiles: boolean;
    difficulties: string[];
    selectedDifficulty: string | null;
    onSelectDifficulty: (difficulty: string) => void;
    onFilesFound: (files: FileInfo[]) => void;
    exportState: { type: 'phira' | 'chart' | null; progress: number };
    onExportChart: () => void;
    onExportAllAssets: () => void;
    onShareCard: () => void;
    shareCardEnabled: boolean;
}

// 页面下滚多远（px）后曲绘完全变暗
const DIM_DISTANCE = 320;
const MAX_DIM = 0.82;
// 顶部紧凑标题栏在这个滚动区间内淡入
const BAR_FADE_START = 120;
const BAR_FADE_LENGTH = 60;

const ProgressBar: React.FC<{ progress: number; className: string }> = ({ progress, className }) => (
    <div
        className={`absolute bottom-0 left-0 h-[3px] transition-[width] duration-150 ${className}`}
        style={{ width: `${progress.toFixed(0)}%` }}
    />
);

/**
 * 手机端的歌曲页：从右侧推入的全屏页面。
 * 顶部是曲绘 hero，中间是标题 / 难度 / 文件列表（可折叠），底部是常驻导出栏。
 */
export const MobileSongView: React.FC<MobileSongViewProps> = ({
    open,
    onBack,
    song,
    bgImage,
    isBgLoaded,
    audio,
    files,
    isLoadingFiles,
    difficulties,
    selectedDifficulty,
    onSelectDifficulty,
    onFilesFound,
    exportState,
    onExportChart,
    onExportAllAssets,
    onShareCard,
    shareCardEnabled,
}) => {
    const { settings } = useSettings();
    const [filesOpen, setFilesOpen] = useState(false);
    const [scrollTop, setScrollTop] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    // 每次推入新页面都从顶部开始，并收起文件列表
    useEffect(() => {
        if (!open) return;
        scrollRef.current?.scrollTo({ top: 0 });
        setScrollTop(0);
        setFilesOpen(false);
    }, [open, song?.id]);

    const isExporting = exportState.type !== null;
    const dim = Math.min(scrollTop / DIM_DISTANCE, 1) * MAX_DIM;
    const barOpacity = Math.max(0, Math.min(1, (scrollTop - BAR_FADE_START) / BAR_FADE_LENGTH));

    // 按钮文案沿用桌面端：没选难度就是「导出全部难度」
    const exportLabel = exportState.type === 'chart'
        ? '导出中…'
        : selectedDifficulty
            ? `导出 [${selectedDifficulty}]`
            : '导出全部难度';

    return (
        <div
            aria-hidden={!open}
            className={`absolute inset-0 z-10 bg-[#090b10] shadow-[-20px_0_60px_rgba(0,0,0,.5)] transition-[transform,visibility] duration-[340ms] ease-[cubic-bezier(.16,1,.3,1)] ${open ? 'translate-x-0 visible' : 'translate-x-[105%] invisible'}`}
        >
            {/* Hero 曲绘 */}
            <div className="absolute inset-x-0 top-0 h-[296px] overflow-hidden bg-[repeating-linear-gradient(135deg,#141b29_0_10px,#0f1521_10px_20px)]">
                <div
                    className="absolute inset-0 bg-cover bg-center transition-opacity duration-[600ms] ease-out"
                    style={{ backgroundImage: bgImage ? `url("${bgImage}")` : 'none', opacity: isBgLoaded ? 1 : 0 }}
                    aria-hidden="true"
                />
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(9,11,16,.35)_0%,rgba(9,11,16,0)_22%,rgba(9,11,16,.7)_62%,#090b10_92%)]" />
            </div>
            <div className="absolute inset-0 pointer-events-none bg-[#090b10]" style={{ opacity: dim }} />

            <div
                ref={scrollRef}
                onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
                className="absolute inset-0 overflow-y-auto thin-scroll px-5 pt-[176px] pb-[130px]"
            >
                {song && (
                    <div className="flex flex-col gap-5">
                        <div className="flex flex-col gap-0.5 min-w-0">
                            <span
                                className="font-mono text-[11px] font-medium tracking-[.12em] text-[#22d3ee] break-all select-all"
                                title="歌曲 ID"
                            >
                                {song.id}
                            </span>
                            <h2 className="text-[32px] font-bold leading-[1.12] tracking-[-0.01em] text-white break-words">
                                {song.name}
                            </h2>
                            <span className="text-[15px] text-slate-400">{song.composer}</span>
                        </div>

                        {settings.newUiAudioPreview && audio && (
                            <AudioPlayerControl audio={audio} songName={song.name} artist={song.composer} />
                        )}

                        {isLoadingFiles ? (
                            <div className="flex flex-col gap-2.5">
                                <span className="font-mono text-[10px] font-medium tracking-[.14em] text-slate-500">
                                    正在读取难度…
                                </span>
                                <div className="grid grid-cols-4 gap-2">
                                    {[0, 1, 2, 3].map(i => (
                                        <div key={i} className="h-[68px] rounded-[10px] border border-white/[.06] bg-white/[.015] animate-pulse" />
                                    ))}
                                </div>
                            </div>
                        ) : difficulties.length > 0 ? (
                            <div className="flex flex-col gap-2.5">
                                <span className="font-mono text-[10px] font-medium tracking-[.14em] text-slate-500">
                                    可选难度
                                </span>
                                <DifficultySelector
                                    difficulties={difficulties}
                                    selectedDifficulty={selectedDifficulty}
                                    onSelectDifficulty={onSelectDifficulty}
                                    selectedSong={song}
                                    highlight={false}
                                />
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500">这首歌没有找到可用的谱面。</p>
                        )}

                        {shareCardEnabled && (
                            <button
                                type="button"
                                onClick={onShareCard}
                                className="h-12 rounded-[10px] border border-white/[.12] text-sm font-semibold text-slate-200 active:bg-white/[.05]"
                            >
                                生成分享卡片
                            </button>
                        )}

                        <div className="flex flex-col">
                            <button
                                type="button"
                                onClick={() => setFilesOpen(v => !v)}
                                aria-expanded={filesOpen}
                                className="h-[52px] flex items-center justify-between border-t border-white/[.06]"
                            >
                                <span className="flex items-center gap-2 text-sm text-slate-300">
                                    <ChevronDownIcon
                                        className={`w-3.5 h-3.5 transition-transform duration-200 ${filesOpen ? '' : '-rotate-90'}`}
                                    />
                                    单个文件
                                    <span className="font-mono text-[11px] font-medium text-slate-500">
                                        · {isLoadingFiles ? '…' : files.length}
                                    </span>
                                </span>
                                <span className="font-mono text-[10px] font-medium tracking-[.12em] text-slate-600">
                                    {filesOpen ? '收起' : '展开'}
                                </span>
                            </button>
                            {filesOpen && (
                                <div className="pt-1.5">
                                    <FileTable selectedSong={song} onFilesFound={onFilesFound} />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* 滚过主标题后淡入的紧凑标题栏 */}
            <div
                className="absolute inset-x-0 top-0 h-14 px-16 flex items-center justify-center bg-[rgba(16,20,29,.92)] backdrop-blur-[14px] border-b border-white/[.08] pointer-events-none"
                style={{ opacity: barOpacity }}
                aria-hidden="true"
            >
                <span className="text-[15px] font-semibold text-slate-100 truncate">{song?.name}</span>
            </div>

            <button
                type="button"
                onClick={onBack}
                aria-label="返回"
                className="absolute top-1.5 left-3 w-11 h-11 rounded-full border border-white/[.1] bg-[rgba(9,11,16,.55)] backdrop-blur-[10px] text-slate-100 flex items-center justify-center"
            >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
            </button>

            {/* 拇指可及的导出栏 */}
            <div className="absolute inset-x-0 bottom-0 flex gap-2.5 px-4 pt-6 pb-[calc(16px+env(safe-area-inset-bottom))] bg-[linear-gradient(to_top,#090b10_62%,rgba(9,11,16,0))]">
                <button
                    type="button"
                    onClick={onExportChart}
                    disabled={isExporting}
                    className="export-glow relative overflow-hidden flex-1 min-w-0 h-[54px] rounded-xl bg-[#22d3ee] text-[#06141a] flex items-center justify-center gap-[9px] font-bold text-[15px] tracking-[.03em] whitespace-nowrap disabled:cursor-not-allowed disabled:bg-[#22d3ee]/40"
                >
                    {exportState.type === 'chart' ? (
                        <>
                            <span className="[&_svg]:text-[#06141a] [&_svg]:w-[18px] [&_svg]:h-[18px]">
                                <Spinner />
                            </span>
                            {exportLabel}
                        </>
                    ) : (
                        <>
                            <ArrowDownTrayIcon className="w-[18px] h-[18px] flex-none" />
                            <span className="truncate">{exportLabel}</span>
                        </>
                    )}
                    {exportState.type === 'chart' && <ProgressBar progress={exportState.progress} className="bg-[#06141a]/40" />}
                </button>
                <button
                    type="button"
                    onClick={onExportAllAssets}
                    disabled={isExporting || files.length === 0}
                    aria-label="导出全部资源为 .zip"
                    className="relative overflow-hidden flex-none w-[72px] h-[54px] rounded-xl border border-white/[.14] bg-[rgba(9,11,16,.5)] backdrop-blur-[8px] text-slate-200 flex flex-col items-center justify-center gap-px disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {exportState.type === 'phira' ? (
                        <span className="[&_svg]:w-[18px] [&_svg]:h-[18px]">
                            <Spinner />
                        </span>
                    ) : (
                        <span className="font-mono text-[13px] font-semibold tracking-[.06em]">.zip</span>
                    )}
                    <span className="text-[10px] leading-none text-slate-400">全部资源</span>
                    {exportState.type === 'phira' && <ProgressBar progress={exportState.progress} className="bg-[#22d3ee]/75" />}
                </button>
            </div>
        </div>
    );
};
