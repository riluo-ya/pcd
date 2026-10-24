import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NoticeDialog, Button, ErrorBody } from './components/ui/Dialog';
import { Header } from './components/Header';
import { useIsMobile } from './hooks/useIsMobile';
import { useSongFilter } from './hooks/useSongFilter';
import { MobileLayout } from './components/mobile/MobileLayout';
import { SongSelector } from './components/SongSelector';
import { FileTable } from './components/FileTable';
import { DifficultySelector } from './components/DifficultySelector';
import { Spinner } from './components/Spinner';
import { BlacklistWarningPopup } from './components/BlacklistWarningPopup';
import { isBlacklisted, BlacklistEntry } from './blacklist';
import { SettingsPopup } from './components/SettingsPopup';
import { SourcePopup } from './components/SourcePopup';
import { FAQPopup } from './components/FAQPopup';
import { AboutPopup } from './components/AboutPopup';
import { ShareCardPopup } from './components/ShareCardPopup';
import { useSettings } from './contexts/SettingsContext';
import { AudioVisualizer } from './components/AudioVisualizer';
import { getSongEffect } from './song-effects';
import { SongEffectRenderer } from './components/SongEffectRenderer';
import { AudioPlayerControl } from './components/AudioPlayerControl';
import { Song, FileInfo, SortConfig } from './types';
import { fetchVersion, fetchSongs } from './utils/api';
import { ghRaw } from './utils/sources';
import { exportAllAssets, exportChart } from './utils/export';
import { BulkDownloadPanel } from './components/BulkDownloadPanel';

const App: React.FC = () => {
    const { settings, setSettings } = useSettings();
    const [version, setVersion] = useState<string | null>(null);
    const [isLoadingVersion, setIsLoadingVersion] = useState<boolean>(true);
    const [errorVersion, setErrorVersion] = useState<string | null>(null);

    const [songs, setSongs] = useState<Song[]>([]);
    const [isLoadingSongs, setIsLoadingSongs] = useState<boolean>(true);
    const [errorSongs, setErrorSongs] = useState<string | null>(null);
    const [selectedSong, setSelectedSong] = useState<Song | null>(null);
    const [sortConfig, setSortConfig] = useState<SortConfig>({ type: 'alphanumerical', direction: 'asc' });
    
    const [files, setFiles] = useState<FileInfo[]>([]);
    const [availableDifficulties, setAvailableDifficulties] = useState<string[]>([]);
    const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
    const [exportState, setExportState] = useState<{ type: 'phira' | 'chart' | null; progress: number }>({ type: null, progress: 0 });
    const [blacklistWarning, setBlacklistWarning] = useState<(BlacklistEntry & { exportType: 'phira' | 'chart' }) | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isFaqOpen, setIsFaqOpen] = useState(false);
    const [isAboutOpen, setIsAboutOpen] = useState(false);
    const [isSourceOpen, setIsSourceOpen] = useState(false);
    const [isShareCardOpen, setIsShareCardOpen] = useState(false);
    // 手机走另一套组件树（推入式页面 + 底部抽屉），与上游一致；桌面仍是左右分栏。
    const isMobile = useIsMobile();
    

    // Background and Audio management
    const [bgImage, setBgImage] = useState<string | null>(null);
    // 自绘错误弹窗：替代 window.alert，同时保留完整的技术细节
    const [errorDialog, setErrorDialog] = useState<{ title: string; message: string; detail: string } | null>(null);
    const [isBgLoaded, setIsBgLoaded] = useState<boolean>(false);
    const [activeAudio, setActiveAudio] = useState<HTMLAudioElement | null>(null);

    const initialSongSelected = useRef<boolean>(false);
    // Determine current song effect
    const activeEffect = settings.useNewUi && settings.newUiSongSpecificEffects && selectedSong 
        ? getSongEffect(selectedSong.name) 
        : null;

    const sortedSongs = React.useMemo(() => {
        let result = [...songs];
        
        if (sortConfig.type === 'alphanumerical') {
            result.sort((a, b) => a.name.localeCompare(b.name));
        }
        // If 'unsorted', we rely on the original order (which is essentially what songs is)
        
        if (sortConfig.direction === 'desc') {
            result.reverse();
        }
        
        return result;
    }, [songs, sortConfig]);

    // 手机端曲库的筛选与搜索状态（必须在 sortedSongs 之后声明）
    const mobileFilter = useSongFilter(sortedSongs);

    /**
     * 拉取资源版本。
     * 提到组件作用域是为了让顶栏的「重试」按钮能直接复用它 ——
     * 之前它定义在 useEffect 内部，JSX 里引用会直接 ReferenceError 导致整个应用白屏。
     */
    const loadVersion = useCallback(async () => {
        setIsLoadingVersion(true);
        setErrorVersion(null);
        try {
            const ver = await fetchVersion();
            setVersion(ver);
        } catch (err) {
            setErrorVersion(err instanceof Error ? err.message : '发生未知错误。');
            console.error(err);
        } finally {
            setIsLoadingVersion(false);
        }
    }, []);

    useEffect(() => {
        loadVersion();
    }, [loadVersion]);

    useEffect(() => {
        const loadSongs = async () => {
            setIsLoadingSongs(true);
            setErrorSongs(null);
            try {
                const fetchedSongs = await fetchSongs();
                setSongs(fetchedSongs);
            } catch (err) {
                setErrorSongs(err instanceof Error ? err.message : '获取歌曲列表时发生错误。');
                console.error(err);
            } finally {
                setIsLoadingSongs(false);
            }
        };
        loadSongs();
    }, []);

    const handleSongSelect = useCallback((song: Song | null) => {
        setSelectedSong(song);
        setSelectedDifficulty(null);
        setAvailableDifficulties([]);
        setFiles([]);
    }, []);
    
    useEffect(() => {
        if (songs.length > 0 && !initialSongSelected.current) {
            initialSongSelected.current = true;
            const urlParams = new URLSearchParams(window.location.search);
            const songIdFromUrl = urlParams.get('song');
            
            if (songIdFromUrl) {
                const songToSelect = songs.find(s => s.id === songIdFromUrl);
                if (songToSelect) {
                    handleSongSelect(songToSelect);
                }
            }
        }
    }, [songs, handleSongSelect]);

    // Enhanced New UI with preloading and audio state
    useEffect(() => {
        if (!settings.useNewUi || !selectedSong || settings.bulkDownloadMode) {
            setActiveAudio(prev => {
                if (prev) prev.pause();
                return null;
            });
            setBgImage(null);
            setIsBgLoaded(false);
            return;
        }

        const songId = selectedSong.id;
        const illustrationUrl = ghRaw(`7aGiven/Phigros_Resource/refs/heads/illustration/${songId}.png`);
        
        // Reset loaded state for smooth transition
        setIsBgLoaded(false);
        
        // Preload image
        const img = new Image();
        img.src = illustrationUrl;
        img.onload = () => {
            setBgImage(illustrationUrl);
            setIsBgLoaded(true);
        };
        img.onerror = () => {
            setBgImage(null);
            setIsBgLoaded(false);
        };

        // Audio Setup - Only if preview is enabled
        if (settings.newUiAudioPreview) {
            const audioUrl = ghRaw(`7aGiven/Phigros_Resource/refs/heads/music/${songId}.ogg`);
            const audio = new Audio();
            // IMPORTANT: Must set crossOrigin to anonymous BEFORE loading to allow Web Audio API analysis
            audio.crossOrigin = "anonymous"; 
            audio.src = audioUrl;
            audio.loop = settings.newUiLoopAudio;
            audio.volume = settings.newUiAudioVolume;

            setActiveAudio(prev => {
                if (prev) prev.pause();
                return audio;
            });

            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.warn("Autoplay blocked or audio failed to load:", error);
                });
            }
        } else {
            setActiveAudio(prev => {
                if (prev) prev.pause();
                return null;
            });
        }

        return () => {
            // No cleanup needed for activeAudio here as setActiveAudio logic handles pause
        };
    }, [selectedSong, settings.useNewUi, settings.newUiAudioPreview, settings.bulkDownloadMode]);

    // Update audio loop property immediately when setting changes
    useEffect(() => {
        if (activeAudio) {
            activeAudio.loop = settings.newUiLoopAudio;
        }
    }, [activeAudio, settings.newUiLoopAudio]);

    // Update audio volume when setting changes
    useEffect(() => {
        if (activeAudio) {
            activeAudio.volume = settings.newUiAudioVolume;
        }
    }, [activeAudio, settings.newUiAudioVolume]);

    // Cleanup audio on unmount or song change via the effect above essentially
    useEffect(() => {
         return () => {
            if (activeAudio) activeAudio.pause();
         }
    }, []);


    const handleFilesFound = useCallback((foundFiles: FileInfo[]) => {
        setFiles(foundFiles);
        const chartDifficulties = foundFiles
            .map(file => {
                const match = file.type.match(/Chart \(([^)]+)\)/);
                return match ? match[1] : null;
            })
            .filter((diff): diff is string => diff !== null);
        setAvailableDifficulties(chartDifficulties);
    }, []);

    const executeAllAssetsExport = async () => {
        if (!selectedSong || files.length === 0 || exportState.type) return;

        setExportState({ type: 'phira', progress: 0 });
        try {
            await exportAllAssets(files, selectedSong, settings, (progress) => {
                setExportState(prev => ({ ...prev, progress }));
            });
        } catch (error) {
            console.error("Failed to export all assets: ", error);
            setErrorDialog({
                title: '导出资源失败',
                message: '打包这首歌的完整资源时出错了。常见原因是网络中断或上游文件暂时不可用，可稍后重试。',
                detail: error instanceof Error ? (error.stack || error.message) : String(error),
            });
        } finally {
            setExportState({ type: null, progress: 0 });
        }
    };

    /**
     * 导出谱面。
     * 选了难度就只导那一个；没选难度则导出这首歌的全部难度，
     * 每个难度一个 .pez / .zip，打包成一个压缩包。
     */
    const executeChartExport = async () => {
        if (!selectedSong || exportState.type) return;

        setExportState({ type: 'chart', progress: 0 });
        try {
            await exportChart(
                files,
                selectedSong,
                selectedDifficulty,          // null = 导出全部难度
                settings,
                (progress) => {
                    setExportState(prev => ({ ...prev, progress }));
                },
                availableDifficulties.length > 0 ? availableDifficulties : undefined
            );
        } catch (error) {
            console.error("Failed to export as chart: ", error);
            setErrorDialog({
                title: '导出谱面失败',
                message: '生成谱面文件时出错了。若只有个别歌曲失败，通常是这首歌的某个难度文件在上游缺失。',
                detail: error instanceof Error ? (error.stack || error.message) : String(error),
            });
        } finally {
            setExportState({ type: null, progress: 0 });
        }
    };

    const handleExportAllAssets = () => {
        if (!selectedSong || exportState.type) return;
        executeAllAssetsExport();
    };

    const handleExportChart = () => {
        if (!selectedSong || exportState.type) return;

        // 没选难度时不再拦人 —— 直接导出这首歌的全部难度
        if (!selectedDifficulty) {
            void executeChartExport();
            return;
        }

        const entry = isBlacklisted(selectedSong.id, selectedDifficulty);
        if (entry) {
            setBlacklistWarning({ ...entry, exportType: 'chart' });
        } else {
            executeChartExport();
        }
    };


    const handleBlacklistConfirm = () => {
        if (!blacklistWarning) return;
        
        if (blacklistWarning.exportType === 'chart') {
            executeChartExport();
        }
        setBlacklistWarning(null);
    };
    
    const handleBlacklistCancel = () => {
        setBlacklistWarning(null);
    };

    const isExporting = exportState.type !== null;

    return (
        <div className="relative h-dvh flex flex-col antialiased font-saira text-slate-200 bg-[#090b10] overflow-hidden">
            {/* New UI Background Layer - Fixed Z-0 */}
            <div 
                className="fixed top-0 left-0 w-full h-[100lvh] z-0 pointer-events-none"
                aria-hidden="true"
            >
                {/* Background Image */}
                <div 
                    className="absolute inset-0 transition-all duration-1000 ease-in-out"
                    style={{
                        backgroundImage: bgImage ? `url("${bgImage}")` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        filter: 'blur(30px) brightness(0.5)',
                        opacity: isBgLoaded ? 1 : 0,
                        transform: isBgLoaded ? 'scale(1.05)' : 'scale(1.15)',
                    }}
                />
                {/* Fallback/Base gradient used when image is not loaded or for slight darkening */}
                <div className={`absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-gray-900 -z-10`} />
            </div>

            {/* Visualizer Layer - Fixed Z-5 (Between bg and content) */}
            {settings.useNewUi && settings.newUiShowVisualizer && activeAudio && !settings.bulkDownloadMode && (
                <div className="animate-fade-in">
                    <AudioVisualizer 
                        audio={activeAudio} 
                        color={settings.newUiVisualizerColor}
                        height={settings.newUiVisualizerHeight}
                        opacity={settings.newUiVisualizerOpacity}
                    />
                </div>
            )}
            
            {/* Song Effects Styles & Overlay */}
            {activeEffect && !settings.bulkDownloadMode && (
                <div className="animate-fade-in">
                    <SongEffectRenderer effect={activeEffect} audio={activeAudio} songName={selectedSong?.name} />
                </div>
            )}

            {isSettingsOpen && <SettingsPopup isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />}
            {isFaqOpen && <FAQPopup isOpen={isFaqOpen} onClose={() => setIsFaqOpen(false)} />}
            {isAboutOpen && <AboutPopup isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />}
            {isShareCardOpen && (
                <ShareCardPopup
                    song={selectedSong}
                    isOpen={isShareCardOpen}
                    onClose={() => setIsShareCardOpen(false)}
                />
            )}
            {isSourceOpen && <SourcePopup isOpen={isSourceOpen} onClose={() => setIsSourceOpen(false)} />}
            {blacklistWarning && (
                <BlacklistWarningPopup 
                    isOpen={!!blacklistWarning}
                    onCancel={handleBlacklistCancel}
                    onConfirm={handleBlacklistConfirm}
                    reason={blacklistWarning.reason}
                />
            )}
            
            {/* Content Layer - Relative Z-10 */}
            {/* 手机端：另一套组件树（推入式歌曲页 + 底部抽屉菜单），与上游布局一致 */}
            {isMobile ? (
                <MobileLayout
                    songs={sortedSongs}
                    filter={mobileFilter}
                    isLoadingSongs={isLoadingSongs}
                    errorSongs={errorSongs}
                    selectedSong={selectedSong}
                    onSongSelect={handleSongSelect}
                    sortConfig={sortConfig}
                    onSortConfigChange={setSortConfig}
                    version={version}
                    isLoadingVersion={isLoadingVersion}
                    versionError={errorVersion}
                    onRetryVersion={loadVersion}
                    onAboutClick={() => setIsAboutOpen(true)}
                    onFaqClick={() => setIsFaqOpen(true)}
                    onSettingsClick={() => setIsSettingsOpen(true)}
                    onSourceClick={() => setIsSourceOpen(true)}
                    bgImage={bgImage}
                    isBgLoaded={isBgLoaded}
                    audio={activeAudio}
                    files={files}
                    isLoadingFiles={!!selectedSong && availableDifficulties.length === 0}
                    difficulties={availableDifficulties}
                    selectedDifficulty={selectedDifficulty}
                    onSelectDifficulty={setSelectedDifficulty}
                    onFilesFound={handleFilesFound}
                    exportState={exportState}
                    onExportChart={handleExportChart}
                    onExportAllAssets={handleExportAllAssets}
                    onShareCard={() => setIsShareCardOpen(true)}
                    shareCardEnabled={settings.shareCardEnabled}
                    bulkPanel={settings.bulkDownloadMode ? <BulkDownloadPanel songs={sortedSongs} isLoading={isLoadingSongs} error={errorSongs} onExit={() => setSettings(prev => ({ ...prev, bulkDownloadMode: false }))} /> : null}
                />
            ) : (

                <div className={`relative z-10 flex-1 min-h-0 flex flex-col ${activeEffect === 'glitch' ? 'effect-glitch-active' : ''} ${activeEffect === 'cracking' ? 'effect-cracking-active' : ''}`}>
                     {/* Standard background decorative shape, only visible if New UI bg isn't loaded */}
                     <div 
                         className={`absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80 transition-opacity duration-500 ${!isBgLoaded ? 'opacity-100' : 'opacity-0'}`} 
                         aria-hidden="true"
                     >
                         <div 
                             className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#80ff89] to-[#22d3ee] opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" 
                             style={{
                                 clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)'
                             }}
                         ></div>
                     </div>

                    <Header
                        version={version}
                        isLoadingVersion={isLoadingVersion}
                        versionError={errorVersion}
                        onRetryVersion={loadVersion}
                        onSettingsClick={() => setIsSettingsOpen(true)}
                        onFaqClick={() => setIsFaqOpen(true)}
                        onAboutClick={() => setIsAboutOpen(true)}
                        onSourceClick={() => setIsSourceOpen(true)}
                    />

                    <main className="flex-1 min-h-0 grid grid-rows-[minmax(0,40%)_minmax(0,1fr)] md:grid-rows-1 md:grid-cols-[340px_minmax(0,1fr)]">
                        {/* 窄屏：列表与详情二选一，各占满一屏；宽屏（md+）始终并排显示 */}
                        <aside className="min-h-0 border-b md:border-b-0 md:border-r border-white/[.06]">
                            <SongSelector 
                                    isLoading={isLoadingSongs}
                                    error={errorSongs}
                                    songs={sortedSongs}
                                    selectedSong={selectedSong}
                                    onSongSelect={handleSongSelect}
                                    sortConfig={sortConfig}
                                    onSortConfigChange={setSortConfig}
                                />
                        </aside>

                        <section className="relative min-h-0">
                            {/* 批量下载模式：把面板铺满右侧工作区 */}
                            {settings.bulkDownloadMode ? (
                                <BulkDownloadPanel
                                    songs={sortedSongs}
                                    isLoading={isLoadingSongs}
                                    error={errorSongs}
                                    onExit={() => setSettings(prev => ({ ...prev, bulkDownloadMode: false }))}
                                />
                            ) : (
                                <div className="min-h-full flex flex-col gap-6 px-5 sm:px-8 py-6">
                                {/* 曲目标题区：对齐上游的大字号排版 */}
                                <div className="flex flex-col gap-1">
                                    {selectedSong ? (
                                        <>
                                            <span className="font-mono text-[11px] font-medium tracking-[.12em] text-[#22d3ee] break-all select-all" title="歌曲 ID">
                                                {selectedSong.id}
                                            </span>
                                            <h2 className="text-[32px] sm:text-[44px] font-bold leading-[1.15] tracking-[-0.01em] text-white break-words">
                                                {selectedSong.name}
                                            </h2>
                                            <span className="text-base text-slate-400">{selectedSong.composer}</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="font-mono text-[11px] font-medium tracking-[.12em] text-[#22d3ee]">
                                                未选择歌曲
                                            </span>
                                            <h2 className="text-[32px] sm:text-[44px] font-bold leading-[1.15] tracking-[-0.01em] text-white">
                                                选一首歌
                                            </h2>
                                            <span className="text-base text-slate-400">
                                                从左侧列表挑一首，查看它的谱面与文件。
                                            </span>
                                        </>
                                    )}
                                </div>

                                {/* Audio Player - 位于工作区顶部 */}
                                {settings.useNewUi && settings.newUiAudioPreview && (
                                    <div className="flex flex-col items-center justify-center z-20 w-full max-w-lg">
                                        {activeAudio ? (
                                            <AudioPlayerControl 
                                                audio={activeAudio} 
                                                songName={selectedSong?.name}
                                                artist={selectedSong?.composer}
                                            />
                                        ) : (
                                            <div className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-500 text-sm italic backdrop-blur-sm">
                                                选择歌曲以播放其音频。
                                            </div>
                                        )}
                                    </div>
                                )}

                                    <div className="relative z-30 w-full max-w-4xl mx-auto">
                                    <FileTable selectedSong={selectedSong} onFilesFound={handleFilesFound} />
                                    {selectedSong && availableDifficulties.length > 0 && (
                                        <div className="relative mt-6 flex flex-col gap-4">
                                                <DifficultySelector
                                                    difficulties={availableDifficulties}
                                                    selectedDifficulty={selectedDifficulty}
                                                    onSelectDifficulty={setSelectedDifficulty}
                                                    selectedSong={selectedSong}
                                                    highlight={false}
                                                />
                                            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5">
                                                <button
                                                    type="button"
                                                    onClick={handleExportChart}
                                                    disabled={isExporting}
                                                    aria-live="polite"
                                                    className={`export-glow relative overflow-hidden w-full sm:w-auto sm:min-w-[220px] h-[52px] rounded-[10px] bg-[#22d3ee] hover:bg-[#67e8f9] text-[#06141a] flex items-center justify-center gap-2.5 font-bold text-[15px] tracking-[.04em] transition-colors disabled:cursor-not-allowed disabled:bg-[#22d3ee]/40`}
                                                >
                                                    {exportState.type === 'chart' ? (
                                                        <>
                                                            <Spinner />
                                                            <span>导出中...</span>
                                                        </>
                                                    ) : selectedDifficulty ? (
                                                        `导出为谱面（${selectedDifficulty}）`
                                                    ) : (
                                                        '导出全部难度'
                                                    )}
                                                    {exportState.type === 'chart' && (
                                                        <div
                                                            className="absolute bottom-0 left-0 h-[3px] bg-[#06141a]/40 transition-[width] duration-150"
                                                            style={{ width: `${exportState.progress.toFixed(0)}%` }}
                                                        />
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleExportAllAssets}
                                                    disabled={!selectedSong || isExporting || files.length === 0}
                                                    aria-live="polite"
                                                    className="relative overflow-hidden w-full sm:w-auto h-[52px] px-5 rounded-[10px] border border-white/[.12] text-slate-200 flex items-center justify-center gap-2.5 font-semibold text-sm backdrop-blur-sm hover:bg-white/[.04] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {exportState.type === 'phira' ? (
                                                        <>
                                                            <Spinner />
                                                            <span>导出中...</span>
                                                        </>
                                                    ) : exportState.type === 'chart' ? (
                                                        // 另一个导出在跑，说明为什么这个点不了
                                                        '等待中'
                                                    ) : (
                                                        '导出全部资源'
                                                    )}
                                                    {exportState.type === 'phira' && (
                                                        <div
                                                            className="absolute bottom-0 left-0 h-[3px] bg-[rgba(34,211,238,.6)] transition-[width] duration-150"
                                                            style={{ width: `${exportState.progress.toFixed(0)}%` }}
                                                        />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* 谱面分享卡片入口：选中歌曲后即可生成（可在设置里关闭） */}
                                    {selectedSong && settings.shareCardEnabled && (
                                        <div className="mt-5 flex justify-center">
                                            <button
                                                type="button"
                                                onClick={() => setIsShareCardOpen(true)}
                                                className="px-5 py-2.5 font-bold rounded-lg shadow-md transition-colors duration-200 flex items-center justify-center bg-cyan-700 hover:bg-cyan-800 text-white"
                                            >
                                                生成分享卡片
                                            </button>
                                        </div>
                                    )}
                                    </div>
                                </div>
                            )}
                        </section>
                    </main>

                    <footer className="flex-none min-h-10 flex flex-wrap items-center justify-center text-center gap-x-6 gap-y-0.5 px-4 sm:px-6 py-2 border-t border-white/[.1] bg-[#05070a] text-xs text-slate-500">
                        <span>
                            源码见{' '}
                            <a href="https://github.com/swordalt/phigros-chart-downloader/" target="_blank" rel="noreferrer" className="text-[#22d3ee] hover:text-[#67e8f9]">
                                GitHub
                            </a>
                            ，欢迎点个 star。
                        </span>
                        <span className="hidden sm:inline">所有资源版权归各自所有者所有。</span>
                        <span>项目由「sword」创建。| 网站使用 AI 和其他工具优化。</span>
                    </footer>
                </div>
            )}

            {errorDialog && (
                <NoticeDialog
                    tone="error"
                    eyebrow="EXPORT ERROR"
                    title={errorDialog.title}
                    onClose={() => setErrorDialog(null)}
                    actions={
                        <Button variant="danger" onClick={() => setErrorDialog(null)}>
                            知道了
                        </Button>
                    }
                >
                    <ErrorBody message={errorDialog.message} detail={errorDialog.detail} />
                </NoticeDialog>
            )}
        </div>
    );
};

export default App;
