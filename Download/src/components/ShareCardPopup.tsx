import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Song } from '../types';
import { getResourceUrl, ProxySource } from '../utils/resourceUrls';
import { useSettings } from '../contexts/SettingsContext';
import { DialogFrame, DialogHeader, DialogFooter, Button } from './ui/Dialog';
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
async function loadIllustration(songId: string, proxySource: ProxySource): Promise<HTMLImageElement | null> {
    // 先用当前加速源，失败再退回 GitHub 直连。
    // 直连域名稳定返回 CORS 头，能显著提高卡片拿到曲绘的成功率。
    const viaSource = await loadImage(getResourceUrl(proxySource, 'illustration', `${songId}.png`));
    if (viaSource) return viaSource;
    return await loadImage(getResourceUrl('github', 'illustration', `${songId}.png`));
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


        loadIllustration(song.id, settings.proxySource).then(img => {
            if (cancelled || !aliveRef.current) return;
            illuRef.current = img;
            setIlluReady(true); // 失败时为 null，卡片会画占位图
        });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, song?.id, settings.proxySource]);

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
                    const s = await fetchChartStats(song.id, d, settings.proxySource);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [needsChart, song?.id, isOpen, settings.proxySource]);

    /** 下载按钮的反馈状态：null 为常态 */
    const [downloadState, setDownloadState] = useState<'saving' | 'done' | 'failed' | null>(null);
    const [copyState, setCopyState] = useState<'copying' | 'done' | 'failed' | null>(null);

    /** 下载/复制按钮的反馈态：停留一会儿再回到常态，避免状态一闪而过 */
    const flash = <T extends string | null>(
        set: React.Dispatch<React.SetStateAction<T>>,
        v: T | null
    ) => {
        set(v as T);
        if (v !== 'saving') {
            setTimeout(() => {
                if (aliveRef.current) set(null as T);
            }, 1600);
        }
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
        <DialogFrame onClose={onClose} labelledBy="share-card-title" className="w-full max-w-[520px] max-h-[min(88dvh,760px)]">
            <DialogHeader id="share-card-title" eyebrow="Share" title="谱面分享卡片" onClose={onClose} />

                <div className="flex-1 min-h-0 overflow-y-auto thin-scroll px-5 py-4">
                    {/* 主题选择 */}
                    <div className="mb-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-[10px] font-medium tracking-[.14em] text-slate-500">配色</span>
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
                    <div className="relative rounded-xl overflow-hidden bg-[#05070a] border border-white/[.08] shadow-[0_16px_40px_-12px_rgba(0,0,0,.7)]">
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

            <DialogFooter>
                <span className="hidden sm:inline font-mono text-[10px] font-medium tracking-[.1em] text-slate-600">手机上长按图片即可保存</span>
                <div className="flex items-center gap-2.5">
                    <Button variant="outline" onClick={handleCopy} disabled={!canvasRef.current || copyState === 'copying'}>
                        {copyState === 'copying'
                            ? '正在复制…'
                            : copyState === 'done'
                                ? '已复制'
                                : copyState === 'failed'
                                    ? '复制失败'
                                    : '复制图片'}
                    </Button>
                    <Button variant="primary" size="md" onClick={handleDownload} disabled={!canvasRef.current || downloadState === 'saving'}>
                        {downloadState === 'saving'
                            ? '正在下载…'
                            : downloadState === 'done'
                                ? '已保存'
                                : downloadState === 'failed'
                                    ? '下载失败，重试'
                                    : '下载图片'}
                    </Button>
                </div>
            </DialogFooter>
        </DialogFrame>
    );
};
