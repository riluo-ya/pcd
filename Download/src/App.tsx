import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { SongSelector } from './components/SongSelector';
import { SongWorkspace, ExportState } from './components/SongWorkspace';
import { Spinner } from './components/Spinner';
import { BlacklistWarningPopup } from './components/BlacklistWarningPopup';
import { isBlacklisted, BlacklistEntry } from './blacklist';
import { PatchedChartPopup } from './components/PatchedChartPopup';
import { getPatchedChart, PatchedChartEntry } from './patchedCharts';
import FileSaver from 'file-saver';
import { SettingsPopup, SettingsCategory } from './components/SettingsPopup';
import { FAQPopup } from './components/FAQPopup';
import { AboutPopup } from './components/AboutPopup';
import { InstructionPopup } from './components/InstructionPopup';
import { ResourceErrorPopup } from './components/ResourceErrorPopup';
import { Button } from './components/ui/Dialog';
import { useSettings } from './contexts/SettingsContext';
import { resourceFetch } from './utils/githubAuth';
import { useResourceError } from './contexts/ResourceErrorContext';
import { Song, SortConfig } from './types';
import { fetchVersion, fetchSongs, sendPatchedChartDownloadNotification } from './utils/api';
import { registerSongAliasesConsoleHelper } from './utils/songAliasesExport';
import { exportAllAssets, exportChart, exportBulkAssets } from './utils/export';
import { getResourceUrl, hasPerDifficultyIllustrations, getDifficultyIllustrationUrl } from './utils/resourceUrls';
import { useSongFiles, getChartDifficulty } from './hooks/useSongFiles';
import { useIsMobile } from './hooks/useIsMobile';
import { MobileLayout } from './components/mobile/MobileLayout';
// —— 本站自定义功能 ——
import { AudioVisualizer } from './components/AudioVisualizer';
import { getSongEffect } from './song-effects';
import { SongEffectRenderer } from './components/SongEffectRenderer';
import { ShareCardPopup } from './components/ShareCardPopup';
import { SourcePopup } from './components/SourcePopup';
import { BulkDownloadPanel } from './components/BulkDownloadPanel';
import type { FailedFile } from './worker/export.worker';

const REPO_URL = 'https://github.com/swordalt/phigros-chart-downloader/';
const INSTRUCTION_SHOWN_KEY = 'phigrosDownloader_instructionShown';

const App: React.FC = () => {
    const { settings, setSettings } = useSettings();
    const { reportResourceError } = useResourceError();
    const isMobile = useIsMobile();

    useEffect(() => {
        document.documentElement.dataset.blur = settings.newUiBlur ? 'on' : 'off';
    }, [settings.newUiBlur]);
    const [version, setVersion] = useState<string | null>(null);
    const [isLoadingVersion, setIsLoadingVersion] = useState<boolean>(true);
    const [errorVersion, setErrorVersion] = useState<string | null>(null);

    const [songs, setSongs] = useState<Song[]>([]);
    const [isLoadingSongs, setIsLoadingSongs] = useState<boolean>(true);
    const [errorSongs, setErrorSongs] = useState<string | null>(null);
    const [selectedSong, setSelectedSong] = useState<Song | null>(null);
    const [sortConfig, setSortConfig] = useState<SortConfig>({ type: 'alphanumerical', direction: 'asc' });

    // The difficulty the user last picked; carried over to the next song when it has that chart.
    const [preferredDifficulty, setPreferredDifficulty] = useState<string>('IN');
    const [exportState, setExportState] = useState<ExportState>({ type: null, progress: 0 });
    const [blacklistWarning, setBlacklistWarning] = useState<(BlacklistEntry & { exportType: 'phira' | 'chart' }) | null>(null);
    const [patchedChartPrompt, setPatchedChartPrompt] = useState<PatchedChartEntry | null>(null);
    const [showInstruction, setShowInstruction] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isFaqOpen, setIsFaqOpen] = useState(false);
    const [isAboutOpen, setIsAboutOpen] = useState(false);
    const [isSourceOpen, setIsSourceOpen] = useState(false);
    const [isShareCardOpen, setIsShareCardOpen] = useState(false);
    const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>('export');
    const openSettings = (category: SettingsCategory) => {
        setSettingsCategory(category);
        setIsSettingsOpen(true);
    };

    const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
    const toastTimeoutRef = useRef<number | null>(null);
    const showToast = useCallback((text: string) => {
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setToast({ id: Date.now(), text });
        toastTimeoutRef.current = window.setTimeout(() => setToast(null), 2600);
    }, []);

    const abortControllerRef = useRef<AbortController | null>(null);

    // Background and Audio management
    const [bgImage, setBgImage] = useState<string | null>(null);
    const [isBgLoaded, setIsBgLoaded] = useState<boolean>(false);
    const [activeAudio, setActiveAudio] = useState<HTMLAudioElement | null>(null);

    // 当前曲目命中的歌曲特效（可在设置里关闭）
    const activeEffect = settings.newUiSongSpecificEffects && selectedSong
        ? getSongEffect(selectedSong.name)
        : null;

    const initialSongSelected = useRef<boolean>(false);

    const { files, isLoading: isLoadingFiles } = useSongFiles(selectedSong, settings.proxySource);
    const availableDifficulties = React.useMemo(
        () => files.map(getChartDifficulty).filter((diff): diff is string => diff !== null),
        [files]
    );
    const selectedDifficulty = availableDifficulties.length === 0
        ? null
        : availableDifficulties.includes(preferredDifficulty)
            ? preferredDifficulty
            : availableDifficulties[availableDifficulties.length - 1];

    const sortedSongs = React.useMemo(() => {
        const result = [...songs];

        if (sortConfig.type === 'alphanumerical') {
            result.sort((a, b) => a.name.localeCompare(b.name));
        }
        // If 'unsorted', we rely on the original order (which is essentially what songs is)

        if (sortConfig.direction === 'desc') {
            result.reverse();
        }

        return result;
    }, [songs, sortConfig]);

    const loadVersion = useCallback(async () => {
        setIsLoadingVersion(true);
        setErrorVersion(null);
        try {
            const ver = await fetchVersion(settings.proxySource);
            setVersion(ver);
        } catch (err) {
            const message = err instanceof Error ? err.message : '发生未知错误。';
            setErrorVersion(message);
            console.error(err);
            reportResourceError('版本号加载失败。', () => loadVersion(), message);
        } finally {
            setIsLoadingVersion(false);
        }
    }, [settings.proxySource, reportResourceError]);

    const loadSongs = useCallback(async () => {
        setIsLoadingSongs(true);
        setErrorSongs(null);
        try {
            const fetchedSongs = await fetchSongs(settings.proxySource);
            setSongs(fetchedSongs);
        } catch (err) {
            const message = err instanceof Error ? err.message : '获取歌曲列表时发生错误。';
            setErrorSongs(message);
            console.error(err);
            reportResourceError('歌曲列表加载失败。', () => loadSongs(), message);
        } finally {
            setIsLoadingSongs(false);
        }
    }, [settings.proxySource, reportResourceError]);

    useEffect(() => {
        registerSongAliasesConsoleHelper(songs);
    }, [songs]);

    useEffect(() => {
        loadVersion();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings.proxySource]);

    useEffect(() => {
        loadSongs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings.proxySource]);

    useEffect(() => {
        return () => {
            if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        };
    }, []);

    const handleSongSelect = useCallback((song: Song | null) => {
        setSelectedSong(song);
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

    // Illustration behind the workspace. Songs with per-difficulty art follow the selected difficulty.
    const illustrationUrl = selectedSong
        ? hasPerDifficultyIllustrations(selectedSong.id)
            ? getDifficultyIllustrationUrl(settings.proxySource, selectedSong.id, selectedDifficulty && ['EZ', 'HD', 'IN', 'AT'].includes(selectedDifficulty) ? selectedDifficulty : 'AT')
            : getResourceUrl(settings.proxySource, 'illustration', `${selectedSong.id}.png`)
        : null;

    useEffect(() => {
        setIsBgLoaded(false);
        if (!illustrationUrl) {
            setBgImage(null);
            return;
        }

        let cancelled = false;
        const img = new Image();
        img.src = illustrationUrl;
        img.onload = () => {
            if (cancelled) return;
            setBgImage(illustrationUrl);
            setIsBgLoaded(true);
        };
        img.onerror = () => {
            if (cancelled) return;
            setBgImage(null);
            setIsBgLoaded(false);
        };
        return () => {
            cancelled = true;
        };
    }, [illustrationUrl]);

    // Audio preview
    useEffect(() => {
        if (!selectedSong || settings.bulkDownloadMode || !settings.newUiAudioPreview) {
            setActiveAudio(prev => {
                if (prev) prev.pause();
                return null;
            });
            return;
        }

        const audioUrl = getResourceUrl(settings.proxySource, 'music', `${selectedSong.id}.ogg`);
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

        audio.preload = "auto";
        if (settings.newUiAutoplayAudio) {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.warn("浏览器阻止了自动播放，或音频加载失败：", error);
                });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSong, settings.newUiAudioPreview, settings.bulkDownloadMode, settings.proxySource]);

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

    // Stop audio when the audio element is replaced or the app unmounts
    useEffect(() => {
        return () => {
            if (activeAudio) activeAudio.pause();
        };
    }, [activeAudio]);

    const executeAllAssetsExport = async () => {
        if (!selectedSong || files.length === 0 || exportState.type) return;

        setExportState({ type: 'phira', progress: 0 });
        try {
            const fileName = await exportAllAssets(files, selectedSong, settings, (progress) => {
                setExportState(prev => ({ ...prev, progress }));
            });
            showToast(`已导出全部资源 · ${fileName}`);
        } catch (error) {
            console.error("导出全部资源失败： ", error);
            reportResourceError(
                '全部资源导出失败。',
                () => executeAllAssetsExport(),
                error instanceof Error ? error.message : undefined
            );
        } finally {
            setExportState({ type: null, progress: 0 });
        }
    };

    const executeChartExport = async (difficulty?: string | null) => {
        if (!selectedSong || exportState.type) return;
        // difficulty 为 null / undefined 时导出这首歌的全部难度
        const target = difficulty === undefined ? selectedDifficulty : difficulty;

        setExportState({ type: 'chart', progress: 0 });
        try {
            const fileName = await exportChart(files, selectedSong, target, settings, (progress) => {
                setExportState(prev => ({ ...prev, progress }));
            }, target ? undefined : availableDifficulties);
            showToast(`已导出 ${fileName}`);
        } catch (error) {
            console.error("导出谱面失败： ", error);
            reportResourceError(
                '谱面导出失败。',
                () => executeChartExport(target),
                error instanceof Error ? error.message : undefined
            );
        } finally {
            setExportState({ type: null, progress: 0 });
        }
    };

    const handleExportAllAssets = () => {
        if (!selectedSong || exportState.type) return;
        executeAllAssetsExport();
    };

    /** 把这首歌的全部难度各打一个包，再塞进一个压缩包 */
    const handleExportAllDifficulties = () => {
        if (!selectedSong || availableDifficulties.length === 0 || exportState.type) return;
        void executeChartExport(null);
    };

    // Patched chart → known-issue warning → export.
    const proceedChartExport = () => {
        if (!selectedSong || !selectedDifficulty) return;

        const patched = getPatchedChart(selectedSong.id, selectedDifficulty);
        if (patched) {
            setPatchedChartPrompt(patched);
            return;
        }

        startChartExport();
    };

    const handleExportChart = () => {
        if (!selectedSong || !selectedDifficulty || exportState.type) return;

        // The "Before you play" notice is shown once, before the first export.
        if (!localStorage.getItem(INSTRUCTION_SHOWN_KEY)) {
            setShowInstruction(true);
            return;
        }

        proceedChartExport();
    };

    const handleInstructionConfirm = () => {
        localStorage.setItem(INSTRUCTION_SHOWN_KEY, 'true');
        setShowInstruction(false);
        proceedChartExport();
    };

    const startChartExport = () => {
        if (!selectedSong || !selectedDifficulty) return;
        const entry = isBlacklisted(selectedSong.id, selectedDifficulty);
        if (entry) {
            setBlacklistWarning({ ...entry, exportType: 'chart' });
        } else {
            executeChartExport(selectedDifficulty);
        }
    };

    const handlePatchedOriginal = () => {
        setPatchedChartPrompt(null);
        startChartExport();
    };

    const handlePatchedDownload = async () => {
        const patched = patchedChartPrompt;
        setPatchedChartPrompt(null);
        if (!patched || !selectedSong || exportState.type) return;

        setExportState({ type: 'chart', progress: 0 });
        try {
            const response = await resourceFetch(patched.url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            FileSaver.saveAs(blob, patched.fileName);
            sendPatchedChartDownloadNotification(selectedSong.name, patched.difficulty);
            showToast(`已导出 ${patched.fileName}`);
        } catch (error) {
            console.error("下载修复版谱面失败： ", error);
            reportResourceError(
                '修复版谱面下载失败。',
                () => handlePatchedDownload(),
                error instanceof Error ? error.message : undefined
            );
        } finally {
            setExportState({ type: null, progress: 0 });
        }
    };

    // 简易批量导出：上游内置的全量导出，作为 BulkDownloadPanel 不可用时的兜底
    const [bulkExportState, setBulkExportState] = useState<{
        isExporting: boolean;
        currentFile: string;
        action: 'Downloading' | 'Zipping' | 'Waiting' | null;
        songsLeft: number;
        percent: number;
    }>({ isExporting: false, currentFile: '', action: null, songsLeft: 0, percent: 0 });

    const handleSimpleBulkExport = async () => {
        if (bulkExportState.isExporting || songs.length === 0) return;

        setBulkExportState({
            isExporting: true,
            currentFile: '正在开始…',
            action: 'Downloading',
            songsLeft: songs.length,
            percent: 0
        });
        abortControllerRef.current = new AbortController();

        try {
            const failedFiles: FailedFile[] = await exportBulkAssets(
                songs, 0, settings.proxySource,
                (currentFile, action, songsLeft, percent) => {
                    setBulkExportState(prev => ({ ...prev, currentFile, action, songsLeft, percent: percent || 0 }));
                },
                abortControllerRef.current.signal
            );
            showToast(failedFiles.length > 0
                ? `导出完成，${failedFiles.length} 个文件失败`
                : `全部资源已导出（${songs.length} 首）`);
        } catch (error) {
            if (error instanceof Error && error.name !== 'AbortError') {
                console.error("Bulk export failed: ", error);
                reportResourceError('批量导出过程中出错。', () => handleSimpleBulkExport(), error.message);
            }
        } finally {
            setBulkExportState({ isExporting: false, currentFile: '', action: null, songsLeft: 0, percent: 0 });
            abortControllerRef.current = null;
        }
    };

    const cancelBulkExport = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    }, []);

    // Cancel bulk export when exiting bulk download mode
    useEffect(() => {
        if (!settings.bulkDownloadMode) {
            cancelBulkExport();
        }
    }, [settings.bulkDownloadMode, cancelBulkExport]);

    const handleBlacklistConfirm = () => {
        if (!blacklistWarning) return;

        if (blacklistWarning.exportType === 'chart') {
            executeChartExport(selectedDifficulty);
        }
        setBlacklistWarning(null);
    };

    const handleBlacklistCancel = () => {
        setBlacklistWarning(null);
    };

    const handleFileDownloaded = useCallback((fileName: string) => showToast(`已保存 ${fileName}`), [showToast]);

    // 批量下载面板退出：直接关掉模式开关
    const exitBulkMode = useCallback(() => {
        setSettings(prev => ({ ...prev, bulkDownloadMode: false }));
    }, [setSettings]);

    /** 桌面端 / 移动端的批量面板内容 */
    const renderBulkPanel = () => (
        <BulkDownloadPanel
            songs={sortedSongs}
            isLoading={isLoadingSongs}
            error={errorSongs}
            onExit={exitBulkMode}
        />
    );

    return (
        <div className="relative h-dvh flex flex-col antialiased font-saira text-slate-200 bg-[#090b10] overflow-hidden">
            {isSettingsOpen && <SettingsPopup isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} initialCategory={settingsCategory} />}
            {isFaqOpen && <FAQPopup isOpen={isFaqOpen} onClose={() => setIsFaqOpen(false)} />}
            {isAboutOpen && (
                <AboutPopup
                    isOpen={isAboutOpen}
                    onClose={() => setIsAboutOpen(false)}
                    version={version}
                    isLoadingVersion={isLoadingVersion}
                    errorVersion={errorVersion}
                    onRetryVersion={loadVersion}
                />
            )}
            <ResourceErrorPopup onSwitchProxy={() => openSettings('proxy')} />
            <InstructionPopup
                isOpen={showInstruction}
                onConfirm={handleInstructionConfirm}
                onCancel={() => setShowInstruction(false)}
            />
            <ShareCardPopup song={selectedSong} isOpen={isShareCardOpen} onClose={() => setIsShareCardOpen(false)} />
            <SourcePopup isOpen={isSourceOpen} onClose={() => setIsSourceOpen(false)} />
            {patchedChartPrompt && (
                <PatchedChartPopup
                    isOpen={!!patchedChartPrompt}
                    onCancel={() => setPatchedChartPrompt(null)}
                    onDownloadOriginal={handlePatchedOriginal}
                    onDownloadPatched={handlePatchedDownload}
                    reason={patchedChartPrompt.reason}
                    songName={selectedSong?.name}
                    difficulty={patchedChartPrompt.difficulty}
                />
            )}
            {blacklistWarning && (
                <BlacklistWarningPopup
                    isOpen={!!blacklistWarning}
                    onCancel={handleBlacklistCancel}
                    onConfirm={handleBlacklistConfirm}
                    reason={blacklistWarning.reason}
                />
            )}

            {isMobile ? (
                <MobileLayout
                    songs={sortedSongs}
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
                    onSettingsClick={() => openSettings('export')}
                    onSourceClick={() => setIsSourceOpen(true)}
                    bgImage={bgImage}
                    isBgLoaded={isBgLoaded}
                    audio={activeAudio}
                    files={files}
                    isLoadingFiles={isLoadingFiles}
                    difficulties={availableDifficulties}
                    selectedDifficulty={selectedDifficulty}
                    onSelectDifficulty={setPreferredDifficulty}
                    exportState={exportState}
                    onExportChart={handleExportChart}
                    onExportAllAssets={handleExportAllAssets}
                    onExportAllDifficulties={handleExportAllDifficulties}
                    onShareCardClick={() => setIsShareCardOpen(true)}
                    onDownloaded={handleFileDownloaded}
                    bulkPanel={settings.bulkDownloadMode ? renderBulkPanel() : null}
                    toast={toast}
                    effect={activeEffect}
                    songName={selectedSong?.name}
                />
            ) : (
            <div className="relative z-10 flex-1 min-h-0 flex flex-col">
                {/* 频谱可视化：贴在内容之下、背景之上 */}
                {settings.newUiShowVisualizer && activeAudio && !settings.bulkDownloadMode && (
                    <div className="absolute inset-0 z-0 pointer-events-none">
                        <AudioVisualizer
                            audio={activeAudio}
                            color={settings.newUiVisualizerColor}
                            height={settings.newUiVisualizerHeight}
                            opacity={settings.newUiVisualizerOpacity}
                        />
                    </div>
                )}
                {/* 歌曲特效层 */}
                {activeEffect && !settings.bulkDownloadMode && (
                    <SongEffectRenderer effect={activeEffect} audio={activeAudio} songName={selectedSong?.name} />
                )}

                <Header
                    version={version}
                    isLoadingVersion={isLoadingVersion}
                    versionError={errorVersion}
                    onRetryVersion={loadVersion}
                    onSettingsClick={() => openSettings('export')}
                    onFaqClick={() => setIsFaqOpen(true)}
                    onAboutClick={() => setIsAboutOpen(true)}
                    onSourceClick={() => setIsSourceOpen(true)}
                />

                <main className="relative z-10 flex-1 min-h-0 grid grid-rows-[minmax(0,40%)_minmax(0,1fr)] md:grid-rows-1 md:grid-cols-[340px_minmax(0,1fr)]">
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
                        {settings.bulkDownloadMode ? (
                            <div className="absolute inset-0 overflow-y-auto thin-scroll px-4 py-4">
                                {renderBulkPanel()}
                            </div>
                        ) : (
                            <SongWorkspace
                                song={selectedSong}
                                bgImage={bgImage}
                                isBgLoaded={isBgLoaded}
                                audio={activeAudio}
                                files={files}
                                isLoadingFiles={isLoadingFiles}
                                difficulties={availableDifficulties}
                                selectedDifficulty={selectedDifficulty}
                                onSelectDifficulty={setPreferredDifficulty}
                                exportState={exportState}
                                onExportChart={handleExportChart}
                                onExportAllAssets={handleExportAllAssets}
                                onExportAllDifficulties={handleExportAllDifficulties}
                                onShareCardClick={settings.shareCardEnabled ? () => setIsShareCardOpen(true) : undefined}
                                onDownloaded={handleFileDownloaded}
                            />
                        )}

                        {toast && (
                            <div
                                key={toast.id}
                                role="status"
                                className="motion-toast absolute left-1/2 bottom-5 z-30 flex items-center gap-2.5 max-w-[calc(100%-32px)] pl-3 pr-4 py-2.5 rounded-[10px] bg-[rgba(12,15,22,.95)] border border-[rgba(34,211,238,.3)] shadow-[0_20px_50px_rgba(0,0,0,.5)] text-[13px] text-slate-200"
                            >
                                <span className="w-5 h-5 flex-none rounded-full bg-[#22d3ee] flex items-center justify-center">
                                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="#06141a"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                </span>
                                <span className="truncate">{toast.text}</span>
                            </div>
                        )}
                    </section>
                </main>

                <footer className="relative z-10 flex-none min-h-10 flex flex-wrap items-center justify-center text-center gap-x-6 gap-y-0.5 px-4 sm:px-6 py-2 border-t border-white/[.1] bg-[#05070a] text-xs text-slate-500">
                    <span>本站基于 <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-[#22d3ee] hover:text-[#67e8f9]">Phigros Chart Downloader</a> 二次开发，非 Phigros 官方项目。</span>
                    <span className="hidden sm:inline">全部素材版权归各自权利人所有。</span>
                </footer>
            </div>
            )}
        </div>
    );
};

export default App;
