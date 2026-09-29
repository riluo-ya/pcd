import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { VersionCard } from './components/VersionCard';
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
    const [showDifficultyWarning, setShowDifficultyWarning] = useState<boolean>(false);
    /** 「导出为谱面」按钮的即时反馈，null 为常态 */
    const [chartHint, setChartHint] = useState<'need-difficulty' | 'blacklisted' | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isFaqOpen, setIsFaqOpen] = useState(false);
    const [isAboutOpen, setIsAboutOpen] = useState(false);
    const [isSourceOpen, setIsSourceOpen] = useState(false);
    const [isShareCardOpen, setIsShareCardOpen] = useState(false);
    

    // Background and Audio management
    const [bgImage, setBgImage] = useState<string | null>(null);
    const [isBgLoaded, setIsBgLoaded] = useState<boolean>(false);
    const [activeAudio, setActiveAudio] = useState<HTMLAudioElement | null>(null);

    const warningTimeoutRef = useRef<number | null>(null);
    const initialSongSelected = useRef<boolean>(false);
    const hintTimerRef = useRef<number | null>(null);

    /** 短暂显示一段提示再回到常态，避免状态一闪而过看不清 */
    const flash = useCallback(
        (setter: (v: any) => void, value: any, ms = 2000) => {
            setter(value);
            if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
            hintTimerRef.current = window.setTimeout(() => setter(null), ms);
        },
        []
    );

    useEffect(() => () => {
        if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    }, []);

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

    useEffect(() => {
        const loadVersion = async () => {
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
        };
        loadVersion();
    }, []);

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

    useEffect(() => {
        return () => {
            if (warningTimeoutRef.current) {
                clearTimeout(warningTimeoutRef.current);
            }
        };
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
            alert("发生错误。请查看控制台获取更多信息。");
        } finally {
            setExportState({ type: null, progress: 0 });
        }
    };

    const executeChartExport = async () => {
        if (!selectedSong || !selectedDifficulty || exportState.type) return;

        setExportState({ type: 'chart', progress: 0 });
        try {
            await exportChart(files, selectedSong, selectedDifficulty, settings, (progress) => {
                setExportState(prev => ({ ...prev, progress }));
            });
        } catch (error) {
            console.error("Failed to export as chart: ", error);
            alert("发生错误。请查看控制台获取更多信息。");
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

        if (!selectedDifficulty) {
            // 未选难度：按钮自身给出反馈，并高亮难度选择器，比只弹个浮层更容易被注意到
            setShowDifficultyWarning(true);
            flash(setChartHint, 'need-difficulty');
            if (warningTimeoutRef.current) {
                clearTimeout(warningTimeoutRef.current);
            }
            warningTimeoutRef.current = window.setTimeout(() => {
                setShowDifficultyWarning(false);
            }, 3000);
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
        <div className="relative min-h-screen antialiased font-saira overflow-x-hidden text-slate-200">
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
            <div className={`relative z-10 flex flex-col min-h-screen ${activeEffect === 'glitch' ? 'effect-glitch-active' : ''} ${activeEffect === 'cracking' ? 'effect-cracking-active' : ''}`}>
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

                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow">
                    <Header 
                        onSettingsClick={() => setIsSettingsOpen(true)} 
                        onFaqClick={() => setIsFaqOpen(true)}
                        onAboutClick={() => setIsAboutOpen(true)}
                        onSourceClick={() => setIsSourceOpen(true)}
                    />

                    {!settings.bulkDownloadMode && (
                        <div className="mt-8 flex flex-col items-center gap-6 animate-fade-in">
                            <VersionCard isLoading={isLoadingVersion} error={errorVersion} version={version} />
                        </div>
                    )}

                    <main className="mt-8">
                        {settings.bulkDownloadMode ? (
                            <BulkDownloadPanel
                                songs={sortedSongs}
                                isLoading={isLoadingSongs}
                                error={errorSongs}
                                onExit={() => setSettings(prev => ({ ...prev, bulkDownloadMode: false }))}
                            />
                        ) : (
                            <div className="flex flex-col items-center gap-8 animate-fade-in">
                               
                               <SongSelector 
                                isLoading={isLoadingSongs}
                                error={errorSongs}
                                songs={sortedSongs}
                                selectedSong={selectedSong}
                                onSongSelect={handleSongSelect}
                                sortConfig={sortConfig}
                                onSortConfigChange={setSortConfig}
                           />

                            {/* Audio Player - Now below SongSelector, hidden if New UI or Audio Preview is off */}
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

                           <div className="relative z-30 mt-4 w-full max-w-4xl">
                                <FileTable selectedSong={selectedSong} onFilesFound={handleFilesFound} />
                                {selectedSong && availableDifficulties.length > 0 && (
                                    <div className="relative mt-6">
                                        {showDifficultyWarning && (
                                            <div
                                                role="alert"
                                                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max whitespace-nowrap px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-md shadow-lg z-10"
                                            >
                                                请先选择难度！
                                            </div>
                                        )}
                                        <div className="flex justify-center items-center flex-wrap gap-4">
                                            <DifficultySelector
                                                difficulties={availableDifficulties}
                                                selectedDifficulty={selectedDifficulty}
                                                onSelectDifficulty={setSelectedDifficulty}
                                                selectedSong={selectedSong}
                                                highlight={showDifficultyWarning}
                                            />
                                            <button
                                                type="button"
                                                onClick={handleExportChart}
                                                disabled={isExporting}
                                                aria-live="polite"
                                                className={`relative overflow-hidden px-6 py-2 font-bold rounded-lg shadow-md transition-colors duration-200 flex items-center justify-center gap-2 min-w-[190px] ${
                                                    chartHint === 'need-difficulty'
                                                        ? 'motion-shake bg-amber-600 text-white'
                                                        : exportState.type === 'chart'
                                                            ? 'bg-purple-800 text-white'
                                                            : isExporting
                                                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                                                : !selectedDifficulty
                                                                    ? 'bg-purple-800/60 hover:bg-purple-800 text-white'
                                                                    : 'bg-purple-800 hover:bg-purple-900 text-white'
                                                }`}
                                            >
                                                {exportState.type === 'chart' ? (
                                                    <>
                                                        <Spinner />
                                                        <span>导出中...</span>
                                                    </>
                                                ) : chartHint === 'need-difficulty' ? (
                                                    '请先选择难度'
                                                ) : (
                                                    '导出为谱面'
                                                )}
                                                {exportState.type === 'chart' && (
                                                    <div 
                                                        className="absolute bottom-0 left-0 h-0.5 bg-brand-cyan/75 transition-all duration-150"
                                                        style={{ width: `${exportState.progress.toFixed(0)}%` }}
                                                    />
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleExportAllAssets}
                                                disabled={!selectedSong || isExporting || files.length === 0}
                                                aria-live="polite"
                                                className={`relative overflow-hidden px-6 py-2 font-bold rounded-lg shadow-md transition-colors duration-200 flex items-center justify-center gap-2 min-w-[190px] ${
                                                    exportState.type === 'phira'
                                                        ? 'bg-indigo-700 text-white'
                                                        : !selectedSong || isExporting || files.length === 0
                                                            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                                            : 'bg-indigo-700 hover:bg-indigo-800 text-white'
                                                }`}
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
                                                        className="absolute bottom-0 left-0 h-0.5 bg-brand-cyan/75 transition-all duration-150"
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
                    </main>
                </div>
                
                {!settings.bulkDownloadMode && (
                    <footer 
                        className={`w-full mt-16 transition-all duration-300 flex justify-center animate-fade-in ${
                            settings.useNewUi 
                                ? 'pb-10' 
                                : 'py-8 text-slate-500 border-t border-transparent'
                        }`}
                    >
                        <div className={`
                            text-center text-sm transition-all duration-300
                            ${settings.useNewUi 
                                ? 'bg-slate-950/50 backdrop-blur-md border border-white/10 rounded-3xl text-slate-200 shadow-2xl px-8 py-4 mx-4' 
                                : 'container mx-auto px-4 sm:px-6 lg:px-8'
                            }
                        `}>
                            <p>
                                有关此项目的更多信息，请查看 <a href="https://github.com/swordalt/phigros-chart-downloader/" className={`transition-colors duration-200 ${settings.useNewUi ? 'text-brand-cyan hover:text-cyan-300' : 'hover:text-slate-400 underline decoration-slate-600'}`}>https://github.com/swordalt/phigros-chart-downloader/</a>。
                            </p>
                            <p className="mt-2">
                                项目由「sword」创建。| 网站使用 AI 和其他工具优化。
                            </p>
                        </div>
                    </footer>
                )}
            </div>
        </div>
    );
};

export default App;
