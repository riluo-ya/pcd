import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Song } from '../types';
import { ghRaw } from '../utils/sources';
import { useSettings } from '../contexts/SettingsContext';
import { ChartStats, fetchChartStats, primaryDifficulty } from '../utils/chartStats';
import {
    CARD_THEMES,
    CardThemeId,
    renderShareCard,
    downloadCanvas,
    copyCanvas,
    cardFileName,
    levelOf,
} from '../utils/shareCard';

interface ShareCardPopupProps {
    song: Song | null;
    isOpen: boolean;
    onClose: () => void;
}

const DIFFS = ['EZ', 'HD', 'IN', 'AT'] as const;

/** 尝试加载一张跨域图片，成功返回 Image，失败返回 null */
function loadImage(url: string): Promise<HTMLImageElement | null> {
    return new Promise(resolve => {
        const img = new Image();
        // 必须在 src 之前设置，否则跨域图会污染画布导致无法导出
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

/**
 * 加载曲绘：先用当前加速源，失败再退回 GitHub 直连。
 * 直连域名稳定返回 CORS 头，能显著提高卡片拿到曲绘的成功率；
 * 两次都失败时返回 null，卡片会画占位图，不影响生成。
 */
async function loadIllustration(songId: string): Promise<HTMLImageElement | null> {
    const path = `7aGiven/Phigros_Resource/refs/heads/illustration/${songId}.png`;
    const viaSource = await loadImage(ghRaw(path));
    if (viaSource) return viaSource;
    return await loadImage(`https://raw.githubusercontent.com/${path}`);
}

export const ShareCardPopup: React.FC<ShareCardPopupProps> = ({ song, isOpen, onClose }) => {
    const { settings } = useSettings();
    const [themeId, setThemeId] = useState<CardThemeId>('midnight');
    const [dataUrl, setDataUrl] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'building' | 'ready'>('idle');
    const [illuReady, setIlluReady] = useState(false);
    const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});
    const [chartInfo, setChartInfo] = useState<{ bpm: number | null; judgeLines: number | null; duration: number | null }>({
        bpm: null,
        judgeLines: null,
        duration: null,
    });
    const [loadingNotes, setLoadingNotes] = useState(false);


    // 只要有一项谱面数据被开启，就需要下载谱面文件解析
    const needsChart =
        settings.shareCardBpm ||
        settings.shareCardJudgeLines ||
        settings.shareCardDuration ||
        settings.shareCardNoteCounts;

    // 只把设置里开启的项交给卡片渲染
    const visibleChartInfo = {
        bpm: settings.shareCardBpm ? chartInfo.bpm : null,
        judgeLines: settings.shareCardJudgeLines ? chartInfo.judgeLines : null,
        duration: settings.shareCardDuration ? chartInfo.duration : null,
    };

    const illuRef = useRef<HTMLImageElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const aliveRef = useRef(true);

    useEffect(() => {
        aliveRef.current = true;
        return () => {
            aliveRef.current = false;
        };
    }, []);

    // 打开时加载曲绘（跨域匿名，避免污染 canvas 导致无法导出）
    useEffect(() => {
        if (!isOpen || !song) return;
        let cancelled = false;
        setStatus('building');
        setIlluReady(false);
        setDataUrl(null);
        setNoteCounts({});
        setChartInfo({ bpm: null, judgeLines: null, duration: null });


        loadIllustration(song.id).then(img => {
            if (cancelled || !aliveRef.current) return;
            illuRef.current = img;
            setIlluReady(true); // 失败时为 null，卡片会画占位图
        });

        return () => {
            cancelled = true;
        };
    }, [isOpen, song?.id]);

    // 生成卡片
    const build = useCallback(() => {
        if (!song || !illuReady) return;
        setStatus('building');
        try {
            const theme = CARD_THEMES.find(t => t.id === themeId) || CARD_THEMES[0];
            const canvas = renderShareCard({
                song,
                illustration: illuRef.current,
                theme,
                noteCounts: settings.shareCardNoteCounts ? noteCounts : undefined,
                chartInfo: visibleChartInfo,
                qrText: `https://pcd.bot.cd/?song=${encodeURIComponent(song.id)}`,
            });
            canvasRef.current = canvas;
            setDataUrl(canvas.toDataURL('image/png'));
            setStatus('ready');
        } catch (err) {
            console.error('[shareCard] 生成失败', err);
            setStatus('idle');
        }
    }, [song, illuReady, themeId, noteCounts, chartInfo, settings.shareCardNoteCounts, visibleChartInfo.bpm, visibleChartInfo.judgeLines, visibleChartInfo.duration]);

    useEffect(() => {
        build();
    }, [build]);

    // 勾选后异步拉取：各难度物量 + 曲目级 BPM / 判定线 / 时长
    useEffect(() => {
        if (!needsChart || !song || !isOpen) return;
        let cancelled = false;
        setLoadingNotes(true);
        (async () => {
            const result: Record<string, number> = {};
            const targets = DIFFS.filter(d => levelOf(song, d) !== null);
            const statsByDiff: Record<string, ChartStats> = {};

            await Promise.all(
                targets.map(async d => {
                    const s = await fetchChartStats(song.id, d);
                    if (!s) return;
                    result[d] = s.notes;
                    statsByDiff[d] = s;
                })
            );

            // BPM / 判定线 / 时长属于曲目级信息，优先取最高难度那份
            const highest = primaryDifficulty(song) || [...DIFFS].reverse().find(d => statsByDiff[d]);
            const s = highest ? statsByDiff[highest] : null;

            if (!cancelled && aliveRef.current) {
                setNoteCounts(result);
                setChartInfo({
                    bpm: s?.bpm ?? null,
                    judgeLines: s?.judgeLines ?? null,
                    duration: s?.duration ?? null,
                });
                setLoadingNotes(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [needsChart, song?.id, isOpen]);

    /** 下载按钮的反馈状态：null 为常态 */
    const [downloadState, setDownloadState] = useState<'saving' | 'done' | 'failed' | null>(null);
    const [copyState, setCopyState] = useState<'copying' | 'done' | 'failed' | null>(null);

    const flash = (
        set: (v: 'saving' | 'done' | 'failed' | null) => void,
        v: 'saving' | 'done' | 'failed' | null
    ) => {
        set(v);
        if (v === 'saving') return;
        // 成功/失败提示停留一会儿再回到常态，避免状态一闪而过
        setTimeout(() => {
            if (aliveRef.current) set(null);
        }, 1600);
    };

    const handleDownload = async () => {
        if (!canvasRef.current || !song || downloadState === 'saving') return;
        setDownloadState('saving');
        try {
            await downloadCanvas(canvasRef.current, cardFileName(song));
            flash(setDownloadState, 'done');
        } catch (err) {
            console.error('[shareCard] 下载失败', err);
            flash(setDownloadState, 'failed');
        }
    };

    const handleCopy = async () => {
        if (!canvasRef.current || copyState === 'copying') return;
        setCopyState('copying');
        const ok = await copyCanvas(canvasRef.current);
        flash(setCopyState, ok ? 'done' : 'failed');
        if (!ok) {
            // 复制被拒时给出可手动操作的提示
            window.alert('当前浏览器不支持直接复制图片。\n你可以长按预览图保存，或点「下载图片」。');
        }
    };

    if (!isOpen || !song) return null;

    return (
        <div
            className="motion-backdrop fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-card-title"
            onClick={onClose}
        >
            <div
                className="motion-dialog relative w-full max-w-lg mx-auto overflow-hidden rounded-xl border border-slate-700 shadow-2xl flex flex-col max-h-[88vh] bg-slate-900/90 backdrop-blur-md"
                onClick={e => e.stopPropagation()}
            >
                {/* 标题 */}
                <div className="h-1 w-full bg-gradient-to-r from-brand-cyan/80 via-brand-cyan/25 to-transparent flex-shrink-0" />
                <div className="px-5 pt-5 pb-3 border-b border-slate-700/50 flex-shrink-0">
                    <h2 id="share-card-title" className="text-xl font-bold text-brand-cyan">
                        谱面分享卡片
                    </h2>
                    <p className="text-slate-400 text-xs mt-1">
                        生成一张可分享的图片，含曲绘、定数、谱师与二维码
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4">
                    {/* 主题选择 */}
                    <div className="mb-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-slate-400">配色</span>
                            <span className="text-[11px] text-slate-500">
                                {CARD_THEMES.length} 套 · 当前：
                                {CARD_THEMES.find(t => t.id === themeId)?.name}
                            </span>
                        </div>
                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                            {CARD_THEMES.map(t => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setThemeId(t.id)}
                                    className={`px-2 py-1.5 text-xs rounded-lg border transition-colors flex items-center justify-center gap-1.5 ${
                                        themeId === t.id
                                            ? 'border-brand-cyan text-brand-cyan bg-brand-cyan/10'
                                            : 'border-slate-600 text-slate-300 hover:border-slate-500'
                                    }`}
                                >
                                    <span
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                        style={{ background: t.accent }}
                                    />
                                    {t.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 预览 */}
                    <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-700/80 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)] ring-1 ring-white/5">
                        {dataUrl ? (
                            <img
                                src={dataUrl}
                                alt="分享卡片预览"
                                className="w-full h-auto block"
                                style={{ opacity: status === 'building' ? 0.5 : 1, transition: 'opacity .2s' }}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
                                正在生成卡片…
                            </div>
                        )}
                        {loadingNotes && (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-xs text-brand-cyan">
                                正在读取谱面…
                            </div>
                        )}
                    </div>

                    <p className="text-xs text-slate-500 mt-2 text-center">
                        💡 手机上长按图片即可保存到相册
                    </p>
                </div>

                {/* 底部按钮 */}
                <div className="px-5 py-4 border-t border-slate-700/50 flex flex-wrap gap-2 flex-shrink-0">
                    <button
                        type="button"
                        onClick={handleDownload}
                        disabled={!canvasRef.current || downloadState === 'saving'}
                        aria-live="polite"
                        className="flex-1 min-w-[120px] px-4 py-2.5 font-bold rounded-lg shadow-md transition-colors flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-400 to-brand-cyan hover:from-cyan-300 hover:to-cyan-400 text-slate-900 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {downloadState === 'saving' && (
                            <span
                                aria-hidden="true"
                                className="inline-block w-3.5 h-3.5 rounded-full border-2 border-slate-900/30 border-t-slate-900 animate-spin"
                            />
                        )}
                        {downloadState === 'saving'
                            ? '正在下载…'
                            : downloadState === 'done'
                                ? '已保存到下载'
                                : downloadState === 'failed'
                                    ? '下载失败，重试'
                                    : '下载图片'}
                    </button>
                    <button
                        type="button"
                        onClick={handleCopy}
                        disabled={!canvasRef.current || copyState === 'copying'}
                        aria-live="polite"
                        className="px-4 py-2.5 font-semibold rounded-lg shadow-md transition-colors bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {copyState === 'copying'
                            ? '正在复制…'
                            : copyState === 'done'
                                ? '已复制'
                                : copyState === 'failed'
                                    ? '复制失败'
                                    : '复制图片'}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 font-semibold rounded-lg shadow-md transition-colors bg-slate-700 hover:bg-slate-600 text-slate-200"
                    >
                        关闭
                    </button>
                </div>
            </div>
        </div>
    );
};
